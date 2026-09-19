import { describe, it, expect } from 'vitest';
import {
  analyseSet,
  estimateRir,
  metersPerPixel,
  MIN_USABLE_FPS,
  rescaleToMilliseconds,
  PLATE_DIAMETER_M,
  sampleRate,
  type BarSample,
} from './bar-velocity';

/**
 * Spike VBT-01 — la moitié « calcul » de la chaîne, mise à l'épreuve sans caméra.
 *
 * Ces tests sont la **pré-validation du critère de sortie « écart ≤ 0,05 m/s »** : on fabrique des
 * trajectoires dont on connaît la vitesse exacte, on les échantillonne comme le ferait une caméra
 * (60 i/s, tremblement de quelques pixels, images perdues), et on vérifie que le moteur les
 * retrouve. Ce qui reste à prouver sur device après ça, c'est **le suivi du point** — pas le calcul.
 *
 * Le repère est celui de l'image : `y` descend, donc une barre qui monte fait **baisser** `y`.
 */

/** Un disque de 45 cm mesuré 300 px à l'écran : l'étalon de toute la scène. */
const MPP = PLATE_DIAMETER_M / 300;

/** Hauteur de référence (m) qui garde les `y` positifs, comme sur une vraie image. */
const H0 = 2;

type TraceOptions = {
  fps?: number;
  rangeM?: number;
  /** Amplitude du tremblement de suivi, en pixels (±). */
  noisePx?: number;
  /** Bruit déterministe : même graine ⇒ même trace, sinon un test rouge n'est pas reproductible. */
  seed?: number;
};

/**
 * Fabrique une série : pour chaque vitesse demandée, une descente, une pause, puis une montée dont
 * la **vitesse moyenne concentrique vaut exactement** la valeur donnée.
 *
 * La montée suit un profil en cloche (demi-sinusoïde) et non un palier : c'est la forme réelle d'une
 * répétition, et c'est aussi le cas le plus dur pour la détection — la vitesse y passe par zéro aux
 * deux bouts, donc pile sous le seuil qui sert à repérer la montée.
 */
function buildTrace(meanVelocities: readonly number[], options: TraceOptions = {}): BarSample[] {
  const fps = options.fps ?? 60;
  const rangeM = options.rangeM ?? 0.6;
  const noisePx = options.noisePx ?? 0;
  const dt = 1 / fps;

  let seed = options.seed ?? 42;
  const jitter = () => {
    if (noisePx === 0) return 0;
    // Générateur congruentiel minuscule : reproductible, suffisant pour secouer une trajectoire.
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return ((seed / 2147483648) * 2 - 1) * noisePx;
  };

  const samples: BarSample[] = [];
  let t = 0;
  const push = (h: number) => {
    samples.push({ t: Math.round(t * 1000), y: (H0 - h) / MPP + jitter() });
    t += dt;
  };

  const hold = (seconds: number, h: number) => {
    for (let s = 0; s < seconds; s += dt) push(h);
  };

  for (const meanV of meanVelocities) {
    // Descente à vitesse constante : la phase excentrique n'est pas mesurée, elle sépare les reps.
    const downS = rangeM / 0.4;
    for (let s = 0; s < downS; s += dt) push(rangeM * (1 - s / downS));
    hold(0.3, 0);

    // Montée : v(s) = vmax·sin(π·s/T) avec vmax = π/2·meanV ⇒ amplitude = rangeM en T = rangeM/meanV.
    const upS = rangeM / meanV;
    for (let s = 0; s < upS; s += dt) {
      push((rangeM / 2) * (1 - Math.cos((Math.PI * s) / upS)));
    }
    hold(0.6, rangeM);
  }

  return samples;
}

/** Remplace par `null` les échantillons dont l'instant tombe dans une des fenêtres données (ms). */
function loseFrames(samples: BarSample[], windows: ReadonlyArray<[number, number]>): BarSample[] {
  return samples.map((sample) =>
    windows.some(([from, to]) => sample.t >= from && sample.t <= to)
      ? { t: sample.t, y: null }
      : sample,
  );
}

const analyse = (samples: readonly BarSample[], lossThresholdPct?: number) =>
  analyseSet(samples, { metersPerPixel: MPP, lossThresholdPct });

describe('metersPerPixel (l’étalon de la scène)', () => {
  it('convertit le diamètre du disque en échelle', () => {
    expect(metersPerPixel(300)).toBeCloseTo(0.0015, 6);
  });

  it('accepte un disque non standard, puisque c’est là que se joue l’erreur', () => {
    // Un disque de 35 cm pris pour un 45 fausserait chaque vitesse de 29 % sans rien signaler.
    expect(metersPerPixel(300, 0.35)).toBeCloseTo(0.35 / 300, 6);
  });

  it('🔴 refuse une mesure absurde plutôt que de rendre une échelle infinie', () => {
    expect(metersPerPixel(0)).toBeNull();
    expect(metersPerPixel(-10)).toBeNull();
    expect(metersPerPixel(300, 0)).toBeNull();
  });
});

describe('sampleRate', () => {
  it('retrouve la cadence de la caméra', () => {
    // Tolérance assumée : les instants sont des millisecondes entières, donc 60 i/s se lit comme
    // une alternance 16/17 ms. Exiger 60,0 pile testerait l'arrondi, pas la mesure.
    expect(sampleRate(buildTrace([0.5]))).toBeGreaterThan(55);
    expect(sampleRate(buildTrace([0.5]))).toBeLessThan(63);
    expect(sampleRate(buildTrace([0.5], { fps: 30 }))).toBeGreaterThan(29);
    expect(sampleRate(buildTrace([0.5], { fps: 30 }))).toBeLessThan(31);
  });

  it('null sous deux échantillons', () => {
    expect(sampleRate([])).toBeNull();
    expect(sampleRate([{ t: 0, y: 100 }])).toBeNull();
  });
});

describe('détection des répétitions', () => {
  it('compte exactement les répétitions filmées', () => {
    const { reps } = analyse(buildTrace([0.62, 0.58, 0.55, 0.5, 0.41]));
    expect(reps).toHaveLength(5);
    expect(reps.map((r) => r.index)).toEqual([1, 2, 3, 4, 5]);
  });

  it('🔴 retrouve chaque vitesse moyenne à mieux que 0,05 m/s — le critère de sortie du spike', () => {
    const attendues = [0.62, 0.58, 0.55, 0.5, 0.41];
    const { reps } = analyse(buildTrace(attendues));

    reps.forEach((rep, i) => {
      expect(Math.abs(rep.meanVelocity - attendues[i]!)).toBeLessThanOrEqual(0.05);
    });
  });

  it('tient le même écart avec un suivi qui tremble de ±3 px', () => {
    const attendues = [0.6, 0.45];
    const { reps } = analyse(buildTrace(attendues, { noisePx: 3 }));

    expect(reps).toHaveLength(2);
    reps.forEach((rep, i) => {
      expect(Math.abs(rep.meanVelocity - attendues[i]!)).toBeLessThanOrEqual(0.05);
    });
  });

  it('la vitesse de pointe dépasse la moyenne sans la dépasser absurdement', () => {
    const rep = analyse(buildTrace([0.5])).reps[0]!;
    // Profil en cloche : le pic vaut π/2 ≈ 1,57 fois la moyenne. On vérifie l'ordre de grandeur,
    // pas la décimale — c'est le lissage qui rabote le sommet, et c'est voulu.
    expect(rep.peakVelocity).toBeGreaterThan(rep.meanVelocity);
    expect(rep.peakVelocity).toBeLessThan(rep.meanVelocity * 2);
  });

  it('🔴 un ajustement de barre de 5 cm n’est PAS une répétition', () => {
    const { reps } = analyse(buildTrace([0.5], { rangeM: 0.05 }));
    expect(reps).toHaveLength(0);
  });
});

describe('le point de blocage (le piège de la rep la plus intéressante)', () => {
  it('🔴 une montée qui cale au milieu reste UNE répétition', () => {
    // Trace fabriquée à la main : montée, arrêt net de 100 ms à mi-course, fin de montée.
    const dt = 1 / 60;
    const samples: BarSample[] = [];
    let t = 0;
    const push = (h: number) => {
      samples.push({ t: Math.round(t * 1000), y: (H0 - h) / MPP });
      t += dt;
    };

    for (let s = 0; s < 0.3; s += dt) push(0);
    for (let s = 0; s < 0.6; s += dt) push((s / 0.6) * 0.3); // 0 → 0,30 m
    for (let s = 0; s < 0.1; s += dt) push(0.3); // le blocage
    for (let s = 0; s < 0.6; s += dt) push(0.3 + (s / 0.6) * 0.3); // 0,30 → 0,60 m
    for (let s = 0; s < 0.5; s += dt) push(0.6);

    const { reps } = analyse(samples);

    // Deux reps ici, ce serait deux vitesses surestimées à la place de la vraie, très lente.
    expect(reps).toHaveLength(1);
    expect(reps[0]!.rangeM).toBeGreaterThan(0.5);
    expect(reps[0]!.meanVelocity).toBeLessThan(0.55);
  });
});

describe('les trous de suivi (le mode d’échec principal en salle)', () => {
  it('comble un trou court sans perdre la répétition, et le DIT', () => {
    // La montée commence à 1,8 s (descente de 0,6 m à 0,4 m/s = 1,5 s, puis 0,3 s de pause) et dure
    // 1,2 s à 0,5 m/s : on perd 5 images en plein milieu, soit ~80 ms — sous le seuil de comblement.
    const complet = buildTrace([0.5]);
    const { reps } = analyse(loseFrames(complet, [[2200, 2280]]));

    expect(reps).toHaveLength(1);
    expect(reps[0]!.interpolated).toBe(true);
  });

  it('🔴 coupe la trace sur un trou long au lieu d’inventer une trajectoire', () => {
    const complet = buildTrace([0.55, 0.55]);
    const milieu = complet[Math.floor(complet.length / 2)]!.t;
    const { quality } = analyse(loseFrames(complet, [[milieu, milieu + 1000]]));

    expect(quality.breaks).toBe(1);
    expect(quality.lostFrames).toBeGreaterThan(30);
  });
});

describe('qualité de la trace — refuser avant d’afficher', () => {
  it('une trace propre à 60 i/s est exploitable', () => {
    const { quality } = analyse(buildTrace([0.5, 0.5]));
    expect(quality.fps).toBeGreaterThanOrEqual(MIN_USABLE_FPS);
    expect(quality.usable).toBe(true);
  });

  it('🔴 une cadence de 15 i/s est refusée, même si les vitesses ont l’air crédibles', () => {
    const { quality, reps } = analyse(buildTrace([0.5, 0.5], { fps: 15 }));
    expect(quality.usable).toBe(false);
    // Le calcul rend quand même quelque chose : c'est bien pour ça qu'il faut un verdict séparé.
    expect(reps.length).toBeGreaterThan(0);
  });

  it('🔴 plus de 10 % d’images perdues : refusé', () => {
    const complet = buildTrace([0.5, 0.5]);
    const debut = complet[10]!.t;
    const { quality } = analyse(loseFrames(complet, [[debut, debut + 900]]));

    expect(quality.lostRatio).toBeGreaterThan(0.1);
    expect(quality.usable).toBe(false);
  });
});

describe('perte de vitesse et signal d’arrêt', () => {
  it('mesure la perte de la dernière rep par rapport à la meilleure', () => {
    const { bestMeanVelocity, velocityLossPct } = analyse(buildTrace([0.62, 0.55, 0.41]));

    expect(bestMeanVelocity).not.toBeNull();
    // 0,41 contre 0,62 ≈ −34 %, la valeur de la maquette.
    expect(velocityLossPct).toBeGreaterThan(28);
    expect(velocityLossPct).toBeLessThan(40);
  });

  it('déclenche l’arrêt au seuil, et pas avant', () => {
    expect(analyse(buildTrace([0.62, 0.58])).stop).toBe(false);
    expect(analyse(buildTrace([0.62, 0.41])).stop).toBe(true);
  });

  it('le seuil est réglable : 10 % pour la force, 20 % par défaut', () => {
    const trace = buildTrace([0.62, 0.52]);
    expect(analyse(trace).stop).toBe(false);
    expect(analyse(trace, 10).stop).toBe(true);
  });

  it('🔴 aucune perte annonçable sur une seule répétition', () => {
    const { velocityLossPct, stop } = analyse(buildTrace([0.5]));
    expect(velocityLossPct).toBeNull();
    expect(stop).toBe(false);
  });

  it('série vide : rien, et surtout aucun zéro trompeur', () => {
    const vide = analyse([]);
    expect(vide.reps).toEqual([]);
    expect(vide.bestMeanVelocity).toBeNull();
    expect(vide.velocityLossPct).toBeNull();
    expect(vide.quality.usable).toBe(false);
  });
});

describe('estimateRir — ce que le moteur refuse de deviner', () => {
  const profil = { exerciseId: 'squat', mvt: 0.3, velocityPerRir: 0.08 };

  it('🔴 null sans profil mesuré : un RIR inventé serait pire qu’un RIR absent', () => {
    expect(estimateRir(0.41, null)).toBeNull();
  });

  it('estime avec un profil mesuré', () => {
    // 0,41 m/s, échec à 0,30, 0,08 m/s par rep en réserve ⇒ ≈ 1,4 rep.
    expect(estimateRir(0.41, profil)).toBeCloseTo(1.4, 1);
  });

  it('jamais négatif : sous sa vitesse d’échec, on est à l’échec', () => {
    expect(estimateRir(0.2, profil)).toBe(0);
  });

  it('refuse un profil inutilisable plutôt que de diviser par zéro', () => {
    expect(estimateRir(0.41, { ...profil, velocityPerRir: 0 })).toBeNull();
    expect(estimateRir(0, profil)).toBeNull();
  });
});

describe('🔴 ce que le spike prouve vraiment : la DÉCISION est plus juste que l’affichage', () => {
  /*
   * Résultat central du spike, mesuré au banc (rapport §4) : la vitesse absolue d'une répétition
   * porte 0,02 à 0,08 m/s d'erreur selon la cadence et l'amplitude, mais la PERTE de vitesse — le
   * rapport entre deux répétitions de la même série — tombe à ±2 points dans toutes les conditions,
   * parce que les biais de mesure sont les mêmes d'une rep à l'autre et se simplifient.
   *
   * C'est ce qui décide du produit : le signal d'arrêt est fiable avant que le chiffre affiché le
   * soit. Si ce test se met à échouer, la promesse « seuil −20 % » ne tient plus.
   *
   * ⚠️ Chaque condition est jouée avec TROIS tirages de bruit différents. Avec un seul, le test
   * mesurerait la chance : le premier jet donnait 1,6 point d'écart sur le développé couché à
   * 30 i/s, un autre en donne 4,5. La borne annoncée (5 points) est celle du pire tirage, pas du
   * plus flatteur.
   */
  const serie = [0.62, 0.6, 0.55, 0.48, 0.41];
  const PERTE_REELLE = ((0.62 - 0.41) / 0.62) * 100;

  const conditions: ReadonlyArray<[string, TraceOptions]> = [
    ['squat, 60 i/s', { fps: 60 }],
    ['squat, 60 i/s, ±3 px', { fps: 60, noisePx: 3 }],
    ['squat, 30 i/s, ±3 px', { fps: 30, noisePx: 3 }],
    ['développé couché (0,25 m), 60 i/s, ±3 px', { rangeM: 0.25, noisePx: 3 }],
    ['développé couché (0,25 m), 30 i/s, ±3 px', { rangeM: 0.25, fps: 30, noisePx: 3 }],
  ];

  it.each(conditions)('perte juste à ±5 points — %s', (_nom, options) => {
    for (const seed of [7, 42, 1789]) {
      const { reps, velocityLossPct, stop } = analyse(buildTrace(serie, { ...options, seed }));

      expect(reps).toHaveLength(serie.length);
      expect(velocityLossPct).not.toBeNull();
      expect(Math.abs((velocityLossPct as number) - PERTE_REELLE)).toBeLessThanOrEqual(5);
      // 34 % de perte : le seuil de 20 % est franchi, quelle que soit la condition de prise de vue.
      expect(stop).toBe(true);
    }
  });
});

describe('bornes de répétition — le seuil relatif à la pointe', () => {
  it('🔴 une pause immobile avant la poussée n’est PAS comptée dans la montée', () => {
    // Le piège du seuil absolu : le tremblement du suivi pendant la pause ressemble à un mouvement,
    // et la durée de la rep s'allonge — donc sa vitesse baisse sans que l'athlète y soit pour rien.
    const { reps } = analyse(buildTrace([0.5], { noisePx: 3 }));

    expect(reps).toHaveLength(1);
    // Montée de 0,60 m à 0,50 m/s ⇒ 1,20 s. Une pause avalée se verrait immédiatement ici.
    expect(reps[0]!.durationS).toBeLessThan(1.4);
    expect(reps[0]!.durationS).toBeGreaterThan(1.0);
  });

  it('les deux bouts lents d’une rep d’échec sont gardés', () => {
    // À 0,22 m/s, le début et la fin de la montée sont très lents : un seuil fixe les couperait,
    // et la rep la plus significative de la série paraîtrait plus rapide qu'elle ne l'est.
    const rep = analyse(buildTrace([0.22], { noisePx: 3 })).reps[0]!;

    expect(rep.rangeM).toBeGreaterThan(0.55);
    expect(Math.abs(rep.meanVelocity - 0.22)).toBeLessThanOrEqual(0.05);
  });
});

describe('rescaleToMilliseconds — le piège qui ne se voit qu’au retour de la salle', () => {
  /*
   * Une caméra Android rend souvent des nanosecondes. Lue comme des millisecondes, la série
   * paraît durer des heures et chaque vitesse est un million de fois trop lente — mais la FORME de
   * la courbe reste juste, donc rien à l'écran ne trahit l'erreur. On la corrige à la source.
   */
  const enMs = buildTrace([0.5, 0.45]);

  it('laisse une trace déjà en millisecondes intacte', () => {
    expect(rescaleToMilliseconds(enMs)).toEqual(enMs);
  });

  it('🔴 ramène des nanosecondes, et retrouve alors la bonne vitesse', () => {
    const enNs = enMs.map((s) => ({ t: s.t * 1e6, y: s.y }));
    const { reps } = analyseSet(rescaleToMilliseconds(enNs), { metersPerPixel: MPP });

    expect(reps).toHaveLength(2);
    expect(Math.abs(reps[0]!.meanVelocity - 0.5)).toBeLessThanOrEqual(0.05);
  });

  it('ramène des secondes flottantes', () => {
    const enS = enMs.map((s) => ({ t: s.t / 1000, y: s.y }));
    const { reps } = analyseSet(rescaleToMilliseconds(enS), { metersPerPixel: MPP });

    expect(reps).toHaveLength(2);
    expect(Math.abs(reps[0]!.meanVelocity - 0.5)).toBeLessThanOrEqual(0.05);
  });

  it('🔴 rend la trace telle quelle quand aucune échelle ne tient : douteux vaut mieux qu’inventé', () => {
    // Une image par seconde même en lisant les écarts comme des nanosecondes : aucune échelle
    // ne rend ça plausible. (Mon premier exemple, 9 ms en nanosecondes, l'était parfaitement —
    // le test disait donc le contraire de ce qu'il croyait dire.)
    const absurde: BarSample[] = [
      { t: 0, y: 100 },
      { t: 1_000_000_000, y: 90 },
      { t: 2_000_000_000, y: 80 },
    ];
    expect(rescaleToMilliseconds(absurde)).toEqual(absurde);
  });
});

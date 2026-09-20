import { describe, expect, it } from 'vitest';
import {
  bestSegmentTimeFromSamples, bestSegmentTime, bestSegmentWindowFromSamples, bestSegmentWindow,
  computeRunRecords, RUNNING_RECORD_DISTANCES, CANONICAL_RECORD_DISTANCES,
  predictRaceTime, resolveRacePredictions,
} from './pace-records';
import type { GpsPoint } from './running';

describe('RUNNING_RECORD_DISTANCES', () => {
  // US EFFORT-01 (spec R1) : 400 m, demi-mile et mile ajoutés le 20/09/2026 aux 5 distances
  // d'origine. L'ordre est **croissant** et il compte : c'est celui de l'affichage.
  it('les 8 distances attendues, dans l’ordre croissant', () =>
    expect(RUNNING_RECORD_DISTANCES.map((d) => [d.key, d.meters])).toEqual([
      ['400m', 400], ['halfmile', 804.672], ['1k', 1000], ['mile', 1609.344],
      ['5k', 5000], ['10k', 10000], ['semi', 21097.5], ['marathon', 42195],
    ]));

  it('les mètres sont strictement croissants', () => {
    const m = RUNNING_RECORD_DISTANCES.map((d) => d.meters);
    expect(m).toEqual([...m].sort((a, b) => a - b));
    expect(new Set(m).size).toBe(m.length);
  });

  // Spec R3 : le mur de records du hub Course reste à cinq distances (ADR-007, CARDIO-UX02 vient
  // de dégonfler cet écran). Les trois nouvelles ne vivent que dans la fiche d'une sortie.
  it('les 5 distances canoniques restent celles du mur de records', () =>
    expect(CANONICAL_RECORD_DISTANCES).toEqual(['1k', '5k', '10k', 'semi', 'marathon']));
});

describe('bestSegmentTimeFromSamples', () => {
  const cum = [0, 1000, 2000, 3000, 4000, 5000];
  const t = [0, 300, 600, 900, 1200, 1500]; // 300 s/km constant
  it('1 km = 300 s (allure constante)', () => expect(bestSegmentTimeFromSamples(cum, t, 1000)).toBe(300));
  it('5 km = 1500 s', () => expect(bestSegmentTimeFromSamples(cum, t, 5000)).toBe(1500));
  it('choisit le km le plus rapide', () =>
    expect(bestSegmentTimeFromSamples([0, 1000, 2000], [0, 240, 600], 1000)).toBe(240));
  it('interpole t au franchissement (1500 m @ 300 s/km = 450 s)', () =>
    expect(bestSegmentTimeFromSamples([0, 1000, 2000], [0, 300, 600], 1500)).toBe(450));
  it('trace trop courte → null', () =>
    expect(bestSegmentTimeFromSamples([0, 1000], [0, 300], 5000)).toBeNull());
  it('moins de deux échantillons → null', () => {
    expect(bestSegmentTimeFromSamples([0], [0], 1000)).toBeNull();
    expect(bestSegmentTimeFromSamples([], [], 1000)).toBeNull();
  });
  it('distance cible nulle ou négative → null, jamais NaN', () => {
    // Régression : avant le 04/08/2026 ces appels renvoyaient **NaN** (l'index de départ sortait
    // du tableau, `span` devenait NaN et se propageait) — soit un record de « NaN seconde »
    // écrivable en base. Une cible non strictement positive n'est pas un record.
    expect(bestSegmentTimeFromSamples(cum, t, 0)).toBeNull();
    expect(bestSegmentTimeFromSamples(cum, t, -500)).toBeNull();
    expect(bestSegmentTimeFromSamples([0, 0, 0], [0, 10, 20], 0)).toBeNull();
  });
  it('segment sur zone outlier (0 m) pénalisé en temps', () => {
    // j=3 (cum=1500≥1000) : s0=500 ; while avance k à 2 (cum[1]=500 et cum[2]=500 ≤ 500) ;
    // frac=0, tStart=t[2]=250, seg=550-250=300.
    expect(bestSegmentTimeFromSamples([0, 500, 500, 1500], [0, 150, 250, 550], 1000)).toBe(300);
  });
});

// `bestSegmentTime` était **importée par ce fichier sans être jamais appelée** — d'où 85,7 % de
// fonctions couvertes sur le module. C'est le point d'entrée réellement utilisé par l'app (elle
// part de points GPS, pas de distances cumulées déjà calculées) : sa composition
// `cumulativeDistances` → `bestSegmentTimeFromSamples` n'était vérifiée nulle part.
describe('bestSegmentTime (depuis des points GPS)', () => {
  // À l'équateur, 0,001° de longitude ≈ 111,3 m. 0,009° ≈ 1 001 m, donc le kilomètre est atteint.
  const km: GpsPoint[] = [
    { lat: 0, lng: 0, t: 0 },
    { lat: 0, lng: 0.009, t: 300 },
  ];

  it('rend le temps du segment quand la distance est atteinte', () => {
    const seconds = bestSegmentTime(km, 1000);
    expect(seconds).not.toBeNull();
    // Interpolation au franchissement exact des 1 000 m : légèrement sous les 300 s du point final.
    expect(seconds!).toBeGreaterThan(290);
    expect(seconds!).toBeLessThanOrEqual(300);
  });

  it('rend null quand la trace est plus courte que la cible', () => {
    expect(bestSegmentTime(km, 5000)).toBeNull();
  });

  it('rend null sous deux points — une trace d’un seul relevé n’a pas de segment', () => {
    expect(bestSegmentTime([{ lat: 0, lng: 0, t: 0 }], 1000)).toBeNull();
    expect(bestSegmentTime([], 1000)).toBeNull();
  });

  it('ignore un saut GPS aberrant au lieu de fabriquer un record impossible', () => {
    // Un point téléporté à ~111 km en 1 s dépasse MAX_PLAUSIBLE_SPEED_MS : `cumulativeDistances`
    // compte 0 m pour ce bond. Sans ce filtre, la trace afficherait un « record » de 1 km en 1 s.
    const withJump: GpsPoint[] = [
      { lat: 0, lng: 0, t: 0 },
      { lat: 1, lng: 0, t: 1 },
    ];
    expect(bestSegmentTime(withJump, 1000)).toBeNull();
  });
});

describe('computeRunRecords (composition GPS, équateur)', () => {
  const pts: GpsPoint[] = [ { lat: 0, lng: 0, t: 0 }, { lat: 0, lng: 0.02, t: 600 } ]; // ~2.2 km
  it("n'inclut que les distances atteignables", () => {
    const rec = computeRunRecords(pts);
    expect(Object.keys(rec)).toContain('1k');
    expect(Object.keys(rec)).not.toContain('5k');
  });
  it('trace vide → aucun record', () => expect(computeRunRecords([])).toEqual({}));

  // US EFFORT-01, spec D8 — garde de synchro. `computeRunRecords` alimente
  // `running_pace_records`, dont la contrainte `check` n'accepte que cinq clés : lui faire rendre
  // '400m' ferait échouer la remontée vers Postgres. Le journal des efforts couvre les huit.
  it('ne rend JAMAIS une distance hors des cinq canoniques', () => {
    // ~2,2 km à l'équateur : 400 m, demi-mile, 1 km et mile sont tous atteints.
    const long: GpsPoint[] = [{ lat: 0, lng: 0, t: 0 }, { lat: 0, lng: 0.02, t: 900 }];
    const keys = Object.keys(computeRunRecords(long));
    expect(keys).toContain('1k');
    expect(keys).not.toContain('400m');
    expect(keys).not.toContain('halfmile');
    expect(keys).not.toContain('mile');
  });
});

describe('predictRaceTime (US RUN-14)', () => {
  it('référence connue : 5 km en 25 min → 10 km ≈ 52 min (exposant appliqué, pas une règle de trois)', () => {
    const predicted = predictRaceTime(1500, 5000, 10000);
    // Règle de trois naïve (allure constante) donnerait exactement 3000 s : l'exposant 1,06 doit
    // rendre le temps prédit strictement supérieur.
    expect(predicted).toBeGreaterThan(3000);
    expect(predicted).toBeCloseTo(3127.4, 0);
  });

  it('d2 === d1 → renvoie t1 inchangé (cas limite trivial)', () => {
    expect(predictRaceTime(1500, 5000, 5000)).toBe(1500);
  });

  it('croissance plus rapide que linéaire à mesure que la distance cible s’éloigne', () => {
    const t10k = predictRaceTime(1500, 5000, 10000);
    const tSemi = predictRaceTime(1500, 5000, 21097.5);
    const tMarathon = predictRaceTime(1500, 5000, 42195);
    // Si la formule était linéaire (allure constante), tSemi/t10k === 21097.5/10000 exactement.
    // L'exposant 1,06 doit rendre ce ratio strictement supérieur au ratio des distances.
    expect(tSemi / t10k).toBeGreaterThan(21097.5 / 10000);
    expect(tMarathon / tSemi).toBeGreaterThan(42195 / 21097.5);
  });
});

describe('resolveRacePredictions (US RUN-14, R1/R3)', () => {
  const fiveK = { distanceKey: '5k' as const, bestTimeSeconds: 1500, achievedAt: '2026-07-28T10:00:00.000Z' };

  it('aucun record 5 km → aucune prédiction (R1)', () => {
    expect(resolveRacePredictions([])).toEqual([]);
    expect(
      resolveRacePredictions([{ distanceKey: '1k', bestTimeSeconds: 240, achievedAt: '2026-07-01T00:00:00.000Z' }]),
    ).toEqual([]);
  });

  it('record 5 km seul → 3 prédictions (10 km, semi, marathon), dans cet ordre', () => {
    const preds = resolveRacePredictions([fiveK]);
    expect(preds.map((p) => p.distanceKey)).toEqual(['10k', 'semi', 'marathon']);
    expect(preds.every((p) => p.sourceTimeSeconds === 1500 && p.sourceAchievedAt === fiveK.achievedAt)).toBe(true);
  });

  it('un vrai record semi masque la prédiction semi, sans toucher aux autres (R3 — test central)', () => {
    const semiReal = { distanceKey: 'semi' as const, bestTimeSeconds: 6600, achievedAt: '2026-07-20T00:00:00.000Z' };
    const preds = resolveRacePredictions([fiveK, semiReal]);
    expect(preds.map((p) => p.distanceKey)).toEqual(['10k', 'marathon']);
  });

  it('un vrai record marathon masque la prédiction marathon, sans toucher aux autres (R3)', () => {
    const marathonReal = { distanceKey: 'marathon' as const, bestTimeSeconds: 13000, achievedAt: '2026-06-01T00:00:00.000Z' };
    const preds = resolveRacePredictions([fiveK, marathonReal]);
    expect(preds.map((p) => p.distanceKey)).toEqual(['10k', 'semi']);
  });
});

// ---------------------------------------------------------------------------
// US EFFORT-01 — la fenêtre gagnante, pas seulement son temps (spec C2)
// ---------------------------------------------------------------------------

describe('bestSegmentWindowFromSamples (US EFFORT-01)', () => {
  it('rend les bornes en plus du temps, allure constante', () => {
    const cum = [0, 1000, 2000, 3000];
    const t = [0, 300, 600, 900];
    expect(bestSegmentWindowFromSamples(cum, t, 1000)).toEqual({
      seconds: 300, startIdx: 0, startFrac: 0, endIdx: 1,
    });
  });

  it('la fenêtre gagnante est au MILIEU de la trace', () => {
    // km 2 couru en 240 s, les autres en 300 s.
    const cum = [0, 1000, 2000, 3000];
    const t = [0, 300, 540, 840];
    const w = bestSegmentWindowFromSamples(cum, t, 1000)!;
    expect(w.seconds).toBe(240);
    expect(w.endIdx).toBe(2);
    expect(w.startIdx).toBe(1);
    expect(w.startFrac).toBe(0);
  });

  it('la fenêtre gagnante est à la FIN de la trace', () => {
    const cum = [0, 1000, 2000, 3000];
    const t = [0, 300, 600, 820];
    const w = bestSegmentWindowFromSamples(cum, t, 1000)!;
    expect(w.seconds).toBe(220);
    expect(w.endIdx).toBe(3);
  });

  it('départ interpolé entre deux points (startFrac non nul)', () => {
    // Cible 1500 m sur une trace de 2000 m : la meilleure fenêtre démarre à 500 m, soit à
    // mi-chemin entre cum[0]=0 et cum[1]=1000.
    const w = bestSegmentWindowFromSamples([0, 1000, 2000], [0, 300, 600], 1500)!;
    expect(w.seconds).toBe(450);
    expect(w.startIdx).toBe(0);
    expect(w.startFrac).toBeCloseTo(0.5, 10);
    expect(w.endIdx).toBe(2);
  });

  it('égalité stricte entre deux fenêtres → la PREMIÈRE gagne', () => {
    const w = bestSegmentWindowFromSamples([0, 1000, 2000], [0, 300, 600], 1000)!;
    expect(w.endIdx).toBe(1);
  });

  it('trace trop courte, cible nulle ou négative → null', () => {
    expect(bestSegmentWindowFromSamples([0, 1000], [0, 300], 5000)).toBeNull();
    expect(bestSegmentWindowFromSamples([0, 1000], [0, 300], 0)).toBeNull();
    expect(bestSegmentWindowFromSamples([0, 1000], [0, 300], -1)).toBeNull();
    expect(bestSegmentWindowFromSamples([0], [0], 100)).toBeNull();
  });

  it('bestSegmentTimeFromSamples reste le même nombre que la fenêtre (non-régression)', () => {
    const cum = [0, 400, 900, 1500, 2100];
    const t = [0, 120, 260, 430, 600];
    for (const target of [400, 800, 1000, 1500, 2000]) {
      const w = bestSegmentWindowFromSamples(cum, t, target);
      expect(bestSegmentTimeFromSamples(cum, t, target)).toBe(w === null ? null : w.seconds);
    }
  });
});

describe('bestSegmentWindow (points GPS)', () => {
  const line = (n: number, stepM: number, stepS: number): GpsPoint[] =>
    Array.from({ length: n }, (_, i) => ({ lat: 45 + (i * stepM) / 111320, lng: 3, t: i * stepS }));

  it('trace d’un peu plus d’1 km par pas de 100 m → fenêtre plausible', () => {
    // 12 points = 11 pas. Un pas de 100 m « nominal » vaut ~99,89 m réels (le degré de latitude
    // fait 111 195 m, pas 111 320) : il en faut donc 11 pour franchir le kilomètre, pas 10.
    const w = bestSegmentWindow(line(12, 100, 30), 1000)!;
    expect(w.seconds).toBeCloseTo(300, 0);
    expect(w.startIdx).toBe(0);
    expect(w.endIdx).toBe(11);
  });

  it('moins de deux points → null', () => expect(bestSegmentWindow([{ lat: 45, lng: 3, t: 0 }], 400)).toBeNull());
});

// Spec R4 — garde : élargir l'union des distances ne doit RIEN déplacer des prédictions.
// Un type union élargi est exactement le genre de changement qui déplace une valeur par défaut
// sans qu'on le voie.
describe('garde de non-régression des prédictions (spec R4)', () => {
  it('la source reste le 5 km et les cibles restent 10k / semi / marathon', () => {
    const preds = resolveRacePredictions([
      { distanceKey: '400m', bestTimeSeconds: 80, achievedAt: '2026-09-01T00:00:00.000Z' },
      { distanceKey: 'mile', bestTimeSeconds: 420, achievedAt: '2026-09-02T00:00:00.000Z' },
      { distanceKey: '5k', bestTimeSeconds: 1500, achievedAt: '2026-09-03T00:00:00.000Z' },
    ]);
    expect(preds.map((p) => p.distanceKey)).toEqual(['10k', 'semi', 'marathon']);
    expect(preds[0]!.sourceTimeSeconds).toBe(1500);
  });

  it('un record 400 m ou mile seul ne prédit rien', () => {
    expect(resolveRacePredictions([{ distanceKey: '400m', bestTimeSeconds: 80, achievedAt: 'x' }])).toEqual([]);
    expect(resolveRacePredictions([{ distanceKey: 'halfmile', bestTimeSeconds: 200, achievedAt: 'x' }])).toEqual([]);
  });
});

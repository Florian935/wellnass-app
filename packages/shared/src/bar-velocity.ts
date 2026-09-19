/**
 * Spike VBT-01 — de la trajectoire d'un point à la vitesse de chaque répétition.
 * Réf. : docs/specs/technical/spike-vbt01-vitesse-barre.md · idée 27 de la salve du 13/09/2026.
 *
 * ── Ce que ce module est, et ce qu'il n'est pas ────────────────────────────────────────────────
 * Il prend une **suite de positions** (ce que rend un suivi de pastille ou de disque, image par
 * image) et rend des **vitesses par répétition**. Il ne voit aucune image, ne connaît aucune caméra,
 * n'appelle rien : c'est volontaire. La chaîne complète du spike a deux moitiés de risque très
 * inégales — **suivre le point** (risque caméra, mesurable seulement sur device) et **transformer
 * la trajectoire en décision** (risque calcul, mesurable ici, tout de suite). Séparer les deux permet
 * de prouver la seconde avant d'investir un centime dans la première.
 *
 * ── La seule chose qu'on mesure vraiment ──────────────────────────────────────────────────────
 * La **vitesse moyenne concentrique** (MCV) : amplitude de la montée ÷ durée de la montée. C'est la
 * grandeur sur laquelle la littérature VBT s'accorde et celle que l'étude PLOS One 2024 compare à une
 * capture Vicon. Tout le reste en découle — la perte de vitesse dans la série est un **rapport entre
 * deux mesures**, donc sans modèle ni coefficient inventé.
 *
 * 🔴 **Ce module ne devine PAS le RIR.** Le passage « vitesse → répétitions en réserve » exige une
 * vitesse de fin de série propre à la personne ET à l'exercice (MVT), qui ne s'obtient qu'en allant
 * à l'échec une fois. Sans elle, `estimateRir` rend `null` — voir le commentaire de la fonction.
 */

/** Diamètre d'un disque olympique standard, en mètres : c'est l'étalon qui convertit les pixels. */
export const PLATE_DIAMETER_M = 0.45;

/**
 * Durée de la fenêtre de lissage, en millisecondes.
 *
 * 🔴 En **durée**, pas en nombre d'images — la version en images (5) était juste à 60 i/s et
 * désastreuse en dessous : à 30 i/s elle couvrait 167 ms, soit plus de la moitié d'un développé
 * couché rapide, dont elle rabotait les deux extrêmes. Mesuré au banc : l'écart maximal passait de
 * 0,026 m/s (60 i/s) à 0,069 m/s (30 i/s) pour la même trajectoire, uniquement à cause de ça.
 */
export const SMOOTH_WINDOW_MS = 80;

/** Bornes de la fenêtre, en nombre d'échantillons : ni moins de 3 (inutile), ni plus de 9 (mou). */
export const SMOOTH_WINDOW_MIN = 3;
export const SMOOTH_WINDOW_MAX = 9;

/**
 * Part de la durée d'une répétition que la fenêtre de lissage ne doit jamais dépasser, au moment de
 * **mesurer** (la détection, elle, garde la fenêtre large).
 *
 * Un développé couché rapide dure 0,29 s : une fenêtre de 80 ms en couvre 28 % et rabote ses deux
 * extrêmes, donc son amplitude. D'où deux passes — détecter large, mesurer serré.
 */
export const MEASURE_WINDOW_SHARE = 0.15;

/** Une montée plus courte que ça n'est pas une répétition : c'est un ajustement ou un rebond. */
export const REP_MIN_RANGE_M = 0.15;

/** Idem pour la durée : sous ce seuil, c'est du bruit de suivi, pas un mouvement. */
export const REP_MIN_DURATION_S = 0.2;

/** Au-dessus de cette vitesse, on considère que la barre monte. */
export const CONCENTRIC_START_V = 0.1;

/**
 * Deux montées séparées par moins que ça sont **la même** répétition.
 *
 * Le point de blocage d'un squat lourd fait tomber la vitesse à presque zéro pendant un instant.
 * Sans cette tolérance, la rep la plus intéressante de la série — la plus lente — serait comptée
 * double, et sa vitesse moyenne surestimée deux fois.
 */
export const STICK_GAP_S = 0.15;

/**
 * Part de la vitesse de pointe **de la répétition** en dessous de laquelle la barre est considérée
 * à l'arrêt, quand on étend la montée jusqu'à ses vrais bouts.
 *
 * 🔴 Relatif, et non en millimètres par image : un seuil absolu se fait battre par le bruit de
 * suivi (±3 px lissés ≈ 0,06 m/s de tremblement sur la vitesse), et il ne peut pas convenir à la
 * fois à une rep à 0,85 m/s et à une rep d'échec à 0,22 m/s. Mesuré au banc : le seuil absolu
 * allongeait la rep rapide de 13 % et raccourcissait la rep lente de 17 % — deux erreurs opposées,
 * donc impossibles à rattraper par une correction unique.
 */
export const EXPAND_V_SHARE = 0.08;

/** Trou de suivi comblé par interpolation ; au-delà, la trace est coupée en deux segments. */
export const MAX_FILLED_GAP_S = 0.2;

/** Seuil de perte de vitesse par défaut, en pourcentage de la meilleure répétition de la série. */
export const DEFAULT_LOSS_THRESHOLD_PCT = 20;

/** En dessous de cette cadence, la mesure n'est plus fiable (critère de sortie du spike). */
export const MIN_USABLE_FPS = 30;

/**
 * Un échantillon de suivi. `y` est en **pixels, axe vers le bas** (repère image), et vaut `null`
 * quand le point n'a pas été trouvé sur cette image — c'est le mode d'échec principal en salle
 * (barre masquée par le corps, reflet, sortie de cadre), et le taire fabriquerait des vitesses
 * fausses au lieu de signaler un trou.
 */
export type BarSample = { t: number; y: number | null };

/** Une répétition détectée, avec ce qu'on en sait de mesuré. */
export type BarRep = {
  /** Rang dans la série, à partir de 1. */
  index: number;
  startMs: number;
  endMs: number;
  durationS: number;
  /** Amplitude de la phase concentrique, en mètres. */
  rangeM: number;
  /** Vitesse moyenne concentrique (m/s) — la mesure de référence. */
  meanVelocity: number;
  /** Vitesse instantanée maximale de la montée (m/s). */
  peakVelocity: number;
  /** Vrai si la montée contenait un trou de suivi comblé par interpolation. */
  interpolated: boolean;
};

/** Ce que la trace dit de sa propre qualité — avant même de parler de vitesses. */
export type BarTrackingQuality = {
  /** Cadence médiane observée, en images par seconde. */
  fps: number;
  /** Nombre d'images où le point n'a pas été trouvé. */
  lostFrames: number;
  /** Part d'images perdues, de 0 à 1. */
  lostRatio: number;
  /** Nombre de coupures (trou trop long pour être comblé). */
  breaks: number;
  /** Faux dès qu'un critère de mesurabilité n'est pas tenu : la série ne doit pas être affichée. */
  usable: boolean;
};

export type BarSetAnalysis = {
  reps: BarRep[];
  quality: BarTrackingQuality;
  /** Meilleure vitesse moyenne de la série (m/s), `null` si aucune répétition. */
  bestMeanVelocity: number | null;
  /** Perte de la **dernière** répétition par rapport à la meilleure, en %. `null` si < 2 reps. */
  velocityLossPct: number | null;
  /** Vrai quand la perte atteint le seuil : c'est un **signal d'arrêt**, pas une prédiction. */
  stop: boolean;
};

export type AnalyseSetOptions = {
  /** Échelle pixels → mètres. Voir `metersPerPixel`. */
  metersPerPixel: number;
  /** Seuil de perte de vitesse, en %. */
  lossThresholdPct?: number;
};

/**
 * Échelle de la scène, déduite du diamètre apparent du disque.
 *
 * ⚠️ C'est **le** point de fragilité de toute la mesure : un petit disque (35 cm, fréquent en salle)
 * pris pour un 45 fausse chaque vitesse de 29 %, sans que rien ne le signale. Le diamètre doit venir
 * d'une saisie explicite ou d'une détection, jamais d'un défaut silencieux.
 */
export function metersPerPixel(
  plateDiameterPx: number,
  plateDiameterM: number = PLATE_DIAMETER_M,
): number | null {
  if (!Number.isFinite(plateDiameterPx) || plateDiameterPx <= 0) return null;
  if (!Number.isFinite(plateDiameterM) || plateDiameterM <= 0) return null;
  return plateDiameterM / plateDiameterPx;
}

/** Cadence médiane de la trace, en images/s. `null` si moins de deux échantillons. */
export function sampleRate(samples: readonly BarSample[]): number | null {
  if (samples.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < samples.length; i += 1) {
    const dt = samples[i]!.t - samples[i - 1]!.t;
    if (dt > 0) gaps.push(dt);
  }
  if (gaps.length === 0) return null;
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)]!;
  return 1000 / median;
}

/** Un point de trajectoire converti : instant en secondes, hauteur en mètres, axe vers le haut. */
type Point = { t: number; h: number; filled: boolean };

/**
 * Trace nettoyée : pixels → mètres, axe retourné, trous courts comblés, trous longs = coupure.
 *
 * L'axe est retourné parce que le repère image descend et que la barre, elle, monte : garder le
 * repère caméra rendrait toutes les vitesses négatives et forcerait chaque lecteur du code à faire
 * l'inversion de tête.
 */
function toSegments(samples: readonly BarSample[], mpp: number): Point[][] {
  const segments: Point[][] = [];
  let current: Point[] = [];
  let lastSeen: { t: number; y: number } | null = null;
  let pendingGap: BarSample[] = [];

  const flush = () => {
    if (current.length > 0) segments.push(current);
    current = [];
  };

  for (const sample of samples) {
    if (sample.y === null || !Number.isFinite(sample.y)) {
      pendingGap.push(sample);
      continue;
    }

    const seen = { t: sample.t, y: sample.y };

    if (pendingGap.length > 0 && lastSeen !== null) {
      const gapS = (seen.t - lastSeen.t) / 1000;
      if (gapS <= MAX_FILLED_GAP_S) {
        // Trou court : on interpole en ligne droite. Une barre ne téléporte pas en 200 ms, et
        // couper la répétition ici la ferait disparaître du décompte — l'erreur la plus coûteuse.
        for (const missing of pendingGap) {
          const ratio = (missing.t - lastSeen.t) / (seen.t - lastSeen.t);
          const y = lastSeen.y + (seen.y - lastSeen.y) * ratio;
          current.push({ t: missing.t / 1000, h: -y * mpp, filled: true });
        }
      } else {
        // Trou long : on ne bouche pas, on coupe. Inventer une trajectoire sur une seconde
        // d'absence produirait une vitesse plausible et fausse — le pire des deux mondes.
        flush();
      }
      pendingGap = [];
    }

    current.push({ t: seen.t / 1000, h: -seen.y * mpp, filled: false });
    lastSeen = seen;
  }

  flush();
  return segments.filter((segment) => segment.length >= 2);
}

/**
 * Lissage par moyenne glissante centrée.
 *
 * Le suivi d'un point tremble de quelques pixels d'une image à l'autre ; dérivé tel quel, ce
 * tremblement produit des pics de vitesse qui n'existent pas et qui, eux, seraient pris pour la
 * vitesse maximale de la répétition.
 */
/** Intervalle moyen entre deux échantillons, en millisecondes. */
function stepMs(points: readonly Point[]): number {
  if (points.length < 2) return 0;
  return ((points[points.length - 1]!.t - points[0]!.t) / (points.length - 1)) * 1000;
}

/** Nombre impair d'échantillons couvrant `targetMs`, borné. */
function windowFor(points: readonly Point[], targetMs: number): number {
  if (points.length < SMOOTH_WINDOW_MIN) return 1;
  const dtMs = stepMs(points);
  if (!(dtMs > 0)) return SMOOTH_WINDOW_MIN;
  const count = Math.round(targetMs / dtMs);
  const odd = count % 2 === 0 ? count + 1 : count;
  return Math.max(SMOOTH_WINDOW_MIN, Math.min(SMOOTH_WINDOW_MAX, odd));
}

function smoothWindow(points: readonly Point[]): number {
  return windowFor(points, SMOOTH_WINDOW_MS);
}

function smooth(points: readonly Point[], window: number = smoothWindow(points)): Point[] {
  const half = Math.floor(window / 2);
  return points.map((point, i) => {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(points.length - 1, i + half); j += 1) {
      sum += points[j]!.h;
      count += 1;
    }
    return { ...point, h: sum / count };
  });
}

/** Vitesse instantanée par différence centrée (m/s), alignée sur `points`. */
function velocities(points: readonly Point[]): number[] {
  return points.map((_, i) => {
    const before = points[Math.max(0, i - 1)]!;
    const after = points[Math.min(points.length - 1, i + 1)]!;
    const dt = after.t - before.t;
    return dt <= 0 ? 0 : (after.h - before.h) / dt;
  });
}

/** Une plage d'indices montante, avant filtrage. */
type Phase = { from: number; to: number };

/** Découpe un segment en phases concentriques, points de blocage recollés. */
function concentricPhases(points: readonly Point[], v: readonly number[]): Phase[] {
  const raw: Phase[] = [];
  let start: number | null = null;

  for (let i = 0; i < points.length; i += 1) {
    const rising = v[i]! >= CONCENTRIC_START_V;
    if (rising && start === null) start = i;
    if (!rising && start !== null) {
      raw.push({ from: start, to: i - 1 });
      start = null;
    }
  }
  if (start !== null) raw.push({ from: start, to: points.length - 1 });

  // Recollage : deux montées séparées par un creux très bref sont la même répétition (STICK_GAP_S).
  const merged: Phase[] = [];
  for (const phase of raw) {
    const previous = merged[merged.length - 1];
    if (previous !== undefined && points[phase.from]!.t - points[previous.to]!.t <= STICK_GAP_S) {
      previous.to = phase.to;
    } else {
      merged.push({ ...phase });
    }
  }

  /*
   * 🔴 Extension aux extrêmes réels du mouvement — la correction qui décide de la justesse.
   *
   * Une répétition part et finit à vitesse nulle : ses deux extrémités passent donc SOUS le seuil
   * qui sert à la repérer. S'en tenir à ce seuil ampute les instants les plus lents de la montée et
   * **surestime la vitesse moyenne de 5 à 6 %** — 0,66 m/s affiché pour 0,62 m/s réel. L'erreur est
   * invisible (l'ordre des répétitions est conservé) et pourtant fatale au critère « ≤ 0,05 m/s ».
   *
   * On repart donc de chaque bout jusqu'au creux et au sommet réels, en s'arrêtant dès que la barre
   * cesse de bouger : la pause en bas ne doit pas être comptée dans la durée de la montée.
   */
  return merged.map(({ from, to }) => {
    let peak = 0;
    for (let i = from; i <= to; i += 1) peak = Math.max(peak, v[i]!);
    const plancher = peak * EXPAND_V_SHARE;

    let start = from;
    while (start > 0 && v[start - 1]! >= plancher) start -= 1;
    let end = to;
    while (end < points.length - 1 && v[end + 1]! >= plancher) end += 1;
    return { from: start, to: end };
  });
}

/**
 * Analyse une série complète : trace brute → répétitions, qualité, perte de vitesse.
 *
 * L'ordre compte : la **qualité** est calculée sur la trace brute, avant tout nettoyage. Une série
 * filmée à 12 i/s avec un tiers d'images perdues peut très bien rendre des vitesses d'allure
 * crédible — c'est précisément pour ça qu'il faut la refuser sur la foi de la trace, pas du résultat.
 */
export function analyseSet(
  samples: readonly BarSample[],
  options: AnalyseSetOptions,
): BarSetAnalysis {
  const lostFrames = samples.filter((s) => s.y === null || !Number.isFinite(s.y)).length;
  const fps = sampleRate(samples) ?? 0;
  const segments = toSegments(samples, options.metersPerPixel);

  const quality: BarTrackingQuality = {
    fps,
    lostFrames,
    lostRatio: samples.length === 0 ? 1 : lostFrames / samples.length,
    breaks: Math.max(0, segments.length - 1),
    usable: fps >= MIN_USABLE_FPS && samples.length > 0 && lostFrames / samples.length <= 0.1,
  };

  const reps: BarRep[] = [];
  for (const segment of segments) {
    const points = smooth(segment);
    const v = velocities(points);

    for (const phase of concentricPhases(points, v)) {
      /*
       * Deuxième passe : on remesure la montée avec une fenêtre proportionnée À CETTE répétition.
       * La première passe sert à la trouver (fenêtre large, robuste au bruit) ; celle-ci à la
       * chiffrer sans lui raboter les extrêmes. Les indices sont ceux du même segment, donc les
       * bornes restent celles qui ont été détectées.
       */
      const mesure = smooth(
        segment,
        windowFor(
          segment,
          Math.min(
            SMOOTH_WINDOW_MS,
            (points[phase.to]!.t - points[phase.from]!.t) * 1000 * MEASURE_WINDOW_SHARE,
          ),
        ),
      );
      const from = mesure[phase.from]!;
      const to = mesure[phase.to]!;
      const durationS = to.t - from.t;
      const rangeM = to.h - from.h;
      if (durationS < REP_MIN_DURATION_S || rangeM < REP_MIN_RANGE_M) continue;

      let peak = 0;
      let interpolated = false;
      for (let i = phase.from; i <= phase.to; i += 1) {
        if (v[i]! > peak) peak = v[i]!;
        if (points[i]!.filled) interpolated = true;
      }

      reps.push({
        index: reps.length + 1,
        startMs: Math.round(from.t * 1000),
        endMs: Math.round(to.t * 1000),
        durationS,
        rangeM,
        meanVelocity: rangeM / durationS,
        peakVelocity: peak,
        interpolated,
      });
    }
  }

  const bestMeanVelocity = reps.length === 0
    ? null
    : reps.reduce((best, rep) => Math.max(best, rep.meanVelocity), 0);

  // La perte se lit sur la DERNIÈRE répétition, pas sur la plus lente : c'est l'état actuel de la
  // série qui décide de continuer ou non, pas son pire instant passé.
  const velocityLossPct =
    reps.length < 2 || bestMeanVelocity === null || bestMeanVelocity <= 0
      ? null
      : ((bestMeanVelocity - reps[reps.length - 1]!.meanVelocity) / bestMeanVelocity) * 100;

  const threshold = options.lossThresholdPct ?? DEFAULT_LOSS_THRESHOLD_PCT;

  return {
    reps,
    quality,
    bestMeanVelocity,
    velocityLossPct,
    stop: velocityLossPct !== null && velocityLossPct >= threshold,
  };
}

/**
 * Profil vitesse-répétitions d'une personne **pour un exercice donné**, mesuré une fois sur une
 * série menée à l'échec : `mvt` = vitesse de la toute dernière répétition réussie.
 */
export type VelocityProfile = {
  exerciseId: string;
  /** Minimum velocity threshold (m/s) — la vitesse à laquelle cette personne échoue. */
  mvt: number;
  /** Gain de vitesse par répétition en réserve (m/s par RIR), mesuré sur la même série. */
  velocityPerRir: number;
};

/**
 * Répétitions en réserve estimées — **uniquement** si un profil mesuré existe.
 *
 * 🔴 Rendre `null` est le comportement normal, pas un cas d'erreur. La conversion vitesse → RIR
 * dépend de la personne et de l'exercice ; la faire avec des constantes de la littérature
 * afficherait « RIR ≈ 1 » à quelqu'un qui a encore quatre répétitions, avec l'autorité d'un chiffre
 * mesuré. Le dépôt a déjà payé ce travers (coefficient d'allure inventé du prototype Labo, 15/09) :
 * un nombre faux est plus cher qu'un nombre absent.
 */
export function estimateRir(
  lastMeanVelocity: number,
  profile: VelocityProfile | null,
): number | null {
  if (profile === null) return null;
  if (!Number.isFinite(lastMeanVelocity) || lastMeanVelocity <= 0) return null;
  if (!Number.isFinite(profile.mvt) || profile.velocityPerRir <= 0) return null;

  const rir = (lastMeanVelocity - profile.mvt) / profile.velocityPerRir;
  // Jamais négatif : passer sous sa vitesse d'échec veut dire « échec », pas « −2 en réserve ».
  return Math.max(0, Math.round(rir * 10) / 10);
}

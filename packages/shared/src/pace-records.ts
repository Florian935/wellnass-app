import { haversineMeters, MAX_PLAUSIBLE_SPEED_MS, type GpsPoint } from './running';

export type RecordDistanceKey =
  | '400m' | 'halfmile' | '1k' | 'mile' | '5k' | '10k' | 'semi' | 'marathon';

/**
 * Les distances sur lesquelles on cherche un meilleur segment glissant, **par ordre croissant**
 * (c'est aussi l'ordre d'affichage).
 *
 * ── Pourquoi 400 m, le demi-mile et le mile (US EFFORT-01, spec R1) ─────────────────────────────
 * Ajoutés le 20/09/2026. Avec les cinq distances d'origine, une sortie de 2 km ne pouvait produire
 * qu'**un seul** effort (1 km) : les sorties courtes n'avaient rien à raconter. Ce sont par ailleurs
 * des repères que les coureurs utilisent réellement.
 *
 * ⚠️ Élargir cette union ne doit **rien** déplacer des prédictions de Riegel (spec R4) :
 * `PREDICTION_SOURCE` reste le 5 km et `PREDICTION_TARGETS` reste 10k/semi/marathon. Un test de
 * garde le vérifie — c'est exactement le genre de changement qui déplace une valeur par défaut sans
 * qu'on le voie.
 */
export const RUNNING_RECORD_DISTANCES: { key: RecordDistanceKey; meters: number }[] = [
  { key: '400m', meters: 400 },
  { key: 'halfmile', meters: 804.672 },
  { key: '1k', meters: 1000 },
  { key: 'mile', meters: 1609.344 },
  { key: '5k', meters: 5000 },
  { key: '10k', meters: 10000 },
  { key: 'semi', meters: 21097.5 },
  { key: 'marathon', meters: 42195 },
];

/**
 * Les cinq distances **historiques**, seules affichées par le mur de records du hub Course.
 *
 * US EFFORT-01, spec R3 : CARDIO-UX02 vient de dégonfler cet écran et
 * [ADR-007](../../../docs/adr/ADR-007-surfacage-analyses.md) interdit de le regonfler. Les trois
 * distances neuves vivent dans la fiche d'une sortie, pas sur le hub.
 */
export const CANONICAL_RECORD_DISTANCES: readonly RecordDistanceKey[] = [
  '1k', '5k', '10k', 'semi', 'marathon',
];

/**
 * Clé i18n du libellé de chaque distance — **source unique**.
 *
 * Cette table vivait, à l'identique, dans **six** fichiers de l'app (`run/summary`,
 * `running-history`, `RecordRecentCard`, `RunPredictionsCard`, `RunRecordWall`,
 * `run-cards-repository`) : l'un d'eux portait même le commentaire « les mêmes libellés que l'écran
 * de stats — une distance ne change pas de nom selon l'écran ». C'est l'ajout des trois distances
 * d'EFFORT-01 qui l'a révélé, le compilateur refusant les six copies d'un coup.
 *
 * La garder ici a un effet utile : ajouter une distance **ne compile plus** tant que son libellé
 * n'est pas fourni.
 */
export const RECORD_DISTANCE_I18N_KEY: Record<RecordDistanceKey, string> = {
  '400m': 'running.records.distance400m',
  halfmile: 'running.records.distanceHalfMile',
  '1k': 'running.records.distance1k',
  mile: 'running.records.distanceMile',
  '5k': 'running.records.distance5k',
  '10k': 'running.records.distance10k',
  semi: 'running.records.distanceSemi',
  marathon: 'running.records.distanceMarathon',
};

/** Distance cumulée le long de la trace (outlier de vitesse → 0 m ajouté, point conservé). */
export function cumulativeDistances(points: ReadonlyArray<GpsPoint>): number[] {
  const cum: number[] = new Array(points.length);
  cum[0] = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!, curr = points[i]!;
    const dt = curr.t - prev.t;
    let d = 0;
    if (dt > 0) {
      const dist = haversineMeters(prev, curr);
      if (dist / dt <= MAX_PLAUSIBLE_SPEED_MS) d = dist;
    }
    cum[i] = cum[i - 1]! + d;
  }
  return cum;
}

/**
 * Temps minimal (s) pour couvrir >= `targetDistanceM` sur des échantillons (distance cumulée `cum`,
 * temps `t`). Interpolation linéaire de `t` à exactement D côté départ. `null` si trace trop courte
 * ou si la distance demandée n'est pas strictement positive.
 *
 * ⚠️ **`targetDistanceM <= 0` est rejeté en entrée**, et ce n'est pas cosmétique : c'était le seul
 * cas où `k` sortait du tableau (`s0` valant alors `cum[j]`, la boucle avançait jusqu'au dernier
 * indice), d'où un `span` à `NaN` propagé jusqu'au temps retourné. La fonction rendait donc
 * `NaN` — soit un « record » de NaN seconde écrit en base — au lieu de refuser l'appel.
 * Corrigé le 04/08/2026 en comblant la couverture de branches du paquet.
 */
export function bestSegmentTimeFromSamples(
  cum: ReadonlyArray<number>, t: ReadonlyArray<number>, targetDistanceM: number,
): number | null {
  return bestSegmentWindowFromSamples(cum, t, targetDistanceM)?.seconds ?? null;
}

/**
 * La fenêtre gagnante, et pas seulement son temps (US EFFORT-01, spec C2 et R5).
 *
 * ── Pourquoi cette fonction existe ──────────────────────────────────────────────────────────────
 * Le balayage calculait déjà les bornes de la fenêtre la plus rapide, puis **les jetait** : on ne
 * gardait qu'un nombre de secondes. Sans elles, impossible de poser quoi que ce soit sur la carte —
 * on sait *qu'*on a bien couru, jamais *où*. `bestSegmentTimeFromSamples` est devenue un appel
 * mince dessus : **aucun changement de comportement**, et ses tests d'origine le vérifient.
 *
 * `startIdx` / `startFrac` décrivent un départ **interpolé** : la fenêtre commence entre les points
 * `startIdx` et `startIdx + 1`, à la fraction `startFrac`. `endIdx` est le point qui a franchi la
 * distance cible.
 */
export type SegmentWindow = {
  seconds: number;
  startIdx: number;
  /** Fraction dans `[0, 1[` entre `startIdx` et `startIdx + 1` où démarre la fenêtre. */
  startFrac: number;
  endIdx: number;
};

export function bestSegmentWindowFromSamples(
  cum: ReadonlyArray<number>, t: ReadonlyArray<number>, targetDistanceM: number,
): SegmentWindow | null {
  const n = cum.length;
  if (n < 2 || targetDistanceM <= 0 || cum[n - 1]! < targetDistanceM) return null;
  let best = Infinity;
  let bestStartIdx = 0;
  let bestStartFrac = 0;
  let bestEndIdx = 0;
  let k = 0;
  for (let j = 1; j < n; j++) {
    if (cum[j]! < targetDistanceM) continue;
    const s0 = cum[j]! - targetDistanceM;
    // Invariant garanti par la garde d'entrée : `cum[n-1] >= targetDistanceM > 0`, donc
    // `s0 < cum[n-1]`. La boucle s'arrête sur `cum[k+1] > s0` **avant** de sortir du tableau →
    // `k <= n-2`, `cum[k+1]` est défini, et `span > 0` strictement. Pas de garde nécessaire.
    while (k + 1 < n && cum[k + 1]! <= s0) k++;
    const span = cum[k + 1]! - cum[k]!;
    const frac = (s0 - cum[k]!) / span;
    const tStart = t[k]! + frac * (t[k + 1]! - t[k]!);
    const seconds = t[j]! - tStart;
    // Comparaison **stricte** : à égalité de temps, la première fenêtre rencontrée gagne — c'est
    // le comportement de l'ancien `Math.min`, et un test le fige.
    if (seconds < best) {
      best = seconds;
      bestStartIdx = k;
      bestStartFrac = frac;
      bestEndIdx = j;
    }
  }
  // `j = n-1` satisfait toujours `cum[j] >= targetDistanceM` (même garde d'entrée) : `best` a donc
  // forcément été assigné. Un `best === Infinity ? null` ici serait du code mort.
  return { seconds: best, startIdx: bestStartIdx, startFrac: bestStartFrac, endIdx: bestEndIdx };
}

export function bestSegmentTime(points: ReadonlyArray<GpsPoint>, targetDistanceM: number): number | null {
  return bestSegmentWindow(points, targetDistanceM)?.seconds ?? null;
}

/** `bestSegmentWindowFromSamples`, depuis des points GPS. */
export function bestSegmentWindow(
  points: ReadonlyArray<GpsPoint>, targetDistanceM: number,
): SegmentWindow | null {
  if (points.length < 2) return null;
  const cum = cumulativeDistances(points);
  const t = points.map((p) => p.t);
  return bestSegmentWindowFromSamples(cum, t, targetDistanceM);
}

/**
 * Meilleurs temps par distance atteignable (clé absente si non atteignable) — **le palmarès**.
 *
 * ⚠️ **Ne balaie que les cinq distances canoniques**, pas les huit (US EFFORT-01, spec D8).
 * Cette fonction alimente `running_pace_records`, dont la colonne `distance_key` porte une
 * contrainte `check` à cinq valeurs : lui passer `'400m'` ferait **échouer la synchro** vers
 * Postgres, silencieusement côté SQLite local et bruyamment à la remontée.
 *
 * Ce n'est pas un contournement, c'est la bonne séparation : le **palmarès** garde les cinq
 * distances de référence ; le **journal** (`computeRunEfforts`, dans `run-efforts.ts`) couvre les
 * huit. Le record d'une distance neuve se lit comme le minimum de son journal — là où vit déjà son
 * classement. Aucune contrainte de base à élargir, aucun comportement existant déplacé.
 */
export function computeRunRecords(points: ReadonlyArray<GpsPoint>): Partial<Record<RecordDistanceKey, number>> {
  const out: Partial<Record<RecordDistanceKey, number>> = {};
  if (points.length < 2) return out;
  const cum = cumulativeDistances(points);
  const t = points.map((p) => p.t);
  for (const { key, meters } of RUNNING_RECORD_DISTANCES) {
    if (!CANONICAL_RECORD_DISTANCES.includes(key)) continue;
    const time = bestSegmentTimeFromSamples(cum, t, meters);
    if (time != null) out[key] = time;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Prédiction de temps (US RUN-14, roadmap 5.34) — formule de Riegel
// ---------------------------------------------------------------------------

/** Exposant de Riegel : la fatigue s'accumule plus vite que la distance. */
export const RIEGEL_EXPONENT = 1.06;

/** Distance source unique des prédictions (spec R1) — déjà la référence de l'app (VMA, `running-paces.ts`). */
const PREDICTION_SOURCE: RecordDistanceKey = '5k';

/** Distances cibles des prédictions, dans cet ordre (spec R2) — toujours plus longues que la source. */
const PREDICTION_TARGETS: RecordDistanceKey[] = ['10k', 'semi', 'marathon'];

/** Distance en mètres d'une clé canonique. */
function metersOf(key: RecordDistanceKey): number {
  return RUNNING_RECORD_DISTANCES.find((d) => d.key === key)!.meters;
}

/**
 * Temps prédit (s) sur `d2Meters` à partir d'un temps `t1Seconds` sur `d1Meters` (formule de
 * Riegel). `d2Meters === d1Meters` renvoie `t1Seconds` inchangé (cas limite trivial).
 */
export function predictRaceTime(t1Seconds: number, d1Meters: number, d2Meters: number): number {
  if (d2Meters === d1Meters) return t1Seconds;
  return t1Seconds * (d2Meters / d1Meters) ** RIEGEL_EXPONENT;
}

/** Une prédiction résolue, prête pour l'affichage. */
export type RacePrediction = {
  distanceKey: RecordDistanceKey;
  predictedSeconds: number;
  sourceTimeSeconds: number;
  sourceAchievedAt: string;
};

/**
 * Prédictions de temps (10 km / semi / marathon) depuis le record des 5 km (spec R1) — `[]` si ce
 * record n'existe pas (aucun calcul, pas d'erreur). Une distance cible qui a déjà un **vrai**
 * record dans `records` n'est **jamais** prédite (spec R3) : la vraie performance prime toujours
 * sur une estimation.
 */
export function resolveRacePredictions(
  records: ReadonlyArray<{ distanceKey: RecordDistanceKey; bestTimeSeconds: number; achievedAt: string }>,
): RacePrediction[] {
  const source = records.find((r) => r.distanceKey === PREDICTION_SOURCE);
  if (!source) return [];

  const alreadyRecorded = new Set(records.map((r) => r.distanceKey));
  const d1 = metersOf(PREDICTION_SOURCE);

  return PREDICTION_TARGETS.filter((key) => !alreadyRecorded.has(key)).map((distanceKey) => ({
    distanceKey,
    predictedSeconds: predictRaceTime(source.bestTimeSeconds, d1, metersOf(distanceKey)),
    sourceTimeSeconds: source.bestTimeSeconds,
    sourceAchievedAt: source.achievedAt,
  }));
}

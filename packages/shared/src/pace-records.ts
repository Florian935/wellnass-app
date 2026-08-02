import { haversineMeters, MAX_PLAUSIBLE_SPEED_MS, type GpsPoint } from './running';

export type RecordDistanceKey = '1k' | '5k' | '10k' | 'semi' | 'marathon';
export const RUNNING_RECORD_DISTANCES: { key: RecordDistanceKey; meters: number }[] = [
  { key: '1k', meters: 1000 },
  { key: '5k', meters: 5000 },
  { key: '10k', meters: 10000 },
  { key: 'semi', meters: 21097.5 },
  { key: 'marathon', meters: 42195 },
];

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
 * temps `t`). Interpolation linéaire de `t` à exactement D côté départ. `null` si trace trop courte.
 */
export function bestSegmentTimeFromSamples(
  cum: ReadonlyArray<number>, t: ReadonlyArray<number>, targetDistanceM: number,
): number | null {
  const n = cum.length;
  if (n < 2 || cum[n - 1]! < targetDistanceM) return null;
  let best = Infinity;
  let k = 0;
  for (let j = 1; j < n; j++) {
    if (cum[j]! < targetDistanceM) continue;
    const s0 = cum[j]! - targetDistanceM;
    while (k + 1 < n && cum[k + 1]! <= s0) k++;
    const span = cum[k + 1]! - cum[k]!;
    const frac = span > 0 ? (s0 - cum[k]!) / span : 0;
    const tStart = t[k]! + frac * (t[k + 1]! - t[k]!);
    best = Math.min(best, t[j]! - tStart);
  }
  return best === Infinity ? null : best;
}

export function bestSegmentTime(points: ReadonlyArray<GpsPoint>, targetDistanceM: number): number | null {
  if (points.length < 2) return null;
  const cum = cumulativeDistances(points);
  const t = points.map((p) => p.t);
  return bestSegmentTimeFromSamples(cum, t, targetDistanceM);
}

/** Meilleurs temps par distance atteignable (clé absente si non atteignable). */
export function computeRunRecords(points: ReadonlyArray<GpsPoint>): Partial<Record<RecordDistanceKey, number>> {
  const out: Partial<Record<RecordDistanceKey, number>> = {};
  if (points.length < 2) return out;
  const cum = cumulativeDistances(points);
  const t = points.map((p) => p.t);
  for (const { key, meters } of RUNNING_RECORD_DISTANCES) {
    const time = bestSegmentTimeFromSamples(cum, t, meters);
    if (time != null) out[key] = time;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Prédiction de temps (US RUN-14, roadmap 5.34) — formule de Riegel
// ---------------------------------------------------------------------------

/** Exposant de Riegel : la fatigue s'accumule plus vite que la distance. */
const RIEGEL_EXPONENT = 1.06;

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

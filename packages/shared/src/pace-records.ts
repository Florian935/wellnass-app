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

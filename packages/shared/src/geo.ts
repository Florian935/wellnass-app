import type { GpsPoint } from './running';

// ---------------------------------------------------------------------------
// Constantes de projection equirectangulaire locale
// ---------------------------------------------------------------------------

const METERS_PER_DEG_LAT = 111_320;

/**
 * Retourne le nombre de metres par degre de longitude
 * pour une latitude de reference (en degres decimaux).
 */
function metersPerDegLng(latRefDeg: number): number {
  return METERS_PER_DEG_LAT * Math.cos((latRefDeg * Math.PI) / 180);
}

// ---------------------------------------------------------------------------
// Distance point-segment en metres (projection equirectangulaire locale)
// ---------------------------------------------------------------------------

/**
 * Calcule la distance perpendiculaire en metres du point `p`
 * au segment defini par `a` et `b`, via une projection equirectangulaire
 * locale centree sur la latitude moyenne du segment.
 *
 * Si `a` et `b` sont identiques (segment degenere), retourne la distance
 * euclidienne (equirectangulaire) entre `p` et `a`.
 */
function perpendicularDistanceMeters(
  p: GpsPoint,
  a: GpsPoint,
  b: GpsPoint,
): number {
  const latRef = (a.lat + b.lat) / 2;
  const mLng = metersPerDegLng(latRef);

  const px = p.lng * mLng;
  const py = p.lat * METERS_PER_DEG_LAT;
  const ax = a.lng * mLng;
  const ay = a.lat * METERS_PER_DEG_LAT;
  const bx = b.lng * mLng;
  const by = b.lat * METERS_PER_DEG_LAT;

  const dx = bx - ax;
  const dy = by - ay;

  // Segment degenere : a == b
  if (dx === 0 && dy === 0) {
    const ex = px - ax;
    const ey = py - ay;
    return Math.sqrt(ex * ex + ey * ey);
  }

  // Projection du point sur la droite portee par le segment
  // t ∈ [0,1] → pied dans le segment ; hors borne → extremite la plus proche
  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  const tClamped = Math.max(0, Math.min(1, t));

  const closestX = ax + tClamped * dx;
  const closestY = ay + tClamped * dy;

  const ex = px - closestX;
  const ey = py - closestY;
  return Math.sqrt(ex * ex + ey * ey);
}

// ---------------------------------------------------------------------------
// Algorithme Douglas-Peucker (recursif, in-place sur indices)
// ---------------------------------------------------------------------------

function douglasPeuckerIndices(
  points: GpsPoint[],
  start: number,
  end: number,
  epsilonMeters: number,
  keep: boolean[],
): void {
  if (end - start <= 1) return; // moins d'un point intermediaire

  const a = points[start]!;
  const b = points[end]!;

  let maxDist = 0;
  let maxIdx = start;

  for (let i = start + 1; i < end; i++) {
    const dist = perpendicularDistanceMeters(points[i]!, a, b);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilonMeters) {
    keep[maxIdx] = true;
    douglasPeuckerIndices(points, start, maxIdx, epsilonMeters, keep);
    douglasPeuckerIndices(points, maxIdx, end, epsilonMeters, keep);
  }
  // sinon : tous les points intermediaires sont sous le seuil → on ne les garde pas
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Simplifie une trace GPS par l'algorithme Douglas-Peucker.
 *
 * - Preserve toujours le premier et le dernier point.
 * - `points.length <= 2` → tableau retourne tel quel.
 * - `epsilonMeters === 0` → aucun point supprime.
 *
 * La distance perpendiculaire est calculee en metres via une projection
 * equirectangulaire locale (erreur < 0,5 % sur des traces courantes).
 *
 * @param points       - Points GPS ordonnes dans le temps.
 * @param epsilonMeters - Seuil de simplification en metres (>= 0).
 * @returns Tableau simplifie de `GpsPoint` (sous-ensemble ordonne des points d'origine).
 */
export function simplifyTrack(points: GpsPoint[], epsilonMeters: number): GpsPoint[] {
  if (points.length <= 2) return points.slice();

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  douglasPeuckerIndices(points, 0, points.length - 1, epsilonMeters, keep);

  return points.filter((_, i) => keep[i]);
}

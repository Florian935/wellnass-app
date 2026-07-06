import { z } from 'zod';
import { syncFieldsSchema, utcTimestampSchema } from './sync';

// ---------------------------------------------------------------------------
// Statuts et sources
// ---------------------------------------------------------------------------

/**
 * Statuts d'une course.
 * - `active`    : course en cours.
 * - `completed` : course terminee normalement.
 * - `cancelled` : course interrompue / abandonnee.
 */
export const RUN_STATUSES = ['active', 'completed', 'cancelled'] as const;
export const runStatusSchema = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof runStatusSchema>;

/**
 * Sources d'une course.
 * - `gps`    : trace GPS enregistree en temps reel.
 * - `manual` : saisie manuelle (distance + duree).
 */
export const RUN_SOURCES = ['gps', 'manual'] as const;
export const runSourceSchema = z.enum(RUN_SOURCES);
export type RunSource = z.infer<typeof runSourceSchema>;

// ---------------------------------------------------------------------------
// Type point GPS
// ---------------------------------------------------------------------------

/**
 * Point GPS d'une trace de course.
 * `t` = secondes ecoulees depuis le debut de la course (0 au premier point).
 */
export interface GpsPoint {
  lat: number;
  lng: number;
  /** Secondes depuis le debut de la course. */
  t: number;
}

// ---------------------------------------------------------------------------
// Calcul Haversine
// ---------------------------------------------------------------------------

const EARTH_RADIUS_M = 6_371_000;

/**
 * Calcule la distance en metres entre deux coordonnees GPS
 * via la formule haversine.
 *
 * @param a - Premier point {lat, lng} en degres decimaux.
 * @param b - Deuxieme point {lat, lng} en degres decimaux.
 * @returns Distance en metres.
 */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aVal =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return EARTH_RADIUS_M * c;
}

// ---------------------------------------------------------------------------
// Distance totale avec filtrage des outliers GPS
// ---------------------------------------------------------------------------

/**
 * Seuil de vitesse maximale plausible en m/s.
 * Au-dela, le segment est considere comme un artefact GPS et ignore.
 * 12 m/s ~43 km/h (bien au-dela du sprint humain max ~10 m/s en competition).
 */
const MAX_PLAUSIBLE_SPEED_MS = 12;

/**
 * Calcule la distance totale d'une trace GPS en metres.
 *
 * Les segments dont la vitesse implicite depasse `MAX_PLAUSIBLE_SPEED_MS`
 * (ou dont le delta-t est nul) sont consideres comme des artefacts GPS
 * et exclus du cumul.
 *
 * @param points - Tableau en lecture seule de points GPS ordonnes dans le temps.
 * @returns Distance totale en metres.
 */
export function totalDistance(points: ReadonlyArray<GpsPoint>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const dt = curr.t - prev.t;
    if (dt <= 0) continue; // delta-t nul ou negatif : outlier
    const dist = haversineMeters(prev, curr);
    const speed = dist / dt;
    if (speed > MAX_PLAUSIBLE_SPEED_MS) continue; // glitch GPS
    total += dist;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Allures
// ---------------------------------------------------------------------------

/**
 * Calcule l'allure moyenne en secondes par kilometre.
 *
 * @param distanceM  - Distance totale en metres.
 * @param durationS  - Duree totale en secondes.
 * @returns Allure en s/km, ou `null` si `distanceM <= 0`.
 */
export function averagePace(distanceM: number, durationS: number): number | null {
  if (distanceM <= 0) return null;
  return (durationS / distanceM) * 1000;
}

/**
 * Calcule l'allure instantanee sur une fenetre glissante en secondes par kilometre.
 *
 * La fenetre couvre les `windowS` dernieres secondes de la trace
 * (depuis `lastPoint.t - windowS` jusqu'a `lastPoint.t`).
 *
 * @param points  - Tableau en lecture seule de points GPS ordonnes dans le temps.
 * @param windowS - Largeur de la fenetre en secondes (defaut : 60 s).
 * @returns Allure en s/km, ou `null` si la distance dans la fenetre est nulle.
 */
export function instantPace(
  points: ReadonlyArray<GpsPoint>,
  windowS = 60,
): number | null {
  if (points.length < 2) return null;
  const lastT = points[points.length - 1]!.t;
  const windowStart = lastT - windowS;

  // Filtrer les points dans la fenetre
  const windowPoints = points.filter((p) => p.t >= windowStart);
  if (windowPoints.length < 2) return null;

  let dist = 0;
  for (let i = 1; i < windowPoints.length; i++) {
    const prev = windowPoints[i - 1]!;
    const curr = windowPoints[i]!;
    const dt = curr.t - prev.t;
    if (dt <= 0) continue;
    const segDist = haversineMeters(prev, curr);
    const speed = segDist / dt;
    if (speed > MAX_PLAUSIBLE_SPEED_MS) continue;
    dist += segDist;
  }

  if (dist <= 0) return null;
  const duration = lastT - windowPoints[0]!.t;
  if (duration <= 0) return null;
  return (duration / dist) * 1000;
}

// ---------------------------------------------------------------------------
// Encodage polyline Google (precision 1e-5) + deltas temporels
//
// Format d'un segment encode :
//   <polyline_encoded>|<time_delta_encoded>
//
// Le separateur `|` ne peut pas apparaitre dans un polyline Google encode
// (seuls les caracteres ASCII 63-126 sont utilises).
//
// Format de la piste complete (plusieurs segments) :
//   <segment1>~<segment2>~...
//
// Le separateur `~` (ASCII 126) est hors du domaine polyline (63-125),
// ce qui garantit l'absence d'ambiguite.
//
// Les deltas temporels (entiers, secondes depuis debut de course) sont
// encodes en delta-encode puis avec le meme varint/zigzag que le polyline,
// separes par des virgules dans la partie time.
// ---------------------------------------------------------------------------

const POLY_SEPARATOR = '|'; // separateur polyline / temps dans un segment
const SEGMENT_SEPARATOR = '~'; // separateur entre segments dans la piste

// ---------------------------------------------------------------------------
// Primitives varint / zigzag (algorithme Google encoded polyline)
// ---------------------------------------------------------------------------

/**
 * Encode une valeur entiere signee en polyline chunk (varint + zigzag).
 * Precision imposee par l'appelant (multiplication avant appel).
 */
function encodeValue(value: number): string {
  // Arrondi sûr
  let v = Math.round(value);
  // Zigzag
  v = v < 0 ? ~(v << 1) : v << 1;
  let result = '';
  while (v >= 0x20) {
    result += String.fromCharCode(((v & 0x1f) | 0x20) + 63);
    v >>= 5;
  }
  result += String.fromCharCode(v + 63);
  return result;
}

/**
 * Decode un chunk varint/zigzag depuis `encoded` a partir de `index`.
 * Retourne { value, nextIndex }.
 */
function decodeValue(encoded: string, index: number): { value: number; nextIndex: number } {
  let result = 0;
  let shift = 0;
  let b: number;
  let idx = index;
  do {
    b = encoded.charCodeAt(idx++) - 63;
    result |= (b & 0x1f) << shift;
    shift += 5;
  } while (b >= 0x20);
  // Dezigzag
  const value = result & 1 ? ~(result >> 1) : result >> 1;
  return { value, nextIndex: idx };
}

// ---------------------------------------------------------------------------
// Encodage polyline coordonnees (lat/lng) a precision 1e-5
// ---------------------------------------------------------------------------

function encodeCoords(points: ReadonlyArray<{ lat: number; lng: number }>): string {
  let prevLat = 0;
  let prevLng = 0;
  let encoded = '';
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    encoded += encodeValue(lat - prevLat);
    encoded += encodeValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return encoded;
}

function decodeCoords(encoded: string): Array<{ lat: number; lng: number }> {
  const result: Array<{ lat: number; lng: number }> = [];
  let idx = 0;
  let lat = 0;
  let lng = 0;
  while (idx < encoded.length) {
    const dLat = decodeValue(encoded, idx);
    idx = dLat.nextIndex;
    lat += dLat.value;
    const dLng = decodeValue(encoded, idx);
    idx = dLng.nextIndex;
    lng += dLng.value;
    result.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Encodage des deltas temporels (entiers, secondes depuis debut de course)
// Meme schema varint/zigzag que les coordonnees
// ---------------------------------------------------------------------------

function encodeTimes(points: ReadonlyArray<{ t: number }>): string {
  let prevT = 0;
  let encoded = '';
  for (const p of points) {
    encoded += encodeValue(p.t - prevT);
    prevT = p.t;
  }
  return encoded;
}

function decodeTimes(encoded: string, count: number): number[] {
  const result: number[] = [];
  let idx = 0;
  let t = 0;
  for (let i = 0; i < count; i++) {
    const d = decodeValue(encoded, idx);
    idx = d.nextIndex;
    t += d.value;
    result.push(t);
  }
  return result;
}

// ---------------------------------------------------------------------------
// API publique : encodeSegment / appendToTrack / decodeTrack
// ---------------------------------------------------------------------------

/**
 * Encode un segment de points GPS en une chaine compacte.
 *
 * Format : `<polyline_coords>|<time_deltas>`
 *
 * Les coordonnees sont encodees avec l'algorithme Google Encoded Polyline
 * (precision 1e-5). Les deltas temporels (en secondes depuis le debut de
 * la course) utilisent le meme schema varint/zigzag.
 *
 * Le separateur `|` ne peut pas apparaitre dans un polyline Google encode
 * (domaine ASCII 63-126 hors `|`=124... en fait `|` = 124 = 0x7C).
 *
 * Note de securite : `|` (ASCII 124) est dans le domaine theorique du polyline
 * (63-126). Pour garantir l'absence d'ambiguite, on utilise le separateur
 * entre les deux parties (coords et temps) d'un meme segment, et `~` (ASCII 126,
 * valeur max du domaine polyline) comme separateur inter-segments.
 * L'encodeur n'emet jamais `~` car la valeur 126-63=63=0x3F=0b111111 correspond
 * a un chunk dont tous les bits data valent 1 et le bit continuation vaut 1,
 * ce qui ne termine jamais un chunk — il est toujours suivi d'un autre octet.
 * En pratique Google encode polyline utilise 63-90 et 95-126 ; le caractere
 * `~`=126 peut apparaitre comme dernier octet d'un chunk dont la valeur delta
 * code serait exactement 63 (0x3F en zigzag non-shifted). C'est theoriquement
 * possible. On choisit donc un separateur de segment qui ne peut PAS etre emis :
 * on prefixe chaque segment par sa longueur en ASCII decimal + ':'.
 *
 * Nouveau format piste : `<len1>:<seg1><len2>:<seg2>...`
 * ou <lenN> est la longueur en octets du segment encode N.
 *
 * Cela rend `appendToTrack` O(1) en n'ayant pas a decoder les segments precedents.
 *
 * @param points - Points GPS du segment.
 * @returns Chaine encodee du segment, ou `""` si `points` est vide.
 */
export function encodeSegment(points: ReadonlyArray<GpsPoint>): string {
  if (points.length === 0) return '';
  const coords = encodeCoords(points);
  const times = encodeTimes(points);
  return coords + POLY_SEPARATOR + times;
}

/**
 * Ajoute un segment encode a une piste existante.
 *
 * La piste est stockee comme une concatenation de blocs prefixes par leur longueur :
 * `<len1>:<seg1><len2>:<seg2>...`
 *
 * Cette conception permet l'ajout O(1) sans re-encoder les segments precedents.
 *
 * @param track   - Piste existante (peut etre `""`).
 * @param segment - Segment encode par `encodeSegment` (peut etre `""`).
 * @returns Nouvelle piste avec le segment ajoute.
 */
export function appendToTrack(track: string, segment: string): string {
  if (segment === '') return track;
  return track + segment.length.toString() + ':' + segment;
}

/**
 * Decode une piste complete en tableau de points GPS.
 *
 * @param track - Piste encodee par `appendToTrack`.
 * @returns Tableau ordonne de points GPS, ou `[]` si la piste est vide.
 */
export function decodeTrack(track: string): GpsPoint[] {
  if (track === '') return [];

  const allPoints: GpsPoint[] = [];
  let idx = 0;

  while (idx < track.length) {
    // Lire la longueur du segment
    const colonPos = track.indexOf(':', idx);
    if (colonPos === -1) break; // donnees corrompues
    const segLen = parseInt(track.slice(idx, colonPos), 10);
    if (isNaN(segLen) || segLen < 0) break;
    const segStart = colonPos + 1;
    const segEnd = segStart + segLen;
    const segment = track.slice(segStart, segEnd);
    idx = segEnd;

    if (segment === '') continue;

    // Decoder le segment
    const sepIdx = segment.indexOf(POLY_SEPARATOR);
    if (sepIdx === -1) continue; // segment malformed

    const coordsPart = segment.slice(0, sepIdx);
    const timesPart = segment.slice(sepIdx + 1);

    const coords = decodeCoords(coordsPart);
    const times = decodeTimes(timesPart, coords.length);

    for (let i = 0; i < coords.length; i++) {
      allPoints.push({ lat: coords[i]!.lat, lng: coords[i]!.lng, t: times[i]! });
    }
  }

  return allPoints;
}

// ---------------------------------------------------------------------------
// Schema Zod ligne course (table `runs`)
// ---------------------------------------------------------------------------

/**
 * Ligne course (table `runs`).
 * Etend `syncFieldsSchema` (id + userId + timestamps + soft delete).
 */
export const runRowSchema = syncFieldsSchema.extend({
  /** Statut courant de la course. */
  status: runStatusSchema,
  /** Source de la course (GPS ou saisie manuelle). */
  source: runSourceSchema,
  /** Moment de demarrage de la course (UTC). */
  startedAt: utcTimestampSchema,
  /** Moment de fin de la course (UTC, nullable si en cours). */
  finishedAt: utcTimestampSchema.nullable(),
  /** Duree totale en secondes (nullable, calculee a la fin). */
  durationSeconds: z.number().int().nonnegative().nullable(),
  /** Distance totale en metres (nullable). */
  distanceM: z.number().nonnegative().nullable(),
  /** Allure moyenne en secondes par kilometre (nullable). */
  avgPaceSPerKm: z.number().nullable(),
  /** Trace GPS encodee (nullable si saisie manuelle ou non encore enregistree). */
  gpsTrack: z.string().nullable(),
  /** Effort percu (Rate of Perceived Exertion), entier entre 1 et 10. */
  rpe: z.number().int().min(1).max(10).nullable(),
  /** Notes libres sur la course. */
  notes: z.string().nullable(),
});
export type RunRow = z.infer<typeof runRowSchema>;

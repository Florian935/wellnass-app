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
 *
 * Exporte comme source de verite unique : le tracker de fond (`tracker-task.ts`)
 * l'importe pour son propre filtre d'outliers plutot que de le redeclarer.
 */
export const MAX_PLAUSIBLE_SPEED_MS = 12;

// ---------------------------------------------------------------------------
// Filtre des fixes GPS invalides a l'ingestion
// ---------------------------------------------------------------------------

/**
 * Precision horizontale maximale (m) acceptee pour un fix GPS.
 * Au-dela, le fix est trop degrade pour etre fiable et est ecarte a l'ingestion.
 */
export const ACCURACY_MAX_M = 50;

/**
 * Coordonnee GPS candidate a l'ingestion. `accuracy` = precision horizontale
 * estimee en metres (peut etre absente/`null`, cas `LocationObject` d'Expo).
 */
export interface GpsFixCandidate {
  lat: number;
  lng: number;
  accuracy?: number | null;
}

/**
 * Predicat PUR : un fix GPS est-il valide (a conserver dans la trace) ?
 *
 * Rejette un fix si :
 *  - `lat`/`lng` absents ou non finis (NaN, Infinity) ;
 *  - `lat === 0 && lng === 0` (« null island » — fix degrade classique) ;
 *  - hors bornes geographiques (`|lat| > 90` ou `|lng| > 180`) ;
 *  - `accuracy` presente et `> ACCURACY_MAX_M` (precision trop mauvaise).
 *
 * Un `accuracy` absent/`null` n'entraine PAS de rejet (l'info n'est pas toujours
 * fournie par la plateforme). Fonction pure, testable avec des objets simples.
 */
export function isValidFix(fix: GpsFixCandidate): boolean {
  const { lat, lng, accuracy } = fix;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false; // null island
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false; // hors bornes
  if (accuracy != null && accuracy > ACCURACY_MAX_M) return false;
  return true;
}

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
// Vitesse lissee (auto-pause) — Volet B
// ---------------------------------------------------------------------------

/**
 * Vitesse moyenne LISSEE (m/s) sur les `windowS` dernieres secondes de la trace.
 *
 * Contrairement a la vitesse instantanee point-a-point (tres bruitee en GPS —
 * une marche lente reelle a 0,72 m/s plonge regulierement sous 0,5 m/s), on
 * moyenne la distance parcourue sur une fenetre temporelle. Un vrai arret
 * prolonge fait tendre cette moyenne vers 0 ; un simple creux de bruit ne la
 * fait pas passer sous le seuil. Les segments « glitch » (> `MAX_PLAUSIBLE_SPEED_MS`
 * ou delta-t nul) sont exclus, coherent avec `totalDistance`.
 *
 * @param points  - Points GPS ordonnes dans le temps (au moins 2 utiles).
 * @param windowS - Largeur de la fenetre en secondes.
 * @returns Vitesse moyenne en m/s sur la fenetre, ou `null` si indeterminee
 *          (< 2 points dans la fenetre, ou duree de fenetre nulle).
 */
export function smoothedSpeedMs(
  points: ReadonlyArray<GpsPoint>,
  windowS: number,
): number | null {
  if (points.length < 2) return null;
  const lastT = points[points.length - 1]!.t;
  const windowStart = lastT - windowS;
  const windowPoints = points.filter((p) => p.t >= windowStart);
  if (windowPoints.length < 2) return null;

  let dist = 0;
  for (let i = 1; i < windowPoints.length; i++) {
    const prev = windowPoints[i - 1]!;
    const curr = windowPoints[i]!;
    const dt = curr.t - prev.t;
    if (dt <= 0) continue;
    const segDist = haversineMeters(prev, curr);
    if (segDist / dt > MAX_PLAUSIBLE_SPEED_MS) continue; // glitch GPS
    dist += segDist;
  }
  const duration = lastT - windowPoints[0]!.t;
  if (duration <= 0) return null;
  return dist / duration;
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
// Encodage polyline Google (coordonnees) + deltas temporels
//
// Coordonnees encodees en Google Encoded Polyline ; deltas temporels (secondes
// depuis le depart) avec le meme schema varint/zigzag. La PRECISION des coords et
// le SEPARATEUR coords/temps dependent de la VERSION du segment (voir le bloc
// « Versionnage du format de segment » ci-dessous). La piste complete est une
// concatenation de blocs prefixes par leur longueur : `<len1>:<seg1><len2>:<seg2>...`.
// ---------------------------------------------------------------------------

const POLY_SEPARATOR = '|'; // separateur polyline / temps dans un segment herite (v0)

// ---------------------------------------------------------------------------
// Versionnage du format de segment (precision d'encodage des coordonnees)
// ---------------------------------------------------------------------------
//
// Historique : les premieres traces encodent les coordonnees a 1e-5 (~1,1 m).
// Cette maille est trop grossiere pour une marche lente (pas ~0,7 m sous la
// maille) → la trace DECODEE sous-compte la distance et un record 1 km peut
// manquer. On passe donc a 1e-6 (~0,11 m).
//
// Compat ascendante OBLIGATOIRE : les traces deja stockees (1e-5) doivent
// continuer a se decoder correctement. On introduit un marqueur de version en
// TETE du contenu de chaque segment :
//
//   - Segment HERITE (v0, 1e-5)  : `<coords>|<times>`   (aucun marqueur)
//   - Segment VERSIONNE (v1, 1e-6) : `#1#<coords>|<times>`
//
// Le marqueur commence par `#` (ASCII 35), STRICTEMENT hors du domaine polyline
// Google (ASCII 63-126). Un segment herite commence donc toujours par un
// caractere >= 63 : la presence de `#` en premiere position est un signal
// non ambigu de segment versionne. `decodeTrack` lit la version par segment et
// applique le facteur de precision correspondant → une trace MIXTE (segments
// 1e-5 herites puis 1e-6) se decode correctement, dans l'ordre.

/** Prefixe/suffixe du marqueur de version en tete de contenu de segment. */
const VERSION_MARKER = '#';

/** Version d'encodage courante des NOUVEAUX segments. */
const CURRENT_SEGMENT_VERSION = 1;

/** Facteur de precision des coordonnees par version de segment. */
const PRECISION_BY_VERSION: Record<number, number> = {
  0: 1e5, // herite : 1e-5 (~1,1 m)
  1: 1e6, // courant : 1e-6 (~0,11 m)
};

// Separateur coords/temps a l'INTERIEUR d'un segment, selon la version.
//
// A 1e-5, les deltas etaient assez petits pour que le caractere `|` (ASCII 124)
// n'apparaisse jamais dans un chunk polyline → separateur sur (donc conserve
// pour la compat des segments HERITES v0). A 1e-6, les deltas sont 10x plus
// grands et un chunk peut valoir `|` : ce separateur devient ambigu. Les
// segments VERSIONNES (v1+) utilisent donc un separateur STRICTEMENT hors du
// domaine polyline (63-126) : `,` (ASCII 44), que `encodeValue` n'emet jamais.
const SEG_SEPARATOR_V0 = POLY_SEPARATOR; // herite : `|`
const SEG_SEPARATOR_V1 = ','; // versionne : hors domaine polyline

/** Separateur coords/temps applicable a une version de segment donnee. */
function segSeparatorForVersion(version: number): string {
  return version === 0 ? SEG_SEPARATOR_V0 : SEG_SEPARATOR_V1;
}

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
// Encodage polyline coordonnees (lat/lng) — precision parametree (voir versionnage)
// ---------------------------------------------------------------------------

function encodeCoords(
  points: ReadonlyArray<{ lat: number; lng: number }>,
  precision: number,
): string {
  let prevLat = 0;
  let prevLng = 0;
  let encoded = '';
  for (const p of points) {
    const lat = Math.round(p.lat * precision);
    const lng = Math.round(p.lng * precision);
    encoded += encodeValue(lat - prevLat);
    encoded += encodeValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return encoded;
}

function decodeCoords(
  encoded: string,
  precision: number,
): Array<{ lat: number; lng: number }> {
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
    result.push({ lat: lat / precision, lng: lng / precision });
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
 * Encode un segment de points GPS en une chaine compacte, au format COURANT (v1).
 *
 * Format d'un segment v1 : `#1#<polyline_coords>,<time_deltas>`
 *  - `#1#` : marqueur de version en tete (voir le bloc « Versionnage du format de
 *    segment » plus haut) — `#` (ASCII 35) est hors du domaine polyline, donc non
 *    ambigu face a un segment herite v0 qui, lui, commence par un octet >= 63.
 *  - coordonnees encodees en Google Encoded Polyline a precision 1e-6 (~0,11 m) ;
 *  - deltas temporels (s depuis le depart) avec le meme schema varint/zigzag ;
 *  - separateur coords/temps `,` (ASCII 44, hors domaine polyline) — a 1e-6 les
 *    deltas peuvent emettre `|`, d'ou l'abandon de `|` (conserve pour decoder les
 *    segments HERITES v0 uniquement).
 *
 * La piste complete est une concatenation de blocs prefixes par leur longueur
 * (`<len1>:<seg1><len2>:<seg2>...`), ce qui rend `appendToTrack` O(1) : on n'a pas
 * a re-decoder les segments precedents. `decodeTrack` lit `<len>` puis exactement
 * `<len>` octets, et dispatche le decodage du segment selon son marqueur de version.
 *
 * @param points - Points GPS du segment.
 * @returns Chaine encodee du segment, ou `""` si `points` est vide.
 */
export function encodeSegment(points: ReadonlyArray<GpsPoint>): string {
  if (points.length === 0) return '';
  const precision = PRECISION_BY_VERSION[CURRENT_SEGMENT_VERSION]!;
  const coords = encodeCoords(points, precision);
  const times = encodeTimes(points);
  const separator = segSeparatorForVersion(CURRENT_SEGMENT_VERSION);
  // Marqueur de version en tete : `#<version>#` (voir bloc versionnage).
  const versionTag =
    VERSION_MARKER + CURRENT_SEGMENT_VERSION.toString() + VERSION_MARKER;
  return versionTag + coords + separator + times;
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

    // Lire l'eventuel marqueur de version en tete de segment.
    // Herite (v0, 1e-5) : aucun marqueur (le contenu commence par un chunk
    //   polyline, ASCII >= 63). Versionne (v1+, 1e-6) : prefixe `#<version>#`.
    let version = 0;
    let body = segment;
    if (segment.startsWith(VERSION_MARKER)) {
      const endMarker = segment.indexOf(VERSION_MARKER, 1);
      if (endMarker === -1) continue; // marqueur malformed
      const parsedVersion = parseInt(segment.slice(1, endMarker), 10);
      if (isNaN(parsedVersion)) continue; // version illisible
      version = parsedVersion;
      body = segment.slice(endMarker + 1);
    }
    const precision = PRECISION_BY_VERSION[version];
    if (precision === undefined) continue; // version inconnue → segment ignore

    // Decoder le corps du segment (coords <sep> temps). Le separateur depend de
    // la version (`|` herite, `,` versionne — voir bloc versionnage).
    const sepIdx = body.indexOf(segSeparatorForVersion(version));
    if (sepIdx === -1) continue; // segment malformed

    const coordsPart = body.slice(0, sepIdx);
    const timesPart = body.slice(sepIdx + 1);

    const coords = decodeCoords(coordsPart, precision);
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

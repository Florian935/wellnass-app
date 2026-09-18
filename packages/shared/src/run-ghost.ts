/**
 * US FANT-01 — Le Fantôme : courir contre soi-même sur le même parcours.
 * Réf. : docs/specs/functional/us/fant01-fantome-course.md
 *
 * ⚠️ **Ne pas confondre avec [ghost.ts](./ghost.ts)**, qui est le fantôme de la **musculation**
 * (MUSCU-UX03, comparaison de tonnage série après série). Deux piliers, deux fantômes, deux modules :
 * ici on compare des **distances parcourues à temps égal** sur une trace GPS.
 *
 * Module **pur** : aucune date, aucun I/O, aucune chaîne de texte. L'écran tient l'état et parle
 * (`ghost-guidance.ts`), comme pour RUN-F2a et RUN-F4 lot E.
 */

import { haversineMeters, isValidCoord, type GpsPoint } from './running';

// ---------------------------------------------------------------------------
// Constantes de cadrage (spec §5) — exportées pour être relisibles et ajustables
// ---------------------------------------------------------------------------

/**
 * Au-delà de ce trou entre deux points, on considère que le fantôme était **en pause** : le temps
 * ne compte pas, la distance si (R3). Sans cette règle, on comparerait le temps **net** du coureur
 * au temps d'**horloge** du fantôme — et une course d'il y a trois semaines avec un arrêt au feu
 * rouge paraîtrait bien plus lente qu'elle ne l'était.
 */
export const GHOST_PAUSE_GAP_S = 60;

/** En deçà de cet écart, on parle de « coude à coude » plutôt que d'avance ou de retard. */
export const GHOST_LEVEL_M = 5;

/** Distance maximale entre le départ d'une course passée et le départ actuel (R2). */
export const GHOST_MAX_START_DISTANCE_M = 300;

/** En dessous de cette distance, une course n'est pas un fantôme intéressant (R2). */
export const GHOST_MIN_DISTANCE_M = 500;

/** Délai minimum entre deux annonces vocales de fantôme (R6). */
export const GHOST_ANNOUNCE_MIN_GAP_S = 60;

// ---------------------------------------------------------------------------
// Profil du fantôme
// ---------------------------------------------------------------------------

/** Un échantillon du profil : temps **net** écoulé (s) et distance cumulée (m). */
export type GhostSample = { t: number; d: number };

export type GhostProfile = {
  /** Échantillons, strictement croissants en temps. */
  samples: GhostSample[];
  /** Distance totale de la course fantôme (m). */
  totalDistanceM: number;
  /** Durée **nette** totale de la course fantôme (s). */
  totalSeconds: number;
};

export type GhostStatus = 'ahead' | 'behind' | 'level' | 'finished';

export type GhostGap = {
  /** Écart en mètres, arrondi. Positif = le coureur est devant. */
  meters: number;
  status: GhostStatus;
  /** Écart converti en secondes à l'allure moyenne du coureur, `null` si elle est inconnue. */
  seconds: number | null;
};

/**
 * Construit le profil d'un fantôme à partir d'une trace décodée (R1).
 *
 * Les points aux coordonnées invalides sont **ignorés** plutôt que de faire échouer le profil : une
 * trace abîmée reste utilisable, c'est déjà le parti pris de `decodeTrack`. `null` en dessous de deux
 * points valides — il n'y a alors ni distance ni durée à comparer.
 */
export function buildGhostProfile(points: ReadonlyArray<GpsPoint>): GhostProfile | null {
  const valid = points.filter((p) => isValidCoord(p.lat, p.lng));
  if (valid.length < 2) return null;

  const samples: GhostSample[] = [{ t: 0, d: 0 }];
  let netSeconds = 0;
  let distance = 0;

  for (let i = 1; i < valid.length; i++) {
    const prev = valid[i - 1]!;
    const curr = valid[i]!;
    const rawGap = curr.t - prev.t;
    // Un trou trop long = une pause : la distance est conservée, le temps non (R3).
    const gap = rawGap > GHOST_PAUSE_GAP_S || rawGap < 0 ? 0 : rawGap;
    netSeconds += gap;
    distance += haversineMeters(prev, curr);
    samples.push({ t: netSeconds, d: distance });
  }

  return { samples, totalDistanceM: distance, totalSeconds: netSeconds };
}

/**
 * Distance parcourue par le fantôme à un instant donné (R1), par interpolation linéaire entre les
 * deux échantillons qui l'encadrent — recherche par **dichotomie** (R10).
 *
 * Jamais d'extrapolation : avant le départ c'est 0, après la fin c'est la distance totale (R5).
 */
export function ghostDistanceAt(profile: GhostProfile, netSeconds: number): number {
  const { samples } = profile;
  if (netSeconds <= 0) return 0;
  const last = samples[samples.length - 1]!;
  if (netSeconds >= last.t) return last.d;

  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid]!.t <= netSeconds) lo = mid;
    else hi = mid;
  }

  const a = samples[lo]!;
  const b = samples[hi]!;
  const span = b.t - a.t;
  // Défensif : la dichotomie ne renvoie jamais deux échantillons au même temps (elle remonte
  // toujours au dernier t <= cible), mais un profil construit autrement ne doit pas diviser par zéro.
  if (span <= 0) return b.d;
  const ratio = (netSeconds - a.t) / span;
  return a.d + (b.d - a.d) * ratio;
}

/**
 * Écart entre le coureur et son fantôme au même temps net (R4, R5).
 *
 * `seconds` est **dérivé** de l'allure moyenne courante : c'est une lecture de confort, pas une
 * seconde mesure. Sans allure moyenne (départ, données absentes), il vaut `null` — on n'invente pas
 * une vitesse pour pouvoir afficher un chiffre.
 */
export function ghostGap(input: {
  profile: GhostProfile;
  runnerDistanceM: number;
  netSeconds: number;
  avgPaceSPerKm: number | null;
}): GhostGap {
  const { profile, runnerDistanceM, netSeconds, avgPaceSPerKm } = input;
  const finished = netSeconds > profile.totalSeconds;
  const ghostDistance = ghostDistanceAt(profile, netSeconds);
  const meters = Math.round(runnerDistanceM - ghostDistance);

  const status: GhostStatus = finished
    ? 'finished'
    : Math.abs(meters) < GHOST_LEVEL_M
      ? 'level'
      : meters > 0
        ? 'ahead'
        : 'behind';

  let seconds: number | null = null;
  if (avgPaceSPerKm != null && avgPaceSPerKm > 0 && Number.isFinite(avgPaceSPerKm)) {
    const speedMs = 1000 / avgPaceSPerKm;
    seconds = Math.round(meters / speedMs);
  }

  return { meters, status, seconds };
}

/**
 * Une course passée peut-elle servir de fantôme ici et maintenant (R2) ?
 *
 * Trois conditions : une trace exploitable, une distance qui vaut la peine, et un **départ proche**
 * du départ actuel. Le tri « même parcours » s'arrête là : deux boucles qui partent du même endroit
 * suffisent à rendre la comparaison parlante, et exiger une superposition des tracés écarterait une
 * variante de quartier pour rien.
 */
export function isGhostCandidate(input: {
  distanceM: number | null;
  points: ReadonlyArray<GpsPoint>;
  startLat: number;
  startLng: number;
}): boolean {
  const { distanceM, points, startLat, startLng } = input;
  if (distanceM == null || distanceM < GHOST_MIN_DISTANCE_M) return false;
  if (!isValidCoord(startLat, startLng)) return false;

  const profile = buildGhostProfile(points);
  if (profile === null) return false;

  // Défensif : un profil non nul garantit au moins deux points valides, donc `first` existe.
  const first = points.find((p) => isValidCoord(p.lat, p.lng));
  if (first === undefined) return false;

  return (
    haversineMeters({ lat: startLat, lng: startLng }, first) <= GHOST_MAX_START_DISTANCE_M
  );
}

/**
 * Faut-il annoncer le fantôme maintenant (R6) ?
 *
 * On ne parle que d'un **changement** de statut, jamais du coude à coude (qui oscillerait) ni d'un
 * fantôme terminé (il n'y a plus de course). L'anti-répétition est la même que pour l'allure : un
 * délai minimum en temps **net**, pour qu'une pause ne libère pas la parole.
 */
export function shouldAnnounceGhost(input: {
  status: GhostStatus;
  lastStatus: GhostStatus | null;
  lastAnnouncedAtS: number | null;
  netSeconds: number;
}): boolean {
  const { status, lastStatus, lastAnnouncedAtS, netSeconds } = input;
  if (status === 'finished' || status === 'level') return false;
  if (status === lastStatus) return false;
  if (lastAnnouncedAtS != null && netSeconds - lastAnnouncedAtS < GHOST_ANNOUNCE_MIN_GAP_S) {
    return false;
  }
  return true;
}

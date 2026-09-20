/**
 * US EFFORT-01 — le **journal des efforts** d'une course.
 * Réf. : docs/specs/functional/us/effort01-meilleurs-efforts-sortie.md
 *
 * ── Pourquoi ce module existe ───────────────────────────────────────────────────────────────────
 * `running_pace_records` porte un **index unique `(user_id, distance_key)`** : une ligne par
 * distance, le meilleur temps, point. C'est un **palmarès**, pas un journal — l'app était donc
 * *structurellement* incapable de dire « 2ᵉ meilleur temps ». Un classement suppose l'historique des
 * efforts ; il n'existait pas.
 *
 * Ce module est **pur** : aucune date, aucun I/O, aucune chaîne de texte, aucun accès base. Il
 * calcule les efforts d'une trace, les classe, et choisit lesquels méritent une médaille sur la
 * carte. L'écran et le repository font le reste.
 *
 * ⚠️ **Le rang n'est jamais stocké** (spec R7). Il est dérivé à chaque affichage : un effort classé
 * 2ᵉ devient 3ᵉ à la course suivante **sans que sa propre ligne ait bougé**. Le journal est
 * matérialisé, le classement est calculé.
 */

import {
  bestSegmentWindowFromSamples,
  cumulativeDistances,
  RUNNING_RECORD_DISTANCES,
  type RecordDistanceKey,
} from './pace-records';
import type { GpsPoint } from './running';

// ---------------------------------------------------------------------------
// Constantes de cadrage — exportées pour être relisibles et ajustables
// ---------------------------------------------------------------------------

/**
 * Allure en dessous de laquelle un segment est du **bruit GPS**, pas une performance (spec R17).
 *
 * 2:00 /km, soit 8,33 m/s. `cumulativeDistances` écarte déjà les bonds au-delà de
 * `MAX_PLAUSIBLE_SPEED_MS` (12 m/s), mais un segment tenu entre les deux survit à ce filtre tout en
 * étant invraisemblable sur une distance entière. Sans ce seuil, un glitch écrirait un record.
 */
export const EFFORT_MIN_PACE_S_PER_KM = 120;

/** Nombre maximum de médailles posées sur la carte (spec R11) — 390 px de large. */
export const MAX_MAP_MEDALS = 2;

/** Au-delà de ce rang, aucune médaille (spec R12) : on ne décore pas un 12ᵉ temps. */
export const MAX_MEDAL_RANK = 3;

// ---------------------------------------------------------------------------
// Les efforts d'une course
// ---------------------------------------------------------------------------

/** Un meilleur segment glissant, dans une course donnée. */
export type RunEffort = {
  distanceKey: RecordDistanceKey;
  timeSeconds: number;
  /** Point de la trace juste avant le départ (interpolé) de la fenêtre. */
  startIndex: number;
  /** Point de la trace qui a franchi la distance cible. */
  endIndex: number;
  /** Milieu de la fenêtre — c'est là que se pose la médaille (spec R10). `null` si introuvable. */
  midLat: number | null;
  midLng: number | null;
};

/**
 * Position interpolée à une distance cumulée donnée le long de la trace.
 *
 * `null` si la cible tombe hors de la trace. Un palier de distance nulle (outlier neutralisé par
 * `cumulativeDistances`) n'est pas un cas d'erreur : on prend son point de départ.
 */
function positionAtDistance(
  points: ReadonlyArray<GpsPoint>,
  cum: ReadonlyArray<number>,
  target: number,
): { lat: number; lng: number } | null {
  const n = cum.length;
  if (n === 0 || target < 0 || target > cum[n - 1]!) return null;
  for (let i = 0; i + 1 < n; i++) {
    if (cum[i + 1]! < target) continue;
    const span = cum[i + 1]! - cum[i]!;
    const a = points[i]!;
    if (span <= 0) return { lat: a.lat, lng: a.lng };
    const frac = (target - cum[i]!) / span;
    const b = points[i + 1]!;
    return { lat: a.lat + frac * (b.lat - a.lat), lng: a.lng + frac * (b.lng - a.lng) };
  }
  const last = points[n - 1]!;
  return { lat: last.lat, lng: last.lng };
}

/**
 * Les efforts d'une course, une entrée par distance **atteinte** (spec R2).
 *
 * Jamais de zéro, jamais de `null` : une distance que la course n'atteint pas n'a simplement pas de
 * ligne. Les efforts sortent dans l'ordre croissant de `RUNNING_RECORD_DISTANCES`.
 */
export function computeRunEfforts(points: ReadonlyArray<GpsPoint>): RunEffort[] {
  if (points.length < 2) return [];
  const cum = cumulativeDistances(points);
  const t = points.map((p) => p.t);
  const out: RunEffort[] = [];

  for (const { key, meters } of RUNNING_RECORD_DISTANCES) {
    const win = bestSegmentWindowFromSamples(cum, t, meters);
    if (win === null) continue;

    // Spec R17 — sous le seuil, c'est du bruit GPS : on n'écrit rien plutôt que d'inventer un record.
    const paceSecondsPerKm = win.seconds / (meters / 1000);
    if (paceSecondsPerKm < EFFORT_MIN_PACE_S_PER_KM) continue;

    const mid = positionAtDistance(points, cum, cum[win.endIdx]! - meters / 2);
    out.push({
      distanceKey: key,
      timeSeconds: win.seconds,
      startIndex: win.startIdx,
      endIndex: win.endIdx,
      midLat: mid?.lat ?? null,
      midLng: mid?.lng ?? null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Le classement — dérivé, jamais stocké (spec R6, R7, R8)
// ---------------------------------------------------------------------------

/** Le minimum dont le classement a besoin. Tout le reste de l'objet est conservé tel quel. */
export type RankableEffort = { timeSeconds: number; achievedAt: string };

export type RankedEffort<T> = T & {
  /** 1 = record personnel. */
  rank: number;
  /** Secondes qui séparent cet effort du meilleur temps de la distance. `0` pour un record. */
  gapSeconds: number;
};

/**
 * Classe les efforts d'une **même distance**, du plus rapide au plus lent.
 *
 * ⚠️ **À égalité stricte de temps, le plus ancien garde la tête** (spec R6) : on ne déclasse pas un
 * record existant avec un temps identique. La liste reçue n'est jamais modifiée.
 */
export function rankEfforts<T extends RankableEffort>(efforts: ReadonlyArray<T>): RankedEffort<T>[] {
  if (efforts.length === 0) return [];
  const sorted = [...efforts].sort(
    (a, b) => a.timeSeconds - b.timeSeconds || a.achievedAt.localeCompare(b.achievedAt),
  );
  const best = sorted[0]!.timeSeconds;
  return sorted.map((e, i) => ({ ...e, rank: i + 1, gapSeconds: e.timeSeconds - best }));
}

// ---------------------------------------------------------------------------
// Les médailles de la carte (spec R11, R12)
// ---------------------------------------------------------------------------

/** Ce dont le choix des médailles a besoin ; le reste de l'objet passe tel quel. */
export type MedalCandidate = { rank: number; distanceMeters: number };

/**
 * Les efforts qui méritent une pastille sur la carte : **au plus deux**, **jamais au-delà du rang
 * 3**. Rang croissant d'abord, puis distance décroissante à égalité — un record sur 5 km parle plus
 * fort qu'un record sur 400 m.
 *
 * La règle de proximité à l'écran (spec R13) n'est **pas** ici : elle dépend du zoom de la carte,
 * donc elle appartient au composant, pas au moteur.
 */
export function pickMapMedals<T extends MedalCandidate>(efforts: ReadonlyArray<T>): T[] {
  return [...efforts]
    .filter((e) => e.rank <= MAX_MEDAL_RANK)
    .sort((a, b) => a.rank - b.rank || b.distanceMeters - a.distanceMeters)
    .slice(0, MAX_MAP_MEDALS);
}

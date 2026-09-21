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
 * La règle de proximité (spec R13) est appliquée **après**, par `dropOverlappingMedals` : elle a
 * besoin du cadrage et de la taille de la carte, que seul le composant connaît.
 */
export function pickMapMedals<T extends MedalCandidate>(efforts: ReadonlyArray<T>): T[] {
  return [...efforts]
    .filter((e) => e.rank <= MAX_MEDAL_RANK)
    .sort((a, b) => a.rank - b.rank || b.distanceMeters - a.distanceMeters)
    .slice(0, MAX_MAP_MEDALS);
}

// ---------------------------------------------------------------------------
// Chevauchement des médailles à l'écran (spec R13)
// ---------------------------------------------------------------------------

/** Bornes d'une carte, dans l'ordre de MapLibre : `[ouest, sud, est, nord]`. */
export type MapBounds = readonly [number, number, number, number];

/**
 * Écart minimal entre deux pastilles, en pixels (spec R13).
 *
 * 44 px n'est pas un nombre choisi au hasard : c'est la taille minimale d'une cible tactile. Deux
 * médailles plus proches que ça ne sont pas seulement laides — elles sont **impossibles à toucher
 * séparément**.
 */
export const MEDAL_MIN_PIXEL_GAP = 44;

/**
 * Écart approximatif **en pixels** entre deux positions, sur une carte cadrée sur `bounds` et
 * rendue dans `widthPx × heightPx`.
 *
 * Approximation assumée : on projette linéairement, sans tenir compte de la projection Mercator ni
 * de la rotation. À l'échelle d'une sortie de course (quelques kilomètres, loin des pôles), l'écart
 * avec la vraie projection est très inférieur au seuil qu'on teste — et la seule alternative, une
 * projection demandée à la carte native, serait asynchrone et intestable.
 *
 * Contrat : `widthPx` et `heightPx` doivent être mesurés (> 0). Un cadrage dégénéré (bornes d'un
 * seul point) rend **0** — tout y est au même endroit, ce qui est la vérité.
 */
export function approxPixelGap(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  bounds: MapBounds,
  widthPx: number,
  heightPx: number,
): number {
  const [west, south, east, north] = bounds;
  const lngSpan = east - west;
  const latSpan = north - south;
  if (lngSpan <= 0 || latSpan <= 0) return 0;
  const dx = ((a.lng - b.lng) / lngSpan) * widthPx;
  const dy = ((a.lat - b.lat) / latSpan) * heightPx;
  return Math.hypot(dx, dy);
}

/**
 * Retire les médailles qui se chevaucheraient à l'écran (spec R13).
 *
 * L'ordre reçu fait foi — il vient de `pickMapMedals`, donc la mieux classée est en tête et c'est
 * elle qui reste. **Pas de désempilement automatique** : deux pastilles décalées pour ne plus se
 * toucher ne désignent plus l'endroit où l'effort a eu lieu, ce qui est tout l'intérêt de les
 * poser sur la carte.
 */
export function dropOverlappingMedals<T extends { midLat: number | null; midLng: number | null }>(
  medals: ReadonlyArray<T>,
  bounds: MapBounds,
  widthPx: number,
  heightPx: number,
  minGapPx: number = MEDAL_MIN_PIXEL_GAP,
): T[] {
  const kept: T[] = [];
  for (const medal of medals) {
    if (medal.midLat == null || medal.midLng == null) continue;
    const here = { lat: medal.midLat, lng: medal.midLng };
    const collides = kept.some((k) => {
      const there = { lat: k.midLat as number, lng: k.midLng as number };
      return approxPixelGap(here, there, bounds, widthPx, heightPx) < minGapPx;
    });
    if (!collides) kept.push(medal);
  }
  return kept;
}

// ---------------------------------------------------------------------------
// Ordinaux (spec §6)
// ---------------------------------------------------------------------------

/** Les catégories ordinales qu'on expose à i18n — une clé de traduction par catégorie. */
export type OrdinalCategory = 'one' | 'two' | 'few' | 'other';

/**
 * Catégorie ordinale d'un rang, dans la langue donnée.
 *
 * ⚠️ **Un ordinal ne s'interpole pas.** « 2ᵉ » en français, « 2nd » en anglais — et l'anglais change
 * de suffixe selon le chiffre : 1st, 2nd, 3rd, 4th, puis 11th, 21st. Concaténer un suffixe fixe
 * produit « 21th », faux dans toutes les langues qui déclinent. On passe donc par `Intl.PluralRules`
 * et une clé i18n par catégorie.
 *
 * Le français ne distingue que `one` (1ᵉʳ) du reste ; l'anglais utilise les quatre.
 * Repli `other` si la locale est inconnue du moteur — la forme la plus courante, jamais une erreur.
 */
export function ordinalCategory(n: number, locale: string): OrdinalCategory {
  try {
    const selected = new Intl.PluralRules(locale, { type: 'ordinal' }).select(n);
    return selected === 'one' || selected === 'two' || selected === 'few' ? selected : 'other';
  } catch {
    return 'other';
  }
}

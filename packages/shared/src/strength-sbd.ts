/**
 * US MUSCPWR-01 (catalogue MUSC-29) — **total SBD** (squat + bench + deadlift) et sa **projection**.
 *
 * Le total est la métrique de référence en force athlétique : c'est sur lui qu'on se classe, et c'est
 * lui qu'on cherche à faire monter. Sa projection répond à la seule question qui compte pendant une
 * préparation : « à ce rythme, où j'en serai le jour de la compétition ? »
 *
 * ⚠️ Une projection est une **promesse implicite**. Ce module refuse donc d'en produire une sans
 * matière suffisante (R8), la borne à 12 semaines (R9), et laisse l'appelant dire **pourquoi** il n'y
 * en a pas — masquer sans expliquer se lit comme un bug.
 *
 * Réf. : docs/specs/functional/us/muscpwr01-module-force.md
 */

import { linearRegression } from './regression';
import { SBD_LIFTS, type SbdLift, type SbdLifts } from './settings';

/** Nombre minimal de mesures de total pour projeter (R8). */
export const SBD_MIN_POINTS = 3;
/** Étendue minimale de l'historique, en jours (R8 : 8 semaines). */
export const SBD_MIN_WINDOW_DAYS = 56;
/** Horizon maximal d'une projection, en semaines (R9). */
export const SBD_MAX_PROJECTION_WEEKS = 12;

/** 1RM connu par mouvement — `null` = mouvement non désigné, ou aucun record. */
export type OneRmByLift = Record<SbdLift, number | null>;

export type SbdTotalResult = {
  /** `null` dès qu'un mouvement manque : un total partiel n'est jamais un total (R11). */
  totalKg: number | null;
  /** Mouvements sans 1RM exploitable, pour que l'écran dise lesquels. */
  missing: SbdLift[];
};

/**
 * Total des trois mouvements, ou `null` avec la liste de ce qui manque (règle R11).
 *
 * Annoncer « total : 317 kg » alors qu'il manque le soulevé de terre serait faux — et d'autant plus
 * trompeur que le nombre a l'air juste.
 */
export function sbdTotal(oneRmByLift: OneRmByLift): SbdTotalResult {
  const missing: SbdLift[] = [];
  let total = 0;

  for (const lift of SBD_LIFTS) {
    const value = oneRmByLift[lift];
    if (value == null || !Number.isFinite(value) || value <= 0) {
      missing.push(lift);
      continue;
    }
    total += value;
  }

  return { totalKg: missing.length === 0 ? total : null, missing };
}

/** Un record de 1RM daté, réduit à ce dont l'historique a besoin. */
export type DatedOneRm = {
  exerciseId: string;
  type: string;
  value: number;
  /** ISO 8601 (`personal_records.achieved_at`). */
  achievedAt: string;
};

export type SbdHistoryPoint = { date: string; totalKg: number };

/**
 * Historique des totaux dans le temps — la matière de la projection.
 *
 * Principe : à chaque nouveau record, le total est recalculé avec le **meilleur 1RM connu à cette
 * date** pour chacun des trois mouvements. Un point n'est émis que lorsque les trois sont connus,
 * sinon le total serait partiel (R11). La courbe est donc croissante par paliers, ce qui est la
 * réalité d'une progression en force.
 *
 * Les records sont triés ici : on ne présume pas de l'ordre fourni par la requête.
 */
export function sbdHistory(
  records: readonly DatedOneRm[],
  sbdLifts: SbdLifts,
): SbdHistoryPoint[] {
  /** Exercice désigné → mouvement, pour retrouver le mouvement depuis un record. */
  const liftByExercise = new Map<string, SbdLift>();
  for (const lift of SBD_LIFTS) {
    const exerciseId = sbdLifts[lift];
    if (exerciseId) liftByExercise.set(exerciseId, lift);
  }
  if (liftByExercise.size < SBD_LIFTS.length) return [];

  const relevant = records
    .filter(
      (r) =>
        r.type === 'estimated_1rm' &&
        liftByExercise.has(r.exerciseId) &&
        Number.isFinite(r.value) &&
        r.value > 0 &&
        Number.isFinite(Date.parse(r.achievedAt)),
    )
    .sort((a, b) => Date.parse(a.achievedAt) - Date.parse(b.achievedAt));

  const best: Record<string, number> = {};
  const points: SbdHistoryPoint[] = [];

  for (const r of relevant) {
    const lift = liftByExercise.get(r.exerciseId)!;
    // Un record inférieur au meilleur connu ne fait pas baisser le total : le meilleur reste le
    // meilleur (même logique que `bestKnownOneRm`, règle R1).
    if (best[lift] === undefined || r.value > best[lift]!) best[lift] = r.value;

    if (SBD_LIFTS.every((l) => best[l] !== undefined)) {
      const totalKg = SBD_LIFTS.reduce((sum, l) => sum + best[l]!, 0);
      const last = points.at(-1);
      // Deux records le même jour ne créent qu'un point : on garde le total le plus haut du jour.
      if (last && last.date === r.achievedAt) last.totalKg = totalKg;
      else points.push({ date: r.achievedAt, totalKg });
    }
  }

  return points;
}

export type SbdProjection =
  | {
      ok: true;
      /** Total projeté à l'horizon demandé. */
      projectedKg: number;
      /** Pente, en kg par semaine. Négative si la progression recule (R10). */
      slopePerWeek: number;
      /** Horizon réellement appliqué, borné à {@link SBD_MAX_PROJECTION_WEEKS} (R9). */
      weeks: number;
    }
  | {
      ok: false;
      /** Pourquoi il n'y a pas de projection — l'écran doit pouvoir le dire (R8). */
      reason: 'not-enough-points' | 'window-too-short';
      /** Ce qui manque, pour un message précis (« encore 1 mesure »). */
      pointsMissing: number;
      daysMissing: number;
    };

/**
 * Projette le total à `weeks` semaines, **au rythme observé**.
 *
 * Refuse (R8) sous {@link SBD_MIN_POINTS} mesures ou sur une fenêtre plus courte que
 * {@link SBD_MIN_WINDOW_DAYS} : une droite tracée sur deux points proches est une illusion de
 * précision, et la projeter donnerait un chiffre que rien ne soutient.
 *
 * Borne l'horizon à {@link SBD_MAX_PROJECTION_WEEKS} (R9) — extrapoler un an de progression linéaire
 * est physiologiquement faux. Une pente négative est rendue telle quelle (R10) : masquer une
 * mauvaise nouvelle décrédibilise les bonnes.
 */
export function projectSbd(
  history: readonly SbdHistoryPoint[],
  weeks: number,
): SbdProjection {
  const pointsMissing = Math.max(0, SBD_MIN_POINTS - history.length);

  const first = history[0];
  const last = history.at(-1);
  const spanDays =
    first && last ? (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000 : 0;
  const daysMissing = Math.max(0, Math.ceil(SBD_MIN_WINDOW_DAYS - spanDays));

  if (pointsMissing > 0) return { ok: false, reason: 'not-enough-points', pointsMissing, daysMissing };
  if (daysMissing > 0) return { ok: false, reason: 'window-too-short', pointsMissing, daysMissing };

  const originMs = Date.parse(first!.date);
  const fit = linearRegression(
    history.map((p) => ({ x: (Date.parse(p.date) - originMs) / 86_400_000, y: p.totalKg })),
  );
  // `null` demanderait une variance de x nulle, or l'étendue est ≥ 56 jours ici. Garde défensive.
  if (fit === null) return { ok: false, reason: 'window-too-short', pointsMissing, daysMissing: 1 };

  const horizon = Math.min(SBD_MAX_PROJECTION_WEEKS, Math.max(0, weeks));
  return {
    ok: true,
    projectedKg: last!.totalKg + fit.slope * horizon * 7,
    slopePerWeek: fit.slope * 7,
    weeks: horizon,
  };
}

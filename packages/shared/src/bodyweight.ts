import { z } from 'zod';
import { syncFieldsSchema } from './sync';
import type { Nutrients } from './food';

/**
 * Suivi du poids corporel (spec §7.1) + statistiques d'apports (spec §7.2).
 */

export const bodyWeightEntryRowSchema = syncFieldsSchema.extend({
  /** Jour de la pesée (AAAA-MM-JJ, local). */
  logDate: z.string(),
  /** Poids en kg (stockage SI ; conversion à l'affichage). */
  weightKg: z.number().positive(),
});
export type BodyWeightEntryRow = z.infer<typeof bodyWeightEntryRowSchema>;

/** Tendance de poids sur une série ordonnée (ancienne → récente). Seuil ±0,3 kg. */
export function weightTrend(weights: ReadonlyArray<number>): 'up' | 'down' | 'stable' {
  if (weights.length < 2) return 'stable';
  const delta = weights[weights.length - 1]! - weights[0]!;
  if (delta > 0.3) return 'up';
  if (delta < -0.3) return 'down';
  return 'stable';
}

/**
 * Apports moyens par jour sur une fenêtre de `dayCount` jours (spec §7.2).
 * `dailyTotals` = un total nutritionnel par jour renseigné (jours sans saisie exclus).
 * La moyenne est calculée sur le nombre de jours renseignés (pas sur `dayCount`),
 * pour ne pas diluer par les jours vides.
 */
export function averageIntake(dailyTotals: ReadonlyArray<Nutrients>): Nutrients {
  if (dailyTotals.length === 0) {
    return { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  }
  const sum = dailyTotals.reduce(
    (acc, d) => ({
      kcal: acc.kcal + d.kcal,
      proteinG: acc.proteinG + d.proteinG,
      carbsG: acc.carbsG + d.carbsG,
      fatG: acc.fatG + d.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  const n = dailyTotals.length;
  return {
    kcal: Math.round(sum.kcal / n),
    proteinG: Math.round(sum.proteinG / n),
    carbsG: Math.round(sum.carbsG / n),
    fatG: Math.round(sum.fatG / n),
  };
}

// --- Corrélation muscu ↔ apports (spec §7.3, item 4.32) ----------------------

/** Seuils de l'alerte croisée déficit + fort volume (heuristiques, ajustables). */
export const DEFICIT_ALERT_RATIO = 0.15; // apports ≥ 15 % sous l'objectif
export const HIGH_VOLUME_THRESHOLD = 8000; // volume muscu hebdo (Σ reps × kg)

/**
 * Vrai si la semaine cumule un **déficit calorique important** (apports moyens nettement
 * sous l'objectif) **et** un **fort volume de musculation** — signal de sous-alimentation
 * face à la charge d'entraînement (première stat croisée inter-piliers, décision H).
 */
export function shouldAlertDeficitVolume(params: {
  avgDailyKcal: number;
  targetKcal: number;
  weeklyVolume: number;
}): boolean {
  const { avgDailyKcal, targetKcal, weeklyVolume } = params;
  if (targetKcal <= 0 || avgDailyKcal <= 0) return false;
  const deficitRatio = (targetKcal - avgDailyKcal) / targetKcal;
  return deficitRatio >= DEFICIT_ALERT_RATIO && weeklyVolume >= HIGH_VOLUME_THRESHOLD;
}

/** Nombre minimum de jours loggés (sur 7) requis pour évaluer l'alerte déficit + volume. */
export const MIN_LOGGED_DAYS = 4; // sur 7

export type DeficitVolumeAlert = {
  show: boolean;
  deficitPct: number; // écart sous l'objectif en %, arrondi (0 si pas d'alerte)
  loggedDays: number; // nb de jours loggés en entrée
};

/**
 * Règle d'affichage de l'alerte croisée déficit + fort volume (déterministe, pure).
 * `loggedDailyKcals` = kcal des SEULS jours loggés de la fenêtre 7 j (tableau épars).
 */
export function computeDeficitVolumeAlert(params: {
  loggedDailyKcals: ReadonlyArray<number>;
  targetKcal: number;
  weeklyVolume: number;
}): DeficitVolumeAlert {
  const { loggedDailyKcals, targetKcal, weeklyVolume } = params;
  const loggedDays = loggedDailyKcals.length;
  if (loggedDays < MIN_LOGGED_DAYS || targetKcal <= 0) {
    return { show: false, deficitPct: 0, loggedDays };
  }
  const avgDailyKcal = Math.round(loggedDailyKcals.reduce((s, k) => s + k, 0) / loggedDays);
  const show = shouldAlertDeficitVolume({ avgDailyKcal, targetKcal, weeklyVolume });
  const deficitPct = show ? Math.round(((targetKcal - avgDailyKcal) / targetKcal) * 100) : 0;
  return { show, deficitPct, loggedDays };
}

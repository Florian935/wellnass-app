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

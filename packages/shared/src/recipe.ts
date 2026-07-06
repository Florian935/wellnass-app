import { z } from 'zod';
import { syncFieldsSchema, uuidSchema } from './sync';
import type { Nutrients } from './food';

/**
 * Recettes & repas types (spec alimentation §5).
 *  - Recipe : plusieurs ingrédients + nombre de portions ; valeurs par portion calculées.
 *  - MealTemplate : un repas entier enregistré, réutilisable en 1 tap.
 * Ingrédients / items = snapshot des valeurs à l'ajout (spec §8).
 */

// --- Recette ------------------------------------------------------------------

export const recipeRowSchema = syncFieldsSchema.extend({
  name: z.string(),
  /** Nombre de portions (≥ 1). */
  servings: z.number().int().positive().default(1),
});
export type RecipeRow = z.infer<typeof recipeRowSchema>;

export const recipeIngredientRowSchema = syncFieldsSchema.extend({
  recipeId: uuidSchema,
  foodId: uuidSchema.nullable().default(null),
  name: z.string(),
  quantityG: z.number().positive().nullable().default(null),
  kcal: z.number().nonnegative(),
  proteinG: z.number().nonnegative().default(0),
  carbsG: z.number().nonnegative().default(0),
  fatG: z.number().nonnegative().default(0),
});
export type RecipeIngredientRow = z.infer<typeof recipeIngredientRowSchema>;

// --- Repas type ---------------------------------------------------------------

export const mealTemplateRowSchema = syncFieldsSchema.extend({
  name: z.string(),
});
export type MealTemplateRow = z.infer<typeof mealTemplateRowSchema>;

export const mealTemplateItemRowSchema = syncFieldsSchema.extend({
  templateId: uuidSchema,
  foodId: uuidSchema.nullable().default(null),
  name: z.string(),
  quantityG: z.number().positive().nullable().default(null),
  kcal: z.number().nonnegative(),
  proteinG: z.number().nonnegative().default(0),
  carbsG: z.number().nonnegative().default(0),
  fatG: z.number().nonnegative().default(0),
});
export type MealTemplateItemRow = z.infer<typeof mealTemplateItemRowSchema>;

// --- Helpers ------------------------------------------------------------------

/** Nutriments d'une portion = total / nombre de portions (arrondi, servings ≥ 1). */
export function perServing(total: Nutrients, servings: number): Nutrients {
  const n = Math.max(1, Math.round(servings));
  return {
    kcal: Math.round(total.kcal / n),
    proteinG: Math.round(total.proteinG / n),
    carbsG: Math.round(total.carbsG / n),
    fatG: Math.round(total.fatG / n),
  };
}

/** Nutriments de `count` portions (multiplie une portion). */
export function scalePortions(oneServing: Nutrients, count: number): Nutrients {
  const c = Math.max(0, count);
  return {
    kcal: Math.round(oneServing.kcal * c),
    proteinG: Math.round(oneServing.proteinG * c),
    carbsG: Math.round(oneServing.carbsG * c),
    fatG: Math.round(oneServing.fatG * c),
  };
}

import { z } from 'zod';
import { contentOwnerSyncFieldsSchema, syncFieldsSchema, uuidSchema } from './sync';
import { localeSchema } from './pillar';

/**
 * Domaine Alimentation — aliments, portions, journal.
 * Réf. : docs/specs/functional/alimentation.md §3 (base d'aliments), §4 (journal).
 */

// --- Catégories & sources (spec §3.1) ----------------------------------------

export const FOOD_CATEGORIES = [
  'meat',
  'fish',
  'starchy',
  'vegetables',
  'fruits',
  'dairy',
  'nuts',
  'drinks',
  'other',
] as const;
export const foodCategorySchema = z.enum(FOOD_CATEGORIES);
export type FoodCategory = z.infer<typeof foodCategorySchema>;

/** Origine d'un aliment : bibliothèque app (dont CIQUAL), OpenFoodFacts, perso utilisateur. */
export const FOOD_SOURCES = ['library', 'openfoodfacts', 'custom'] as const;
export const foodSourceSchema = z.enum(FOOD_SOURCES);
export type FoodSource = z.infer<typeof foodSourceSchema>;

// --- Repas du journal (spec §4.1) --------------------------------------------

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export const mealTypeSchema = z.enum(MEAL_TYPES);
export type MealType = z.infer<typeof mealTypeSchema>;

// --- Portions usuelles (spec §4.3) -------------------------------------------

/** Portion usuelle : libellé bilingue + poids en grammes (« 1 œuf = 60 g »). */
export const foodPortionSchema = z.object({
  labelFr: z.string(),
  labelEn: z.string(),
  grams: z.number().positive(),
});
export type FoodPortion = z.infer<typeof foodPortionSchema>;

// --- Aliment (valeurs pour 100 g, universelles/numériques) -------------------

export const foodRowSchema = contentOwnerSyncFieldsSchema.extend({
  source: foodSourceSchema,
  category: foodCategorySchema,
  /** Code-barres EAN (import/scan), nullable. */
  barcode: z.string().nullable().default(null),
  /** Valeurs pour 100 g. Calories obligatoires ; macros détaillées optionnelles (spec §3.3). */
  kcalPer100g: z.number().nonnegative(),
  proteinPer100g: z.number().nonnegative().nullable().default(null),
  carbsPer100g: z.number().nonnegative().nullable().default(null),
  sugarsPer100g: z.number().nonnegative().nullable().default(null),
  fatPer100g: z.number().nonnegative().nullable().default(null),
  saturatedFatPer100g: z.number().nonnegative().nullable().default(null),
  fiberPer100g: z.number().nonnegative().nullable().default(null),
  /** Portions usuelles (JSON). Vide = grammes uniquement. */
  portions: z.array(foodPortionSchema).default([]),
});
export type FoodRow = z.infer<typeof foodRowSchema>;

/** Traduction d'un aliment (name par langue). Les aliments perso ne sont pas traduits. */
export const foodTranslationRowSchema = contentOwnerSyncFieldsSchema.extend({
  foodId: uuidSchema,
  lang: localeSchema,
  name: z.string(),
});
export type FoodTranslationRow = z.infer<typeof foodTranslationRowSchema>;

// --- Journal : entrée d'aliment dans un repas (snapshot, spec §3.5 / §4.2) ----

/**
 * Une ligne du journal : un aliment ajouté à un repas d'une journée.
 * Les valeurs nutritionnelles sont un **snapshot** (déjà calculées pour la quantité),
 * l'historique n'est pas recalculé si l'aliment change ensuite (spec §8).
 */
export const foodEntryRowSchema = syncFieldsSchema.extend({
  /** Jour du journal au format ISO local (AAAA-MM-JJ) — pas de timezone. */
  logDate: z.string(),
  mealType: mealTypeSchema,
  /** Ordre dans le repas. */
  orderIndex: z.number().int().default(0),
  /** Aliment source (null pour un « quick add » de calories libres). */
  foodId: uuidSchema.nullable().default(null),
  /** Nom affiché (snapshot). */
  name: z.string(),
  /** Quantité en grammes (null pour quick add). */
  quantityG: z.number().positive().nullable().default(null),
  /** Snapshot des valeurs pour la quantité saisie. */
  kcal: z.number().nonnegative(),
  proteinG: z.number().nonnegative().default(0),
  carbsG: z.number().nonnegative().default(0),
  fatG: z.number().nonnegative().default(0),
});
export type FoodEntryRow = z.infer<typeof foodEntryRowSchema>;

// --- Helpers purs ------------------------------------------------------------

/**
 * Résout le nom d'un aliment selon la langue, avec repli langue courante → fr → premier.
 * (même stratégie que `resolveExerciseName`).
 */
export function resolveFoodName(
  translations: ReadonlyArray<{ lang: string; name: string }>,
  lang: string,
): string | undefined {
  if (translations.length === 0) return undefined;
  const found = translations.find((t) => t.lang === lang);
  if (found) return found.name;
  const fr = translations.find((t) => t.lang === 'fr');
  if (fr) return fr.name;
  return translations[0]!.name;
}

/** Valeurs nutritionnelles pour 100 g d'un aliment (macros nulles → 0). */
export type Nutrients = { kcal: number; proteinG: number; carbsG: number; fatG: number };

/**
 * Met à l'échelle les valeurs pour 100 g vers `grams` grammes (arrondi entier).
 * Les macros absentes (null) comptent pour 0.
 */
export function scaleNutrition(
  per100g: {
    kcalPer100g: number;
    proteinPer100g?: number | null;
    carbsPer100g?: number | null;
    fatPer100g?: number | null;
  },
  grams: number,
): Nutrients {
  const factor = grams / 100;
  return {
    kcal: Math.round(per100g.kcalPer100g * factor),
    proteinG: Math.round((per100g.proteinPer100g ?? 0) * factor),
    carbsG: Math.round((per100g.carbsPer100g ?? 0) * factor),
    fatG: Math.round((per100g.fatPer100g ?? 0) * factor),
  };
}

/** Somme des nutriments d'une liste d'entrées (totaux du jour, spec §4.6). */
export function sumNutrients(entries: ReadonlyArray<Nutrients>): Nutrients {
  return entries.reduce<Nutrients>(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

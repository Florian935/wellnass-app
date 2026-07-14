import { z } from 'zod';
import { contentOwnerSyncFieldsSchema, syncFieldsSchema, uuidSchema } from './sync';
import { localeSchema } from './pillar';
import { parseJsonColumn } from './json-column';

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

// --- Micronutriments (socle 4.33) --------------------------------------------

/**
 * Socle de micronutriments (spec 4.33). Toutes les clés sont **optionnelles** : une clé
 * absente = donnée **non renseignée** (jamais 0). L'unité est encodée dans le nom de la clé
 * (mg, sauf vitamines D/B9/B12 en µg) et **ne doit jamais changer** (clés stables).
 * Valeurs **pour 100 g** sur un aliment (`foods`), **figées pour la quantité** dans le journal
 * (`food_entries`).
 */
export const MICRONUTRIENT_KEYS = [
  // Lipides
  'cholesterol_mg',
  'monounsaturated_fat_g',
  'polyunsaturated_fat_g',
  'trans_fat_g',
  'omega_3_g',
  'omega_6_g',
  'omega_9_g',
  // Minéraux
  'sodium_mg',
  'magnesium_mg',
  'potassium_mg',
  'calcium_mg',
  'iron_mg',
  'zinc_mg',
  'phosphorus_mg',
  'copper_mg',
  'manganese_mg',
  'selenium_ug',
  'iodine_ug',
  // Vitamines
  'vitamin_a_ug',
  'vitamin_c_mg',
  'vitamin_d_ug',
  'vitamin_e_mg',
  'vitamin_k_ug',
  'vitamin_b1_mg',
  'vitamin_b2_mg',
  'vitamin_b3_mg',
  'vitamin_b5_mg',
  'vitamin_b6_mg',
  'vitamin_b7_ug',
  'vitamin_b9_ug',
  'vitamin_b12_ug',
] as const;
export type MicronutrientKey = (typeof MICRONUTRIENT_KEYS)[number];

const micronutrientFields = Object.fromEntries(
  MICRONUTRIENT_KEYS.map((k) => [k, z.number().nonnegative().optional()]),
) as Record<MicronutrientKey, z.ZodOptional<z.ZodNumber>>;

/** Écriture stricte : seules les clés connues du panel sont acceptées. */
export const micronutrientsSchema = z.object(micronutrientFields).strict();
export type Micronutrients = z.infer<typeof micronutrientsSchema>;

/**
 * Lecture **tolérante** d'un JSON micronutriments venu de la base : ignore les clés hors
 * panel, les valeurs non numériques / négatives, et renvoie `{}` sur JSON invalide.
 * (Ne jette jamais — la base ne doit pas casser l'affichage.)
 */
export function parseMicronutrients(input: unknown): Micronutrients {
  // Tolère le double encodage des colonnes texte-JSON client (cf. parseJsonColumn).
  const obj = parseJsonColumn<unknown>(input, null);
  if (obj == null || typeof obj !== 'object') return {};
  const out: Micronutrients = {};
  for (const key of MICRONUTRIENT_KEYS) {
    const v = (obj as Record<string, unknown>)[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[key] = v;
  }
  return out;
}

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
  /** Micronutriments pour 100 g (JSON, socle 4.33). Clés absentes = non renseignées. */
  micronutrients: micronutrientsSchema.default({}),
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
  /** Snapshot des micronutriments figés pour la quantité (JSON, socle 4.33). */
  micronutrients: micronutrientsSchema.default({}),
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

// --- Micronutriments : helpers purs (spec 4.33 §3.3) -------------------------

/** Arrondi à 1 décimale (les micros portent des valeurs fines, notamment en µg). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Met à l'échelle les micronutriments pour 100 g vers `grams` grammes.
 * Seules les clés **présentes** sont mises à l'échelle (une clé absente reste absente,
 * jamais forcée à 0). Arrondi à 1 décimale.
 */
export function scaleMicronutrients(per100g: Micronutrients, grams: number): Micronutrients {
  const factor = grams / 100;
  const out: Micronutrients = {};
  for (const key of MICRONUTRIENT_KEYS) {
    const v = per100g[key];
    if (v != null) out[key] = round1(v * factor);
  }
  return out;
}

/** Snapshot nutritionnel d'une entrée du journal (valeurs figées pour une quantité). */
export type EntryNutritionSnapshot = Nutrients & { micronutrients: Micronutrients };

/**
 * Recalcule le snapshot d'une entrée du journal pour une **nouvelle quantité**, par règle
 * de trois depuis le snapshot déjà mis à l'échelle (`fromGrams` → `toGrams`). On reconstitue
 * une base « pour 100 g » en flottant puis on réutilise `scaleNutrition`/`scaleMicronutrients` :
 * un **seul arrondi** est appliqué, exactement comme à l'ajout (cf. food-picker).
 *
 * `fromGrams` doit être > 0 (une entrée « quick add » sans grammes n'est pas remise à l'échelle).
 */
export function rescaleEntryNutrition(
  snapshot: EntryNutritionSnapshot,
  fromGrams: number,
  toGrams: number,
): EntryNutritionSnapshot {
  if (fromGrams <= 0) return snapshot;
  const per100g = {
    kcalPer100g: (snapshot.kcal * 100) / fromGrams,
    proteinPer100g: (snapshot.proteinG * 100) / fromGrams,
    carbsPer100g: (snapshot.carbsG * 100) / fromGrams,
    fatPer100g: (snapshot.fatG * 100) / fromGrams,
  };
  return {
    ...scaleNutrition(per100g, toGrams),
    micronutrients: scaleMicronutrients(snapshot.micronutrients, (toGrams * 100) / fromGrams),
  };
}

/**
 * Somme clé à clé d'une liste de micronutriments (agrégat d'un jour). Une clé n'apparaît
 * dans le résultat que si **au moins une** entrée la renseigne. Arrondi à 1 décimale.
 */
export function sumMicronutrients(list: ReadonlyArray<Micronutrients>): Micronutrients {
  const out: Micronutrients = {};
  for (const m of list) {
    for (const key of MICRONUTRIENT_KEYS) {
      const v = m[key];
      if (v != null) out[key] = round1((out[key] ?? 0) + v);
    }
  }
  return out;
}

/**
 * Sel (g) dérivé du sodium (mg) : `sodium × 2,5 / 1000`, arrondi à 2 décimales (les valeurs
 * de sel sont petites : ex. 142 mg → 0,36 g). Affichage seulement (non stocké).
 */
export function saltFromSodiumMg(sodiumMg: number): number {
  return Math.round((sodiumMg * 2.5) / 10) / 100;
}

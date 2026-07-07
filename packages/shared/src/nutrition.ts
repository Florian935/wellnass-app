import { z } from 'zod';
import type { Goal, Sex } from './profile';
import { syncFieldsSchema } from './sync';

/**
 * Domaine nutrition (pilier Alimentation) — calculs déclaratifs purs + schéma de la
 * ligne `nutrition_profiles` synchronisée via PowerSync.
 * Réf. : docs/specs/functional/alimentation.md §2 (profil, TDEE, macros).
 */

// --- Objectif nutritionnel (spec §2.1) ---------------------------------------

/** Objectif nutritionnel — distinct de l'objectif d'entraînement (`Goal`). */
export const NUTRITION_OBJECTIVES = ['bulk', 'cut', 'maintain', 'weightloss'] as const;
export const nutritionObjectiveSchema = z.enum(NUTRITION_OBJECTIVES);
export type NutritionObjective = z.infer<typeof nutritionObjectiveSchema>;

/** Objectif nutritionnel par défaut dérivé de l'objectif d'entraînement (première ouverture). */
export function objectiveFromGoal(goal: Goal | null): NutritionObjective {
  switch (goal) {
    case 'muscle':
      return 'bulk';
    case 'weightloss':
      return 'weightloss';
    default:
      return 'maintain';
  }
}

/**
 * Ajustement calorique par objectif (kcal/jour), milieu des fourchettes spec §2.1 :
 * masse +200/+400 → +300 · sèche −300/−500 → −400 · perte progressive −250 · maintien 0.
 */
export function objectiveCalorieDelta(objective: NutritionObjective): number {
  switch (objective) {
    case 'bulk':
      return 300;
    case 'cut':
      return -400;
    case 'weightloss':
      return -250;
    case 'maintain':
      return 0;
  }
}

// --- Facteur d'activité (spec §2.2) ------------------------------------------

export const ACTIVITY_LEVELS = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
] as const;
export const activityLevelSchema = z.enum(ACTIVITY_LEVELS);
export type ActivityLevel = z.infer<typeof activityLevelSchema>;

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Multiplicateur d'activité de Mifflin-St Jeor. */
export function activityFactor(level: ActivityLevel): number {
  return ACTIVITY_FACTORS[level];
}

// --- Restrictions / préférences (spec §2.4) ----------------------------------

export const DIET_RESTRICTIONS = [
  'vegetarian',
  'vegan',
  'gluten_free',
  'lactose_free',
  'halal',
  'kosher',
] as const;
export const dietRestrictionSchema = z.enum(DIET_RESTRICTIONS);
export type DietRestriction = z.infer<typeof dietRestrictionSchema>;

// --- Métabolisme de base & TDEE (spec §2.2) ----------------------------------

export type BmrInput = {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
};

/**
 * Métabolisme de base (Mifflin-St Jeor), en kcal/jour.
 * Homme : +5 · Femme : −161 · Sexe non précisé : moyenne des deux (constante −78).
 */
export function basalMetabolicRate({ sex, weightKg, heightCm, age }: BmrInput): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const sexConstant = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return base + sexConstant;
}

/**
 * TDEE (dépense énergétique totale) = BMR × facteur d'activité, arrondi à l'entier.
 * Renvoie `null` si les données requises (poids, taille, âge > 0) sont absentes.
 */
export function tdee(
  input: Partial<BmrInput> & { activityLevel: ActivityLevel },
): number | null {
  const { sex = 'unspecified', weightKg, heightCm, age, activityLevel } = input;
  if (!weightKg || !heightCm || !age || weightKg <= 0 || heightCm <= 0 || age <= 0) {
    return null;
  }
  const bmr = basalMetabolicRate({ sex, weightKg, heightCm, age });
  return Math.round(bmr * activityFactor(activityLevel));
}

/**
 * Objectif calorique = TDEE + delta de l'objectif.
 * `manualOverride` (si défini et > 0) prime sur le calcul automatique (spec §2.2, 4.3).
 */
export function targetCalories(
  tdeeValue: number,
  objective: NutritionObjective,
  manualOverride?: number | null,
): number {
  if (manualOverride && manualOverride > 0) {
    return Math.round(manualOverride);
  }
  return Math.max(0, Math.round(tdeeValue + objectiveCalorieDelta(objective)));
}

/**
 * Calories des jours d'entraînement (spec §2.2 / item 4.7, intégration opt-in décision H).
 * Ajoute un bonus aux jours de séance ; le rattachement au planning est câblé ultérieurement.
 */
export function trainingDayCalories(target: number, bonus: number): number {
  return Math.round(target + Math.max(0, bonus));
}

// --- Macros (spec §2.3) ------------------------------------------------------

export const PROTEIN_KCAL_PER_G = 4;
export const CARBS_KCAL_PER_G = 4;
export const FAT_KCAL_PER_G = 9;

/** Répartition en pourcentages (somme = 100). */
export type MacroRatios = { protein: number; carbs: number; fat: number };
/** Répartition en grammes. */
export type MacroGrams = { protein: number; carbs: number; fat: number };

/**
 * Répartition macros par défaut selon l'objectif (spec §2.3).
 * Perte progressive réutilise les ratios « sèche » (déficit). Somme = 100 %.
 */
export function defaultMacroRatios(objective: NutritionObjective): MacroRatios {
  switch (objective) {
    case 'bulk':
      return { protein: 30, carbs: 45, fat: 25 };
    case 'cut':
    case 'weightloss':
      return { protein: 40, carbs: 35, fat: 25 };
    case 'maintain':
      return { protein: 25, carbs: 50, fat: 25 };
  }
}

/** Convertit des calories + ratios (%) en grammes de macros (arrondis). */
export function macroGramsFromCalories(calories: number, ratios: MacroRatios): MacroGrams {
  return {
    protein: Math.round((calories * ratios.protein) / 100 / PROTEIN_KCAL_PER_G),
    carbs: Math.round((calories * ratios.carbs) / 100 / CARBS_KCAL_PER_G),
    fat: Math.round((calories * ratios.fat) / 100 / FAT_KCAL_PER_G),
  };
}

/** Calories totales d'une répartition en grammes. */
export function caloriesFromMacros(grams: MacroGrams): number {
  return Math.round(
    grams.protein * PROTEIN_KCAL_PER_G +
      grams.carbs * CARBS_KCAL_PER_G +
      grams.fat * FAT_KCAL_PER_G,
  );
}

/**
 * Ratios (%) dérivés d'une répartition en grammes — les grammes priment (spec §8).
 * Renvoie 0/0/0 si l'apport calorique dérivé est nul (aucune division par zéro).
 */
export function macroRatiosFromGrams(grams: MacroGrams): MacroRatios {
  const calories = caloriesFromMacros(grams);
  if (calories <= 0) {
    return { protein: 0, carbs: 0, fat: 0 };
  }
  return {
    protein: Math.round(((grams.protein * PROTEIN_KCAL_PER_G) / calories) * 100),
    carbs: Math.round(((grams.carbs * CARBS_KCAL_PER_G) / calories) * 100),
    fat: Math.round(((grams.fat * FAT_KCAL_PER_G) / calories) * 100),
  };
}

// --- Configuration des repas (spec §4.1, item 4.15) --------------------------

/** Clés des repas par défaut (petit-déj / déj / dîner / collation). */
export const DEFAULT_MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

/** Un repas de la journée : clé stable + libellé personnalisé (`null` = libellé par défaut i18n). */
export const mealConfigItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().nullable().default(null),
});
export type MealConfigItem = z.infer<typeof mealConfigItemSchema>;

/** Configuration par défaut : les 4 repas standards, libellés i18n. */
export const DEFAULT_MEAL_CONFIG: MealConfigItem[] = DEFAULT_MEAL_KEYS.map((key) => ({
  key,
  label: null,
}));

/** Renvoie la config de repas de l'utilisateur, ou les 4 repas par défaut si absente/vide. */
export function resolveMealConfig(
  meals: ReadonlyArray<MealConfigItem> | null | undefined,
): MealConfigItem[] {
  return meals && meals.length > 0 ? [...meals] : DEFAULT_MEAL_CONFIG;
}

// --- Ligne synchronisée (table nutrition_profiles) ---------------------------

/**
 * Profil nutritionnel — une ligne par compte, synchronisée via PowerSync.
 * Macros manuelles stockées en grammes (les trois ensemble = mode manuel actif) ;
 * `null` = macros dérivées de l'objectif. Restrictions/allergènes en JSON.
 */
export const nutritionProfileRowSchema = syncFieldsSchema.extend({
  /** Objectif nutritionnel ; `null` = dérivé de l'objectif d'entraînement du profil. */
  objective: nutritionObjectiveSchema.nullable().default(null),
  /** Niveau d'activité (facteur TDEE). */
  activityLevel: activityLevelSchema.default('moderate'),
  /** Surcharge calorique manuelle (item 4.3) ; `null` = objectif calculé automatiquement. */
  manualCalories: z.number().positive().nullable().default(null),
  /** Macros manuelles en grammes (item 4.5) ; `null` = macros par défaut de l'objectif. */
  manualProteinG: z.number().nonnegative().nullable().default(null),
  manualCarbsG: z.number().nonnegative().nullable().default(null),
  manualFatG: z.number().nonnegative().nullable().default(null),
  /** Restrictions alimentaires (item 4.6). */
  restrictions: z.array(dietRestrictionSchema).default([]),
  /** Allergènes en liste libre (item 4.6). */
  allergens: z.array(z.string()).default([]),
  /** Bonus calorique des jours d'entraînement (item 4.7, opt-in) ; 0 = désactivé. */
  trainingDayBonus: z.number().nonnegative().default(0),
  /** Repas personnalisés (renommer / ajouter / supprimer, item 4.15) ; `null` = 4 repas par défaut. */
  meals: z.array(mealConfigItemSchema).nullable().default(null),
});

export type NutritionProfileRow = z.infer<typeof nutritionProfileRowSchema>;

import { z } from 'zod';
import { addDays, localDayKey } from './date';
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

// --- Ajustement auto du TDEE selon le volume de course (US RN-03, catalogue) -

/** Fenêtre de mesure de la fréquence (spec D1) — 14 j, pas 7 : lisse une semaine anormale. */
const RUNNING_FREQUENCY_WINDOW_DAYS = 14;

/**
 * Palier suggéré par la fréquence de course (spec R2) — reprend telles quelles les fourchettes
 * jours/semaine de la spec §2.2. Plafonné à `active` : `very_active` n'a aucun seuil sourcé pour
 * ce palier (spec D4), l'inventer serait un chiffre non défendable.
 */
export function activityLevelFromRunningFrequency(runningDaysInWindow: number): ActivityLevel {
  const perWeek = runningDaysInWindow / (RUNNING_FREQUENCY_WINDOW_DAYS / 7);
  if (perWeek <= 0) return 'sedentary';
  if (perWeek <= 2) return 'light';
  if (perWeek <= 5) return 'moderate';
  return 'active';
}

/**
 * Suggestion RN-03 : compare le niveau déclaré au niveau qu'impliquerait la fréquence de course
 * réelle sur les 14 derniers jours. `null` si identiques (spec R3 — rien à afficher).
 */
export function suggestActivityLevel(input: {
  currentLevel: ActivityLevel;
  runningDaysInWindow: number;
}): ActivityLevel | null {
  const suggested = activityLevelFromRunningFrequency(input.runningDaysInWindow);
  return suggested === input.currentLevel ? null : suggested;
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
 * Objectif nutritionnel **effectif** du jour (US VIE-01, règle R4).
 *
 * Pendant une période « mode vie réelle », l'objectif retombe à `maintain` : le delta calorique de
 * l'objectif est neutralisé, **dans les deux sens**. Un `cut` ne creuse plus — tenir un déficit
 * agressif pendant une semaine de maladie ou de déplacement est exactement ce qu'il ne faut pas faire
 * — et un `bulk` ne charge plus, parce qu'un surplus pris sans s'entraîner n'est pas une prise de
 * masse, juste de la graisse.
 *
 * ⚠️ **Cette fonction ne touche ni le TDEE, ni le niveau d'activité, ni le bonus des jours
 * d'entraînement.** Le mode corrige une **intention** (l'objectif), jamais une **dépense mesurée**.
 * Et `targetCalories` n'a pas été modifiée : un `manualOverride` continue donc de primer sans une
 * ligne de plus — ce n'est pas à nous de corriger une cible que l'utilisateur a posée à la main.
 *
 * 🔴 **Tous les appelants ne doivent PAS l'utiliser**, et c'est la règle la plus facile à casser de
 * cette US : un écran qui affiche **la cible du jour** l'applique ; l'écran où l'utilisateur
 * **configure son objectif** ne l'applique pas. Y afficher « maintien » pendant une période ferait
 * croire que le réglage `cut` n'a pas pris.
 */
export function effectiveNutritionObjective(
  objective: NutritionObjective,
  inRealLifePeriod: boolean,
): NutritionObjective {
  return inRealLifePeriod ? 'maintain' : objective;
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

/** Mode de calcul du bonus calorique des jours d'entrainement (item RN-02). */
export type TrainingBonusMode = 'fixed' | 'auto';

/**
 * Bonus calorique du jour selon le mode choisi (item RN-02).
 * `fixed` : forfait fixe les jours de seance, 0 sinon.
 * `auto` : depense de la course du jour si une course a ete enregistree,
 * sinon repli sur le forfait fixe (jour de seance sans course), sinon 0.
 */
export function dayCalorieBonus(params: {
  mode: TrainingBonusMode;
  isTrainingDay: boolean;
  fixedBonus: number;
  runCaloriesToday: number;
}): number {
  const { mode, isTrainingDay, fixedBonus, runCaloriesToday } = params;
  const forfait = isTrainingDay && fixedBonus > 0 ? fixedBonus : 0;
  if (mode === 'fixed') return forfait;
  if (runCaloriesToday > 0) return runCaloriesToday;
  return forfait;
}

/**
 * Objectif calorique effectif d'un jour = base + bonus du jour (forfait fixe les jours de
 * séance, ou dépense d'une course en mode auto). Compose `dayCalorieBonus` + `trainingDayCalories`
 * pour un usage batch (adhérence NUTR-10) hors contexte hook. Pur.
 */
export function computeEffectiveTargetForDay(params: {
  targetBase: number;
  mode: TrainingBonusMode;
  fixedBonus: number;
  isTrainingDay: boolean;
  runCaloriesToday: number;
}): number {
  const bonus = dayCalorieBonus({
    mode: params.mode,
    isTrainingDay: params.isTrainingDay,
    fixedBonus: params.fixedBonus,
    runCaloriesToday: params.runCaloriesToday,
  });
  return trainingDayCalories(params.targetBase, bonus);
}

/**
 * Adhérence calorique (item NUTR-10) : part des jours loggés dont les kcal tombent dans la
 * fourchette ±`marginPct` % de l'objectif effectif du jour. Les jours sans objectif
 * (`effectiveTarget` null ou ≤ 0) sont ignorés (exclus du dénominateur). Pur.
 */
export function computeGoalAdherence(
  perDay: { kcal: number; effectiveTarget: number | null }[],
  marginPct: number,
): { loggedDays: number; daysInTarget: number; pct: number } {
  const days = perDay.filter(
    (d): d is { kcal: number; effectiveTarget: number } =>
      d.effectiveTarget != null && d.effectiveTarget > 0,
  );
  const loggedDays = days.length;
  const daysInTarget = days.filter(
    (d) => Math.abs(d.kcal - d.effectiveTarget) <= d.effectiveTarget * (marginPct / 100),
  ).length;
  const pct = loggedDays > 0 ? Math.round((daysInTarget / loggedDays) * 100) : 0;
  return { loggedDays, daysInTarget, pct };
}

/**
 * Bilan calorique cumulé (US NUTR-18, spec R1/R2) : somme signée des écarts (kcal − objectif
 * effectif) sur les jours loggés avec un objectif valide, + décompte binaire au-dessus/en dessous
 * (distinct de la marge de tolérance de `computeGoalAdherence`). Même filtre de jours exploitables
 * que `computeGoalAdherence` — pas de nouvelle convention.
 */
export function computeCaloricBalance(
  perDay: { kcal: number; effectiveTarget: number | null }[],
): { balanceKcal: number; daysAbove: number; daysBelow: number } {
  const days = perDay.filter(
    (d): d is { kcal: number; effectiveTarget: number } =>
      d.effectiveTarget != null && d.effectiveTarget > 0,
  );
  const balanceKcal = Math.round(days.reduce((sum, d) => sum + (d.kcal - d.effectiveTarget), 0));
  const daysAbove = days.filter((d) => d.kcal > d.effectiveTarget).length;
  const daysBelow = days.filter((d) => d.kcal < d.effectiveTarget).length;
  return { balanceKcal, daysAbove, daysBelow };
}

/**
 * Régularité du journal (item NUTR-17) : part des jours renseignés sur la fenêtre des `windowDays`
 * jours ÉCOULÉS (`[J-windowDays … J-1]`, aujourd'hui exclu), dénominateur borné à l'ancienneté du
 * compte (`min(fenêtre, jours depuis la 1ʳᵉ entrée)`). Pur. Reçoit un `Date` `today` (jamais une clé —
 * `new Date("AAAA-MM-JJ")` parse en UTC et décalerait d'un jour). Comparaisons en clés `AAAA-MM-JJ`.
 */
export function computeJournalCompletion(params: {
  loggedDayKeys: string[];
  firstEntryDayKey: string | null;
  windowDays: number;
  today: Date;
}): { loggedDays: number; effectiveWindow: number; pct: number } {
  const { loggedDayKeys, firstEntryDayKey, windowDays, today } = params;
  const empty = { loggedDays: 0, effectiveWindow: 0, pct: 0 };

  const yesterdayKey = localDayKey(addDays(today, -1));
  const windowStartKey = localDayKey(addDays(today, -windowDays));
  if (firstEntryDayKey == null) return empty;

  const effectiveStartKey = firstEntryDayKey > windowStartKey ? firstEntryDayKey : windowStartKey;
  if (effectiveStartKey > yesterdayKey) return empty; // 1ʳᵉ entrée = aujourd'hui / futur

  // Écart EXACT en jours (reparse UTC → pas de dérive heure d'été).
  const effectiveWindow = Math.max(
    0,
    Math.round(
      (Date.parse(yesterdayKey + 'T00:00:00Z') - Date.parse(effectiveStartKey + 'T00:00:00Z')) /
        86_400_000,
    ) + 1,
  );
  if (effectiveWindow === 0) return empty;

  const loggedDays = new Set(
    loggedDayKeys.filter((k) => k >= effectiveStartKey && k <= yesterdayKey),
  ).size;
  return { loggedDays, effectiveWindow, pct: Math.round((loggedDays / effectiveWindow) * 100) };
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
 * Cibles macro d'un jour, bonus calorique (MN-01/RN-02) redirigé vers les glucides plutôt
 * qu'invisible (US MN-04, spec R1, décision D1 — 100 % glucides, aucune répartition avec les
 * protéines : déjà couvertes indépendamment par MN-06). `effectiveTarget === targetBase` (jour
 * sans bonus) → résultat identique à `macroGramsFromCalories(targetBase, ...)` seul (spec R4).
 */
export function trainingDayMacroGrams(params: {
  targetBase: number;
  effectiveTarget: number;
  objective: NutritionObjective;
}): MacroGrams {
  const base = macroGramsFromCalories(params.targetBase, defaultMacroRatios(params.objective));
  const bonusKcal = Math.max(0, params.effectiveTarget - params.targetBase);
  const bonusCarbs = Math.round(bonusKcal / CARBS_KCAL_PER_G);
  return { protein: base.protein, carbs: base.carbs + bonusCarbs, fat: base.fat };
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

// --- Répartition calorique par repas (US NUTR-16, roadmap 4.38) --------------

/** Clé technique du bucket des entrées « orphelines » (repas supprimé/renommé depuis). */
export const OTHER_MEAL_KEY = 'other';

/**
 * Une ligne de répartition, prête pour l'affichage (spec R1). `label` reprend tel quel celui du
 * repas configuré (`MealConfigItem.label`, `null` = à résoudre côté UI comme le journal) ;
 * toujours `null` pour le bucket `OTHER_MEAL_KEY` — c'est `mealKey` qui l'identifie, l'UI
 * l'affiche via `journal.meals.other`, pas via ce champ.
 */
export type MealSplitRow = {
  mealKey: string;
  label: string | null;
  pct: number;
  avgKcalPerDay: number;
};

/**
 * Répartit les totaux de kcal par repas (spec R1 : part % + moyenne kcal/jour), groupés sur la
 * **clé réelle** de `meal_type` (spec §0/R2 — `MEAL_TYPES` n'est plus la contrainte de la base
 * depuis les repas personnalisés). Une clé absente de `configuredMeals` rejoint le bucket
 * `OTHER_MEAL_KEY` (spec R3), toujours **en dernier** (spec R4 — l'ordre suit `configuredMeals`,
 * jamais un tri par part décroissante). `loggedDays <= 0` ou aucun total → `[]` (spec R5).
 */
export function resolveMealSplit(
  mealTotals: ReadonlyArray<{ mealKey: string; kcal: number }>,
  configuredMeals: ReadonlyArray<MealConfigItem>,
  loggedDays: number,
): MealSplitRow[] {
  if (loggedDays <= 0 || mealTotals.length === 0) return [];

  const totalKcal = mealTotals.reduce((sum, m) => sum + m.kcal, 0);
  if (totalKcal <= 0) return [];

  const totalsByKey = new Map(mealTotals.map((m) => [m.mealKey, m.kcal]));
  const configuredKeys = new Set(configuredMeals.map((m) => m.key));

  const toRow = (mealKey: string, kcal: number, label: string | null): MealSplitRow => ({
    mealKey,
    label,
    pct: Math.round((kcal / totalKcal) * 100),
    avgKcalPerDay: Math.round(kcal / loggedDays),
  });

  const rows: MealSplitRow[] = [];
  for (const meal of configuredMeals) {
    const kcal = totalsByKey.get(meal.key);
    if (kcal != null && kcal > 0) rows.push(toRow(meal.key, kcal, meal.label));
  }

  const otherKcal = mealTotals
    .filter((m) => !configuredKeys.has(m.mealKey))
    .reduce((sum, m) => sum + m.kcal, 0);
  if (otherKcal > 0) rows.push(toRow(OTHER_MEAL_KEY, otherKcal, null));

  return rows;
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
  /** Mode de calcul du bonus (item RN-02) : forfait fixe ou dépense course auto. */
  trainingBonusMode: z.enum(['fixed', 'auto']).default('fixed'),
  /** Marge d'adhérence à l'objectif (item NUTR-10) : % de tolérance autour de l'objectif effectif. */
  adherenceMarginPct: z.number().int().min(1).max(50).default(10),
  /** Repas personnalisés (renommer / ajouter / supprimer, item 4.15) ; `null` = 4 repas par défaut. */
  meals: z.array(mealConfigItemSchema).nullable().default(null),
});

export type NutritionProfileRow = z.infer<typeof nutritionProfileRowSchema>;

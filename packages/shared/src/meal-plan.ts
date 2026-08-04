/**
 * US REPAS-01 (roadmap 4.27) — briques pures du **planning repas**.
 *
 * Règle cardinale (R1 de la spec) : un planning est une **intention**, jamais du consommé.
 * Rien ici ne touche au journal alimentaire — les totaux du jour, l'adhérence, le streak et les
 * analyses inter-piliers continuent de ne voir que `food_entries`. Le portage au journal est un
 * geste explicite de l'utilisateur, traité côté repository.
 *
 * Réf. : docs/specs/functional/us/repas01-planning-repas-liste-courses.md
 */

import { addDays, localDateFromDayKey, localDayKey } from './date';
import { OTHER_MEAL_KEY, trainingDayCalories, type MealConfigItem } from './nutrition';

/** Ce qu'on peut déposer dans une case du planning (décision D1). */
export type MealPlanSourceType = 'recipe' | 'template';

/**
 * Une case remplie du planning. `label` et les macros sont un **snapshot** pris à la
 * planification : modifier la recette ensuite ne fait pas bouger le planning déjà posé.
 */
export type PlannedMealEntry = {
  id: string;
  planDate: string; // AAAA-MM-JJ
  mealKey: string;
  orderIndex: number;
  sourceType: MealPlanSourceType;
  recipeId: string | null;
  templateId: string | null;
  servings: number;
  label: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Non nul = entrée déjà portée au journal (R2/R3). */
  consumedAt: string | null;
};

export type PlannedDayTotals = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type MealPlanGroup = {
  key: string;
  /** Libellé personnalisé de la config, `null` = libellé i18n par défaut. */
  label: string | null;
  entries: PlannedMealEntry[];
};

/**
 * Multiplicateur à appliquer aux **ingrédients** d'une entrée de planning (règle R8).
 *
 * Piège que cette fonction existe pour neutraliser : `recipe_ingredients.quantity_g` porte la
 * quantité **totale de la recette**, pas celle d'une portion (`portion = total / servings`).
 * Planifier 2 portions d'une recette qui en produit 4 ne demande donc que **la moitié** des
 * ingrédients. Sans ce facteur, la liste de courses doublerait silencieusement.
 *
 * Un repas type n'a pas de rendement : son facteur est le multiplicateur brut.
 */
export function portionFactor(
  sourceType: MealPlanSourceType,
  servings: number,
  recipeServings: number | null | undefined,
): number {
  if (sourceType === 'template') return servings;
  // Une recette a toujours `servings >= 1` en base (CHECK) ; une donnée corrompue ou absente ne
  // doit pas produire Infinity ni NaN dans une liste de courses.
  const yieldServings = recipeServings && recipeServings > 0 ? recipeServings : 1;
  return servings / yieldServings;
}

/** Totaux planifiés d'une journée, depuis les snapshots des entrées. */
export function sumPlannedDay(entries: readonly PlannedMealEntry[]): PlannedDayTotals {
  const totals = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  return {
    kcal: Math.round(totals.kcal),
    proteinG: Math.round(totals.proteinG),
    carbsG: Math.round(totals.carbsG),
    fatG: Math.round(totals.fatG),
  };
}

/**
 * Objectif calorique du jour affiché face au total planifié (règle R5).
 *
 * Rend **`null`** quand aucune cible n'est connue (profil nutritionnel absent) : l'écran masque
 * alors la ligne d'objectif. Afficher « / 0 kcal » ferait croire à un dépassement permanent.
 *
 * Le bonus des jours d'entraînement n'est ajouté que si un pilier d'entraînement est réellement
 * actif — intégration opt-in, décision H : sans muscu ni course, le planning repas ne parle pas
 * d'entraînement.
 */
export function dayTargetKcal(input: {
  targetKcal: number | null;
  trainingBonusKcal: number;
  hasTrainingSession: boolean;
  trainingPillarsActive: boolean;
}): number | null {
  const { targetKcal, trainingBonusKcal, hasTrainingSession, trainingPillarsActive } = input;
  if (targetKcal === null) return null;
  if (!hasTrainingSession || !trainingPillarsActive) return Math.round(targetKcal);
  // `trainingDayCalories` borne déjà le bonus à >= 0 (US RN-02).
  return trainingDayCalories(targetKcal, trainingBonusKcal);
}

/**
 * Répartit les entrées d'un jour dans les repas **configurés par l'utilisateur** (règle R4), dans
 * leur ordre. Les repas vides sont conservés : ce sont les cases à remplir.
 *
 * Une entrée dont la `meal_key` ne correspond plus à aucun repas (repas supprimé des réglages
 * après coup) tombe dans le bucket « Autre » ajouté **en fin de liste** (règle R10) — jamais
 * masquée, jamais perdue. Si la config contient déjà un repas nommé `other`, il n'est pas
 * dupliqué : les orphelines le rejoignent.
 */
export function groupEntriesByMeal(
  entries: readonly PlannedMealEntry[],
  mealConfig: readonly MealConfigItem[],
): MealPlanGroup[] {
  const groups: MealPlanGroup[] = mealConfig.map((m) => ({
    key: m.key,
    label: m.label,
    entries: [],
  }));
  const byKey = new Map(groups.map((g) => [g.key, g]));

  const orphans: PlannedMealEntry[] = [];
  for (const e of entries) {
    const group = byKey.get(e.mealKey);
    if (group) group.entries.push(e);
    else orphans.push(e);
  }

  if (orphans.length > 0) {
    const existing = byKey.get(OTHER_MEAL_KEY);
    if (existing) existing.entries.push(...orphans);
    else groups.push({ key: OTHER_MEAL_KEY, label: null, entries: orphans });
  }

  for (const g of groups) g.entries.sort((a, b) => a.orderIndex - b.orderIndex);
  return groups;
}

/**
 * Les 7 clés `AAAA-MM-JJ` de la semaine commençant à `weekStartDate`.
 *
 * La date est reconstruite **composant par composant** (`localDateFromDayKey`) : `new Date('AAAA-MM-JJ')`
 * est interprété en UTC et décale la semaine d'un jour dans les fuseaux à l'ouest de Greenwich.
 */
export function weekDayKeys(weekStartDate: string): string[] {
  const start = localDateFromDayKey(weekStartDate);
  return Array.from({ length: 7 }, (_, i) => localDayKey(addDays(start, i)));
}

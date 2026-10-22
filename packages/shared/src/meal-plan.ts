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
import type { RangeDayTarget } from './day-target-range';
import { OTHER_MEAL_KEY, type MealConfigItem } from './nutrition';

/** Ce qu'on peut déposer dans une case du planning (décision D1). */
/**
 * Origine d'une entrée de planning.
 *
 * 🔴 `food` et `quick` ouverts par l'US NUTRI-UX01 (R7.1). Le planning n'acceptait que `recipe`
 * et `template` : planifier son premier repas imposait donc de **créer une recette d'abord**,
 * soit une vingtaine de taps avant le moindre résultat. Ce n'était pas l'ergonomie interne du
 * module qui le condamnait, c'était cette porte fermée à l'entrée.
 */
export type MealPlanSourceType = 'recipe' | 'template' | 'food' | 'quick';

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
  /** Aliment planifié (`source_type = 'food'`), sinon `null`. */
  foodId: string | null;
  /** Grammes de l'aliment planifié ; `null` pour les autres sources, qui portent `servings`. */
  quantityG: number | null;
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
  // `template`, `food` et `quick` portent déjà leurs valeurs pour la quantité voulue : le
  // snapshot est pris tel quel, `servings` n'est qu'un multiplicateur (1 dans le cas courant).
  if (sourceType !== 'recipe') return servings;
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
 * D'où vient le bonus d'un jour du planning — ce que dit sa pastille (US CIBLE-01, DD7) :
 * - `planned` : le forfait d'une séance **seulement prévue** (« Séance prévue — objectif +X kcal ») ;
 * - `done` : le forfait d'un jour d'entraînement **fait** (séance, course, autre activité) ;
 * - `run` : la dépense d'une course terminée (mode `auto`, RN-02) ;
 * - `energy` : la dépense réelle retenue du jour (mode « Selon ce que tu fais », DEPENSE-00) ;
 * - `energyLater` : mode « Selon ce que tu fais », une séance prévue aujourd'hui ou après, rien de dépensé
 *   encore — sa dépense s'ajoutera (D3).
 */
export type MealPlanBonusKind = 'planned' | 'done' | 'run' | 'energy' | 'energyLater';
export type MealPlanBonusBadge = { kind: MealPlanBonusKind; kcal: number };

/**
 * Ce que la carte d'un jour du planning affiche face au total planifié : la cible du jour (règle R5) et la
 * pastille de son bonus.
 *
 * US CIBLE-01 — la cible est celle d'Aujourd'hui et de Noryn, pour ce jour (`RangeDayTarget`, composée par
 * `composeCalorieTargetsForDays`) : socle hors sport et dépense réelle en mode « Selon ce que tu fais »,
 * dépense de la course en mode `auto`, forfait des jours d'entraînement — faits, ou prévus aujourd'hui et
 * après. Plus de calcul propre au planning : il recopiait la formule, avec le socle `tdee` quel que soit le
 * mode et le forfait de toute séance planifiée, sautée ou manquée comprise.
 *
 * **Une seule règle reste propre au planning (D7-B)** : sans pilier d'entraînement actif (ni muscu, ni
 * course), il ne parle pas d'entraînement (REPAS-01 R5, décision H) — la cible **de base**, aucune
 * pastille. Éteindre un pilier ne supprime pas ses séances planifiées : sans cette règle, « Séance prévue
 * +300 » s'afficherait pour un pilier masqué. Aujourd'hui leur donne le forfait (BACKLOG CIBLE-02).
 *
 * `null` sans cible calculable (profil incomplet) : l'écran masque la ligne d'objectif, et ne montre pas
 * de pastille — un bonus ne s'ajoute à rien. Afficher « / 0 kcal » ferait croire à un dépassement.
 */
export function mealPlanDayTarget(input: {
  dayKey: string;
  todayKey: string;
  day: Pick<RangeDayTarget, 'target' | 'effectiveTarget' | 'trainingBonus' | 'bonusSource' | 'socleKind' | 'trainedBy'> | null | undefined;
  trainingPillarsActive: boolean;
}): { targetKcal: number | null; badge: MealPlanBonusBadge | null } {
  const { dayKey, todayKey, day, trainingPillarsActive } = input;
  if (!day || day.effectiveTarget == null) return { targetKcal: null, badge: null };
  if (!trainingPillarsActive) return { targetKcal: day.target, badge: null };
  return { targetKcal: day.effectiveTarget, badge: bonusBadge(day, dayKey >= todayKey) };
}

function bonusBadge(
  day: Pick<RangeDayTarget, 'trainingBonus' | 'bonusSource' | 'socleKind' | 'trainedBy'>,
  todayOrLater: boolean,
): MealPlanBonusBadge | null {
  switch (day.bonusSource) {
    case 'forfait':
      return { kind: day.trainedBy === 'done' ? 'done' : 'planned', kcal: day.trainingBonus };
    case 'run':
      return { kind: 'run', kcal: day.trainingBonus };
    case 'activities':
      return { kind: 'energy', kcal: day.trainingBonus };
    case 'none':
      // Le socle hors sport est celui du mode « Selon ce que tu fais » (`nutritionSocle`) : aucune
      // anticipation de la dépense (DEPENSE-00 §6), mais la pastille dit qu'elle viendra.
      return day.socleKind === 'sportFree' && todayOrLater && day.trainedBy === 'planned'
        ? { kind: 'energyLater', kcal: 0 }
        : null;
  }
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

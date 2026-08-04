/**
 * Repository du **planning repas** (US REPAS-01, roadmap 4.27) : `meal_plan_entries`.
 *
 * ⚠️ Règle cardinale R1 : **planifier n'écrit jamais dans `food_entries`.** Le planning est une
 * intention ; les totaux du jour, l'adhérence, le streak, le bilan hebdo et toutes les analyses
 * inter-piliers continuent de ne voir que le consommé réel. Seul `consumePlannedEntry` — déclenché
 * par un geste explicite de l'utilisateur — alimente le journal.
 *
 * Table utilisateur (`user_id`), soft delete, écritures via `_sql.ts`.
 * Réf. : docs/specs/functional/us/repas01-planning-repas-liste-courses.md
 */

import { useQuery } from '@powersync/react';
import {
  localDayKey,
  localDateFromDayKey,
  addDays,
  daysBetween,
  portionFactor,
  type MealPlanSourceType,
  type PlannedMealEntry,
} from '@wellness/shared';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { addFoodEntry, removeEntry } from './journal-repository';
import { applyTemplate } from './meal-template-repository';
import { insertWithSyncFields, nowUtc, patch, softDelete, txInsert } from './_sql';

type PlanDbRow = {
  id: string;
  plan_date: string;
  meal_key: string;
  order_index: number;
  source_type: string;
  recipe_id: string | null;
  template_id: string | null;
  servings: number;
  label: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  consumed_at: string | null;
  consumed_entry_ids: string | null;
};

const PLAN_COLUMNS = `
  id, plan_date, meal_key, order_index, source_type, recipe_id, template_id,
  servings, label, kcal, protein_g, carbs_g, fat_g, consumed_at, consumed_entry_ids
`;

/** Fenêtre de 7 jours, bornes incluses — l'idiome de `useWeekPlan` côté muscu. */
export const SELECT_PLAN_BETWEEN = `
  SELECT ${PLAN_COLUMNS} FROM meal_plan_entries
  WHERE user_id = ? AND plan_date >= ? AND plan_date <= ? AND deleted_at IS NULL
  ORDER BY plan_date, meal_key, order_index
`;

export const SELECT_PLAN_DAY = `
  SELECT ${PLAN_COLUMNS} FROM meal_plan_entries
  WHERE user_id = ? AND plan_date = ? AND deleted_at IS NULL
  ORDER BY meal_key, order_index
`;

/**
 * Nombre d'entrées d'une semaine. Sert à savoir s'il y a **quelque chose à dupliquer** sans
 * charger les entrées elles-mêmes : l'écran n'en affiche aucune, il a seulement besoin de
 * décider s'il propose l'action.
 */
export const COUNT_PLAN_BETWEEN = `
  SELECT COUNT(*) AS n FROM meal_plan_entries
  WHERE user_id = ? AND plan_date >= ? AND plan_date <= ? AND deleted_at IS NULL
`;

function rowToEntry(r: PlanDbRow): PlannedMealEntry {
  return {
    id: r.id,
    planDate: r.plan_date,
    mealKey: r.meal_key,
    orderIndex: r.order_index,
    sourceType: r.source_type as MealPlanSourceType,
    recipeId: r.recipe_id,
    templateId: r.template_id,
    servings: r.servings,
    label: r.label,
    kcal: Math.round(r.kcal),
    proteinG: r.protein_g,
    carbsG: r.carbs_g,
    fatG: r.fat_g,
    consumedAt: r.consumed_at,
  };
}

/**
 * Entrées de planning de la semaine commençant à `weekStartDate` (7 jours, bornes incluses).
 *
 * `isLoading` ne dépend QUE de la résolution de la requête locale (offline-first, ADR-001) —
 * jamais d'une synchro réseau. La date de fin est construite composant par composant :
 * `new Date('AAAA-MM-JJ')` est interprété UTC et décalerait la semaine d'un jour.
 */
export function useWeekMealPlan(weekStartDate: string): {
  entries: PlannedMealEntry[];
  isLoading: boolean;
} {
  const userId = useAuthStore((s) => s.session?.user.id ?? '');
  const weekEnd = localDayKey(addDays(localDateFromDayKey(weekStartDate), 6));

  const { data, isLoading } = useQuery<PlanDbRow>(SELECT_PLAN_BETWEEN, [
    userId,
    weekStartDate,
    weekEnd,
  ]);

  return { entries: data.map(rowToEntry), isLoading };
}

/**
 * Nombre d'entrées planifiées sur une semaine, réactif aux changements locaux.
 *
 * Utilisé pour n'offrir « Dupliquer la semaine précédente » que quand cette semaine a réellement
 * du contenu : une action qui ne peut rien faire ne doit pas être proposée (elle réussirait en
 * silence sans rien copier).
 */
export function useWeekMealPlanCount(weekStartDate: string): {
  count: number;
  isLoading: boolean;
} {
  const userId = useAuthStore((s) => s.session?.user.id ?? '');
  const weekEnd = localDayKey(addDays(localDateFromDayKey(weekStartDate), 6));

  const { data, isLoading } = useQuery<{ n: number }>(COUNT_PLAN_BETWEEN, [
    userId,
    weekStartDate,
    weekEnd,
  ]);

  return { count: data[0]?.n ?? 0, isLoading };
}

/** Entrées de planning d'un jour donné. */
export function useDayMealPlan(dayKey: string): {
  entries: PlannedMealEntry[];
  isLoading: boolean;
} {
  const userId = useAuthStore((s) => s.session?.user.id ?? '');
  const { data, isLoading } = useQuery<PlanDbRow>(SELECT_PLAN_DAY, [userId, dayKey]);
  return { entries: data.map(rowToEntry), isLoading };
}

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible d’écrire un planning repas.');
  return userId;
}

/**
 * Prochain `order_index` d'une case du planning : `MAX + 1` par `(jour, repas)`.
 * Petit entier séquentiel — surtout pas `Date.now()`, qui dépasse l'`integer` Postgres
 * (l'upload PowerSync échouait alors avec « out of range for type integer », cf. journal).
 */
async function nextOrderIndex(planDate: string, mealKey: string): Promise<number> {
  const row = await powerSync.getOptional<{ max_index: number | null }>(
    `SELECT MAX(order_index) AS max_index FROM meal_plan_entries
     WHERE plan_date = ? AND meal_key = ? AND deleted_at IS NULL`,
    [planDate, mealKey],
  );
  const max = row?.max_index;
  return max === null || max === undefined ? 0 : max + 1;
}

type RecipeSnapshotRow = {
  name: string;
  servings: number;
  total_kcal: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
};

/**
 * Planifie `servings` portions d'une recette dans une case du planning.
 *
 * Les macros sont **snapshotées** à cet instant (règle R7 de la spec §2.1) : modifier la recette
 * ensuite ne fait pas bouger le planning déjà posé. Les *ingrédients*, eux, seront relus vivants à
 * la génération de la liste de courses (règle R6) — on achète ce qu'on va réellement cuisiner.
 *
 * Le snapshot est mis à l'échelle par `portionFactor` : `recipe_ingredients` et les totaux qui en
 * découlent portent la quantité **totale de la recette**, pas celle d'une portion.
 */
export async function planRecipe(
  dayKey: string,
  mealKey: string,
  recipeId: string,
  servings: number,
): Promise<string> {
  const recipe = await powerSync.getOptional<RecipeSnapshotRow>(
    `SELECT r.name, r.servings,
       COALESCE(SUM(i.kcal), 0)       AS total_kcal,
       COALESCE(SUM(i.protein_g), 0)  AS total_protein_g,
       COALESCE(SUM(i.carbs_g), 0)    AS total_carbs_g,
       COALESCE(SUM(i.fat_g), 0)      AS total_fat_g
     FROM recipes r
     LEFT JOIN recipe_ingredients i ON i.recipe_id = r.id AND i.deleted_at IS NULL
     WHERE r.id = ? AND r.deleted_at IS NULL
     GROUP BY r.id`,
    [recipeId],
  );
  if (!recipe) throw new Error(`Recette introuvable ou archivée : ${recipeId}`);

  const factor = portionFactor('recipe', servings, recipe.servings);

  return insertWithSyncFields('meal_plan_entries', {
    user_id: currentUserId(),
    plan_date: dayKey,
    meal_key: mealKey,
    order_index: await nextOrderIndex(dayKey, mealKey),
    source_type: 'recipe',
    recipe_id: recipeId,
    template_id: null,
    servings,
    label: recipe.name,
    kcal: Math.round(recipe.total_kcal * factor),
    protein_g: recipe.total_protein_g * factor,
    carbs_g: recipe.total_carbs_g * factor,
    fat_g: recipe.total_fat_g * factor,
    consumed_at: null,
    consumed_entry_ids: null,
  });
}

type TemplateSnapshotRow = {
  name: string;
  total_kcal: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
};

/**
 * Planifie un repas type. Un repas type n'a **pas** de notion de portions (décision D1) : il
 * s'ajoute tel quel, `servings` reste à 1.
 */
export async function planTemplate(
  dayKey: string,
  mealKey: string,
  templateId: string,
): Promise<string> {
  const template = await powerSync.getOptional<TemplateSnapshotRow>(
    `SELECT t.name,
       COALESCE(SUM(i.kcal), 0)      AS total_kcal,
       COALESCE(SUM(i.protein_g), 0) AS total_protein_g,
       COALESCE(SUM(i.carbs_g), 0)   AS total_carbs_g,
       COALESCE(SUM(i.fat_g), 0)     AS total_fat_g
     FROM meal_templates t
     LEFT JOIN meal_template_items i ON i.template_id = t.id AND i.deleted_at IS NULL
     WHERE t.id = ? AND t.deleted_at IS NULL
     GROUP BY t.id`,
    [templateId],
  );
  if (!template) throw new Error(`Repas type introuvable ou archivé : ${templateId}`);

  return insertWithSyncFields('meal_plan_entries', {
    user_id: currentUserId(),
    plan_date: dayKey,
    meal_key: mealKey,
    order_index: await nextOrderIndex(dayKey, mealKey),
    source_type: 'template',
    recipe_id: null,
    template_id: templateId,
    servings: 1,
    label: template.name,
    kcal: Math.round(template.total_kcal),
    protein_g: template.total_protein_g,
    carbs_g: template.total_carbs_g,
    fat_g: template.total_fat_g,
    consumed_at: null,
    consumed_entry_ids: null,
  });
}

/**
 * Change le nombre de portions d'une entrée de recette et **remet le snapshot à l'échelle**.
 *
 * Le snapshot est recalculé depuis la recette vivante : c'est voulu. Changer les portions est une
 * ré-intention explicite, contrairement à une modification de la recette dans le dos du planning.
 */
export async function updatePlannedServings(id: string, servings: number): Promise<void> {
  if (servings <= 0) throw new Error('Un nombre de portions doit être strictement positif.');

  const row = await powerSync.getOptional<{
    source_type: string;
    recipe_id: string | null;
  }>(`SELECT source_type, recipe_id FROM meal_plan_entries WHERE id = ?`, [id]);
  if (!row) throw new Error(`Entrée de planning introuvable : ${id}`);
  if (row.source_type !== 'recipe' || !row.recipe_id) {
    // Un repas type n'a pas de portions : rien à mettre à l'échelle.
    await patch('meal_plan_entries', id, { servings });
    return;
  }

  const recipe = await powerSync.getOptional<RecipeSnapshotRow>(
    `SELECT r.name, r.servings,
       COALESCE(SUM(i.kcal), 0)       AS total_kcal,
       COALESCE(SUM(i.protein_g), 0)  AS total_protein_g,
       COALESCE(SUM(i.carbs_g), 0)    AS total_carbs_g,
       COALESCE(SUM(i.fat_g), 0)      AS total_fat_g
     FROM recipes r
     LEFT JOIN recipe_ingredients i ON i.recipe_id = r.id AND i.deleted_at IS NULL
     WHERE r.id = ? AND r.deleted_at IS NULL
     GROUP BY r.id`,
    [row.recipe_id],
  );

  // Recette archivée depuis : on ajuste les portions sans toucher au snapshot, qui reste la
  // seule trace de ce qui était prévu (règle R11).
  if (!recipe) {
    await patch('meal_plan_entries', id, { servings });
    return;
  }

  const factor = portionFactor('recipe', servings, recipe.servings);
  await patch('meal_plan_entries', id, {
    servings,
    kcal: Math.round(recipe.total_kcal * factor),
    protein_g: recipe.total_protein_g * factor,
    carbs_g: recipe.total_carbs_g * factor,
    fat_g: recipe.total_fat_g * factor,
  });
}

export async function removePlannedEntry(id: string): Promise<void> {
  await softDelete('meal_plan_entries', id);
}

/**
 * Recopie toutes les entrées d'une semaine vers une autre (décision D12).
 *
 * **Ajoute**, n'efface pas : une semaine cible déjà remplie conserve ses entrées, les copies
 * s'empilent derrière (`order_index` recalculé). Effacer serait destructeur sans confirmation
 * possible depuis un repository.
 *
 * ⚠️ `consumed_at` et `consumed_entry_ids` sont **remis à null** : dupliquer une intention ne
 * duplique pas un repas mangé. Sans ça, la semaine copiée arriverait déjà « portée au journal »
 * et l'utilisateur ne pourrait plus la porter.
 *
 * Retourne le nombre d'entrées copiées.
 */
export async function duplicateWeek(
  fromWeekStart: string,
  toWeekStart: string,
): Promise<number> {
  const userId = currentUserId();
  const shift = daysBetween(fromWeekStart, toWeekStart);
  const fromEnd = localDayKey(addDays(localDateFromDayKey(fromWeekStart), 6));

  const rows = await powerSync.getAll<PlanDbRow>(SELECT_PLAN_BETWEEN, [
    userId,
    fromWeekStart,
    fromEnd,
  ]);
  if (rows.length === 0) return 0;

  // Base d'order_index par (jour cible, repas), pour s'empiler derrière l'existant.
  const nextIndex = new Map<string, number>();
  for (const r of rows) {
    const targetDate = localDayKey(addDays(localDateFromDayKey(r.plan_date), shift));
    const key = `${targetDate}|${r.meal_key}`;
    if (!nextIndex.has(key)) {
      nextIndex.set(key, await nextOrderIndex(targetDate, r.meal_key));
    }
  }

  await powerSync.writeTransaction(async (tx) => {
    for (const r of rows) {
      const targetDate = localDayKey(addDays(localDateFromDayKey(r.plan_date), shift));
      const key = `${targetDate}|${r.meal_key}`;
      const index = nextIndex.get(key)!;
      nextIndex.set(key, index + 1);

      await txInsert(tx, 'meal_plan_entries', {
        user_id: userId,
        plan_date: targetDate,
        meal_key: r.meal_key,
        order_index: index,
        source_type: r.source_type,
        recipe_id: r.recipe_id,
        template_id: r.template_id,
        servings: r.servings,
        label: r.label,
        kcal: r.kcal,
        protein_g: r.protein_g,
        carbs_g: r.carbs_g,
        fat_g: r.fat_g,
        consumed_at: null,
        consumed_entry_ids: null,
      });
    }
  });

  return rows.length;
}

// ---------------------------------------------------------------------------
// Portage au journal (règles R2 / R3) — le seul chemin qui écrit dans food_entries
// ---------------------------------------------------------------------------

/**
 * Porte une entrée de planning au journal : « J'ai mangé ça ».
 *
 * - Une **recette** devient une seule ligne de journal portant son nom et ses macros snapshotées,
 *   exactement comme l'ajout d'une recette depuis le journal (spec alimentation §5.2).
 * - Un **repas type** est déplié en une ligne par aliment, via `applyTemplate` réutilisé tel quel.
 *
 * **Idempotent** (règle R3) : une entrée déjà portée ne l'est pas deux fois. Retourne le nombre de
 * lignes de journal créées (0 si l'entrée était déjà portée).
 */
export async function consumePlannedEntry(id: string): Promise<number> {
  const row = await powerSync.getOptional<PlanDbRow>(
    `SELECT ${PLAN_COLUMNS} FROM meal_plan_entries WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
  if (!row) throw new Error(`Entrée de planning introuvable : ${id}`);
  if (row.consumed_at) return 0; // déjà portée — ne pas doubler les lignes

  const createdIds: string[] = [];

  if (row.source_type === 'template' && row.template_id) {
    // `applyTemplate` crée une food_entry par aliment du repas type. On relève les lignes créées
    // en comparant l'état du repas avant/après : c'est le seul moyen sans changer sa signature,
    // qui est déjà utilisée ailleurs (journal, 1 tap).
    const before = await journalEntryIds(row.plan_date, row.meal_key);
    await applyTemplate(row.template_id, row.plan_date, row.meal_key);
    const after = await journalEntryIds(row.plan_date, row.meal_key);
    const beforeSet = new Set(before);
    createdIds.push(...after.filter((entryId) => !beforeSet.has(entryId)));
  } else {
    const entryId = await addFoodEntry(row.plan_date, row.meal_key, {
      foodId: null,
      name: row.label,
      quantityG: null,
      kcal: Math.round(row.kcal),
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
    });
    createdIds.push(entryId);
  }

  await patch('meal_plan_entries', id, {
    consumed_at: nowUtc(),
    consumed_entry_ids: JSON.stringify(createdIds),
  });

  return createdIds.length;
}

async function journalEntryIds(date: string, mealKey: string): Promise<string[]> {
  const rows = await powerSync.getAll<{ id: string }>(
    `SELECT id FROM food_entries
     WHERE log_date = ? AND meal_type = ? AND deleted_at IS NULL`,
    [date, mealKey],
  );
  return rows.map((r) => r.id);
}

/**
 * Annule un portage : retire **exactement** les lignes de journal créées (règle R3), grâce aux
 * identifiants retenus dans `consumed_entry_ids`.
 *
 * Une ligne déjà supprimée à la main entre-temps est simplement ignorée — `removeEntry` est un
 * soft delete idempotent. On ne touche à aucune autre ligne du journal du jour.
 *
 * Retourne le nombre de lignes retirées.
 */
export async function undoConsumedEntry(id: string): Promise<number> {
  const row = await powerSync.getOptional<{
    consumed_at: string | null;
    consumed_entry_ids: string | null;
  }>(`SELECT consumed_at, consumed_entry_ids FROM meal_plan_entries WHERE id = ?`, [id]);
  if (!row) throw new Error(`Entrée de planning introuvable : ${id}`);
  if (!row.consumed_at) return 0;

  const ids = parseEntryIds(row.consumed_entry_ids);
  for (const entryId of ids) {
    await removeEntry(entryId);
  }

  await patch('meal_plan_entries', id, { consumed_at: null, consumed_entry_ids: null });
  return ids.length;
}

/**
 * Lit `consumed_entry_ids`. Tolérant : un JSON illisible ne doit pas empêcher de dé-marquer une
 * entrée (l'utilisateur resterait bloqué sur « porté au journal » sans pouvoir revenir).
 */
function parseEntryIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Repository de la **liste de courses** (US REPAS-01, roadmap 4.28 / 4.29) :
 * `shopping_lists` + `shopping_list_items`.
 *
 * La liste est **matérialisée** (décision D5), pas dérivée à la volée : on la génère, puis elle ne
 * bouge plus. Une liste recalculée en continu changerait de lignes et de quantités pendant qu'on est
 * au rayon, et perdrait les cases cochées à chaque édition de recette.
 *
 * En revanche, la **génération** lit les ingrédients **vivants** (règle R6) : on achète ce qu'on va
 * réellement cuisiner, pas une photo de la recette d'il y a trois semaines.
 *
 * Réf. : docs/specs/functional/us/repas01-planning-repas-liste-courses.md
 */

import { useQuery } from '@powersync/react';
import {
  addDays,
  aggregateShoppingList,
  localDateFromDayKey,
  localDayKey,
  portionFactor,
  sortShoppingLines,
  type IngredientContribution,
  type ShoppingAisle,
} from '@wellness/shared';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, nowUtc, patch, softDelete, txInsert } from './_sql';

export type ShoppingListSummary = {
  id: string;
  weekStartDate: string;
  generatedAt: string;
  /** Entrées de planning dont aucun ingrédient n'a pu être résolu (règle R11/R12). */
  unresolvedCount: number;
  /** Entrées de planning couvertes par cette génération. */
  plannedCount: number;
};

export type ShoppingItem = {
  id: string;
  foodId: string | null;
  name: string;
  category: ShoppingAisle;
  quantityG: number | null;
  unquantifiedCount: number;
  checked: boolean;
  orderIndex: number;
};

type ListDbRow = {
  id: string;
  week_start_date: string;
  generated_at: string;
  unresolved_count: number;
  planned_count: number;
};

type ItemDbRow = {
  id: string;
  food_id: string | null;
  name: string;
  category: string;
  quantity_g: number | null;
  unquantified_count: number;
  checked: number;
  order_index: number;
};

/**
 * La liste **active** d'une semaine = la plus récente (décision D6).
 *
 * Il n'y a volontairement aucune contrainte d'unicité en base : deux appareils hors réseau peuvent
 * générer la même semaine, et une violation d'unicité ferait échouer l'upload PowerSync en
 * bloquant la file d'écriture. On tranche donc à la lecture, pas par une contrainte.
 */
export const SELECT_ACTIVE_LIST = `
  SELECT id, week_start_date, generated_at, unresolved_count, planned_count
  FROM shopping_lists
  WHERE user_id = ? AND week_start_date = ? AND deleted_at IS NULL
  ORDER BY generated_at DESC, id DESC
  LIMIT 1
`;

export const SELECT_LIST_ITEMS = `
  SELECT id, food_id, name, category, quantity_g, unquantified_count, checked, order_index
  FROM shopping_list_items
  WHERE list_id = ? AND deleted_at IS NULL
  ORDER BY order_index
`;

/** Ingrédients vivants des recettes planifiées sur la fenêtre (règle R6). */
const SELECT_RECIPE_CONTRIBUTIONS = `
  SELECT e.id AS entry_id, e.servings AS entry_servings, r.servings AS recipe_servings,
         i.food_id, i.name, i.quantity_g, f.category
  FROM meal_plan_entries e
  JOIN recipes r             ON r.id = e.recipe_id  AND r.deleted_at IS NULL
  JOIN recipe_ingredients i  ON i.recipe_id = r.id  AND i.deleted_at IS NULL
  LEFT JOIN foods f          ON f.id = i.food_id    AND f.deleted_at IS NULL
  WHERE e.user_id = ? AND e.plan_date >= ? AND e.plan_date <= ?
    AND e.deleted_at IS NULL AND e.source_type = 'recipe'
`;

/** Ingrédients vivants des repas types planifiés sur la fenêtre. */
const SELECT_TEMPLATE_CONTRIBUTIONS = `
  SELECT e.id AS entry_id, e.servings AS entry_servings, NULL AS recipe_servings,
         i.food_id, i.name, i.quantity_g, f.category
  FROM meal_plan_entries e
  JOIN meal_templates t          ON t.id = e.template_id     AND t.deleted_at IS NULL
  JOIN meal_template_items i     ON i.template_id = t.id     AND i.deleted_at IS NULL
  LEFT JOIN foods f              ON f.id = i.food_id         AND f.deleted_at IS NULL
  WHERE e.user_id = ? AND e.plan_date >= ? AND e.plan_date <= ?
    AND e.deleted_at IS NULL AND e.source_type = 'template'
`;

const COUNT_PLANNED = `
  SELECT COUNT(*) AS n FROM meal_plan_entries
  WHERE user_id = ? AND plan_date >= ? AND plan_date <= ? AND deleted_at IS NULL
`;

type ContributionDbRow = {
  entry_id: string;
  entry_servings: number;
  recipe_servings: number | null;
  food_id: string | null;
  name: string;
  quantity_g: number | null;
  category: string | null;
};

function rowToSummary(r: ListDbRow): ShoppingListSummary {
  return {
    id: r.id,
    weekStartDate: r.week_start_date,
    generatedAt: r.generated_at,
    unresolvedCount: r.unresolved_count,
    plannedCount: r.planned_count,
  };
}

export function useActiveShoppingList(weekStartDate: string): {
  list: ShoppingListSummary | null;
  isLoading: boolean;
} {
  const userId = useAuthStore((s) => s.session?.user.id ?? '');
  const { data, isLoading } = useQuery<ListDbRow>(SELECT_ACTIVE_LIST, [userId, weekStartDate]);
  return { list: data.length > 0 ? rowToSummary(data[0]!) : null, isLoading };
}

export function useShoppingListItems(listId: string | null): {
  items: ShoppingItem[];
  isLoading: boolean;
} {
  // `listId` vide = aucune liste : la requête ne renvoie rien plutôt que d'être désactivée
  // conditionnellement (un hook ne peut pas être appelé sous condition).
  const { data, isLoading } = useQuery<ItemDbRow>(SELECT_LIST_ITEMS, [listId ?? '']);
  return {
    items: data.map((i) => ({
      id: i.id,
      foodId: i.food_id,
      name: i.name,
      category: i.category as ShoppingAisle,
      quantityG: i.quantity_g,
      unquantifiedCount: i.unquantified_count,
      checked: i.checked === 1,
      orderIndex: i.order_index,
    })),
    isLoading,
  };
}

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible de générer une liste de courses.');
  return userId;
}

/**
 * Génère la liste de courses d'une semaine planifiée.
 *
 * Chaîne : entrées de la semaine → ingrédients **vivants** → facteur de portion (R8) → agrégation
 * (R7/R9) → tri par rayon (R13) → lignes matérialisées.
 *
 * Une entrée dont la source a été archivée ne contribue aucun ingrédient : elle est **comptée**
 * dans `unresolved_count` (règle R11/R12) pour que l'écran l'annonce, au lieu de sous-estimer les
 * courses en silence.
 *
 * Rend `null` si la semaine n'a rien de planifié : **aucune liste vide n'est créée en base**.
 */
export async function generateShoppingList(weekStartDate: string): Promise<string | null> {
  const userId = currentUserId();
  const weekEnd = localDayKey(addDays(localDateFromDayKey(weekStartDate), 6));
  const window = [userId, weekStartDate, weekEnd];

  const plannedRow = await powerSync.getOptional<{ n: number }>(COUNT_PLANNED, window);
  const plannedCount = plannedRow?.n ?? 0;
  if (plannedCount === 0) return null;

  const rows = [
    ...(await powerSync.getAll<ContributionDbRow>(SELECT_RECIPE_CONTRIBUTIONS, window)),
    ...(await powerSync.getAll<ContributionDbRow>(SELECT_TEMPLATE_CONTRIBUTIONS, window)),
  ];

  const contributions: IngredientContribution[] = rows.map((r) => ({
    foodId: r.food_id,
    name: r.name,
    category: r.category,
    quantityG: r.quantity_g,
    factor: portionFactor(
      r.recipe_servings === null ? 'template' : 'recipe',
      r.entry_servings,
      r.recipe_servings,
    ),
  }));

  const lines = sortShoppingLines(aggregateShoppingList(contributions));

  // Entrées qui n'ont contribué aucun ingrédient : source archivée, ou repas type vide.
  const contributingEntries = new Set(rows.map((r) => r.entry_id));
  const unresolvedCount = plannedCount - contributingEntries.size;

  const listId = await insertWithSyncFields('shopping_lists', {
    user_id: userId,
    week_start_date: weekStartDate,
    generated_at: nowUtc(),
    unresolved_count: unresolvedCount,
    planned_count: plannedCount,
  });

  if (lines.length > 0) {
    await powerSync.writeTransaction(async (tx) => {
      for (const [index, line] of lines.entries()) {
        await txInsert(tx, 'shopping_list_items', {
          list_id: listId,
          user_id: userId,
          food_id: line.foodId,
          name: line.name,
          category: line.category,
          quantity_g: line.quantityG,
          unquantified_count: line.unquantifiedCount,
          checked: 0,
          order_index: index,
        });
      }
    });
  }

  return listId;
}

/**
 * Régénère la liste d'une semaine : archive les listes existantes, puis génère.
 *
 * ⚠️ Les cases cochées sont **perdues** — c'est inhérent à une liste figée (D5). L'écran doit
 * l'annoncer AVANT d'appeler cette fonction (critère de recette 16) : une liste de courses à moitié
 * cochée représente un travail de magasin qu'on ne peut pas reconstituer de mémoire.
 *
 * L'archivage a lieu **même si** la nouvelle génération ne produit rien (semaine vidée entre-temps) :
 * garder une liste qui ne correspond plus au planning serait pire que ne pas en avoir.
 */
export async function regenerateShoppingList(weekStartDate: string): Promise<string | null> {
  const userId = currentUserId();
  const existing = await powerSync.getAll<{ id: string }>(
    `SELECT id FROM shopping_lists
     WHERE user_id = ? AND week_start_date = ? AND deleted_at IS NULL`,
    [userId, weekStartDate],
  );
  for (const row of existing) {
    await softDelete('shopping_lists', row.id);
  }
  return generateShoppingList(weekStartDate);
}

export async function toggleShoppingItem(id: string, checked: boolean): Promise<void> {
  await patch('shopping_list_items', id, { checked: checked ? 1 : 0 });
}

/**
 * Coche ou dé-coche tous les articles d'un rayon d'un coup (décision D13), en **une seule
 * transaction** — sinon un rayon à 12 articles ferait 12 rendus successifs à l'écran.
 *
 * Le sens (`nextChecked`) est décidé par `aisleToggleAction` côté écran, qui fait confirmer le seul
 * cas destructeur (dé-cocher un rayon entièrement coché).
 *
 * Retourne le nombre d'articles réellement modifiés.
 */
export async function toggleAisle(
  listId: string,
  category: ShoppingAisle,
  nextChecked: boolean,
): Promise<number> {
  const target = nextChecked ? 1 : 0;
  const rows = await powerSync.getAll<{ id: string }>(
    `SELECT id FROM shopping_list_items
     WHERE list_id = ? AND category = ? AND deleted_at IS NULL AND checked != ?`,
    [listId, category, target],
  );
  if (rows.length === 0) return 0;

  const now = nowUtc();
  await powerSync.writeTransaction(async (tx) => {
    for (const row of rows) {
      await tx.execute(
        `UPDATE shopping_list_items SET checked = ?, updated_at = ? WHERE id = ?`,
        [target, now, row.id],
      );
    }
  });
  return rows.length;
}

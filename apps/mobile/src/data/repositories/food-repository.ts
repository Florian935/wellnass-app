/**
 * Repository de la base d'aliments (bibliothèque + OpenFoodFacts importés + perso + favoris).
 *
 * Tables : `foods` (owner_id null = bibliothèque), `food_translations`, `food_favorites`.
 * Résolution du nom en SQL (langue courante → fr). Pattern identique à `exercise-repository`.
 */

import { useQuery } from '@powersync/react';
import type { FoodCategory, FoodPortion, FoodSource } from '@wellness/shared';
import { useTranslation } from 'react-i18next';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { resolveDeviceLocale } from '@/i18n';
import { insertWithSyncFields, softDelete } from './_sql';

/** Élément d'aliment affiché dans la recherche/liste (nom résolu, valeurs pour 100 g). */
export type FoodListItem = {
  id: string;
  name: string;
  category: FoodCategory;
  source: FoodSource;
  kcalPer100g: number;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  portions: FoodPortion[];
  isFavorite: boolean;
};

type FoodListDbRow = {
  id: string;
  source: string;
  category: string;
  kcal_per_100g: number;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  portions: string | null;
  name: string | null;
  is_favorite: number;
};

function parsePortions(raw: string | null): FoodPortion[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FoodPortion[]) : [];
  } catch {
    return [];
  }
}

const SELECT_FOODS = `
  SELECT f.id, f.source, f.category, f.kcal_per_100g, f.protein_per_100g, f.carbs_per_100g,
         f.fat_per_100g, f.portions,
         COALESCE(tl.name, tfr.name) AS name,
         (fav.id IS NOT NULL) AS is_favorite
  FROM foods f
  LEFT JOIN food_translations tl  ON tl.food_id = f.id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN food_translations tfr ON tfr.food_id = f.id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  LEFT JOIN food_favorites fav    ON fav.food_id = f.id AND fav.deleted_at IS NULL
  WHERE f.deleted_at IS NULL
`;
const ORDER_BY_NAME = 'ORDER BY name COLLATE NOCASE';
const SEARCH_CLAUSE = 'AND COALESCE(tl.name, tfr.name) LIKE ?';

function rowToItem(row: FoodListDbRow): FoodListItem {
  return {
    id: row.id,
    name: row.name ?? '',
    category: row.category as FoodCategory,
    source: row.source as FoodSource,
    kcalPer100g: row.kcal_per_100g,
    proteinPer100g: row.protein_per_100g,
    carbsPer100g: row.carbs_per_100g,
    fatPer100g: row.fat_per_100g,
    portions: parsePortions(row.portions),
    isFavorite: row.is_favorite === 1,
  };
}

/** Aliments (bibliothèque + perso + OFF importés), optionnellement filtrés par recherche. */
export function useFoods(search?: string): { foods: FoodListItem[]; isLoading: boolean } {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const term = search?.trim() ?? '';
  const hasSearch = term.length > 0;

  const sql = hasSearch
    ? `${SELECT_FOODS} ${SEARCH_CLAUSE} ${ORDER_BY_NAME}`
    : `${SELECT_FOODS} ${ORDER_BY_NAME}`;
  const params = hasSearch ? [lang, `%${term}%`] : [lang];

  const { data, isLoading } = useQuery<FoodListDbRow>(sql, params);
  return { foods: data.map(rowToItem), isLoading };
}

/** Aliments favoris de l'utilisateur courant. */
export function useFavoriteFoods(): { foods: FoodListItem[]; isLoading: boolean } {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const sql = `${SELECT_FOODS} AND fav.id IS NOT NULL ${ORDER_BY_NAME}`;
  const { data, isLoading } = useQuery<FoodListDbRow>(sql, [lang]);
  return { foods: data.map(rowToItem), isLoading };
}

// ---------------------------------------------------------------------------
// Écritures
// ---------------------------------------------------------------------------

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    throw new Error("Aucune session active : impossible d'écrire un aliment.");
  }
  return userId;
}

export type CustomFoodInput = {
  name: string;
  category: FoodCategory;
  kcalPer100g: number;
  proteinPer100g?: number | null;
  carbsPer100g?: number | null;
  fatPer100g?: number | null;
};

/**
 * Crée un aliment personnalisé (source 'custom', owner_id = user) + sa traduction
 * dans la langue de l'appareil (les aliments perso ne sont pas traduits). Retourne l'id.
 */
export async function addCustomFood(input: CustomFoodInput): Promise<string> {
  const ownerId = currentUserId();
  const foodId = await insertWithSyncFields('foods', {
    owner_id: ownerId,
    source: 'custom',
    category: input.category,
    barcode: null,
    kcal_per_100g: input.kcalPer100g,
    protein_per_100g: input.proteinPer100g ?? null,
    carbs_per_100g: input.carbsPer100g ?? null,
    sugars_per_100g: null,
    fat_per_100g: input.fatPer100g ?? null,
    saturated_fat_per_100g: null,
    fiber_per_100g: null,
    portions: JSON.stringify([]),
  });
  await insertWithSyncFields('food_translations', {
    food_id: foodId,
    owner_id: ownerId,
    lang: resolveDeviceLocale(),
    name: input.name.trim(),
  });
  return foodId;
}

/**
 * Importe un produit OpenFoodFacts dans la base locale (source 'openfoodfacts',
 * owner_id = user) et retourne l'id de l'aliment créé — prêt à être ajouté au journal.
 */
export async function importOpenFoodFactsFood(input: {
  name: string;
  category: FoodCategory;
  barcode: string | null;
  kcalPer100g: number;
  proteinPer100g?: number | null;
  carbsPer100g?: number | null;
  fatPer100g?: number | null;
}): Promise<string> {
  const ownerId = currentUserId();
  const foodId = await insertWithSyncFields('foods', {
    owner_id: ownerId,
    source: 'openfoodfacts',
    category: input.category,
    barcode: input.barcode,
    kcal_per_100g: input.kcalPer100g,
    protein_per_100g: input.proteinPer100g ?? null,
    carbs_per_100g: input.carbsPer100g ?? null,
    sugars_per_100g: null,
    fat_per_100g: input.fatPer100g ?? null,
    saturated_fat_per_100g: null,
    fiber_per_100g: null,
    portions: JSON.stringify([]),
  });
  await insertWithSyncFields('food_translations', {
    food_id: foodId,
    owner_id: ownerId,
    lang: resolveDeviceLocale(),
    name: input.name.trim(),
  });
  return foodId;
}

/** Ajoute/retire l'aliment des favoris (idempotent, soft delete). */
export async function toggleFoodFavorite(foodId: string): Promise<void> {
  const userId = currentUserId();
  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM food_favorites WHERE user_id = ? AND food_id = ? AND deleted_at IS NULL LIMIT 1`,
    [userId, foodId],
  );
  if (existing) {
    await softDelete('food_favorites', existing.id);
    return;
  }
  await insertWithSyncFields('food_favorites', { user_id: userId, food_id: foodId });
}

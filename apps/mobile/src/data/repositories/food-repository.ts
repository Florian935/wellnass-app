/**
 * Repository de la base d'aliments (bibliothèque + OpenFoodFacts importés + perso + favoris).
 *
 * Tables : `foods` (owner_id null = bibliothèque), `food_translations`, `food_favorites`.
 * Résolution du nom en SQL (langue courante → fr). Pattern identique à `exercise-repository`.
 */

import { useQuery } from '@powersync/react';
import type {
  FoodCategory,
  FoodPortion,
  FoodSource,
  Micronutrients,
  SuggestibleMacro,
} from '@wellness/shared';
import { matchesSearch, parseJsonColumn, parseMicronutrients } from '@wellness/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { resolveDeviceLocale } from '@/i18n';
import { insertWithSyncFields, patch, softDelete } from './_sql';

/** Élément d'aliment affiché dans la recherche/liste (nom résolu, valeurs pour 100 g). */
export type FoodListItem = {
  id: string;
  name: string;
  category: FoodCategory;
  source: FoodSource;
  kcalPer100g: number;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  sugarsPer100g: number | null;
  fatPer100g: number | null;
  saturatedFatPer100g: number | null;
  fiberPer100g: number | null;
  portions: FoodPortion[];
  /** Micronutriments pour 100 g (socle 4.33). Clés absentes = non renseignées. */
  micronutrients: Micronutrients;
  isFavorite: boolean;
};

type FoodListDbRow = {
  id: string;
  source: string;
  category: string;
  kcal_per_100g: number;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  sugars_per_100g: number | null;
  fat_per_100g: number | null;
  saturated_fat_per_100g: number | null;
  fiber_per_100g: number | null;
  portions: string | null;
  micronutrients: string | null;
  name: string | null;
  is_favorite: number;
};

function parsePortions(raw: string | null): FoodPortion[] {
  // Tolère le double encodage des colonnes texte-JSON client (cf. parseJsonColumn).
  const parsed = parseJsonColumn<unknown>(raw, []);
  return Array.isArray(parsed) ? (parsed as FoodPortion[]) : [];
}

const SELECT_FOODS = `
  SELECT f.id, f.source, f.category, f.kcal_per_100g, f.protein_per_100g, f.carbs_per_100g,
         f.sugars_per_100g, f.fat_per_100g, f.saturated_fat_per_100g, f.fiber_per_100g,
         f.portions, f.micronutrients,
         COALESCE(tl.name, tfr.name) AS name,
         (fav.id IS NOT NULL) AS is_favorite
  FROM foods f
  LEFT JOIN food_translations tl  ON tl.food_id = f.id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN food_translations tfr ON tfr.food_id = f.id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  LEFT JOIN food_favorites fav    ON fav.food_id = f.id AND fav.deleted_at IS NULL
  WHERE f.deleted_at IS NULL
`;
const ORDER_BY_NAME = 'ORDER BY name COLLATE NOCASE';

function rowToItem(row: FoodListDbRow): FoodListItem {
  return {
    id: row.id,
    name: row.name ?? '',
    category: row.category as FoodCategory,
    source: row.source as FoodSource,
    kcalPer100g: row.kcal_per_100g,
    proteinPer100g: row.protein_per_100g,
    carbsPer100g: row.carbs_per_100g,
    sugarsPer100g: row.sugars_per_100g,
    fatPer100g: row.fat_per_100g,
    saturatedFatPer100g: row.saturated_fat_per_100g,
    fiberPer100g: row.fiber_per_100g,
    portions: parsePortions(row.portions),
    micronutrients: parseMicronutrients(row.micronutrients),
    isFavorite: row.is_favorite === 1,
  };
}

/**
 * Aliments (bibliothèque + perso + OFF importés), optionnellement filtrés par recherche.
 * Le filtre est appliqué **en mémoire** via `matchesSearch` (repli des accents/ligatures) :
 * SQLite `LIKE` ignore la casse mais pas les accents, or la base est francophone (CIQUAL).
 */
export function useFoods(search?: string): { foods: FoodListItem[]; isLoading: boolean } {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const term = search?.trim() ?? '';

  const { data, isLoading } = useQuery<FoodListDbRow>(`${SELECT_FOODS} ${ORDER_BY_NAME}`, [lang]);
  const foods = useMemo(() => {
    const all = data.map(rowToItem);
    return term ? all.filter((f) => matchesSearch(f.name, term)) : all;
  }, [data, term]);
  return { foods, isLoading };
}

/** Lecture ponctuelle d'un aliment par id (édition), nom résolu dans `lang` (fallback fr). */
export async function getFood(id: string, lang: 'fr' | 'en'): Promise<FoodListItem | null> {
  const row = await powerSync.getOptional<FoodListDbRow>(`${SELECT_FOODS} AND f.id = ? LIMIT 1`, [lang, id]);
  return row ? rowToItem(row) : null;
}

/**
 * Cherche un aliment déjà présent en base (bibliothèque, perso ou OFF importé) par son
 * code-barres — lecture ponctuelle (non réactive). Évite de réimporter un produit déjà
 * scanné. Retourne l'aliment résolu dans `lang` (fallback fr), ou `null`.
 */
export async function findFoodByBarcode(barcode: string, lang: 'fr' | 'en'): Promise<FoodListItem | null> {
  const code = barcode.trim();
  if (!code) return null;
  const row = await powerSync.getOptional<FoodListDbRow>(
    `${SELECT_FOODS} AND f.barcode = ? LIMIT 1`,
    [lang, code],
  );
  return row ? rowToItem(row) : null;
}

/** Aliments favoris de l'utilisateur courant. */
export function useFavoriteFoods(): { foods: FoodListItem[]; isLoading: boolean } {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const sql = `${SELECT_FOODS} AND fav.id IS NOT NULL ${ORDER_BY_NAME}`;
  const { data, isLoading } = useQuery<FoodListDbRow>(sql, [lang]);
  return { foods: data.map(rowToItem), isLoading };
}

/**
 * Aliments **récemment journalisés** (les plus récents d'abord, dédupliqués), pour une
 * saisie rapide au quotidien. On classe par dernière utilisation dans `food_entries`.
 */
export function useRecentFoods(limit = 20): { foods: FoodListItem[]; isLoading: boolean } {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const sql = `
    ${SELECT_FOODS}
      AND f.id IN (
        SELECT food_id FROM food_entries
        WHERE food_id IS NOT NULL AND deleted_at IS NULL
      )
    ORDER BY (
      SELECT MAX(e.created_at) FROM food_entries e
      WHERE e.food_id = f.id AND e.deleted_at IS NULL
    ) DESC
    LIMIT ?
  `;
  const { data, isLoading } = useQuery<FoodListDbRow>(sql, [lang, limit]);
  return { foods: data.map(rowToItem), isLoading };
}

// ---------------------------------------------------------------------------
// US NUTR-F2 — vivier de repli : les aliments les plus DENSES de la base
// ---------------------------------------------------------------------------

/**
 * Colonne portant chaque macro suggérable. **Allowlist stricte**, et c'est le point important :
 * le nom d'une colonne ne peut pas être passé en paramètre SQL, il est donc interpolé. Le seul
 * moyen sûr est que la valeur interpolée ne puisse **jamais** venir d'ailleurs que d'ici.
 */
const MACRO_COLUMN: Record<SuggestibleMacro, string> = {
  protein: 'protein_per_100g',
  carbs: 'carbs_per_100g',
  fat: 'fat_per_100g',
};

/** Nombre d'aliments ramenés **par macro**. Trois macros → au plus 3 × ce nombre, dédupliqués. */
export const DENSE_FOODS_PER_MACRO = 15;

/**
 * Requête du vivier de repli : les aliments les plus **denses** pour un macro donné.
 *
 * ⚠️ **Densité rapportée aux calories** (`macro / kcal`), et non aux 100 g — même règle que la
 * brique de score (décision D2). Trier sur les g/100 g désignerait les aliments les plus
 * caloriques ; on cherche celui qui comble le macro **sans manger tout le budget**.
 *
 * `kcal_per_100g > 0` protège la division, et `> 0` sur le macro écarte les aliments qui n'en
 * apportent pas — les scorer n'aurait aucun sens et ils occuperaient la limite.
 */
export const selectDenseFoods = (macro: SuggestibleMacro): string => `
  ${SELECT_FOODS}
    AND f.${MACRO_COLUMN[macro]} IS NOT NULL
    AND f.${MACRO_COLUMN[macro]} > 0
    AND f.kcal_per_100g > 0
  ORDER BY (f.${MACRO_COLUMN[macro]} * 1.0 / f.kcal_per_100g) DESC
  LIMIT ?
`;

/**
 * Vivier de repli pour la suggestion d'aliments (US NUTR-F2, décision D4 — volet différé).
 *
 * ── Pourquoi ce hook existe ─────────────────────────────────────────────────────────────────────
 * La spec prévoyait « les récents **puis la base** ». L'implémentation du 29/07/2026 s'est arrêtée
 * aux **récents**, pour une raison valable : scorer la base côté client aurait chargé tout CIQUAL
 * en mémoire à chaque rendu de l'onglet. Le repli était conditionné à un constat de recette
 * (critère 8bis) — mais il y a plus simple et plus décisif : **au lancement, aucun compte n'a
 * d'aliment récent**. Le vivier est vide pour 100 % des nouveaux utilisateurs, et la carte ne peut
 * alors rien proposer précisément au moment où le conseil aurait le plus de valeur.
 *
 * ── Les trois macros, pas seulement celui qui manque ────────────────────────────────────────────
 * Le macro visé est choisi **dans la carte**, et l'utilisateur peut en **changer** (`override`).
 * Pré-filtrer sur le seul macro prioritaire viderait donc la liste dès qu'il bascule. On ramène les
 * plus denses de chaque macro, une requête par macro : trois requêtes bornées valent mieux qu'un
 * `ORDER BY` sur toute la table, et le nombre de hooks reste **fixe**.
 *
 * Les doublons sont écartés — un aliment peut être dense en plusieurs macros.
 */
export function useDenseFoodCandidates(limitPerMacro = DENSE_FOODS_PER_MACRO): {
  foods: FoodListItem[];
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const protein = useQuery<FoodListDbRow>(selectDenseFoods('protein'), [lang, limitPerMacro]);
  const carbs = useQuery<FoodListDbRow>(selectDenseFoods('carbs'), [lang, limitPerMacro]);
  const fat = useQuery<FoodListDbRow>(selectDenseFoods('fat'), [lang, limitPerMacro]);

  const foods = useMemo(() => {
    const vus = new Set<string>();
    const out: FoodListItem[] = [];
    for (const row of [...protein.data, ...carbs.data, ...fat.data]) {
      if (vus.has(row.id)) continue;
      vus.add(row.id);
      out.push(rowToItem(row));
    }
    return out;
  }, [protein.data, carbs.data, fat.data]);

  return { foods, isLoading: protein.isLoading || carbs.isLoading || fat.isLoading };
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
  /** Dont sucres (g / 100 g), facultatif. */
  sugarsPer100g?: number | null;
  fatPer100g?: number | null;
  /** Dont acides gras saturés (g / 100 g), facultatif. */
  saturatedFatPer100g?: number | null;
  /** Fibres (g / 100 g), facultatif. */
  fiberPer100g?: number | null;
  /** Micronutriments pour 100 g (facultatif, socle 4.33). */
  micronutrients?: Micronutrients;
};

/** Colonnes `foods` communes à la création et à l'édition d'un aliment perso. */
function customFoodColumns(input: CustomFoodInput): Record<string, unknown> {
  return {
    category: input.category,
    kcal_per_100g: input.kcalPer100g,
    protein_per_100g: input.proteinPer100g ?? null,
    carbs_per_100g: input.carbsPer100g ?? null,
    sugars_per_100g: input.sugarsPer100g ?? null,
    fat_per_100g: input.fatPer100g ?? null,
    saturated_fat_per_100g: input.saturatedFatPer100g ?? null,
    fiber_per_100g: input.fiberPer100g ?? null,
    micronutrients: JSON.stringify(input.micronutrients ?? {}),
  };
}

/**
 * Crée un aliment personnalisé (source 'custom', owner_id = user) + sa traduction
 * dans la langue de l'appareil (les aliments perso ne sont pas traduits). Retourne l'id.
 */
export async function addCustomFood(input: CustomFoodInput): Promise<string> {
  const ownerId = currentUserId();
  const foodId = await insertWithSyncFields('foods', {
    owner_id: ownerId,
    source: 'custom',
    barcode: null,
    portions: JSON.stringify([]),
    ...customFoodColumns(input),
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
 * Met à jour un aliment de l'utilisateur (perso ou OFF importé) : valeurs nutritionnelles +
 * nom (traduction dans la langue courante). N'agit que sur les colonnes `foods` communes ;
 * les entrées de journal déjà écrites gardent leur **snapshot** (non recalculées, spec §8).
 */
export async function updateFood(id: string, input: CustomFoodInput): Promise<void> {
  const ownerId = currentUserId();
  await patch('foods', id, customFoodColumns(input));
  const lang = resolveDeviceLocale();
  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM food_translations WHERE food_id = ? AND lang = ? AND deleted_at IS NULL LIMIT 1`,
    [id, lang],
  );
  if (existing) {
    await patch('food_translations', existing.id, { name: input.name.trim() });
  } else {
    await insertWithSyncFields('food_translations', {
      food_id: id,
      owner_id: ownerId,
      lang,
      name: input.name.trim(),
    });
  }
}

/**
 * Supprime (soft delete) un aliment de la base. Réservé aux aliments **de l'utilisateur**
 * (perso / OFF importé) — voir garde `isEditableFood`. Les entrées de journal déjà
 * enregistrées conservent leur snapshot ; seul l'aliment disparaît de la recherche.
 */
export async function deleteFood(id: string): Promise<void> {
  await softDelete('foods', id);
}

/**
 * Un aliment est modifiable/supprimable s'il appartient à l'utilisateur (perso ou OFF
 * importé). La **bibliothèque** partagée (`library`, seed CIQUAL) est en lecture seule.
 */
export function isEditableFood(source: FoodSource): boolean {
  return source === 'custom' || source === 'openfoodfacts';
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
  sugarsPer100g?: number | null;
  saturatedFatPer100g?: number | null;
  fiberPer100g?: number | null;
  micronutrients?: Micronutrients;
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
    sugars_per_100g: input.sugarsPer100g ?? null,
    fat_per_100g: input.fatPer100g ?? null,
    saturated_fat_per_100g: input.saturatedFatPer100g ?? null,
    fiber_per_100g: input.fiberPer100g ?? null,
    portions: JSON.stringify([]),
    micronutrients: JSON.stringify(input.micronutrients ?? {}),
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

/**
 * Recherche unifiée du sélecteur d'aliments (US NUTRI-UX01, R2.2 / R2.3 / R6.2).
 *
 * ── Trois défauts corrigés d'un coup ─────────────────────────────────────────────────────────
 * ① **La recherche ne balayait que la bibliothèque.** Recettes et repas types vivaient dans des
 *    onglets séparés, hors de portée du champ de recherche — alors que la spec §5.2 demande
 *    qu'une recette « apparaisse dans la recherche au même titre qu'un aliment simple ». Ici,
 *    une seule liste, trois familles.
 * ② **Le classement était alphabétique.** Il devient un classement par pertinence
 *    (`rankFoodMatches`), avec les récents en tête à pertinence égale.
 * ③ **Toute la table était chargée en mémoire** puis filtrée en JS. Indolore à 80 aliments,
 *    intenable au millier — donc bloquant pour le remplissage de la bibliothèque. La requête est
 *    désormais **bornée en SQL** avant tout classement.
 *
 * ── Pourquoi le filtre reste en partie applicatif ────────────────────────────────────────────
 * SQLite `LIKE` ignore la casse mais **pas les accents**, et la base est francophone (CIQUAL) :
 * « creme » ne trouverait pas « crème ». On pré-filtre donc largement en SQL (bornage + `LIKE`
 * quand c'est possible) et on affine en mémoire sur un ensemble déjà réduit — jamais sur la
 * table entière.
 */

import { useQuery } from '@powersync/react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { foldDiacritics, rankFoodMatches, type SearchableItem } from '@wellness/shared';
import { powerSync } from '@/powersync/system';

/** Nombre maximal de lignes remontées de SQLite avant classement. */
const SQL_SCAN_LIMIT = 400;
/** Nombre maximal de lignes rendues à l'écran. */
export const SEARCH_RESULT_LIMIT = 40;
/** Taille de la liste « habitudes » (récents + favoris) affichée sans recherche. */
const HABITS_LIMIT = 24;

/** Une ligne de résultat, quelle que soit sa famille. */
export type CatalogEntry = SearchableItem & {
  /** kcal pour 100 g (aliment) ou pour une portion / le repas (recette, repas type). */
  kcal: number;
  /** Grammes de la quantité proposée par défaut — `null` pour recette et repas type. */
  defaultGrams: number | null;
  /** Vrai si la quantité proposée vient de l'historique de l'utilisateur (R2.5). */
  fromHistory: boolean;
  /** Catégorie d'aliment, pour la vignette. `null` hors aliments. */
  category: string | null;
  /** Nombre d'ingrédients (repas type) ou de portions (recette) — affiché en sous-titre. */
  count: number | null;
};

type FoodRow = {
  id: string;
  name: string | null;
  category: string;
  kcal_per_100g: number;
  portions: string | null;
  last_qty: number | null;
  last_used: string | null;
  is_favorite: number;
};

type RecipeRow = { id: string; name: string; servings: number; total_kcal: number };
type TemplateRow = { id: string; name: string; item_count: number; total_kcal: number };

/**
 * Aliments candidats : nom résolu dans la langue courante, **dernière quantité utilisée** et
 * dernière utilisation embarquées dans la même requête.
 *
 * Les deux sous-requêtes corrélées sont ce qui permet de proposer « ta quantité habituelle »
 * sans une requête par ligne — la donnée était déjà en base (`food_entries.quantity_g`), elle
 * n'était simplement jamais lue.
 */
const SELECT_CANDIDATES = `
  SELECT f.id, f.category, f.kcal_per_100g, f.portions,
         COALESCE(tl.name, tfr.name) AS name,
         (fav.id IS NOT NULL) AS is_favorite,
         (SELECT e.quantity_g FROM food_entries e
           WHERE e.food_id = f.id AND e.deleted_at IS NULL AND e.quantity_g IS NOT NULL
           ORDER BY e.created_at DESC LIMIT 1) AS last_qty,
         (SELECT MAX(e.created_at) FROM food_entries e
           WHERE e.food_id = f.id AND e.deleted_at IS NULL) AS last_used
  FROM foods f
  LEFT JOIN food_translations tl  ON tl.food_id = f.id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN food_translations tfr ON tfr.food_id = f.id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  LEFT JOIN food_favorites fav    ON fav.food_id = f.id AND fav.deleted_at IS NULL
  WHERE f.deleted_at IS NULL
`;

function firstPortionGrams(portions: string | null): number | null {
  if (!portions) return null;
  try {
    const parsed: unknown = JSON.parse(portions);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const grams = (parsed[0] as { grams?: unknown }).grams;
    return typeof grams === 'number' && grams > 0 ? grams : null;
  } catch {
    return null;
  }
}

function foodToEntry(row: FoodRow): CatalogEntry {
  const portion = firstPortionGrams(row.portions);
  // La quantité proposée : ce que l'utilisateur a mis la dernière fois, sinon la portion usuelle,
  // sinon 100 g. C'est l'ordre qui économise le plus de saisie.
  const grams = row.last_qty ?? portion ?? 100;
  return {
    id: row.id,
    name: row.name ?? '',
    kind: 'food',
    kcal: Math.round((row.kcal_per_100g * grams) / 100),
    defaultGrams: grams,
    fromHistory: row.last_qty != null,
    category: row.category,
    count: null,
  };
}

/**
 * Liste « tes habitudes » : récents et favoris fusionnés, récents d'abord.
 *
 * C'est ce que le sélecteur montre **à l'ouverture**, à la place de la bibliothèque entière triée
 * par ordre alphabétique. La loi d'usage en nutrition est brutale : 80 % des ajouts portent sur
 * une vingtaine d'aliments, et l'app possédait déjà cette liste — elle la rangeait dans le
 * troisième onglet.
 */
export function useHabitFoods(): { entries: CatalogEntry[]; isLoading: boolean } {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const { data, isLoading } = useQuery<FoodRow>(
    `${SELECT_CANDIDATES}
       AND (fav.id IS NOT NULL OR EXISTS (
         SELECT 1 FROM food_entries e WHERE e.food_id = f.id AND e.deleted_at IS NULL))
     ORDER BY last_used DESC NULLS LAST, is_favorite DESC, name COLLATE NOCASE
     LIMIT ?`,
    [lang, HABITS_LIMIT],
  );
  return { entries: useMemo(() => data.map(foodToEntry), [data]), isLoading };
}

/** Identifiants des aliments récemment consommés — sert de bonus de classement. */
export function useRecentFoodIds(limit = 40): string[] {
  const { data } = useQuery<{ food_id: string }>(
    `SELECT DISTINCT food_id FROM food_entries
     WHERE food_id IS NOT NULL AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
  return useMemo(() => data.map((r) => r.food_id), [data]);
}

/**
 * Recherche unifiée : aliments + recettes + repas types, classés par pertinence.
 *
 * `term` doit déjà être *debouncé* par l'appelant (`useDebounced`) : ce hook déclenche trois
 * requêtes surveillées, et les relancer à chaque frappe n'apporterait rien de plus qu'un écran
 * qui clignote.
 */
export function useCatalogSearch(
  term: string,
  recentIds: readonly string[],
): { entries: CatalogEntry[]; isLoading: boolean } {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const trimmed = term.trim();
  const active = trimmed.length > 0;

  // Pré-filtre SQL : on borne le balayage. `LIKE` est posé sur la forme *non repliée* — il ne
  // sait pas ignorer les accents —, donc on ne l'utilise que comme filtre grossier, et on garde
  // une deuxième chance en mémoire pour les termes accentués (`foldDiacritics`).
  const like = `%${trimmed}%`;
  const { data: foods, isLoading: loadingFoods } = useQuery<FoodRow>(
    active
      ? `${SELECT_CANDIDATES} AND (COALESCE(tl.name, tfr.name) LIKE ? COLLATE NOCASE)
         ORDER BY last_used DESC NULLS LAST LIMIT ?`
      : `${SELECT_CANDIDATES} ORDER BY name COLLATE NOCASE LIMIT ?`,
    active ? [lang, like, SQL_SCAN_LIMIT] : [lang, SQL_SCAN_LIMIT],
  );

  const { data: recipes, isLoading: loadingRecipes } = useQuery<RecipeRow>(
    `SELECT r.id, r.name, r.servings,
            COALESCE((SELECT SUM(i.kcal) FROM recipe_ingredients i
                      WHERE i.recipe_id = r.id AND i.deleted_at IS NULL), 0) AS total_kcal
     FROM recipes r WHERE r.deleted_at IS NULL ORDER BY r.name COLLATE NOCASE LIMIT 100`,
  );

  const { data: templates, isLoading: loadingTemplates } = useQuery<TemplateRow>(
    `SELECT tpl.id, tpl.name,
            COALESCE((SELECT COUNT(*) FROM meal_template_items i
                      WHERE i.template_id = tpl.id AND i.deleted_at IS NULL), 0) AS item_count,
            COALESCE((SELECT SUM(i.kcal) FROM meal_template_items i
                      WHERE i.template_id = tpl.id AND i.deleted_at IS NULL), 0) AS total_kcal
     FROM meal_templates tpl WHERE tpl.deleted_at IS NULL ORDER BY tpl.name COLLATE NOCASE LIMIT 100`,
  );

  const entries = useMemo(() => {
    const pool: CatalogEntry[] = [
      ...foods.map(foodToEntry),
      ...recipes.map((r) => ({
        id: r.id,
        name: r.name,
        kind: 'recipe' as const,
        // Une recette porte ses macros pour la totalité de son rendement : on affiche la portion.
        kcal: Math.round(r.total_kcal / Math.max(1, r.servings)),
        defaultGrams: null,
        fromHistory: false,
        category: null,
        count: r.servings,
      })),
      ...templates.map((tpl) => ({
        id: tpl.id,
        name: tpl.name,
        kind: 'template' as const,
        kcal: Math.round(tpl.total_kcal),
        defaultGrams: null,
        fromHistory: false,
        category: null,
        count: tpl.item_count,
      })),
    ];

    if (!active) {
      return pool.slice(0, SEARCH_RESULT_LIMIT);
    }
    // Deuxième chance pour les termes accentués que le `LIKE` SQL a pu manquer côté recettes et
    // repas types (non filtrés en SQL) : le classement s'en charge, il rend `null` s'il n'y a
    // aucune correspondance.
    return rankFoodMatches(pool, foldDiacritics(trimmed), {
      recentIds,
      limit: SEARCH_RESULT_LIMIT,
    }).map((m) => m.item);
  }, [foods, recipes, templates, active, trimmed, recentIds]);

  return { entries, isLoading: loadingFoods || loadingRecipes || loadingTemplates };
}

/**
 * Dernière quantité journalisée pour un aliment — lecture ponctuelle (hors liste).
 * Utilisée par le panneau de quantité quand il est ouvert depuis le scan, qui ne passe pas par
 * la liste et n'a donc pas l'information sous la main.
 */
export async function getLastQuantityFor(foodId: string): Promise<number | null> {
  const row = await powerSync.getOptional<{ quantity_g: number | null }>(
    `SELECT quantity_g FROM food_entries
     WHERE food_id = ? AND deleted_at IS NULL AND quantity_g IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [foodId],
  );
  return row?.quantity_g ?? null;
}

/**
 * US NUTRI-UX01 — le catalogue du sélecteur d'aliments. Fichier à **0 %**, alors qu'il est passé
 * de 80 à **3 244 aliments** (import CIQUAL du 13/09/2026) : c'est ce changement d'échelle qui a
 * transformé ses réglages en règles.
 *
 * Ce qui est vérifié ici, et qu'une recette sur device ne produit pas :
 *
 * - 🔴 **Les correspondances par début de nom passent devant.** Sans cette clause, le plafond de
 *   balayage coupait dans un ordre indifférent à la pertinence : sur 3 244 aliments, « pomme »
 *   disparaissait à « po » puis **réapparaissait** à « pom ». Une liste qui rétrécit quand on
 *   précise sa recherche a l'air cassée, et le seul moyen de la voir est d'avoir la base entière.
 * - **La quantité proposée suit un ordre précis** — dernière quantité saisie, puis portion usuelle,
 *   puis 100 g. C'est l'ordre qui économise le plus de saisie ; l'inverser ne casse rien de
 *   visible, ça rend juste l'app un peu plus pénible à chaque ajout.
 * - **Des portions au JSON abîmé ne doivent pas faire tomber la liste**, ni proposer 0 g.
 * - **Une recette s'affiche à la portion**, pas à son rendement total : sinon une recette pour six
 *   annonce six fois ses calories, et l'erreur est reprise telle quelle dans le journal.
 *
 * Les requêtes sont écrites en ligne : on les **capture** au passage de `useQuery` puis on les
 * rejoue sur le harness, pour tester le SQL embarqué et non une copie (§3.3).
 */

import { renderHook } from '@testing-library/react-native';
import { useQuery } from '@powersync/react';

import {
  SEARCH_RESULT_LIMIT,
  getLastQuantityFor,
  useCatalogSearch,
  useHabitFoods,
  useRecentFoodIds,
} from '../food-catalog-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

const mockedQuery = useQuery as unknown as jest.Mock;

type Emitted = { sql: string; params: unknown[] };

/** La première requête émise par un hook — les hooks testés ici en émettent toujours au moins une. */
async function firstQuery(hook: () => unknown): Promise<Emitted> {
  const calls = await emitted(hook);
  if (calls.length === 0) throw new Error('Le hook n’a émis aucune requête');
  return calls[0]!;
}

async function emitted(hook: () => unknown): Promise<Emitted[]> {
  const calls: Emitted[] = [];
  mockedQuery.mockImplementation((sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return { data: [], isLoading: false, error: undefined };
  });
  await renderHook(hook);
  return calls;
}

const find = (calls: Emitted[], fragment: string): Emitted => {
  const hit = calls.find((c) => c.sql.includes(fragment));
  if (!hit) throw new Error(`Aucune requête ne contient « ${fragment} »`);
  return hit;
};

/** Alimente les requêtes par fragment de SQL. */
const feedBy = (rows: { match: string; data: unknown[] }[]) =>
  mockedQuery.mockImplementation((sql: string) => ({
    data: rows.find((r) => sql.includes(r.match))?.data ?? [],
    isLoading: false,
    error: undefined,
  }));

/** Un aliment de la bibliothèque, traduit en français. */
const food = (id: string, name: string, over: Record<string, unknown> = {}) => {
  seed('foods', [{ id, kcal_per_100g: 52, category: 'fruits', owner_id: null, ...over }]);
  seed('food_translations', [{ id: `t-${id}`, food_id: id, lang: 'fr', name }]);
};

beforeEach(() => {
  resetTestDb();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// « Tes habitudes »
// ---------------------------------------------------------------------------

describe('useHabitFoods', () => {
  it('sa requête s’exécute sur le schéma réel', async () => {
    const { sql, params } = await firstQuery(() => useHabitFoods());

    await expect(testPowerSync.getAll(sql, params)).resolves.toEqual([]);
  });

  it('ne retient que les favoris et les aliments déjà consommés', async () => {
    food('f-favori', 'Banane');
    food('f-recent', 'Pomme');
    food('f-jamais', 'Rutabaga');
    seed('food_favorites', [{ id: 'fav-1', food_id: 'f-favori', user_id: 'u' }]);
    seed('food_entries', [
      { id: 'e-1', user_id: 'u', food_id: 'f-recent', log_date: '2026-09-20', quantity_g: 150, kcal: 78, created_at: '2026-09-20T12:00:00.000Z' },
    ]);

    const { sql, params } = await firstQuery(() => useHabitFoods());
    const rows = await testPowerSync.getAll<{ id: string }>(sql, params);

    expect(rows.map((r) => r.id).sort()).toEqual(['f-favori', 'f-recent']);
  });

  it('met le plus récemment consommé en tête, le favori jamais mangé ensuite', async () => {
    food('f-vieux', 'Abricot');
    food('f-neuf', 'Banane');
    food('f-favori', 'Zucchini');
    seed('food_favorites', [{ id: 'fav-1', food_id: 'f-favori', user_id: 'u' }]);
    seed('food_entries', [
      { id: 'e-1', user_id: 'u', food_id: 'f-vieux', log_date: '2026-09-01', quantity_g: 100, kcal: 52, created_at: '2026-09-01T12:00:00.000Z' },
      { id: 'e-2', user_id: 'u', food_id: 'f-neuf', log_date: '2026-09-20', quantity_g: 100, kcal: 52, created_at: '2026-09-20T12:00:00.000Z' },
    ]);

    const { sql, params } = await firstQuery(() => useHabitFoods());
    const rows = await testPowerSync.getAll<{ id: string }>(sql, params);

    expect(rows.map((r) => r.id)).toEqual(['f-neuf', 'f-vieux', 'f-favori']);
  });

  it('embarque la dernière quantité utilisée, sans une requête par ligne', async () => {
    food('f-1', 'Pomme');
    seed('food_entries', [
      { id: 'e-1', user_id: 'u', food_id: 'f-1', log_date: '2026-09-01', quantity_g: 100, kcal: 52, created_at: '2026-09-01T12:00:00.000Z' },
      { id: 'e-2', user_id: 'u', food_id: 'f-1', log_date: '2026-09-20', quantity_g: 180, kcal: 94, created_at: '2026-09-20T12:00:00.000Z' },
    ]);

    const { sql, params } = await firstQuery(() => useHabitFoods());
    const rows = await testPowerSync.getAll<{ last_qty: number }>(sql, params);

    expect(rows[0]!.last_qty).toBe(180);
  });

  it('retombe sur le français quand la langue demandée n’a pas de traduction', async () => {
    food('f-1', 'Pomme');

    const { sql } = await firstQuery(() => useHabitFoods());
    seed('food_favorites', [{ id: 'fav-1', food_id: 'f-1', user_id: 'u' }]);
    const rows = await testPowerSync.getAll<{ name: string }>(sql, ['en', 24]);

    expect(rows[0]!.name).toBe('Pomme');
  });
});

// ---------------------------------------------------------------------------
// La quantité proposée
// ---------------------------------------------------------------------------

describe('quantité proposée', () => {
  const entryFor = async (row: Record<string, unknown>) => {
    feedBy([{ match: 'FROM foods f', data: [{ id: 'f-1', name: 'Pomme', category: 'fruits', kcal_per_100g: 52, portions: null, last_qty: null, last_used: null, is_favorite: 0, ...row }] }]);
    const { result } = await renderHook(() => useHabitFoods());
    return result.current.entries[0]!;
  };

  it('propose d’abord la dernière quantité saisie, et le dit', async () => {
    const entry = await entryFor({ last_qty: 180, portions: JSON.stringify([{ grams: 120 }]) });

    expect(entry.defaultGrams).toBe(180);
    expect(entry.fromHistory).toBe(true);
  });

  it('retombe sur la portion usuelle sans historique', async () => {
    const entry = await entryFor({ portions: JSON.stringify([{ label: 'unité', grams: 120 }]) });

    expect(entry.defaultGrams).toBe(120);
    expect(entry.fromHistory).toBe(false);
  });

  it('retombe sur 100 g quand il n’y a ni historique ni portion', async () => {
    const entry = await entryFor({});

    expect(entry.defaultGrams).toBe(100);
  });

  it.each([
    ['un JSON illisible', 'ceci n’est pas du JSON'],
    ['un tableau vide', '[]'],
    ['un objet au lieu d’un tableau', '{"grams":120}'],
    ['une portion sans grammes', '[{"label":"unité"}]'],
    ['une portion à zéro gramme', '[{"grams":0}]'],
    ['des grammes négatifs', '[{"grams":-50}]'],
    ['des grammes en texte', '[{"grams":"120"}]'],
  ])('ignore %s et retombe sur 100 g, sans faire tomber la liste', async (_label, portions) => {
    const entry = await entryFor({ portions });

    expect(entry.defaultGrams).toBe(100);
  });

  it('calcule les calories sur la quantité proposée, pas sur 100 g', async () => {
    const entry = await entryFor({ last_qty: 200 });

    expect(entry.kcal).toBe(104); // 52 kcal/100 g × 200 g
  });

  it('accepte un aliment sans nom traduit plutôt que de le faire disparaître', async () => {
    feedBy([{ match: 'FROM foods f', data: [{ id: 'f-1', name: null, category: 'fruits', kcal_per_100g: 52, portions: null, last_qty: null, last_used: null, is_favorite: 0 }] }]);
    const { result } = await renderHook(() => useHabitFoods());

    expect(result.current.entries[0]!.name).toBe('');
  });
});

// ---------------------------------------------------------------------------
// La recherche
// ---------------------------------------------------------------------------

describe('useCatalogSearch', () => {
  it('🔴 classe les correspondances par DÉBUT de nom avant tout le reste', async () => {
    food('f-pomme', 'Pomme');
    food('f-compote', 'Compote de pommes');
    // La compote a été mangée hier : sans la clause de préfixe, l'historique la mettrait devant.
    seed('food_entries', [
      { id: 'e-1', user_id: 'u', food_id: 'f-compote', log_date: '2026-09-21', quantity_g: 100, kcal: 90, created_at: '2026-09-21T12:00:00.000Z' },
    ]);

    const calls = await emitted(() => useCatalogSearch('pomme', []));
    const { sql, params } = find(calls, 'LIKE ? COLLATE NOCASE');
    const rows = await testPowerSync.getAll<{ id: string }>(sql, params);

    expect(rows[0]!.id).toBe('f-pomme');
  });

  it('passe bien le terme en préfixe ET en sous-chaîne — deux paramètres distincts', async () => {
    const calls = await emitted(() => useCatalogSearch('pom', []));
    const { params } = find(calls, 'LIKE ? COLLATE NOCASE');

    expect(params).toContain('%pom%');
    expect(params).toContain('pom%');
  });

  it('borne le balayage bien au-delà de ce qui sera affiché', async () => {
    const calls = await emitted(() => useCatalogSearch('po', []));
    const { params } = find(calls, 'LIKE ? COLLATE NOCASE');
    const limit = params[params.length - 1] as number;

    expect(limit).toBeGreaterThan(SEARCH_RESULT_LIMIT);
  });

  it('n’applique aucun filtre de nom quand le terme est vide', async () => {
    const { sql } = await firstQuery(() => useCatalogSearch('   ', []));

    expect(sql).not.toContain('LIKE');
  });

  it('ignore la casse dans la recherche', async () => {
    food('f-pomme', 'Pomme');

    const calls = await emitted(() => useCatalogSearch('POMME', []));
    const { sql, params } = find(calls, 'LIKE ? COLLATE NOCASE');

    expect(await testPowerSync.getAll(sql, params)).toHaveLength(1);
  });

  it('affiche une recette à la PORTION, pas à son rendement total', async () => {
    feedBy([
      { match: 'FROM recipes r', data: [{ id: 'r-1', name: 'Chili', servings: 6, total_kcal: 3000 }] },
    ]);
    const { result } = await renderHook(() => useCatalogSearch('', []));

    expect(result.current.entries.find((e) => e.kind === 'recipe')).toMatchObject({
      kcal: 500,
      count: 6,
    });
  });

  it('ne divise jamais par zéro portion', async () => {
    feedBy([
      { match: 'FROM recipes r', data: [{ id: 'r-1', name: 'Chili', servings: 0, total_kcal: 3000 }] },
    ]);
    const { result } = await renderHook(() => useCatalogSearch('', []));

    expect(result.current.entries[0]!.kcal).toBe(3000);
  });

  it('affiche un repas type à son total, avec son nombre d’ingrédients', async () => {
    feedBy([
      { match: 'FROM meal_templates tpl', data: [{ id: 'tpl-1', name: 'Petit-déj', item_count: 3, total_kcal: 620 }] },
    ]);
    const { result } = await renderHook(() => useCatalogSearch('', []));

    expect(result.current.entries[0]).toMatchObject({ kind: 'template', kcal: 620, count: 3 });
  });

  it('plafonne la liste rendue à l’écran', async () => {
    feedBy([
      {
        match: 'FROM foods f',
        data: Array.from({ length: 200 }, (_, i) => ({
          id: `f-${i}`, name: `Aliment ${i}`, category: 'divers', kcal_per_100g: 100,
          portions: null, last_qty: null, last_used: null, is_favorite: 0,
        })),
      },
    ]);
    const { result } = await renderHook(() => useCatalogSearch('', []));

    expect(result.current.entries).toHaveLength(SEARCH_RESULT_LIMIT);
  });

  it('rattrape en mémoire un terme accentué que le LIKE SQL a manqué', async () => {
    feedBy([
      { match: 'FROM recipes r', data: [{ id: 'r-1', name: 'Crème brûlée', servings: 4, total_kcal: 1200 }] },
    ]);
    const { result } = await renderHook(() => useCatalogSearch('creme', []));

    expect(result.current.entries.map((e) => e.id)).toContain('r-1');
  });

  it.each([
    ['aliments', 'FROM foods f'],
    ['recettes', 'FROM recipes r'],
    ['repas types', 'FROM meal_templates tpl'],
  ])('relaie le chargement de la famille « %s »', async (_label, match) => {
    mockedQuery.mockImplementation((sql: string) => ({
      data: [],
      isLoading: sql.includes(match),
      error: undefined,
    }));
    const { result } = await renderHook(() => useCatalogSearch('', []));

    expect(result.current.isLoading).toBe(true);
  });

  it('émet trois requêtes, une par famille', async () => {
    expect(await emitted(() => useCatalogSearch('pomme', []))).toHaveLength(3);
  });

  it('les trois requêtes s’exécutent sur le schéma réel', async () => {
    for (const { sql, params } of await emitted(() => useCatalogSearch('pomme', []))) {
      await expect(testPowerSync.getAll(sql, params)).resolves.toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Lectures ponctuelles
// ---------------------------------------------------------------------------

describe('useRecentFoodIds', () => {
  it('sa requête s’exécute et dédoublonne les aliments', async () => {
    food('f-1', 'Pomme');
    seed('food_entries', [
      { id: 'e-1', user_id: 'u', food_id: 'f-1', log_date: '2026-09-20', quantity_g: 100, kcal: 52, created_at: '2026-09-20T12:00:00.000Z' },
      { id: 'e-2', user_id: 'u', food_id: 'f-1', log_date: '2026-09-21', quantity_g: 100, kcal: 52, created_at: '2026-09-21T12:00:00.000Z' },
    ]);

    const { sql, params } = await firstQuery(() => useRecentFoodIds());
    const rows = await testPowerSync.getAll<{ food_id: string }>(sql, params);

    expect(rows).toEqual([{ food_id: 'f-1' }]);
  });

  it('respecte la limite demandée', async () => {
    const { params } = await firstQuery(() => useRecentFoodIds(7));

    expect(params).toEqual([7]);
  });

  it('rend la liste des identifiants', async () => {
    mockedQuery.mockReturnValue({ data: [{ food_id: 'f-1' }, { food_id: 'f-2' }], isLoading: false });
    const { result } = await renderHook(() => useRecentFoodIds());

    expect(result.current).toEqual(['f-1', 'f-2']);
  });
});

describe('getLastQuantityFor', () => {
  it('rend la dernière quantité journalisée', async () => {
    food('f-1', 'Pomme');
    seed('food_entries', [
      { id: 'e-1', user_id: 'u', food_id: 'f-1', log_date: '2026-09-01', quantity_g: 100, kcal: 52, created_at: '2026-09-01T12:00:00.000Z' },
      { id: 'e-2', user_id: 'u', food_id: 'f-1', log_date: '2026-09-20', quantity_g: 180, kcal: 94, created_at: '2026-09-20T12:00:00.000Z' },
    ]);

    expect(await getLastQuantityFor('f-1')).toBe(180);
  });

  it('rend null pour un aliment jamais journalisé', async () => {
    expect(await getLastQuantityFor('f-inconnu')).toBeNull();
  });

  it('ignore une entrée supprimée', async () => {
    seed('food_entries', [
      { id: 'e-1', user_id: 'u', food_id: 'f-1', log_date: '2026-09-20', quantity_g: 180, kcal: 94, created_at: '2026-09-20T12:00:00.000Z', deleted_at: '2026-09-21T00:00:00.000Z' },
    ]);

    expect(await getLastQuantityFor('f-1')).toBeNull();
  });

  it('ignore une entrée sans quantité plutôt que de rendre null pour tout l’aliment', async () => {
    seed('food_entries', [
      { id: 'e-vide', user_id: 'u', food_id: 'f-1', log_date: '2026-09-21', quantity_g: null, kcal: 0, created_at: '2026-09-21T12:00:00.000Z' },
      { id: 'e-ok', user_id: 'u', food_id: 'f-1', log_date: '2026-09-20', quantity_g: 180, kcal: 94, created_at: '2026-09-20T12:00:00.000Z' },
    ]);

    expect(await getLastQuantityFor('f-1')).toBe(180);
  });
});

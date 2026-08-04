/**
 * US REPAS-01 — liste de courses, sur **du vrai SQLite** (harness, niveau 2).
 *
 * Le test qui compte le plus ici est le **bout-en-bout du facteur de portion** (R8) : les briques
 * pures le vérifient déjà unitairement, mais rien ne garantit qu'il traverse bien les jointures
 * jusqu'aux grammes écrits en base. Une recette de 4 portions planifiée pour 2 doit faire acheter
 * la moitié des ingrédients — se tromper ici double les courses sans que rien ne le signale.
 *
 * Vérifié aussi : les ingrédients sont lus **vivants** (R6) et non snapshotés, une source archivée
 * est **comptée et signalée** au lieu d'amputer la liste en silence (R11/R12), aucune liste vide
 * n'est créée, et la régénération archive proprement l'ancienne (D5/D6).
 */

import {
  generateShoppingList,
  regenerateShoppingList,
  SELECT_ACTIVE_LIST,
  SELECT_LIST_ITEMS,
  toggleAisle,
  toggleShoppingItem,
} from '../shopping-list-repository';
import { planRecipe, planTemplate } from '../meal-plan-repository';
import { resetTestDb, rowsOf, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

jest.mock('@/lib/analytics', () => ({
  ANALYTICS_EVENTS: { foodLogged: 'food_logged' },
  track: jest.fn(async () => undefined),
}));

// ---------------------------------------------------------------------------
// Aides
// ---------------------------------------------------------------------------

type ListRow = {
  id: string;
  week_start_date: string;
  unresolved_count: number;
  planned_count: number;
  deleted_at: string | null;
};

type ItemRow = {
  id: string;
  list_id: string;
  food_id: string | null;
  name: string;
  category: string;
  quantity_g: number | null;
  unquantified_count: number;
  checked: number;
  order_index: number;
};

const WEEK = '2026-08-03';

function seedFood(id: string, category: string): string {
  seed('foods', [{ id, owner_id: null, source: 'library', category, kcal_per_100g: 100 }]);
  return id;
}

/**
 * Recette de `servings` portions. `quantity_g` est la quantité TOTALE de la recette —
 * c'est tout l'enjeu de R8.
 */
function seedRecipe(
  name: string,
  servings: number,
  ingredients: { foodId: string | null; name: string; quantityG: number | null }[],
): string {
  const [recipeId] = seed('recipes', [{ user_id: 'user-1', name, servings }]);
  seed(
    'recipe_ingredients',
    ingredients.map((i) => ({
      recipe_id: recipeId,
      user_id: 'user-1',
      food_id: i.foodId,
      name: i.name,
      quantity_g: i.quantityG,
      kcal: 100,
      protein_g: 5,
      carbs_g: 10,
      fat_g: 2,
    })),
  );
  return recipeId!;
}

function seedTemplate(
  name: string,
  items: Array<{ foodId: string | null; name: string; quantityG: number | null }>,
): string {
  const [templateId] = seed('meal_templates', [{ user_id: 'user-1', name }]);
  if (items.length > 0) {
    seed(
      'meal_template_items',
      items.map((i) => ({
        template_id: templateId,
        user_id: 'user-1',
        food_id: i.foodId,
        name: i.name,
        quantity_g: i.quantityG,
        kcal: 100,
        protein_g: 5,
        carbs_g: 10,
        fat_g: 2,
      })),
    );
  }
  return templateId!;
}

const items = (listId: string) =>
  rowsOf<ItemRow>('shopping_list_items')
    .filter((i) => i.list_id === listId)
    .sort((a, b) => a.order_index - b.order_index);

beforeEach(() => {
  resetTestDb();
});

// ---------------------------------------------------------------------------
// R8 — bout-en-bout du facteur de portion
// ---------------------------------------------------------------------------

describe('R8 — le facteur de portion arrive jusqu’aux grammes en base', () => {
  it('une recette de 4 portions planifiée pour 2 contribue la moitié des ingrédients', async () => {
    seedFood('food-poulet', 'meat');
    const recipeId = seedRecipe('Poulet riz', 4, [
      { foodId: 'food-poulet', name: 'Poulet', quantityG: 800 },
    ]);
    await planRecipe('2026-08-04', 'lunch', recipeId, 2);

    const listId = (await generateShoppingList(WEEK))!;

    expect(items(listId)).toHaveLength(1);
    expect(items(listId)[0]!.quantity_g).toBe(400);
  });

  it('planifier le rendement complet contribue la quantité totale', async () => {
    seedFood('food-riz', 'starchy');
    const recipeId = seedRecipe('Riz', 4, [{ foodId: 'food-riz', name: 'Riz', quantityG: 400 }]);
    await planRecipe('2026-08-04', 'lunch', recipeId, 4);

    const listId = (await generateShoppingList(WEEK))!;
    expect(items(listId)[0]!.quantity_g).toBe(400);
  });

  it('cumule deux planifications de la même recette', async () => {
    seedFood('food-riz', 'starchy');
    const recipeId = seedRecipe('Riz', 4, [{ foodId: 'food-riz', name: 'Riz', quantityG: 400 }]);
    await planRecipe('2026-08-04', 'lunch', recipeId, 2);
    await planRecipe('2026-08-06', 'dinner', recipeId, 2);

    const listId = (await generateShoppingList(WEEK))!;
    expect(items(listId)).toHaveLength(1);
    expect(items(listId)[0]!.quantity_g).toBe(400); // 200 + 200
  });

  it('un repas type contribue ses quantités telles quelles', async () => {
    seedFood('food-pain', 'starchy');
    const templateId = seedTemplate("Mon déj'", [
      { foodId: 'food-pain', name: 'Pain', quantityG: 80 },
    ]);
    await planTemplate('2026-08-04', 'lunch', templateId);

    const listId = (await generateShoppingList(WEEK))!;
    expect(items(listId)[0]!.quantity_g).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// R6 / R11 / R12 — ingrédients vivants, sources archivées
// ---------------------------------------------------------------------------

describe('R6 — les ingrédients sont lus vivants', () => {
  it('prend en compte un ingrédient ajouté à la recette après la planification', async () => {
    seedFood('food-riz', 'starchy');
    const recipeId = seedRecipe('Riz', 1, [{ foodId: 'food-riz', name: 'Riz', quantityG: 100 }]);
    await planRecipe('2026-08-04', 'lunch', recipeId, 1);

    // On enrichit la recette APRÈS avoir planifié : on achète ce qu'on va cuisiner.
    seedFood('food-huile', 'other');
    seed('recipe_ingredients', [
      {
        recipe_id: recipeId,
        user_id: 'user-1',
        food_id: 'food-huile',
        name: 'Huile',
        quantity_g: 20,
        kcal: 180,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 20,
      },
    ]);

    const listId = (await generateShoppingList(WEEK))!;
    expect(items(listId).map((i) => i.name).sort()).toEqual(['Huile', 'Riz']);
  });

  it('ignore un ingrédient retiré de la recette', async () => {
    seedFood('food-riz', 'starchy');
    const recipeId = seedRecipe('Riz', 1, [
      { foodId: 'food-riz', name: 'Riz', quantityG: 100 },
      { foodId: null, name: 'Persil', quantityG: 5 },
    ]);
    await planRecipe('2026-08-04', 'lunch', recipeId, 1);
    testPowerSync.execute(
      `UPDATE recipe_ingredients SET deleted_at = ? WHERE name = 'Persil'`,
      ['2026-08-04T10:00:00.000Z'],
    );

    const listId = (await generateShoppingList(WEEK))!;
    expect(items(listId).map((i) => i.name)).toEqual(['Riz']);
  });
});

describe('R11 / R12 — sources sans ingrédient exploitable', () => {
  it('compte une recette archivée comme non résolue et l’exclut des lignes', async () => {
    seedFood('food-riz', 'starchy');
    const ok = seedRecipe('Riz', 1, [{ foodId: 'food-riz', name: 'Riz', quantityG: 100 }]);
    const gone = seedRecipe('Disparue', 1, [{ foodId: null, name: 'Mystère', quantityG: 50 }]);
    await planRecipe('2026-08-04', 'lunch', ok, 1);
    await planRecipe('2026-08-05', 'lunch', gone, 1);
    testPowerSync.execute(`UPDATE recipes SET deleted_at = ? WHERE id = ?`, [
      '2026-08-04T10:00:00.000Z',
      gone,
    ]);

    const listId = (await generateShoppingList(WEEK))!;

    const [list] = rowsOf<ListRow>('shopping_lists');
    expect(list!.planned_count).toBe(2);
    expect(list!.unresolved_count).toBe(1); // annoncé à l'écran, jamais tu
    expect(items(listId).map((i) => i.name)).toEqual(['Riz']);
  });

  it('compte un repas type vide comme non résolu', async () => {
    const empty = seedTemplate('Vide', []);
    await planTemplate('2026-08-04', 'lunch', empty);

    const listId = (await generateShoppingList(WEEK))!;

    const [list] = rowsOf<ListRow>('shopping_lists');
    expect(list!.unresolved_count).toBe(1);
    expect(items(listId)).toHaveLength(0);
  });

  it('ne compte aucune entrée non résolue quand tout se résout', async () => {
    seedFood('food-riz', 'starchy');
    const recipeId = seedRecipe('Riz', 1, [{ foodId: 'food-riz', name: 'Riz', quantityG: 100 }]);
    await planRecipe('2026-08-04', 'lunch', recipeId, 1);

    await generateShoppingList(WEEK);
    expect(rowsOf<ListRow>('shopping_lists')[0]!.unresolved_count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Agrégation, rayons, quantités absentes
// ---------------------------------------------------------------------------

describe('agrégation et rayons', () => {
  it('regroupe deux recettes partageant un aliment sur une seule ligne', async () => {
    seedFood('food-oignon', 'vegetables');
    const a = seedRecipe('Chili', 1, [{ foodId: 'food-oignon', name: 'Oignon', quantityG: 100 }]);
    const b = seedRecipe('Curry', 1, [{ foodId: 'food-oignon', name: 'Oignon', quantityG: 50 }]);
    await planRecipe('2026-08-04', 'lunch', a, 1);
    await planRecipe('2026-08-05', 'dinner', b, 1);

    const listId = (await generateShoppingList(WEEK))!;
    expect(items(listId)).toHaveLength(1);
    expect(items(listId)[0]!.quantity_g).toBe(150);
  });

  it('reporte la catégorie de l’aliment comme rayon', async () => {
    seedFood('food-brocoli', 'vegetables');
    seedFood('food-poulet', 'meat');
    const recipeId = seedRecipe('Plat', 1, [
      { foodId: 'food-poulet', name: 'Poulet', quantityG: 200 },
      { foodId: 'food-brocoli', name: 'Brocoli', quantityG: 300 },
    ]);
    await planRecipe('2026-08-04', 'lunch', recipeId, 1);

    const listId = (await generateShoppingList(WEEK))!;
    // R13 : les légumes passent avant les viandes dans le parcours de magasin.
    expect(items(listId).map((i) => i.category)).toEqual(['vegetables', 'meat']);
  });

  it('classe un ingrédient libre dans « other »', async () => {
    const recipeId = seedRecipe('Plat', 1, [{ foodId: null, name: 'Épices', quantityG: 5 }]);
    await planRecipe('2026-08-04', 'lunch', recipeId, 1);

    const listId = (await generateShoppingList(WEEK))!;
    expect(items(listId)[0]!.category).toBe('other');
  });

  it('conserve un ingrédient sans quantité et le compte à part (R7)', async () => {
    seedFood('food-ail', 'vegetables');
    const a = seedRecipe('Plat A', 1, [{ foodId: 'food-ail', name: 'Ail', quantityG: null }]);
    const b = seedRecipe('Plat B', 1, [{ foodId: 'food-ail', name: 'Ail', quantityG: 30 }]);
    await planRecipe('2026-08-04', 'lunch', a, 1);
    await planRecipe('2026-08-05', 'lunch', b, 1);

    const listId = (await generateShoppingList(WEEK))!;
    const [line] = items(listId);
    expect(line!.quantity_g).toBe(30); // jamais 0 + 30 = « 30 g » sans mention
    expect(line!.unquantified_count).toBe(1);
  });

  it('écrit un order_index séquentiel qui matérialise le tri', async () => {
    seedFood('food-eau', 'drinks');
    seedFood('food-carotte', 'vegetables');
    const recipeId = seedRecipe('Plat', 1, [
      { foodId: 'food-eau', name: 'Eau', quantityG: 500 },
      { foodId: 'food-carotte', name: 'Carotte', quantityG: 200 },
    ]);
    await planRecipe('2026-08-04', 'lunch', recipeId, 1);

    const listId = (await generateShoppingList(WEEK))!;
    expect(items(listId).map((i) => [i.order_index, i.name])).toEqual([
      [0, 'Carotte'],
      [1, 'Eau'],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Fenêtre, liste vide, régénération
// ---------------------------------------------------------------------------

describe('fenêtre et cas vides', () => {
  it('ne crée aucune liste sur une semaine vide', async () => {
    expect(await generateShoppingList(WEEK)).toBeNull();
    expect(rowsOf<ListRow>('shopping_lists')).toHaveLength(0);
  });

  it('ne prend que les 7 jours de la semaine', async () => {
    seedFood('food-riz', 'starchy');
    const recipeId = seedRecipe('Riz', 1, [{ foodId: 'food-riz', name: 'Riz', quantityG: 100 }]);
    await planRecipe('2026-08-02', 'lunch', recipeId, 1); // dimanche d'avant
    await planRecipe('2026-08-09', 'lunch', recipeId, 1); // dimanche = dans la semaine
    await planRecipe('2026-08-10', 'lunch', recipeId, 1); // lundi d'après

    const listId = (await generateShoppingList(WEEK))!;
    expect(rowsOf<ListRow>('shopping_lists')[0]!.planned_count).toBe(1);
    expect(items(listId)[0]!.quantity_g).toBe(100);
  });

  it('crée la liste mais aucune ligne si le planning ne résout rien', async () => {
    const empty = seedTemplate('Vide', []);
    await planTemplate('2026-08-04', 'lunch', empty);

    const listId = await generateShoppingList(WEEK);
    expect(listId).not.toBeNull();
    expect(items(listId!)).toHaveLength(0);
  });
});

describe('régénération (D5 / D6)', () => {
  async function seedOneList(): Promise<string> {
    seedFood('food-riz', 'starchy');
    const recipeId = seedRecipe('Riz', 1, [{ foodId: 'food-riz', name: 'Riz', quantityG: 100 }]);
    await planRecipe('2026-08-04', 'lunch', recipeId, 1);
    return (await generateShoppingList(WEEK))!;
  }

  it('archive l’ancienne liste et repart avec des cases décochées', async () => {
    const first = await seedOneList();
    await toggleShoppingItem(items(first)[0]!.id, true);
    expect(items(first)[0]!.checked).toBe(1);

    const second = (await regenerateShoppingList(WEEK))!;

    expect(second).not.toBe(first);
    expect(items(second)[0]!.checked).toBe(0);
    const archived = rowsOf<ListRow>('shopping_lists', true).find((l) => l.id === first)!;
    expect(archived.deleted_at).not.toBeNull();
  });

  it('la liste active est la plus récente, sans contrainte d’unicité en base', async () => {
    const first = await seedOneList();
    // Simule un second appareil qui aurait généré la même semaine hors réseau : deux lignes
    // coexistent sans faire échouer quoi que ce soit (décision D6).
    const [second] = seed('shopping_lists', [
      {
        user_id: 'user-1',
        week_start_date: WEEK,
        generated_at: '2099-01-01T00:00:00.000Z',
        unresolved_count: 0,
        planned_count: 1,
      },
    ]);

    const active = await testPowerSync.getAll<ListRow>(SELECT_ACTIVE_LIST, ['user-1', WEEK]);
    expect(active).toHaveLength(1);
    expect(active[0]!.id).toBe(second);
    expect(rowsOf<ListRow>('shopping_lists').map((l) => l.id).sort()).toEqual(
      [first, second!].sort(),
    );
  });

  it('archive même quand la semaine a été vidée entre-temps', async () => {
    const first = await seedOneList();
    testPowerSync.execute(`UPDATE meal_plan_entries SET deleted_at = ?`, [
      '2026-08-04T10:00:00.000Z',
    ]);

    expect(await regenerateShoppingList(WEEK)).toBeNull();
    const archived = rowsOf<ListRow>('shopping_lists', true).find((l) => l.id === first)!;
    expect(archived.deleted_at).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Cochage
// ---------------------------------------------------------------------------

describe('cochage', () => {
  async function seedTwoAisles(): Promise<string> {
    seedFood('food-carotte', 'vegetables');
    seedFood('food-brocoli', 'vegetables');
    seedFood('food-poulet', 'meat');
    const recipeId = seedRecipe('Plat', 1, [
      { foodId: 'food-carotte', name: 'Carotte', quantityG: 100 },
      { foodId: 'food-brocoli', name: 'Brocoli', quantityG: 200 },
      { foodId: 'food-poulet', name: 'Poulet', quantityG: 300 },
    ]);
    await planRecipe('2026-08-04', 'lunch', recipeId, 1);
    return (await generateShoppingList(WEEK))!;
  }

  it('coche puis dé-coche un article', async () => {
    const listId = await seedTwoAisles();
    const id = items(listId)[0]!.id;

    await toggleShoppingItem(id, true);
    expect(items(listId).find((i) => i.id === id)!.checked).toBe(1);

    await toggleShoppingItem(id, false);
    expect(items(listId).find((i) => i.id === id)!.checked).toBe(0);
  });

  it('coche tout un rayon sans toucher aux autres (D13)', async () => {
    const listId = await seedTwoAisles();

    const changed = await toggleAisle(listId, 'vegetables', true);

    expect(changed).toBe(2);
    const byName = Object.fromEntries(items(listId).map((i) => [i.name, i.checked]));
    expect(byName['Brocoli']).toBe(1);
    expect(byName['Carotte']).toBe(1);
    expect(byName['Poulet']).toBe(0);
  });

  it('ne modifie que le reste d’un rayon partiellement coché', async () => {
    const listId = await seedTwoAisles();
    const carotte = items(listId).find((i) => i.name === 'Carotte')!;
    await toggleShoppingItem(carotte.id, true);

    const changed = await toggleAisle(listId, 'vegetables', true);

    expect(changed).toBe(1); // seul Brocoli restait à cocher
    expect(items(listId).filter((i) => i.category === 'vegetables').every((i) => i.checked === 1))
      .toBe(true);
  });

  it('dé-coche tout un rayon', async () => {
    const listId = await seedTwoAisles();
    await toggleAisle(listId, 'vegetables', true);

    const changed = await toggleAisle(listId, 'vegetables', false);

    expect(changed).toBe(2);
    expect(items(listId).filter((i) => i.category === 'vegetables').every((i) => i.checked === 0))
      .toBe(true);
  });

  it('ne fait rien sur un rayon déjà dans l’état voulu', async () => {
    const listId = await seedTwoAisles();
    expect(await toggleAisle(listId, 'vegetables', false)).toBe(0);
  });

  it('ne fait rien sur un rayon absent de la liste', async () => {
    const listId = await seedTwoAisles();
    expect(await toggleAisle(listId, 'fish', true)).toBe(0);
  });

  it('n’affecte pas les articles d’une autre liste', async () => {
    const listId = await seedTwoAisles();
    const other = (await regenerateShoppingList(WEEK))!;

    await toggleAisle(other, 'vegetables', true);

    // L'ancienne liste est archivée mais ses lignes ne doivent pas avoir bougé.
    expect(items(listId).every((i) => i.checked === 0)).toBe(true);
  });

  it('la requête de lecture ordonne par order_index', async () => {
    const listId = await seedTwoAisles();
    const rows = await testPowerSync.getAll<ItemRow>(SELECT_LIST_ITEMS, [listId]);
    expect(rows.map((r) => r.order_index)).toEqual([0, 1, 2]);
  });
});

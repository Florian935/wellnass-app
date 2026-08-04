/**
 * US REPAS-01 — planning repas, sur **du vrai SQLite** (harness, niveau 2 de strategie-tests.md).
 *
 * Ce qui est vérifié ici ne peut pas l'être ailleurs :
 *
 *  - **R1 : planifier n'écrit RIEN dans `food_entries`.** C'est le garde-fou central de l'US. Un
 *    planning compté comme consommé fausserait les totaux du jour, l'adhérence, le streak, le
 *    bilan hebdo et les analyses inter-piliers — silencieusement, et de façon irrattrapable une
 *    fois l'historique pollué. L'assertion « le journal est vide après planification » est le test
 *    le plus important du fichier.
 *  - **R8 : le facteur de portion arrive bien jusqu'aux macros.** `recipe_ingredients` porte la
 *    quantité TOTALE de la recette : planifier 2 portions d'une recette qui en produit 4 doit
 *    donner la moitié. Une erreur ici double les courses et les calories prévues.
 *  - **R3 : idempotence du portage.** Porter deux fois ne doit pas doubler les lignes ; annuler
 *    doit retirer exactement celles qui ont été créées, et rien d'autre du journal du jour.
 *  - **Le snapshot est figé** : modifier une recette après coup ne réécrit pas le planning posé.
 */

import {
  consumePlannedEntry,
  duplicateWeek,
  planRecipe,
  planTemplate,
  removePlannedEntry,
  SELECT_PLAN_BETWEEN,
  SELECT_PLAN_DAY,
  undoConsumedEntry,
  updatePlannedServings,
} from '../meal-plan-repository';
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

type PlanRow = {
  id: string;
  user_id: string;
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
  consumed_at: string | null;
  consumed_entry_ids: string | null;
  deleted_at: string | null;
};

type FoodEntryRow = {
  id: string;
  log_date: string;
  meal_type: string;
  name: string;
  kcal: number;
  deleted_at: string | null;
};

/** Recette de 4 portions : 800 kcal au total, donc 200 kcal la portion. */
function seedRecipe(over: { servings?: number; name?: string } = {}): string {
  const [recipeId] = seed('recipes', [
    { user_id: 'user-1', name: over.name ?? 'Poulet riz', servings: over.servings ?? 4 },
  ]);
  seed('recipe_ingredients', [
    {
      recipe_id: recipeId,
      user_id: 'user-1',
      food_id: 'food-poulet',
      name: 'Poulet',
      quantity_g: 600,
      kcal: 600,
      protein_g: 120,
      carbs_g: 0,
      fat_g: 12,
    },
    {
      recipe_id: recipeId,
      user_id: 'user-1',
      food_id: 'food-riz',
      name: 'Riz',
      quantity_g: 200,
      kcal: 200,
      protein_g: 8,
      carbs_g: 60,
      fat_g: 1,
    },
  ]);
  return recipeId!;
}

function seedTemplate(): string {
  const [templateId] = seed('meal_templates', [{ user_id: 'user-1', name: "Mon déj'" }]);
  seed('meal_template_items', [
    {
      template_id: templateId,
      user_id: 'user-1',
      food_id: 'food-pain',
      name: 'Pain',
      quantity_g: 80,
      kcal: 200,
      protein_g: 7,
      carbs_g: 40,
      fat_g: 1,
    },
    {
      template_id: templateId,
      user_id: 'user-1',
      food_id: 'food-jambon',
      name: 'Jambon',
      quantity_g: 50,
      kcal: 100,
      protein_g: 10,
      carbs_g: 0,
      fat_g: 5,
    },
  ]);
  return templateId!;
}

const plans = () => rowsOf<PlanRow>('meal_plan_entries');
const journal = () => rowsOf<FoodEntryRow>('food_entries');
const liveJournal = () => journal().filter((e) => e.deleted_at === null);

beforeEach(() => {
  resetTestDb();
});

// ---------------------------------------------------------------------------
// R1 — la séparation planning / journal
// ---------------------------------------------------------------------------

describe('R1 — planifier n’écrit jamais dans le journal', () => {
  it('ne crée aucune food_entry en planifiant une recette', async () => {
    const recipeId = seedRecipe();
    await planRecipe('2026-08-04', 'lunch', recipeId, 2);

    expect(plans()).toHaveLength(1);
    expect(journal()).toHaveLength(0); // ← le test qui protège tout le pilier nutrition
  });

  it('ne crée aucune food_entry en planifiant un repas type', async () => {
    const templateId = seedTemplate();
    await planTemplate('2026-08-04', 'lunch', templateId);

    expect(plans()).toHaveLength(1);
    expect(journal()).toHaveLength(0);
  });

  it('ne crée aucune food_entry en dupliquant une semaine entière', async () => {
    const recipeId = seedRecipe();
    await planRecipe('2026-08-03', 'lunch', recipeId, 1);
    await planRecipe('2026-08-05', 'dinner', recipeId, 1);

    await duplicateWeek('2026-08-03', '2026-08-10');

    expect(plans()).toHaveLength(4);
    expect(journal()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// R8 — le facteur de portion
// ---------------------------------------------------------------------------

describe('R8 — mise à l’échelle du snapshot', () => {
  it('planifier 2 portions d’une recette de 4 donne la moitié des macros', async () => {
    const recipeId = seedRecipe({ servings: 4 }); // 800 kcal au total
    await planRecipe('2026-08-04', 'lunch', recipeId, 2);

    const [entry] = plans();
    expect(entry!.kcal).toBe(400);
    expect(entry!.protein_g).toBe(64); // (120 + 8) / 2
    expect(entry!.servings).toBe(2);
  });

  it('planifier le rendement complet donne les macros totales', async () => {
    const recipeId = seedRecipe({ servings: 4 });
    await planRecipe('2026-08-04', 'lunch', recipeId, 4);
    expect(plans()[0]!.kcal).toBe(800);
  });

  it('planifier plus que le rendement multiplie les macros', async () => {
    const recipeId = seedRecipe({ servings: 2 }); // 800 kcal pour 2 portions
    await planRecipe('2026-08-04', 'lunch', recipeId, 4);
    expect(plans()[0]!.kcal).toBe(1600);
  });

  it('un repas type est pris tel quel, sans notion de portions', async () => {
    const templateId = seedTemplate();
    await planTemplate('2026-08-04', 'lunch', templateId);

    const [entry] = plans();
    expect(entry!.kcal).toBe(300);
    expect(entry!.servings).toBe(1);
    expect(entry!.source_type).toBe('template');
  });
});

describe('snapshot figé', () => {
  it('ne réécrit pas le planning quand la recette change après coup', async () => {
    const recipeId = seedRecipe({ servings: 4 });
    await planRecipe('2026-08-04', 'lunch', recipeId, 4);

    // La recette grossit APRÈS la planification.
    seed('recipe_ingredients', [
      {
        recipe_id: recipeId,
        user_id: 'user-1',
        name: 'Huile',
        quantity_g: 20,
        kcal: 180,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 20,
      },
    ]);

    expect(plans()[0]!.kcal).toBe(800); // inchangé
  });

  it('remet le snapshot à l’échelle quand l’utilisateur change lui-même les portions', async () => {
    const recipeId = seedRecipe({ servings: 4 });
    const id = await planRecipe('2026-08-04', 'lunch', recipeId, 4);

    await updatePlannedServings(id, 2);

    const [entry] = plans();
    expect(entry!.servings).toBe(2);
    expect(entry!.kcal).toBe(400);
  });

  it('ajuste les portions sans toucher au snapshot si la recette a été archivée (R11)', async () => {
    const recipeId = seedRecipe({ servings: 4 });
    const id = await planRecipe('2026-08-04', 'lunch', recipeId, 4);
    testPowerSync.execute(`UPDATE recipes SET deleted_at = ? WHERE id = ?`, [
      '2026-08-04T10:00:00.000Z',
      recipeId,
    ]);

    await updatePlannedServings(id, 2);

    const [entry] = plans();
    expect(entry!.servings).toBe(2);
    expect(entry!.kcal).toBe(800); // le snapshot reste la seule trace de ce qui était prévu
  });

  it('refuse un nombre de portions nul ou négatif', async () => {
    const recipeId = seedRecipe();
    const id = await planRecipe('2026-08-04', 'lunch', recipeId, 1);
    await expect(updatePlannedServings(id, 0)).rejects.toThrow(/strictement positif/);
  });

  it('refuse de planifier une recette archivée', async () => {
    const recipeId = seedRecipe();
    testPowerSync.execute(`UPDATE recipes SET deleted_at = ? WHERE id = ?`, [
      '2026-08-04T10:00:00.000Z',
      recipeId,
    ]);
    await expect(planRecipe('2026-08-04', 'lunch', recipeId, 1)).rejects.toThrow(/introuvable/);
  });

  it('refuse de planifier un repas type archivé', async () => {
    const templateId = seedTemplate();
    testPowerSync.execute(`UPDATE meal_templates SET deleted_at = ? WHERE id = ?`, [
      '2026-08-04T10:00:00.000Z',
      templateId,
    ]);
    await expect(planTemplate('2026-08-04', 'lunch', templateId)).rejects.toThrow(/introuvable/);
  });
});

// ---------------------------------------------------------------------------
// Lecture : fenêtre de semaine, ordre
// ---------------------------------------------------------------------------

describe('lecture du planning', () => {
  it('la fenêtre de semaine est inclusive aux deux bornes', async () => {
    const recipeId = seedRecipe();
    await planRecipe('2026-08-02', 'lunch', recipeId, 1); // dimanche précédent
    await planRecipe('2026-08-03', 'lunch', recipeId, 1); // lundi = borne basse
    await planRecipe('2026-08-09', 'lunch', recipeId, 1); // dimanche = borne haute
    await planRecipe('2026-08-10', 'lunch', recipeId, 1); // lundi suivant

    const rows = await testPowerSync.getAll<PlanRow>(SELECT_PLAN_BETWEEN, [
      'user-1',
      '2026-08-03',
      '2026-08-09',
    ]);
    expect(rows.map((r) => r.plan_date)).toEqual(['2026-08-03', '2026-08-09']);
  });

  it('ignore les entrées archivées', async () => {
    const recipeId = seedRecipe();
    const id = await planRecipe('2026-08-04', 'lunch', recipeId, 1);
    await removePlannedEntry(id);

    const rows = await testPowerSync.getAll<PlanRow>(SELECT_PLAN_DAY, ['user-1', '2026-08-04']);
    expect(rows).toHaveLength(0);
    // Soft delete, jamais de hard delete côté client : la ligne existe toujours en base.
    const withDeleted = rowsOf<PlanRow>('meal_plan_entries', true);
    expect(withDeleted).toHaveLength(1);
    expect(withDeleted[0]!.deleted_at).not.toBeNull();
  });

  it('ne mélange pas les utilisateurs', async () => {
    const recipeId = seedRecipe();
    await planRecipe('2026-08-04', 'lunch', recipeId, 1);
    seed('meal_plan_entries', [
      {
        user_id: 'user-2',
        plan_date: '2026-08-04',
        meal_key: 'lunch',
        order_index: 0,
        source_type: 'recipe',
        servings: 1,
        label: 'Chez quelqu’un d’autre',
        kcal: 500,
      },
    ]);

    const rows = await testPowerSync.getAll<PlanRow>(SELECT_PLAN_DAY, ['user-1', '2026-08-04']);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.label).toBe('Poulet riz');
  });

  it('empile les order_index par (jour, repas) et non globalement', async () => {
    const recipeId = seedRecipe();
    await planRecipe('2026-08-04', 'lunch', recipeId, 1);
    await planRecipe('2026-08-04', 'lunch', recipeId, 1);
    await planRecipe('2026-08-04', 'dinner', recipeId, 1);
    await planRecipe('2026-08-05', 'lunch', recipeId, 1);

    const byMeal = (date: string, meal: string) =>
      plans()
        .filter((p) => p.plan_date === date && p.meal_key === meal)
        .map((p) => p.order_index)
        .sort();

    expect(byMeal('2026-08-04', 'lunch')).toEqual([0, 1]);
    expect(byMeal('2026-08-04', 'dinner')).toEqual([0]);
    expect(byMeal('2026-08-05', 'lunch')).toEqual([0]);
  });

  it('accepte une clé de repas libre (repas personnalisé)', async () => {
    const recipeId = seedRecipe();
    await planRecipe('2026-08-04', 'pre-workout', recipeId, 1);
    expect(plans()[0]!.meal_key).toBe('pre-workout');
  });
});

// ---------------------------------------------------------------------------
// D12 — duplication de semaine
// ---------------------------------------------------------------------------

describe('duplicateWeek (D12)', () => {
  it('recopie chaque entrée en décalant la date du bon nombre de jours', async () => {
    const recipeId = seedRecipe();
    await planRecipe('2026-08-03', 'breakfast', recipeId, 1);
    await planRecipe('2026-08-07', 'dinner', recipeId, 2);

    const copied = await duplicateWeek('2026-08-03', '2026-08-10');

    expect(copied).toBe(2);
    const dates = plans()
      .map((p) => p.plan_date)
      .sort();
    expect(dates).toEqual(['2026-08-03', '2026-08-07', '2026-08-10', '2026-08-14']);
  });

  it('conserve le repas, les portions et le snapshot', async () => {
    const recipeId = seedRecipe({ servings: 4 });
    await planRecipe('2026-08-03', 'dinner', recipeId, 2);

    await duplicateWeek('2026-08-03', '2026-08-10');

    const copy = plans().find((p) => p.plan_date === '2026-08-10')!;
    expect(copy.meal_key).toBe('dinner');
    expect(copy.servings).toBe(2);
    expect(copy.kcal).toBe(400);
  });

  it('remet consumed_at à null : dupliquer une intention ne duplique pas un repas mangé', async () => {
    const recipeId = seedRecipe();
    const id = await planRecipe('2026-08-03', 'lunch', recipeId, 1);
    await consumePlannedEntry(id);

    await duplicateWeek('2026-08-03', '2026-08-10');

    const copy = plans().find((p) => p.plan_date === '2026-08-10')!;
    expect(copy.consumed_at).toBeNull();
    expect(copy.consumed_entry_ids).toBeNull();
    // Et le journal ne contient que le portage d'origine, pas celui de la copie.
    expect(liveJournal()).toHaveLength(1);
  });

  it('ajoute derrière l’existant sans rien effacer sur une semaine cible déjà remplie', async () => {
    const recipeId = seedRecipe();
    await planRecipe('2026-08-03', 'lunch', recipeId, 1);
    await planRecipe('2026-08-10', 'lunch', recipeId, 1); // déjà quelque chose lundi prochain

    await duplicateWeek('2026-08-03', '2026-08-10');

    const target = plans().filter((p) => p.plan_date === '2026-08-10');
    expect(target).toHaveLength(2);
    expect(target.map((p) => p.order_index).sort()).toEqual([0, 1]);
  });

  it('ne fait rien et rend 0 sur une semaine source vide', async () => {
    expect(await duplicateWeek('2026-08-03', '2026-08-10')).toBe(0);
    expect(plans()).toHaveLength(0);
  });

  it('ignore les entrées archivées de la semaine source', async () => {
    const recipeId = seedRecipe();
    const id = await planRecipe('2026-08-03', 'lunch', recipeId, 1);
    await removePlannedEntry(id);

    expect(await duplicateWeek('2026-08-03', '2026-08-10')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// R2 / R3 — portage au journal
// ---------------------------------------------------------------------------

describe('R2 — porter au journal', () => {
  it('crée une seule ligne pour une recette, dans le bon jour et le bon repas', async () => {
    const recipeId = seedRecipe({ servings: 4 });
    const id = await planRecipe('2026-08-04', 'dinner', recipeId, 2);

    const created = await consumePlannedEntry(id);

    expect(created).toBe(1);
    const [entry] = liveJournal();
    expect(entry!.log_date).toBe('2026-08-04');
    expect(entry!.meal_type).toBe('dinner');
    expect(entry!.name).toBe('Poulet riz');
    expect(entry!.kcal).toBe(400); // les macros snapshotées, mises à l'échelle
  });

  it('déplie un repas type en une ligne par aliment', async () => {
    const templateId = seedTemplate();
    const id = await planTemplate('2026-08-04', 'lunch', templateId);

    const created = await consumePlannedEntry(id);

    expect(created).toBe(2);
    expect(liveJournal().map((e) => e.name).sort()).toEqual(['Jambon', 'Pain']);
  });

  it('horodate consumed_at et retient les lignes créées', async () => {
    const recipeId = seedRecipe();
    const id = await planRecipe('2026-08-04', 'lunch', recipeId, 1);

    await consumePlannedEntry(id);

    const [entry] = plans();
    expect(entry!.consumed_at).not.toBeNull();
    expect(JSON.parse(entry!.consumed_entry_ids!)).toHaveLength(1);
  });

  it('ne double pas les lignes si on porte deux fois (R3)', async () => {
    const recipeId = seedRecipe();
    const id = await planRecipe('2026-08-04', 'lunch', recipeId, 1);

    expect(await consumePlannedEntry(id)).toBe(1);
    expect(await consumePlannedEntry(id)).toBe(0);
    expect(liveJournal()).toHaveLength(1);
  });

  it('ne relève que les lignes qu’il a créées, même si le repas en contenait déjà', async () => {
    const templateId = seedTemplate();
    seed('food_entries', [
      {
        user_id: 'user-1',
        log_date: '2026-08-04',
        meal_type: 'lunch',
        order_index: 0,
        name: 'Café pris avant',
        kcal: 5,
      },
    ]);

    const id = await planTemplate('2026-08-04', 'lunch', templateId);
    await consumePlannedEntry(id);

    const tracked: string[] = JSON.parse(plans()[0]!.consumed_entry_ids!);
    expect(tracked).toHaveLength(2);
    const names = tracked.map((t) => journal().find((e) => e.id === t)!.name).sort();
    expect(names).toEqual(['Jambon', 'Pain']);
  });

  it('refuse une entrée de planning inexistante', async () => {
    await expect(consumePlannedEntry('inconnu')).rejects.toThrow(/introuvable/);
  });
});

describe('R3 — annuler un portage', () => {
  it('retire exactement les lignes créées et rien d’autre du journal du jour', async () => {
    const templateId = seedTemplate();
    seed('food_entries', [
      {
        user_id: 'user-1',
        log_date: '2026-08-04',
        meal_type: 'lunch',
        order_index: 0,
        name: 'Café pris avant',
        kcal: 5,
      },
    ]);
    const id = await planTemplate('2026-08-04', 'lunch', templateId);
    await consumePlannedEntry(id);
    expect(liveJournal()).toHaveLength(3);

    const removed = await undoConsumedEntry(id);

    expect(removed).toBe(2);
    expect(liveJournal().map((e) => e.name)).toEqual(['Café pris avant']);
  });

  it('remet l’entrée de planning en état « à porter »', async () => {
    const recipeId = seedRecipe();
    const id = await planRecipe('2026-08-04', 'lunch', recipeId, 1);
    await consumePlannedEntry(id);

    await undoConsumedEntry(id);

    const [entry] = plans();
    expect(entry!.consumed_at).toBeNull();
    expect(entry!.consumed_entry_ids).toBeNull();
    // …et on peut porter de nouveau.
    expect(await consumePlannedEntry(id)).toBe(1);
  });

  it('ne fait rien sur une entrée jamais portée', async () => {
    const recipeId = seedRecipe();
    const id = await planRecipe('2026-08-04', 'lunch', recipeId, 1);
    expect(await undoConsumedEntry(id)).toBe(0);
  });

  it('tolère une ligne de journal déjà supprimée à la main', async () => {
    const recipeId = seedRecipe();
    const id = await planRecipe('2026-08-04', 'lunch', recipeId, 1);
    await consumePlannedEntry(id);
    const entryId: string = JSON.parse(plans()[0]!.consumed_entry_ids!)[0];
    testPowerSync.execute(`UPDATE food_entries SET deleted_at = ? WHERE id = ?`, [
      '2026-08-04T12:00:00.000Z',
      entryId,
    ]);

    await expect(undoConsumedEntry(id)).resolves.toBe(1);
    expect(plans()[0]!.consumed_at).toBeNull();
  });

  it('ne reste pas bloqué si consumed_entry_ids est illisible', async () => {
    const recipeId = seedRecipe();
    const id = await planRecipe('2026-08-04', 'lunch', recipeId, 1);
    await consumePlannedEntry(id);
    testPowerSync.execute(`UPDATE meal_plan_entries SET consumed_entry_ids = ? WHERE id = ?`, [
      'ceci n’est pas du JSON',
      id,
    ]);

    // L'utilisateur doit pouvoir revenir en arrière même si la trace est corrompue.
    await expect(undoConsumedEntry(id)).resolves.toBe(0);
    expect(plans()[0]!.consumed_at).toBeNull();
  });

  it('refuse une entrée de planning inexistante', async () => {
    await expect(undoConsumedEntry('inconnu')).rejects.toThrow(/introuvable/);
  });
});

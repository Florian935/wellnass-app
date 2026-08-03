/**
 * Nutrition — journal alimentaire et profil, sur **du vrai SQLite**.
 *
 * Fin du lot 2 de [strategie-tests.md](../../../../../../docs/specs/technical/strategie-tests.md).
 *
 * Le journal est le repository le plus **manipulé** de l'app : on y ajoute, corrige, déplace,
 * réassigne et copie des entrées plusieurs fois par jour. Deux familles de défauts y sont
 * particulièrement coûteuses, et invisibles autrement qu'en inspectant la base :
 *
 *  - **l'ordre** (`order_index`), qui est par `(jour, repas)` et non global : un échange mal borné
 *    déplace une entrée dans le mauvais repas, ou pire, dans le mauvais jour ;
 *  - **la copie** (`copyMeal`, `duplicateDay`), qui doit reproduire le **snapshot** — un aliment
 *    modifié après coup ne doit pas réécrire les repas déjà journalisés. Une copie qui pointerait
 *    vers l'aliment vivant réécrirait rétroactivement l'historique nutritionnel.
 */

import {
  addFoodEntry,
  copyMeal,
  duplicateDay,
  moveEntry,
  reassignEntryMeal,
  removeEntry,
  SELECT_DAILY_TOTALS,
  SELECT_DAY,
  SELECT_FIRST_LOG_DATE,
  SELECT_MEAL_TOTALS,
  updateEntry,
} from '../journal-repository';
import { upsertNutritionProfile } from '../nutrition-repository';
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

type EntryRow = {
  id: string;
  user_id: string;
  log_date: string;
  meal_type: string;
  order_index: number;
  food_id: string | null;
  name: string;
  quantity_g: number | null;
  kcal: number;
  protein_g: number;
  micronutrients: string | null;
};

const query = <T>(sql: string, params: unknown[]) => testPowerSync.getAll<T>(sql, params);

const entries = (includeDeleted = false) => rowsOf<EntryRow>('food_entries', includeDeleted);

/** Entrées d'un repas, dans l'ordre d'affichage. */
const mealEntries = (logDate: string, mealType: string) =>
  entries()
    .filter((e) => e.log_date === logDate && e.meal_type === mealType)
    .sort((a, b) => a.order_index - b.order_index);

const DAY = '2026-08-03';

/** Snapshot minimal d'une entrée de journal. */
const snapshot = (name: string, kcal: number, opts?: Partial<Record<string, unknown>>) => ({
  foodId: null,
  name,
  quantityG: 100,
  kcal,
  proteinG: 10,
  carbsG: 20,
  fatG: 5,
  micronutrients: {},
  ...opts,
});

beforeEach(() => {
  resetTestDb();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Ajout
// ---------------------------------------------------------------------------

describe('addFoodEntry', () => {
  it('écrit l’entrée avec son propriétaire, son jour et son repas', async () => {
    const id = await addFoodEntry(DAY, 'lunch', snapshot('Riz', 350));

    expect(entries()).toEqual([
      expect.objectContaining({
        id,
        user_id: 'user-1',
        log_date: DAY,
        meal_type: 'lunch',
        name: 'Riz',
        kcal: 350,
        order_index: 0,
      }),
    ]);
  });

  it('numérote par (jour, repas) — chaque repas repart de zéro', async () => {
    await addFoodEntry(DAY, 'lunch', snapshot('Riz', 350));
    await addFoodEntry(DAY, 'lunch', snapshot('Poulet', 200));
    await addFoodEntry(DAY, 'dinner', snapshot('Soupe', 120));
    await addFoodEntry('2026-08-04', 'lunch', snapshot('Pâtes', 400));

    expect(mealEntries(DAY, 'lunch').map((e) => e.order_index)).toEqual([0, 1]);
    expect(mealEntries(DAY, 'dinner').map((e) => e.order_index)).toEqual([0]);
    expect(mealEntries('2026-08-04', 'lunch').map((e) => e.order_index)).toEqual([0]);
  });

  it('sérialise les micronutriments, même absents', async () => {
    await addFoodEntry(DAY, 'lunch', snapshot('Riz', 350, { micronutrients: { iron_mg: 2.4 } }));
    await addFoodEntry(DAY, 'lunch', snapshot('Eau', 0, { micronutrients: undefined }));

    const rows = mealEntries(DAY, 'lunch');
    expect(JSON.parse(rows[0]!.micronutrients!)).toEqual({ iron_mg: 2.4 });
    expect(JSON.parse(rows[1]!.micronutrients!)).toEqual({});
  });

  it('accepte un quick add sans quantité', async () => {
    await addFoodEntry(DAY, 'snack', snapshot('Restaurant', 800, { quantityG: null }));

    expect(mealEntries(DAY, 'snack')[0]).toMatchObject({ quantity_g: null, kcal: 800 });
  });
});

// ---------------------------------------------------------------------------
// Modification et suppression
// ---------------------------------------------------------------------------

describe('updateEntry', () => {
  it('réécrit quantité et macros', async () => {
    const id = await addFoodEntry(DAY, 'lunch', snapshot('Riz', 350));

    await updateEntry(id, { quantityG: 200, kcal: 700, proteinG: 20, carbsG: 40, fatG: 10 });

    expect(entries()[0]).toMatchObject({ quantity_g: 200, kcal: 700, protein_g: 20 });
  });

  it('ne touche ni le nom ni les micros quand ils ne sont pas fournis', async () => {
    const id = await addFoodEntry(
      DAY,
      'lunch',
      snapshot('Riz complet', 350, { micronutrients: { iron_mg: 2.4 } }),
    );

    await updateEntry(id, { quantityG: 200, kcal: 700, proteinG: 20, carbsG: 40, fatG: 10 });

    expect(entries()[0]?.name).toBe('Riz complet');
    expect(JSON.parse(entries()[0]!.micronutrients!)).toEqual({ iron_mg: 2.4 });
  });

  it('remplace nom et micros quand ils sont fournis', async () => {
    const id = await addFoodEntry(DAY, 'lunch', snapshot('Riz', 350));

    await updateEntry(id, {
      quantityG: 100,
      kcal: 350,
      proteinG: 10,
      carbsG: 20,
      fatG: 5,
      name: 'Riz basmati',
      micronutrients: { iron_mg: 1.1 },
    });

    expect(entries()[0]?.name).toBe('Riz basmati');
    expect(JSON.parse(entries()[0]!.micronutrients!)).toEqual({ iron_mg: 1.1 });
  });
});

describe('removeEntry', () => {
  it('supprime en douceur et retire l’entrée du journal du jour', async () => {
    const id = await addFoodEntry(DAY, 'lunch', snapshot('Riz', 350));
    await addFoodEntry(DAY, 'lunch', snapshot('Poulet', 200));

    await removeEntry(id);

    expect(await query(SELECT_DAY, [DAY])).toHaveLength(1);
    expect(entries(true)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Ordre
// ---------------------------------------------------------------------------

describe('moveEntry', () => {
  /** Trois entrées dans le même repas. */
  async function seedThree(): Promise<string[]> {
    return [
      await addFoodEntry(DAY, 'lunch', snapshot('A', 100)),
      await addFoodEntry(DAY, 'lunch', snapshot('B', 200)),
      await addFoodEntry(DAY, 'lunch', snapshot('C', 300)),
    ];
  }

  const names = () => mealEntries(DAY, 'lunch').map((e) => e.name);

  it('échange avec le voisin du dessus', async () => {
    const [, b] = await seedThree();

    await moveEntry(b!, 'up');

    expect(names()).toEqual(['B', 'A', 'C']);
  });

  it('échange avec le voisin du dessous', async () => {
    const [, b] = await seedThree();

    await moveEntry(b!, 'down');

    expect(names()).toEqual(['A', 'C', 'B']);
  });

  it('ne fait rien aux extrémités', async () => {
    const [a, , c] = await seedThree();

    await moveEntry(a!, 'up');
    await moveEntry(c!, 'down');

    expect(names()).toEqual(['A', 'B', 'C']);
  });

  it('ne cherche un voisin QUE dans le même repas', async () => {
    const lunch = await addFoodEntry(DAY, 'lunch', snapshot('Riz', 350));
    await addFoodEntry(DAY, 'dinner', snapshot('Soupe', 120));

    await moveEntry(lunch, 'up');

    // Le dîner a lui aussi un `order_index` 0 : sans le filtre sur `meal_type`, l'échange
    // traverserait les repas et ferait sauter une entrée d'un repas à l'autre.
    expect(mealEntries(DAY, 'lunch').map((e) => e.name)).toEqual(['Riz']);
    expect(mealEntries(DAY, 'dinner').map((e) => e.name)).toEqual(['Soupe']);
  });

  it('ne cherche un voisin QUE dans le même jour', async () => {
    await addFoodEntry('2026-08-02', 'lunch', snapshot('Veille', 100));
    const today = await addFoodEntry(DAY, 'lunch', snapshot('Aujourd’hui', 200));

    await moveEntry(today, 'up');

    expect(mealEntries('2026-08-02', 'lunch').map((e) => e.name)).toEqual(['Veille']);
    expect(mealEntries(DAY, 'lunch').map((e) => e.name)).toEqual(['Aujourd’hui']);
  });

  it('saute par-dessus une entrée supprimée', async () => {
    const [a, b, c] = await seedThree();
    await removeEntry(b!);

    await moveEntry(c!, 'up');

    expect(names()).toEqual(['C', 'A']);
    expect(a).toBeDefined();
  });

  it('est un no-op sur une entrée inconnue', async () => {
    await expect(moveEntry('inconnue', 'up')).resolves.toBeUndefined();
  });
});

describe('reassignEntryMeal', () => {
  it('déplace l’entrée en fin du repas cible', async () => {
    await addFoodEntry(DAY, 'dinner', snapshot('Soupe', 120));
    const id = await addFoodEntry(DAY, 'lunch', snapshot('Riz', 350));

    await reassignEntryMeal(id, 'dinner');

    expect(mealEntries(DAY, 'dinner').map((e) => e.name)).toEqual(['Soupe', 'Riz']);
    expect(mealEntries(DAY, 'lunch')).toHaveLength(0);
  });

  it('ne fait rien si l’entrée est déjà dans ce repas', async () => {
    const id = await addFoodEntry(DAY, 'lunch', snapshot('Riz', 350));
    const before = entries()[0]?.order_index;

    await reassignEntryMeal(id, 'lunch');

    expect(entries()[0]?.order_index).toBe(before);
  });

  it('récupère une entrée orpheline vers un repas existant', async () => {
    const id = await addFoodEntry(DAY, 'repas-supprime', snapshot('Orpheline', 200));

    await reassignEntryMeal(id, 'breakfast');

    expect(mealEntries(DAY, 'breakfast').map((e) => e.name)).toEqual(['Orpheline']);
  });

  it('est un no-op sur une entrée inconnue', async () => {
    await expect(reassignEntryMeal('inconnue', 'lunch')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Copie
// ---------------------------------------------------------------------------

describe('copyMeal / duplicateDay', () => {
  /** Une journée complète : deux repas, trois entrées. */
  async function seedDay(date: string): Promise<void> {
    await addFoodEntry(date, 'lunch', snapshot('Riz', 350, { micronutrients: { iron_mg: 2.4 } }));
    await addFoodEntry(date, 'lunch', snapshot('Poulet', 200));
    await addFoodEntry(date, 'dinner', snapshot('Soupe', 120));
  }

  it('copie un repas vers un autre jour, dans l’ordre, et renvoie le compte', async () => {
    await seedDay('2026-08-02');

    const copied = await copyMeal('2026-08-02', 'lunch', DAY);

    expect(copied).toBe(2);
    expect(mealEntries(DAY, 'lunch').map((e) => e.name)).toEqual(['Riz', 'Poulet']);
    expect(mealEntries(DAY, 'dinner')).toHaveLength(0);
  });

  it('copie le SNAPSHOT, pas une référence — modifier la copie ne touche pas la source', async () => {
    await seedDay('2026-08-02');
    await copyMeal('2026-08-02', 'lunch', DAY);

    const copy = mealEntries(DAY, 'lunch')[0]!;
    await updateEntry(copy.id, { quantityG: 500, kcal: 1750, proteinG: 50, carbsG: 100, fatG: 25 });

    expect(mealEntries('2026-08-02', 'lunch')[0]?.kcal).toBe(350);
  });

  it('reporte les micronutriments de la source', async () => {
    await seedDay('2026-08-02');

    await copyMeal('2026-08-02', 'lunch', DAY);

    expect(JSON.parse(mealEntries(DAY, 'lunch')[0]!.micronutrients!)).toEqual({ iron_mg: 2.4 });
  });

  it('s’ajoute à la suite d’un repas déjà rempli au lieu de l’écraser', async () => {
    await seedDay('2026-08-02');
    await addFoodEntry(DAY, 'lunch', snapshot('Déjà là', 90));

    await copyMeal('2026-08-02', 'lunch', DAY);

    expect(mealEntries(DAY, 'lunch').map((e) => e.name)).toEqual(['Déjà là', 'Riz', 'Poulet']);
    expect(mealEntries(DAY, 'lunch').map((e) => e.order_index)).toEqual([0, 1, 2]);
  });

  it('ne copie pas les entrées supprimées', async () => {
    await seedDay('2026-08-02');
    await removeEntry(mealEntries('2026-08-02', 'lunch')[1]!.id);

    expect(await copyMeal('2026-08-02', 'lunch', DAY)).toBe(1);
  });

  it('renvoie 0 quand le repas source est vide', async () => {
    expect(await copyMeal('2026-08-02', 'lunch', DAY)).toBe(0);
    expect(entries()).toHaveLength(0);
  });

  it('duplique le jour entier en conservant chaque repas', async () => {
    await seedDay('2026-08-02');

    const copied = await duplicateDay('2026-08-02', DAY);

    expect(copied).toBe(3);
    expect(mealEntries(DAY, 'lunch').map((e) => e.name)).toEqual(['Riz', 'Poulet']);
    expect(mealEntries(DAY, 'dinner').map((e) => e.name)).toEqual(['Soupe']);
  });
});

// ---------------------------------------------------------------------------
// Lectures
// ---------------------------------------------------------------------------

describe('requêtes de lecture', () => {
  it('SELECT_DAY ne renvoie que le jour demandé, trié par ordre puis création', async () => {
    await addFoodEntry(DAY, 'lunch', snapshot('Riz', 350));
    await addFoodEntry(DAY, 'dinner', snapshot('Soupe', 120));
    await addFoodEntry('2026-08-04', 'lunch', snapshot('Pâtes', 400));

    const rows = await query<{ name: string }>(SELECT_DAY, [DAY]);

    expect(rows.map((r) => r.name).sort()).toEqual(['Riz', 'Soupe']);
  });

  it('SELECT_DAILY_TOTALS agrège par jour depuis la borne, hors entrées supprimées', async () => {
    await addFoodEntry('2026-08-01', 'lunch', snapshot('Avant', 999));
    await addFoodEntry(DAY, 'lunch', snapshot('Riz', 350));
    await addFoodEntry(DAY, 'dinner', snapshot('Soupe', 120));
    const removed = await addFoodEntry(DAY, 'snack', snapshot('Annulé', 500));
    await removeEntry(removed);

    const rows = await query<{ log_date: string; kcal: number }>(SELECT_DAILY_TOTALS, [
      '2026-08-02',
    ]);

    expect(rows).toEqual([expect.objectContaining({ log_date: DAY, kcal: 470 })]);
  });

  it('SELECT_MEAL_TOTALS groupe sur la clé de repas réelle, y compris une clé inconnue', async () => {
    await addFoodEntry(DAY, 'lunch', snapshot('Riz', 350));
    await addFoodEntry(DAY, 'lunch', snapshot('Poulet', 200));
    await addFoodEntry(DAY, 'repas-perso', snapshot('Collation', 90));

    const rows = await query<{ meal_type: string; kcal: number }>(SELECT_MEAL_TOTALS, [DAY]);

    expect(rows.sort((a, b) => a.meal_type.localeCompare(b.meal_type))).toEqual([
      { meal_type: 'lunch', kcal: 550 },
      { meal_type: 'repas-perso', kcal: 90 },
    ]);
  });

  it('SELECT_FIRST_LOG_DATE donne la première entrée, et null sur un journal vide', async () => {
    expect((await query<{ first: string | null }>(SELECT_FIRST_LOG_DATE, []))[0]?.first).toBeNull();

    await addFoodEntry(DAY, 'lunch', snapshot('Riz', 350));
    await addFoodEntry('2026-07-01', 'lunch', snapshot('Ancien', 300));

    expect((await query<{ first: string }>(SELECT_FIRST_LOG_DATE, []))[0]?.first).toBe(
      '2026-07-01',
    );
  });
});

// ---------------------------------------------------------------------------
// Profil nutritionnel
// ---------------------------------------------------------------------------

describe('upsertNutritionProfile', () => {
  type ProfileRow = {
    id: string;
    user_id: string;
    objective: string | null;
    activity_level: string | null;
    manual_calories: number | null;
  };

  const profiles = (d = false) => rowsOf<ProfileRow>('nutrition_profiles', d);

  it('crée le profil de l’utilisateur courant à la première écriture', async () => {
    await upsertNutritionProfile({ objective: 'cut', activityLevel: 'moderate' });

    expect(profiles()).toEqual([
      expect.objectContaining({
        user_id: 'user-1',
        objective: 'cut',
        activity_level: 'moderate',
      }),
    ]);
  });

  it('met à jour la ligne existante au lieu d’en créer une seconde', async () => {
    await upsertNutritionProfile({ objective: 'cut' });

    await upsertNutritionProfile({ objective: 'bulk' });

    expect(profiles()).toHaveLength(1);
    expect(profiles()[0]?.objective).toBe('bulk');
  });

  it('ne touche que les clés fournies', async () => {
    await upsertNutritionProfile({ objective: 'cut', manualCalories: 2200 });

    await upsertNutritionProfile({ objective: 'maintain' });

    expect(profiles()[0]).toMatchObject({ objective: 'maintain', manual_calories: 2200 });
  });

  it('ne ressuscite pas un profil supprimé : il en crée un neuf', async () => {
    seed('nutrition_profiles', [
      { user_id: 'user-1', objective: 'cut', deleted_at: new Date().toISOString() },
    ]);

    await upsertNutritionProfile({ objective: 'bulk' });

    expect(profiles()).toHaveLength(1);
    expect(profiles()[0]?.objective).toBe('bulk');
  });
});

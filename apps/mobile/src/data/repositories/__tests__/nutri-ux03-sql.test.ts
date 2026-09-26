/**
 * US NUTRI-UX03 — les lectures du hub Nutrition en trois onglets, sur du vrai SQLite.
 *
 * `SELECT_ENTRIES_BETWEEN` nourrit trois surfaces : « Reprendre un repas » (R3) et les repas
 * habituels (R9) sur 60 jours, la liste des jours d'Historique (R8) sur le mois affiché. Ce qu'elle
 * doit garantir, et qu'aucun test de composant ne verrait :
 *
 *  1. **Les bornes sont incluses** — le 1er et le dernier jour du mois font partie du mois.
 *  2. **Une entrée supprimée n'existe plus** (`deleted_at`) : on ne propose pas de reprendre un repas
 *     effacé.
 *  3. **L'ordre** : jour décroissant, puis repas, puis ordre des entrées dans le repas — c'est l'ordre
 *     dans lequel on relit une journée.
 */

import { SELECT_ENTRIES_BETWEEN, SELECT_FIRST_LOG_DATE } from '../journal-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

type Row = { log_date: string; meal_type: string; food_id: string | null; name: string; kcal: number; order_index: number };

const entry = (id: string, logDate: string, mealType: string, name: string, orderIndex: number, extra: Record<string, unknown> = {}) => ({
  id,
  user_id: 'user-1',
  log_date: logDate,
  meal_type: mealType,
  order_index: orderIndex,
  food_id: `f-${name}`,
  name,
  quantity_g: 100,
  kcal: 100,
  protein_g: 1,
  carbs_g: 1,
  fat_g: 1,
  created_at: '2026-09-01T08:00:00.000Z',
  updated_at: '2026-09-01T08:00:00.000Z',
  ...extra,
});

beforeEach(() => {
  resetTestDb();
});

describe('SELECT_ENTRIES_BETWEEN', () => {
  it('🔴 bornes incluses, entrées supprimées exclues', async () => {
    seed('food_entries', [
      entry('a', '2026-08-31', 'lunch', 'Avant', 0),
      entry('b', '2026-09-01', 'lunch', 'Premier', 0),
      entry('c', '2026-09-30', 'lunch', 'Dernier', 0),
      entry('d', '2026-10-01', 'lunch', 'Après', 0),
      entry('e', '2026-09-15', 'lunch', 'Effacé', 0, { deleted_at: '2026-09-16T08:00:00.000Z' }),
    ]);

    const rows = await testPowerSync.getAll<Row>(SELECT_ENTRIES_BETWEEN, ['2026-09-01', '2026-09-30']);

    expect(rows.map((r) => r.name)).toEqual(['Dernier', 'Premier']);
  });

  it('jour décroissant, puis repas, puis ordre dans le repas', async () => {
    seed('food_entries', [
      entry('a', '2026-09-20', 'breakfast', 'Skyr', 0),
      entry('b', '2026-09-21', 'lunch', 'Riz', 1),
      entry('c', '2026-09-21', 'lunch', 'Poulet', 0),
      entry('d', '2026-09-21', 'breakfast', 'Banane', 0),
    ]);

    const rows = await testPowerSync.getAll<Row>(SELECT_ENTRIES_BETWEEN, ['2026-09-01', '2026-09-30']);

    expect(rows.map((r) => `${r.log_date} ${r.meal_type} ${r.name}`)).toEqual([
      '2026-09-21 breakfast Banane',
      '2026-09-21 lunch Poulet',
      '2026-09-21 lunch Riz',
      '2026-09-20 breakfast Skyr',
    ]);
  });

  it('porte ce que Reprendre et la liste des jours lisent', async () => {
    seed('food_entries', [entry('a', '2026-09-20', 'breakfast', 'Crème', 2, { food_id: null, kcal: 240 })]);

    const [row] = await testPowerSync.getAll<Row>(SELECT_ENTRIES_BETWEEN, ['2026-09-20', '2026-09-20']);

    expect(row).toEqual({
      log_date: '2026-09-20',
      meal_type: 'breakfast',
      food_id: null,
      name: 'Crème',
      kcal: 240,
      order_index: 2,
    });
  });
});

describe('SELECT_FIRST_LOG_DATE — borne du calendrier (R7) et compte « sans repas » (R11)', () => {
  it('la première entrée non supprimée', async () => {
    seed('food_entries', [
      entry('a', '2026-07-02', 'lunch', 'Effacé', 0, { deleted_at: '2026-07-03T08:00:00.000Z' }),
      entry('b', '2026-07-10', 'lunch', 'Premier', 0),
    ]);

    const [row] = await testPowerSync.getAll<{ first: string | null }>(SELECT_FIRST_LOG_DATE, []);

    expect(row!.first).toBe('2026-07-10');
  });

  it('aucune entrée : null', async () => {
    const [row] = await testPowerSync.getAll<{ first: string | null }>(SELECT_FIRST_LOG_DATE, []);
    expect(row!.first).toBeNull();
  });
});

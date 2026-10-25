/**
 * US ACCUEIL-07 — les lectures de l'accueil qui dit vrai, sur **du vrai SQLite**.
 *
 * Trois requêtes neuves : les saisies de la fenêtre **avec leur repas** (l'heure de chaque repas
 * s'apprend séparément), les repas notés aujourd'hui, et la garde d'habitude de la pesée. Une
 * colonne absente du schéma local ou un `deleted_at` oublié ferait réclamer un repas déjà noté —
 * ou la pesée à quelqu'un qui a supprimé sa seule pesée.
 */

import { resolveMealConfig, resolveMealSlots, type MealSample } from '@wellness/shared';
import {
  COUNT_WEIGH_INS_SINCE,
  SELECT_MEALS_LOGGED_ON,
  SELECT_MEAL_TYPE_SAMPLES,
} from '../reminder-habits-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

const query = <T>(sql: string, params: unknown[]) => testPowerSync.getAll<T>(sql, params);

const key = (d: number) => `2026-10-${String(d).padStart(2, '0')}`;
const localIso = (d: number, hour: number, minute = 0) =>
  new Date(2026, 9, d, hour, minute, 0, 0).toISOString();
const DELETED = new Date(2026, 9, 24).toISOString();

function seedEntry(mealType: string, d: number, hour: number, minute = 0, deleted = false) {
  seed('food_entries', [
    {
      user_id: 'user-1',
      log_date: key(d),
      meal_type: mealType,
      name: 'aliment',
      kcal: 300,
      created_at: localIso(d, hour, minute),
      ...(deleted ? { deleted_at: DELETED } : {}),
    },
  ]);
}

beforeEach(() => {
  resetTestDb();
});

describe('SELECT_MEAL_TYPE_SAMPLES — les saisies et leur repas', () => {
  it('rend repas, jour et instant, sans les lignes supprimées ni celles hors fenêtre', async () => {
    seedEntry('lunch', 20, 12, 30);
    seedEntry('dinner', 20, 20, 0, true);
    seedEntry('breakfast', 2, 8, 0);

    const rows = await query<{ meal_type: string; log_date: string; created_at: string }>(
      SELECT_MEAL_TYPE_SAMPLES,
      [localIso(12, 0)],
    );
    expect(rows).toEqual([{ meal_type: 'lunch', log_date: key(20), created_at: localIso(20, 12, 30) }]);
  });

  it('🔴 de bout en bout : un petit-déj noté n’éteint pas le déjeuner ni le dîner', async () => {
    for (let d = 11; d <= 24; d += 1) {
      seedEntry('breakfast', d, 7, 45);
      seedEntry('lunch', d, 12, 50);
      seedEntry('dinner', d, 20, 10);
    }
    seedEntry('breakfast', 25, 7, 50);

    const samples = (
      await query<{ meal_type: string; log_date: string; created_at: string }>(SELECT_MEAL_TYPE_SAMPLES, [
        localIso(12, 0),
      ])
    ).map<MealSample>((r) => ({ mealKey: r.meal_type, logDate: r.log_date, createdAt: r.created_at }));
    const today = await query<{ meal_type: string }>(SELECT_MEALS_LOGGED_ON, [key(25)]);

    const slots = resolveMealSlots({
      samples,
      todayKey: key(25),
      meals: resolveMealConfig(null),
      loggedToday: new Set(today.map((r) => r.meal_type)),
    });
    expect(slots.map((s) => [s.key, s.hour, s.logged])).toEqual([
      ['breakfast', 7.75, true],
      ['lunch', 12.75, false],
      ['dinner', 20.25, false],
    ]);
  });
});

describe('SELECT_MEALS_LOGGED_ON — les repas notés aujourd’hui', () => {
  it('un repas par clé, même saisi en plusieurs fois ; les suppressions ne comptent pas', async () => {
    seedEntry('lunch', 25, 12, 30);
    seedEntry('lunch', 25, 13, 0);
    seedEntry('snack', 25, 16, 0, true);
    seedEntry('dinner', 24, 20, 0);

    const rows = await query<{ meal_type: string }>(SELECT_MEALS_LOGGED_ON, [key(25)]);
    expect(rows.map((r) => r.meal_type)).toEqual(['lunch']);
  });
});

describe('COUNT_WEIGH_INS_SINCE — la garde d’habitude de la pesée', () => {
  it('compte les pesées de la fenêtre, pas les supprimées ni les anciennes', async () => {
    seed('body_weight_entries', [
      { user_id: 'user-1', log_date: key(1), weight_kg: 78 },
      { user_id: 'user-1', log_date: key(20), weight_kg: 78.4, deleted_at: DELETED },
    ]);
    const none = await query<{ n: number }>(COUNT_WEIGH_INS_SINCE, [key(5)]);
    expect(none[0]?.n).toBe(0);

    seed('body_weight_entries', [{ user_id: 'user-1', log_date: key(21), weight_kg: 78.2 }]);
    const one = await query<{ n: number }>(COUNT_WEIGH_INS_SINCE, [key(5)]);
    expect(one[0]?.n).toBe(1);
  });
});

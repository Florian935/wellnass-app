/**
 * US APPORT-01 — les deux requêtes du lot croisé, exécutées sur **du vrai SQLite**.
 *
 * Les moteurs sont testés à 100 % dans `@wellness/shared`. Ce qu'ils ne peuvent pas prouver, c'est
 * **ce qu'on leur donne** — et ici deux propriétés portent tout :
 *
 *  - 🔴 **le volume suit la MÊME convention que le reste du dépôt** : séries validées, hors
 *    échauffement, séances terminées. Une troisième définition du « volume » rendrait les chiffres
 *    incomparables d'un écran à l'autre, sans qu'aucun test fonctionnel ne le voie ;
 *  - **les protéines sont groupées par `meal_type`**, la clé que consomme déjà `resolveMealSplit`
 *    (NUTR-16). Grouper autrement ferait diverger deux écrans qui parlent des mêmes repas.
 */

import {
  SELECT_PROTEIN_BY_MEAL,
  SELECT_STRENGTH_VOLUME_BY_DAY,
} from '../dashboard-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

const ME = 'user-1';
const FROM_DAY = '2026-07-11';
const IN_WINDOW_DAY = '2026-07-20';
const BEFORE_DAY = '2026-05-01';
const FROM_UTC = '2026-07-11T00:00:00Z';
const IN_WINDOW_UTC = '2026-07-20T18:00:00Z';
const BEFORE_UTC = '2026-05-01T18:00:00Z';

function seedFood(opts: {
  id: string;
  mealType: string;
  proteinG: number | null;
  logDate?: string;
}) {
  seed('food_entries', [
    {
      id: opts.id,
      user_id: ME,
      log_date: opts.logDate ?? IN_WINDOW_DAY,
      meal_type: opts.mealType,
      name: 'x',
      kcal: 200,
      protein_g: opts.proteinG,
      order_index: 0,
    },
  ]);
}

function seedWorkoutWithSet(opts: {
  id: string;
  finishedAt?: string;
  status?: string;
  reps?: number | null;
  weightKg?: number | null;
  setType?: string;
  done?: boolean;
}) {
  seed('workouts', [
    {
      id: opts.id,
      user_id: ME,
      status: opts.status ?? 'completed',
      started_at: opts.finishedAt ?? IN_WINDOW_UTC,
      finished_at: opts.finishedAt ?? IN_WINDOW_UTC,
    },
  ]);
  seed('workout_sets', [
    {
      id: `set-${opts.id}`,
      user_id: ME,
      workout_id: opts.id,
      exercise_id: 'ex-1',
      reps: opts.reps === undefined ? 10 : opts.reps,
      weight_kg: opts.weightKg === undefined ? 100 : opts.weightKg,
      set_type: opts.setType ?? 'normal',
      done: opts.done === false ? 0 : 1,
      order_index: 0,
    },
  ]);
}

const protein = () =>
  testPowerSync.getAll<{ meal_key: string; protein_g: number | null }>(SELECT_PROTEIN_BY_MEAL, [
    FROM_DAY,
  ]);
const volume = () =>
  testPowerSync.getAll<{ finished_at: string; volume: number | null }>(
    SELECT_STRENGTH_VOLUME_BY_DAY,
    [FROM_UTC],
  );

beforeEach(() => {
  resetTestDb();
});

describe('SELECT_PROTEIN_BY_MEAL — MN-10', () => {
  it('agrège les protéines par clé de repas', async () => {
    seedFood({ id: 'a', mealType: 'breakfast', proteinG: 18 });
    seedFood({ id: 'b', mealType: 'lunch', proteinG: 20 });
    seedFood({ id: 'c', mealType: 'lunch', proteinG: 22 });

    const rows = await protein();
    const byMeal = Object.fromEntries(rows.map((r) => [r.meal_key, r.protein_g]));
    expect(byMeal).toEqual({ breakfast: 18, lunch: 42 });
  });

  it('groupe sur `meal_type` — la clé que consomme déjà resolveMealSplit (NUTR-16)', async () => {
    seedFood({ id: 'a', mealType: 'gouter-perso', proteinG: 25 });
    expect((await protein())[0]!.meal_key).toBe('gouter-perso');
  });

  it('exclut une entrée hors fenêtre', async () => {
    seedFood({ id: 'vieux', mealType: 'lunch', proteinG: 30, logDate: BEFORE_DAY });
    expect(await protein()).toEqual([]);
  });

  it('exclut une entrée supprimée', async () => {
    seedFood({ id: 'a', mealType: 'lunch', proteinG: 30 });
    await testPowerSync.execute(
      `UPDATE food_entries SET deleted_at = '2026-07-21T00:00:00Z' WHERE id = 'a'`,
    );
    expect(await protein()).toEqual([]);
  });

  it('rend NULL — et non 0 — quand toutes les protéines d’un repas sont absentes', async () => {
    // Le type côté TS est donc `number | null` : le moteur filtre, il n'additionne pas un null.
    seedFood({ id: 'a', mealType: 'lunch', proteinG: null });
    expect((await protein())[0]!.protein_g).toBeNull();
  });
});

describe('SELECT_STRENGTH_VOLUME_BY_DAY — MN-15', () => {
  it('somme reps × charge des séries validées', async () => {
    seedWorkoutWithSet({ id: 'w1', reps: 10, weightKg: 100 });
    expect((await volume())[0]!.volume).toBe(1000);
  });

  it('🔴 exclut les échauffements — même convention que useLifetimeTonnage', async () => {
    // Une troisième définition du « volume » rendrait les chiffres incomparables d'un écran à
    // l'autre, sans qu'aucun test fonctionnel ne le voie.
    seedWorkoutWithSet({ id: 'w1', setType: 'warmup' });
    expect(await volume()).toEqual([]);
  });

  it('exclut une série non validée', async () => {
    seedWorkoutWithSet({ id: 'w1', done: false });
    expect(await volume()).toEqual([]);
  });

  it('exclut une série sans reps ou sans charge', async () => {
    seedWorkoutWithSet({ id: 'w1', reps: null });
    seedWorkoutWithSet({ id: 'w2', weightKg: null });
    expect(await volume()).toEqual([]);
  });

  it('exclut une séance non terminée', async () => {
    seedWorkoutWithSet({ id: 'w1', status: 'in_progress' });
    expect(await volume()).toEqual([]);
  });

  it('exclut une séance hors fenêtre', async () => {
    seedWorkoutWithSet({ id: 'vieille', finishedAt: BEFORE_UTC });
    expect(await volume()).toEqual([]);
  });

  it('exclut une séance supprimée', async () => {
    seedWorkoutWithSet({ id: 'w1' });
    await testPowerSync.execute(
      `UPDATE workouts SET deleted_at = '2026-07-21T00:00:00Z' WHERE id = 'w1'`,
    );
    expect(await volume()).toEqual([]);
  });

  it('rend `finished_at` — c’est la clôture qui rattache la séance à un jour', async () => {
    // Convention du dépôt : `trainedDays` est bâti sur `finishedAt`. Une séance commencée à 23 h 50
    // appartient au jour où elle se termine, ici comme ailleurs.
    seedWorkoutWithSet({ id: 'w1', finishedAt: IN_WINDOW_UTC });
    expect((await volume())[0]!.finished_at).toBe(IN_WINDOW_UTC);
  });

  it('rend une ligne par séance — l’agrégation par jour se fait côté hook', async () => {
    seedWorkoutWithSet({ id: 'w1', finishedAt: '2026-07-20T10:00:00Z' });
    seedWorkoutWithSet({ id: 'w2', finishedAt: '2026-07-20T18:00:00Z' });
    expect(await volume()).toHaveLength(2);
  });
});

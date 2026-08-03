/**
 * US BILAN-01 — les requêtes du bilan hebdomadaire, exécutées sur **du vrai SQLite**.
 *
 * Lot 2 de [strategie-tests.md](../../../../../../docs/specs/technical/strategie-tests.md) : les
 * repositories de **lecture**. Ce fichier inaugure la technique retenue — les constantes SQL sont
 * exportées et exécutées directement contre le harness, parce que les hooks `useQuery` qui les
 * consomment ne sont pas exécutables hors React.
 *
 * Pourquoi ça vaut le coup ici : un bilan est **fait de chiffres**, affichés sous un titre de
 * semaine. Une borne fausse (un jour de trop ou de moins), un `deleted_at` oublié ou un
 * échauffement compté produisent un bilan **qui ment sans jamais planter** — invisible en recette,
 * puisqu'il faudrait recalculer sa semaine à la main pour s'en apercevoir.
 *
 * La synthèse (`buildWeeklyReview`, signaux, décision) est testée dans `@wellness/shared` (26
 * tests) ; ici on ne teste que les chiffres qui l'alimentent.
 */

import {
  SELECT_ACTIVITY_DAYS,
  SELECT_LOGGED_DAYS,
  SELECT_MUSCLE_SETS,
  SELECT_RECORDS,
  SELECT_RUNS,
  SELECT_STEPS,
  SELECT_STRENGTH,
  utcBounds,
} from '../weekly-review-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

// ---------------------------------------------------------------------------
// Fenêtre de test : une semaine close, du lundi au dimanche
// ---------------------------------------------------------------------------

const PERIOD = { start: '2026-07-20', end: '2026-07-26' } as const;
const { from, toExclusive } = utcBounds(PERIOD);
const WINDOW = [from, toExclusive];

/** Instant UTC correspondant à `heure` locale le jour local `dayKey`. */
function localInstant(dayKey: string, hour = 12): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y!, m! - 1, d!, hour, 0, 0, 0).toISOString();
}

/** Une séance terminée à la date locale donnée, avec ses séries. */
function seedWorkout(
  dayKey: string,
  sets: {
    exerciseId?: string;
    reps?: number | null;
    weightKg?: number | null;
    setType?: string;
    done?: boolean;
    deleted?: boolean;
  }[] = [],
  opts?: { status?: string; deleted?: boolean; hour?: number },
): string {
  const [workoutId] = seed('workouts', [
    {
      user_id: 'user-1',
      status: opts?.status ?? 'completed',
      started_at: localInstant(dayKey, (opts?.hour ?? 12) - 1),
      finished_at: localInstant(dayKey, opts?.hour ?? 12),
      ...(opts?.deleted ? { deleted_at: new Date().toISOString() } : {}),
    },
  ]);
  seed(
    'workout_sets',
    sets.map((s, i) => ({
      workout_id: workoutId,
      user_id: 'user-1',
      exercise_id: s.exerciseId ?? 'squat',
      order_index: i,
      set_type: s.setType ?? 'normal',
      reps: s.reps ?? null,
      weight_kg: s.weightKg ?? null,
      done: s.done === false ? 0 : 1,
      ...(s.deleted ? { deleted_at: new Date().toISOString() } : {}),
    })),
  );
  return workoutId!;
}

/** Une sortie terminée à la date locale donnée. */
function seedRun(
  dayKey: string,
  distanceM: number | null,
  opts?: { status?: string; deleted?: boolean },
): void {
  seed('runs', [
    {
      user_id: 'user-1',
      status: opts?.status ?? 'completed',
      source: 'gps',
      started_at: localInstant(dayKey, 8),
      finished_at: localInstant(dayKey, 9),
      distance_m: distanceM,
      ...(opts?.deleted ? { deleted_at: new Date().toISOString() } : {}),
    },
  ]);
}

const query = <T>(sql: string, params: unknown[]) => testPowerSync.getAll<T>(sql, params);

beforeEach(() => {
  resetTestDb();
});

// ---------------------------------------------------------------------------
// utcBounds
// ---------------------------------------------------------------------------

describe('utcBounds', () => {
  it('couvre la semaine entière, borne haute exclusive au minuit du lendemain', () => {
    const bounds = utcBounds(PERIOD);

    expect(bounds.from).toBe(localInstant('2026-07-20', 0));
    expect(bounds.toExclusive).toBe(localInstant('2026-07-27', 0));
  });

  it('inclut une activité de fin de dimanche et exclut celle de lundi matin', async () => {
    seedWorkout('2026-07-26', [{ reps: 5, weightKg: 100 }], { hour: 23 });
    seedWorkout('2026-07-27', [{ reps: 5, weightKg: 100 }], { hour: 0 });

    const [row] = await query<{ workouts: number }>(SELECT_STRENGTH, WINDOW);

    expect(row?.workouts).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Musculation
// ---------------------------------------------------------------------------

describe('SELECT_STRENGTH', () => {
  it('compte les séances et somme le tonnage sur la fenêtre', async () => {
    seedWorkout('2026-07-21', [
      { reps: 10, weightKg: 80 },
      { reps: 8, weightKg: 90 },
    ]);
    seedWorkout('2026-07-24', [{ reps: 5, weightKg: 100 }]);

    const [row] = await query<{ workouts: number; tonnage: number }>(SELECT_STRENGTH, WINDOW);

    expect(row).toEqual({ workouts: 2, tonnage: 10 * 80 + 8 * 90 + 5 * 100 });
  });

  it('renvoie zéro sur une semaine vide plutôt que null', async () => {
    const [row] = await query<{ workouts: number; tonnage: number }>(SELECT_STRENGTH, WINDOW);

    expect(row).toEqual({ workouts: 0, tonnage: 0 });
  });

  it('compte une séance sans série valide, avec un tonnage nul', async () => {
    seedWorkout('2026-07-21', [{ reps: 15, weightKg: 20, setType: 'warmup' }]);

    const [row] = await query<{ workouts: number; tonnage: number }>(SELECT_STRENGTH, WINDOW);

    expect(row).toEqual({ workouts: 1, tonnage: 0 });
  });

  it('exclut les séances hors fenêtre, non terminées ou supprimées', async () => {
    seedWorkout('2026-07-19', [{ reps: 5, weightKg: 100 }]); // veille de la fenêtre
    seedWorkout('2026-07-27', [{ reps: 5, weightKg: 100 }]); // lendemain
    seedWorkout('2026-07-22', [{ reps: 5, weightKg: 100 }], { status: 'active' });
    seedWorkout('2026-07-22', [{ reps: 5, weightKg: 100 }], { deleted: true });

    const [row] = await query<{ workouts: number; tonnage: number }>(SELECT_STRENGTH, WINDOW);

    expect(row).toEqual({ workouts: 0, tonnage: 0 });
  });

  it('exclut du tonnage les séries non validées, d’échauffement, supprimées ou incomplètes', async () => {
    seedWorkout('2026-07-21', [
      { reps: 5, weightKg: 100 }, // seule série comptée
      { reps: 5, weightKg: 100, done: false },
      { reps: 15, weightKg: 40, setType: 'warmup' },
      { reps: 5, weightKg: 100, deleted: true },
      { reps: null, weightKg: 100 },
      { reps: 5, weightKg: null },
    ]);

    const [row] = await query<{ workouts: number; tonnage: number }>(SELECT_STRENGTH, WINDOW);

    expect(row).toEqual({ workouts: 1, tonnage: 500 });
  });
});

describe('SELECT_MUSCLE_SETS', () => {
  beforeEach(() => {
    seed('exercises', [
      { id: 'squat', muscle_primary: 'legs' },
      { id: 'bench', muscle_primary: 'chest' },
      { id: 'row', muscle_primary: 'back' },
    ]);
  });

  it('compte les séries validées par groupe musculaire', async () => {
    seedWorkout('2026-07-21', [
      { exerciseId: 'squat', reps: 5, weightKg: 100 },
      { exerciseId: 'squat', reps: 5, weightKg: 100 },
      { exerciseId: 'bench', reps: 8, weightKg: 60 },
    ]);

    const rows = await query<{ muscle: string; sets: number }>(SELECT_MUSCLE_SETS, WINDOW);

    expect(rows.sort((a, b) => a.muscle.localeCompare(b.muscle))).toEqual([
      { muscle: 'chest', sets: 1 },
      { muscle: 'legs', sets: 2 },
    ]);
  });

  it('compte une série au poids du corps — pas de reps/charge exigés ici', async () => {
    seedWorkout('2026-07-21', [{ exerciseId: 'row', reps: 12, weightKg: null }]);

    const rows = await query<{ muscle: string; sets: number }>(SELECT_MUSCLE_SETS, WINDOW);

    expect(rows).toEqual([{ muscle: 'back', sets: 1 }]);
  });

  it('ignore échauffements, séries non validées et séries supprimées', async () => {
    seedWorkout('2026-07-21', [
      { exerciseId: 'squat', setType: 'warmup', reps: 15, weightKg: 40 },
      { exerciseId: 'squat', reps: 5, weightKg: 100, done: false },
      { exerciseId: 'squat', reps: 5, weightKg: 100, deleted: true },
    ]);

    expect(await query(SELECT_MUSCLE_SETS, WINDOW)).toEqual([]);
  });

  it('ignore une séance non terminée', async () => {
    seedWorkout('2026-07-21', [{ exerciseId: 'squat', reps: 5, weightKg: 100 }], {
      status: 'active',
    });

    expect(await query(SELECT_MUSCLE_SETS, WINDOW)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

describe('SELECT_RUNS', () => {
  it('compte les sorties et somme la distance', async () => {
    seedRun('2026-07-21', 5000);
    seedRun('2026-07-25', 10_000);

    const [row] = await query<{ runs: number; distance: number }>(SELECT_RUNS, WINDOW);

    expect(row).toEqual({ runs: 2, distance: 15_000 });
  });

  it('compte une sortie sans distance sans casser la somme', async () => {
    seedRun('2026-07-21', null);
    seedRun('2026-07-22', 3000);

    const [row] = await query<{ runs: number; distance: number }>(SELECT_RUNS, WINDOW);

    expect(row).toEqual({ runs: 2, distance: 3000 });
  });

  it('exclut les sorties hors fenêtre, actives ou supprimées', async () => {
    seedRun('2026-07-19', 5000);
    seedRun('2026-07-27', 5000);
    seedRun('2026-07-22', 5000, { status: 'active' });
    seedRun('2026-07-22', 5000, { deleted: true });

    const [row] = await query<{ runs: number; distance: number }>(SELECT_RUNS, WINDOW);

    expect(row).toEqual({ runs: 0, distance: 0 });
  });
});

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

describe('SELECT_RECORDS', () => {
  /** Un record battu à la date locale donnée. */
  const seedRecord = (dayKey: string, opts?: { deleted?: boolean }) =>
    seed('personal_records', [
      {
        user_id: 'user-1',
        exercise_id: 'squat',
        type: 'max_weight',
        value: 100,
        achieved_at: localInstant(dayKey),
        ...(opts?.deleted ? { deleted_at: new Date().toISOString() } : {}),
      },
    ]);

  it('compte les records de la fenêtre', async () => {
    seedRecord('2026-07-21');
    seedRecord('2026-07-25');

    expect((await query<{ records: number }>(SELECT_RECORDS, WINDOW))[0]?.records).toBe(2);
  });

  it('exclut ceux d’avant, d’après et les supprimés', async () => {
    seedRecord('2026-07-19');
    seedRecord('2026-07-27');
    seedRecord('2026-07-22', { deleted: true });

    expect((await query<{ records: number }>(SELECT_RECORDS, WINDOW))[0]?.records).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

describe('SELECT_LOGGED_DAYS', () => {
  /** Une entrée de journal alimentaire. */
  const seedEntry = (dayKey: string, kcal: number, opts?: { deleted?: boolean }) =>
    seed('food_entries', [
      {
        user_id: 'user-1',
        log_date: dayKey,
        meal_type: 'lunch',
        order_index: 0,
        name: 'Riz',
        quantity_g: 100,
        kcal,
        ...(opts?.deleted ? { deleted_at: new Date().toISOString() } : {}),
      },
    ]);

  const days = (sql: string) =>
    query<{ log_date: string; kcal: number }>(sql, [PERIOD.start, PERIOD.end]);

  it('agrège les kcal par jour', async () => {
    seedEntry('2026-07-21', 400);
    seedEntry('2026-07-21', 350);
    seedEntry('2026-07-23', 600);

    expect((await days(SELECT_LOGGED_DAYS)).sort((a, b) => a.log_date.localeCompare(b.log_date)))
      .toEqual([
        { log_date: '2026-07-21', kcal: 750 },
        { log_date: '2026-07-23', kcal: 600 },
      ]);
  });

  it('écarte un jour à 0 kcal — saisir un aliment sans calorie n’est pas journaliser', async () => {
    seedEntry('2026-07-21', 0);

    expect(await days(SELECT_LOGGED_DAYS)).toEqual([]);
  });

  it('inclut les deux bornes de la semaine (comparaison sur `log_date`, borne haute INCLUSIVE)', async () => {
    seedEntry('2026-07-20', 500);
    seedEntry('2026-07-26', 500);
    seedEntry('2026-07-19', 500);
    seedEntry('2026-07-27', 500);

    expect((await days(SELECT_LOGGED_DAYS)).map((d) => d.log_date).sort()).toEqual([
      '2026-07-20',
      '2026-07-26',
    ]);
  });

  it('ignore les entrées supprimées, y compris pour le seuil de 0 kcal', async () => {
    seedEntry('2026-07-21', 800, { deleted: true });

    expect(await days(SELECT_LOGGED_DAYS)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Jours actifs et pas
// ---------------------------------------------------------------------------

describe('SELECT_ACTIVITY_DAYS', () => {
  it('réunit séances et sorties dans un seul flux d’instants', async () => {
    seedWorkout('2026-07-21');
    seedRun('2026-07-21', 5000); // même jour : deux lignes, dédoublonnées en JS
    seedRun('2026-07-24', 8000);

    const rows = await query<{ finished_at: string }>(SELECT_ACTIVITY_DAYS, [
      ...WINDOW,
      ...WINDOW,
    ]);

    expect(rows).toHaveLength(3);
  });

  it('ne voit ni les séances actives ni les sorties supprimées', async () => {
    seedWorkout('2026-07-21', [], { status: 'active' });
    seedRun('2026-07-22', 5000, { deleted: true });

    expect(await query(SELECT_ACTIVITY_DAYS, [...WINDOW, ...WINDOW])).toEqual([]);
  });

  it('ne compte PAS un joker de série comme jour actif (STREAK-01, décision D3)', async () => {
    seed('streak_jokers', [{ user_id: 'user-1', log_date: '2026-07-22' }]);

    // Le bilan doit voir la semaine telle qu'elle a été vécue : un joker protège le compteur de
    // série et rien d'autre. Féliciter pour un jour où rien n'a eu lieu serait un bilan qui ment.
    expect(await query(SELECT_ACTIVITY_DAYS, [...WINDOW, ...WINDOW])).toEqual([]);
  });
});

describe('SELECT_STEPS', () => {
  const seedSteps = (dayKey: string, steps: number, opts?: { deleted?: boolean }) =>
    seed('daily_steps', [
      {
        user_id: 'user-1',
        log_date: dayKey,
        steps,
        source: 'health_connect',
        ...(opts?.deleted ? { deleted_at: new Date().toISOString() } : {}),
      },
    ]);

  it('renvoie les pas de la fenêtre, bornes incluses', async () => {
    seedSteps('2026-07-20', 8000);
    seedSteps('2026-07-26', 12_000);
    seedSteps('2026-07-27', 9000);

    const rows = await query<{ log_date: string; steps: number }>(SELECT_STEPS, [
      PERIOD.start,
      PERIOD.end,
    ]);

    expect(rows.map((r) => r.log_date).sort()).toEqual(['2026-07-20', '2026-07-26']);
  });

  it('ignore les jours supprimés', async () => {
    seedSteps('2026-07-21', 10_000, { deleted: true });

    expect(await query(SELECT_STEPS, [PERIOD.start, PERIOD.end])).toEqual([]);
  });
});

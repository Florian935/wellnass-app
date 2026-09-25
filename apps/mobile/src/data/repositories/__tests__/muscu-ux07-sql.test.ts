/**
 * US MUSCU-UX07 — les requêtes du hub en trois onglets, sur du vrai SQLite.
 *
 *  - `SELECT_HISTORY` : une séance libre se reconnaît à ses deux premiers exercices (D9) ;
 *  - `SELECT_EXERCISES_LAST_DONE` : la dernière fois de chaque exercice (R7) ;
 *  - `SELECT_PLANNED_STRENGTH_DAYS` : les jours prévus du calendrier (R5) ;
 *  - `SELECT_SESSION_PREVIEW` : l'aperçu liste exactement ce que Démarrer créera (§4.5).
 */

import { SELECT_PLANNED_STRENGTH_DAYS } from '../planned-session-repository';
import { SELECT_SESSION_PREVIEW } from '../session-preview-repository';
import {
  groupExercisesLastDone,
  SELECT_EXERCISES_LAST_DONE,
  SELECT_HISTORY,
  type ExerciseLastDoneRow,
} from '../workout-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

const USER = 'user-1';

/** Une séance terminée et ses séries validées (charge × reps), dans l'ordre. */
function seedWorkout(
  id: string,
  finishedAt: string,
  sessionId: string | null,
  sets: { exercise: string; weight: number | null; reps: number | null; type?: string; done?: number }[],
) {
  seed('workouts', [
    {
      id,
      user_id: USER,
      session_id: sessionId,
      status: 'completed',
      started_at: finishedAt,
      finished_at: finishedAt,
    },
  ]);
  seed(
    'workout_sets',
    sets.map((s, i) => ({
      id: `${id}-s${i}`,
      workout_id: id,
      user_id: USER,
      exercise_id: s.exercise,
      order_index: i,
      set_type: s.type ?? 'normal',
      weight_kg: s.weight,
      reps: s.reps,
      done: s.done ?? 1,
    })),
  );
}

beforeEach(() => {
  resetTestDb();
  seed('exercises', [
    { id: 'bench', source: 'library' },
    { id: 'squat', source: 'library' },
    { id: 'curl', source: 'library' },
    { id: 'perso', source: 'custom' },
  ]);
  seed('exercise_translations', [
    { id: 't-bench', exercise_id: 'bench', lang: 'fr', name: 'Développé couché' },
    { id: 't-bench-en', exercise_id: 'bench', lang: 'en', name: 'Bench press' },
    { id: 't-squat', exercise_id: 'squat', lang: 'fr', name: 'Squat' },
    { id: 't-curl', exercise_id: 'curl', lang: 'fr', name: 'Curl barre' },
    // Un exercice perso créé en anglais seulement : ni langue courante (fr), ni repli français.
    { id: 't-perso', exercise_id: 'perso', lang: 'en', name: 'Landmine press' },
  ]);
  seed('programs', [{ id: 'prog', owner_id: USER, pillar: 'strength', is_active: 1 }]);
  seed('sessions', [{ id: 'legs', program_id: 'prog', owner_id: USER, name: 'Legs', order_index: 0 }]);
});

// ---------------------------------------------------------------------------
// D9 — une séance libre se reconnaît à ses exercices
// ---------------------------------------------------------------------------

describe('SELECT_HISTORY — deux premiers exercices d’une séance libre (D9)', () => {
  type Row = { id: string; session_name: string | null; first_exercise: string | null; second_exercise: string | null };
  const history = () => testPowerSync.getAll<Row>(SELECT_HISTORY, ['fr', 'fr']);

  it('nomme les deux premiers exercices travaillés, dans l’ordre de la séance', async () => {
    seedWorkout('libre', '2026-09-19T18:30:00Z', null, [
      { exercise: 'curl', weight: 35, reps: 10 },
      { exercise: 'curl', weight: 35, reps: 9 },
      { exercise: 'bench', weight: 60, reps: 10 },
      { exercise: 'squat', weight: 80, reps: 8 },
    ]);

    const [row] = await history();

    expect(row).toMatchObject({ session_name: null, first_exercise: 'Curl barre', second_exercise: 'Développé couché' });
  });

  it('ignore les échauffements et les séries non validées', async () => {
    seedWorkout('libre', '2026-09-19T18:30:00Z', null, [
      { exercise: 'squat', weight: 40, reps: 10, type: 'warmup' },
      { exercise: 'bench', weight: 60, reps: 10, done: 0 },
      { exercise: 'curl', weight: 35, reps: 10 },
    ]);

    const [row] = await history();

    expect(row).toMatchObject({ first_exercise: 'Curl barre', second_exercise: null });
  });

  it('ne calcule rien pour une séance de programme, qui a déjà son nom', async () => {
    seedWorkout('prog-w', '2026-09-22T19:05:00Z', 'legs', [{ exercise: 'squat', weight: 120, reps: 5 }]);

    const [row] = await history();

    expect(row).toMatchObject({ session_name: 'Legs', first_exercise: null, second_exercise: null });
  });
});

// ---------------------------------------------------------------------------
// R7 — la dernière fois, exercice par exercice
// ---------------------------------------------------------------------------

describe('SELECT_EXERCISES_LAST_DONE — R7', () => {
  const lastDone = async () =>
    groupExercisesLastDone(await testPowerSync.getAll<ExerciseLastDoneRow>(SELECT_EXERCISES_LAST_DONE, ['fr']));

  it('ne garde que la dernière séance de chaque exercice, triée de la plus récente à la plus ancienne', async () => {
    seedWorkout('w1', '2026-09-10T18:00:00Z', null, [{ exercise: 'bench', weight: 77.5, reps: 8 }]);
    seedWorkout('w2', '2026-09-17T18:00:00Z', null, [
      { exercise: 'bench', weight: 80, reps: 8 },
      { exercise: 'bench', weight: 80, reps: 6 },
    ]);
    seedWorkout('w3', '2026-09-22T19:00:00Z', 'legs', [{ exercise: 'squat', weight: 120, reps: 5 }]);

    const items = await lastDone();

    expect(items.map((i) => i.exerciseId)).toEqual(['squat', 'bench']);
    expect(items[0]).toMatchObject({ name: 'Squat', sessionName: 'Legs', finishedAt: '2026-09-22T19:00:00Z' });
    expect(items[1]!.sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [80, 8],
      [80, 6],
    ]);
  });

  it('écarte échauffements, séries non validées, séances supprimées ou en cours', async () => {
    seedWorkout('w1', '2026-09-10T18:00:00Z', null, [
      { exercise: 'bench', weight: 40, reps: 10, type: 'warmup' },
      { exercise: 'bench', weight: 80, reps: 8 },
      { exercise: 'bench', weight: 85, reps: 8, done: 0 },
    ]);
    seed('workouts', [
      { id: 'gone', user_id: USER, status: 'completed', started_at: '2026-09-20T18:00:00Z', finished_at: '2026-09-20T18:00:00Z', deleted_at: '2026-09-21T00:00:00Z' },
      { id: 'live', user_id: USER, status: 'active', started_at: '2026-09-24T18:00:00Z', finished_at: null },
    ]);
    seed('workout_sets', [
      { id: 'g1', workout_id: 'gone', user_id: USER, exercise_id: 'bench', order_index: 0, set_type: 'normal', weight_kg: 90, reps: 5, done: 1 },
      { id: 'l1', workout_id: 'live', user_id: USER, exercise_id: 'bench', order_index: 0, set_type: 'normal', weight_kg: 95, reps: 5, done: 1 },
    ]);

    const [bench] = await lastDone();

    expect(bench!.sets.map((s) => s.weightKg)).toEqual([80]);
  });

  it('ramène le record de charge quand il existe', async () => {
    seedWorkout('w1', '2026-09-17T18:00:00Z', null, [{ exercise: 'bench', weight: 80, reps: 8 }]);
    seed('personal_records', [
      { id: 'pr1', user_id: USER, exercise_id: 'bench', type: 'max_weight', value: 82.5, weight_kg: 82.5, reps: 5, achieved_at: '2026-08-01T10:00:00Z' },
      { id: 'pr2', user_id: USER, exercise_id: 'bench', type: 'max_weight', value: 85, weight_kg: 85, reps: 5, achieved_at: '2026-09-01T10:00:00Z' },
      { id: 'pr3', user_id: USER, exercise_id: 'bench', type: 'estimated_1rm', value: 100, weight_kg: 85, reps: 5, achieved_at: '2026-09-01T10:00:00Z' },
    ]);

    const [bench] = await lastDone();

    expect(bench).toMatchObject({ recordKg: 85, recordReps: 5 });
  });

  it('nomme un exercice perso créé dans une autre langue (repli sur toute traduction)', async () => {
    seedWorkout('w1', '2026-09-17T18:00:00Z', null, [{ exercise: 'perso', weight: 30, reps: 10 }]);

    const [perso] = await lastDone();

    expect(perso!.name).toBe('Landmine press');
  });

  it('en anglais, le nom anglais', async () => {
    seedWorkout('w1', '2026-09-17T18:00:00Z', null, [{ exercise: 'bench', weight: 80, reps: 8 }]);

    const rows = await testPowerSync.getAll<ExerciseLastDoneRow>(SELECT_EXERCISES_LAST_DONE, ['en']);

    expect(groupExercisesLastDone(rows)[0]!.name).toBe('Bench press');
  });
});

// ---------------------------------------------------------------------------
// R5 — les jours prévus du calendrier
// ---------------------------------------------------------------------------

describe('SELECT_PLANNED_STRENGTH_DAYS — R5', () => {
  beforeEach(() => {
    seed('programs', [{ id: 'prog-run', owner_id: USER, pillar: 'running', is_active: 1 }]);
    seed('sessions', [{ id: 'run', program_id: 'prog-run', owner_id: USER, name: 'Endurance', order_index: 0 }]);
    seed('planned_sessions', [
      { id: 'p1', program_id: 'prog', session_id: 'legs', owner_id: USER, scheduled_date: '2026-09-26', status: 'planned', week_index: 2 },
      { id: 'p2', program_id: 'prog', session_id: 'legs', owner_id: USER, scheduled_date: '2026-09-28', status: 'skipped', week_index: 2 },
      { id: 'p3', program_id: 'prog', session_id: 'legs', owner_id: USER, scheduled_date: '2026-09-30', status: 'done', week_index: 2 },
      { id: 'p4', program_id: 'prog-run', session_id: 'run', owner_id: USER, scheduled_date: '2026-09-27', status: 'planned', week_index: 0 },
      { id: 'p5', program_id: 'prog', session_id: 'legs', owner_id: USER, scheduled_date: '2026-10-01', status: 'planned', week_index: 3 },
      { id: 'p6', program_id: 'prog', session_id: 'legs', owner_id: 'user-2', scheduled_date: '2026-09-25', status: 'planned', week_index: 0 },
    ]);
  });

  it('muscu, statut « prévu », dans les bornes, pour l’utilisateur seulement', async () => {
    const rows = await testPowerSync.getAll<{ scheduled_date: string }>(SELECT_PLANNED_STRENGTH_DAYS, [
      USER,
      '2026-09-24',
      '2026-09-30',
    ]);

    expect(rows.map((r) => r.scheduled_date)).toEqual(['2026-09-26']);
  });

  it('bornes incluses', async () => {
    const rows = await testPowerSync.getAll<{ scheduled_date: string }>(SELECT_PLANNED_STRENGTH_DAYS, [
      USER,
      '2026-09-26',
      '2026-10-01',
    ]);

    expect(rows.map((r) => r.scheduled_date)).toEqual(['2026-09-26', '2026-10-01']);
  });
});

// ---------------------------------------------------------------------------
// §4.5 — l'aperçu liste ce que Démarrer créera
// ---------------------------------------------------------------------------

describe('SELECT_SESSION_PREVIEW — §4.5', () => {
  type Row = {
    exercise_id: string;
    exercise_name: string | null;
    target_sets: number | null;
    target_reps: string | null;
    target_weight_kg: number | null;
  };

  beforeEach(() => {
    seed('exercise_plans', [
      { id: 'ep2', session_id: 'legs', owner_id: USER, exercise_id: 'bench', order_index: 1, target_sets: 3, target_reps: 'AMRAP' },
      { id: 'ep1', session_id: 'legs', owner_id: USER, exercise_id: 'squat', order_index: 0, target_sets: 4, target_reps: '6-8', target_weight_kg: 100 },
      { id: 'ep3', session_id: 'legs', owner_id: USER, exercise_id: 'curl', order_index: 2, target_sets: null, target_reps: null },
      { id: 'ep4', session_id: 'legs', owner_id: USER, exercise_id: 'perso', order_index: 3, target_sets: 2, deleted_at: '2026-09-01T00:00:00Z' },
    ]);
  });

  it('tous les exercices planifiés, dans l’ordre du plan, avec leurs objectifs', async () => {
    const rows = await testPowerSync.getAll<Row>(SELECT_SESSION_PREVIEW, ['fr', 'legs']);

    expect(rows.map((r) => r.exercise_id)).toEqual(['squat', 'bench', 'curl']);
    expect(rows[0]).toMatchObject({ exercise_name: 'Squat', target_sets: 4, target_reps: '6-8', target_weight_kg: 100 });
    expect(rows[1]!.target_reps).toBe('AMRAP');
  });

  it('garde un exercice archivé du catalogue : Démarrer le créera', async () => {
    seed('exercises', [{ id: 'old', source: 'library', deleted_at: '2026-09-01T00:00:00Z' }]);
    seed('exercise_translations', [{ id: 't-old', exercise_id: 'old', lang: 'fr', name: 'Pull-over' }]);
    seed('exercise_plans', [
      { id: 'ep5', session_id: 'legs', owner_id: USER, exercise_id: 'old', order_index: 4, target_sets: 2 },
    ]);

    const rows = await testPowerSync.getAll<Row>(SELECT_SESSION_PREVIEW, ['fr', 'legs']);

    expect(rows.map((r) => r.exercise_name)).toContain('Pull-over');
  });
});

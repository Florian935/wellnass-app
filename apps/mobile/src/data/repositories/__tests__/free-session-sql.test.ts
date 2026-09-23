/**
 * La séance libre, repensée — 1ʳᵉ passe de recette de MUSCU-FIX02 (23/09/2026), sur du vrai SQLite.
 *
 * « Séance libre » créait une séance **vide** au premier appui : chrono lancé, écran noir, et un
 * « ajoute un exercice » pour tout programme (Florian : « pas intuitif, pas fluide »). On choisit
 * désormais **quoi faire** d'abord ; la séance ne naît qu'à ce moment-là, déjà remplie. Deux
 * nouveaux points d'entrée :
 *
 *  - `startWorkoutWithExercises` — composer sa séance en choisissant ses exercices ;
 *  - `startWorkoutFromWorkout` — refaire une séance récente, à l'identique.
 */

import { startWorkoutFromWorkout, startWorkoutWithExercises } from '../workout-repository';
import { getTestDb, resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));
jest.mock('@/lib/analytics', () => ({
  ANALYTICS_EVENTS: { workoutStarted: 'workout_started', workoutCompleted: 'workout_completed' },
  track: jest.fn(async () => undefined),
}));
jest.mock('@/lib/health-connect', () => ({ pushWorkout: jest.fn(async () => undefined) }));

type SetRow = {
  workout_id: string;
  exercise_id: string;
  order_index: number;
  set_type: string;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  done: number;
  planned_weight_kg: number | null;
  deleted_at: string | null;
};
type WorkoutRow = {
  id: string;
  status: string;
  session_id: string | null;
  program_id: string | null;
  planned_session_id: string | null;
};

const setsOf = (workoutId: string) =>
  rowsOf<SetRow>('workout_sets')
    .filter((s) => s.workout_id === workoutId && s.deleted_at === null)
    .sort((a, b) => a.order_index - b.order_index);
const workoutOf = (id: string) => rowsOf<WorkoutRow>('workouts').find((w) => w.id === id);

/** Une séance terminée, avec ses séries. */
function past(
  id: string,
  finishedAt: string,
  sets: { exercise: string; type?: string; reps?: number; weight?: number; done?: 0 | 1 }[],
  extra: Record<string, unknown> = {},
) {
  seed('workouts', [
    { id, user_id: 'user-1', status: 'completed', started_at: finishedAt, finished_at: finishedAt, ...extra },
  ]);
  seed(
    'workout_sets',
    sets.map((set, index) => ({
      workout_id: id,
      user_id: 'user-1',
      exercise_id: set.exercise,
      order_index: index,
      set_type: set.type ?? 'normal',
      reps: set.reps ?? 8,
      weight_kg: set.weight ?? 60,
      done: set.done ?? 1,
    })),
  );
}

beforeEach(() => {
  resetTestDb();
});

// ---------------------------------------------------------------------------
// Composer sa séance
// ---------------------------------------------------------------------------

describe('startWorkoutWithExercises', () => {
  it('crée une séance libre déjà remplie, dans l’ordre choisi', async () => {
    const id = await startWorkoutWithExercises(['curl', 'squat']);

    expect(workoutOf(id)).toMatchObject({ status: 'active', session_id: null, program_id: null });
    const order = [...new Set(setsOf(id).map((s) => s.exercise_id))];
    expect(order).toEqual(['curl', 'squat']);
    // Un `order_index` continu sur toute la séance : l'écran regroupe par première apparition.
    expect(setsOf(id).map((s) => s.order_index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('reprend le nombre de séries de la dernière fois — valeurs laissées au pré-remplissage', async () => {
    // Trois séries de travail la dernière fois (l'échauffement et la série ratée ne comptent pas).
    past('w-old', '2026-09-01T10:00:00.000Z', [
      { exercise: 'squat', type: 'warmup' },
      { exercise: 'squat' },
      { exercise: 'squat' },
      { exercise: 'squat' },
      { exercise: 'squat', done: 0 },
    ]);

    const id = await startWorkoutWithExercises(['squat']);

    const sets = setsOf(id);
    expect(sets).toHaveLength(3);
    // Rien d'écrit en dur : l'écran de séance pré-remplit depuis la dernière performance.
    expect(sets.every((s) => s.reps === null && s.weight_kg === null && s.done === 0)).toBe(true);
    expect(sets.every((s) => s.set_type === 'normal')).toBe(true);
  });

  it('un exercice jamais fait part sur trois séries', async () => {
    const id = await startWorkoutWithExercises(['nouveau']);

    expect(setsOf(id)).toHaveLength(3);
  });

  it('ignore un exercice choisi deux fois', async () => {
    const id = await startWorkoutWithExercises(['curl', 'curl']);

    expect([...new Set(setsOf(id).map((s) => s.exercise_id))]).toEqual(['curl']);
    expect(setsOf(id)).toHaveLength(3);
  });

  it('🔴 ne crée RIEN sans exercice — c’est tout le propos du nouveau parcours', async () => {
    await expect(startWorkoutWithExercises([])).rejects.toThrow();

    expect(rowsOf('workouts')).toHaveLength(0);
  });

  it('rend la main sur une séance déjà active, sans y toucher', async () => {
    seed('workouts', [{ id: 'w-live', user_id: 'user-1', status: 'active', started_at: '2026-09-23T10:00:00.000Z' }]);

    expect(await startWorkoutWithExercises(['curl'])).toBe('w-live');
    expect(setsOf('w-live')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Refaire une séance
// ---------------------------------------------------------------------------

describe('startWorkoutFromWorkout', () => {
  it('rejoue la séance à l’identique : exercices, ordre, types, charges — rien de validé', async () => {
    past('w-src', '2026-09-20T10:00:00.000Z', [
      { exercise: 'bench', type: 'warmup', reps: 12, weight: 40 },
      { exercise: 'bench', reps: 8, weight: 80 },
      { exercise: 'row', reps: 10, weight: 70, done: 0 },
    ]);

    const id = await startWorkoutFromWorkout('w-src');

    expect(id).not.toBe('w-src');
    expect(
      setsOf(id).map((s) => [s.exercise_id, s.order_index, s.set_type, s.reps, s.weight_kg, s.done]),
    ).toEqual([
      ['bench', 0, 'warmup', 12, 40, 0],
      ['bench', 1, 'normal', 8, 80, 0],
      ['row', 2, 'normal', 10, 70, 0],
    ]);
  });

  it('crée une séance LIBRE : ni programme, ni occurrence planifiée', async () => {
    past('w-src', '2026-09-20T10:00:00.000Z', [{ exercise: 'bench' }], {
      session_id: 's1',
      program_id: 'p1',
      planned_session_id: 'ps1',
    });

    const id = await startWorkoutFromWorkout('w-src');

    // La rejouer ne doit ni compter dans l'exécution du programme, ni cocher le planning.
    expect(workoutOf(id)).toMatchObject({
      status: 'active',
      session_id: null,
      program_id: null,
      planned_session_id: null,
    });
  });

  it('laisse de côté les séries supprimées de la séance d’origine', async () => {
    past('w-src', '2026-09-20T10:00:00.000Z', [{ exercise: 'bench' }, { exercise: 'row' }]);
    const gone = rowsOf<SetRow & { id: string }>('workout_sets').find((s) => s.exercise_id === 'row');
    getTestDb()
      .prepare(`UPDATE workout_sets SET deleted_at = '2026-09-21T00:00:00.000Z' WHERE id = ?`)
      .run(gone!.id);

    const id = await startWorkoutFromWorkout('w-src');

    expect(setsOf(id).map((s) => s.exercise_id)).toEqual(['bench']);
  });

  it('refuse une séance introuvable, et n’écrit rien', async () => {
    await expect(startWorkoutFromWorkout('inconnue')).rejects.toThrow();

    expect(rowsOf('workouts')).toHaveLength(0);
  });

  it('rend la main sur une séance déjà active', async () => {
    past('w-src', '2026-09-20T10:00:00.000Z', [{ exercise: 'bench' }]);
    seed('workouts', [{ id: 'w-live', user_id: 'user-1', status: 'active', started_at: '2026-09-23T10:00:00.000Z' }]);

    expect(await startWorkoutFromWorkout('w-src')).toBe('w-live');
    expect(setsOf('w-live')).toHaveLength(0);
  });
});

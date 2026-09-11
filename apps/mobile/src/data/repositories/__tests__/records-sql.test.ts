/**
 * Records personnels — `evaluateWorkoutRecords`, exécuté sur **du vrai SQLite**.
 *
 * Lot 1 de [strategie-tests.md](../../../../../../docs/specs/technical/strategie-tests.md).
 * Un record est un **fait daté et définitif** : une fausse insertion pollue l'historique de façon
 * permanente et n'est pas rattrapable côté UI. Vérifier ça en recette suppose d'enchaîner
 * plusieurs séances réelles pour voir si un record se déclenche à tort — ici c'est immédiat.
 *
 * Deux propriétés portent tout le reste, et sont des requêtes SQL, pas de la logique pure :
 *  - la comparaison au meilleur record **existant** (`MAX(value)` par exercice × type), qui doit
 *    ignorer les records supprimés et ceux d'un autre utilisateur ;
 *  - la résolution du libellé d'exercice, qui doit **survivre à l'archivage** de l'exercice au
 *    catalogue (US ADMIN-01) — un record garde son nom même si l'exercice disparaît.
 *
 * La sélection des candidats (`computeWorkoutRecords` : séries validées, hors échauffement, hors
 * durée) est testée dans `@wellness/shared` ; on vérifie ici son câblage à la base.
 */

import { evaluateWorkoutRecords, SELECT_PREVIOUS_SETS } from '../records-repository';
import { resetTestDb, rowsOf, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

jest.mock('@/lib/analytics', () => ({
  ANALYTICS_EVENTS: {},
  track: jest.fn(async () => undefined),
}));
jest.mock('@/lib/health-connect', () => ({
  pushWorkout: jest.fn(async () => undefined),
}));

type RecordRow = {
  id: string;
  user_id: string;
  exercise_id: string;
  type: string;
  value: number;
  reps: number | null;
  weight_kg: number | null;
  workout_id: string | null;
  achieved_at: string;
};

const records = (includeDeleted = false) => rowsOf<RecordRow>('personal_records', includeDeleted);

/** Records d'un type donné, du plus ancien au plus récent. */
const recordsOfType = (type: string) =>
  records()
    .filter((r) => r.type === type)
    .sort((a, b) => a.achieved_at.localeCompare(b.achieved_at));

/** Une séance terminée contenant les séries fournies. */
function seedWorkout(
  sets: {
    exerciseId?: string;
    reps?: number | null;
    weightKg?: number | null;
    setType?: string;
    done?: boolean;
  }[],
): string {
  const [workoutId] = seed('workouts', [
    { user_id: 'user-1', status: 'completed', started_at: new Date().toISOString() },
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
    })),
  );
  return workoutId!;
}

/** Un exercice au catalogue, avec son libellé FR (et EN si fourni). */
function seedExercise(id: string, nameFr: string, opts?: { archived?: boolean }): void {
  seed('exercises', [
    { id, ...(opts?.archived ? { deleted_at: new Date().toISOString() } : {}) },
  ]);
  seed('exercise_translations', [{ exercise_id: id, lang: 'fr', name: nameFr }]);
}

beforeEach(() => {
  resetTestDb();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Premier record
// ---------------------------------------------------------------------------

describe('premier record sur un exercice', () => {
  it('insère un record par type et les retourne avec le libellé résolu', async () => {
    seedExercise('squat', 'Squat barre');
    const workoutId = seedWorkout([{ reps: 5, weightKg: 100 }]);

    const beaten = await evaluateWorkoutRecords(workoutId);

    // max_weight, estimated_1rm, best_volume : trois types pour une même série validée.
    expect(beaten.map((b) => b.type).sort()).toEqual([
      'best_volume',
      'estimated_1rm',
      'max_weight',
    ]);
    expect(beaten.every((b) => b.exerciseName === 'Squat barre')).toBe(true);
    expect(records()).toHaveLength(3);
  });

  it('rattache chaque record à sa séance et à son propriétaire', async () => {
    seedExercise('squat', 'Squat barre');
    const workoutId = seedWorkout([{ reps: 5, weightKg: 100 }]);

    await evaluateWorkoutRecords(workoutId);

    expect(records().every((r) => r.workout_id === workoutId)).toBe(true);
    expect(records().every((r) => r.user_id === 'user-1')).toBe(true);
  });

  it('conserve reps et charge de la série qui a produit la valeur', async () => {
    seedExercise('squat', 'Squat barre');
    const workoutId = seedWorkout([
      { reps: 10, weightKg: 80 },
      { reps: 3, weightKg: 120 },
    ]);

    await evaluateWorkoutRecords(workoutId);

    const maxWeight = recordsOfType('max_weight')[0];
    expect(maxWeight).toMatchObject({ value: 120, reps: 3, weight_kg: 120 });
  });

  it('n’insère rien quand aucune série n’est éligible', async () => {
    seedExercise('squat', 'Squat barre');
    const workoutId = seedWorkout([
      { reps: 15, weightKg: 20, setType: 'warmup' }, // échauffement
      { reps: 8, weightKg: 60, done: false }, // non validée
    ]);

    expect(await evaluateWorkoutRecords(workoutId)).toEqual([]);
    expect(records()).toHaveLength(0);
  });

  it('n’insère rien pour une séance vide', async () => {
    const workoutId = seedWorkout([]);

    expect(await evaluateWorkoutRecords(workoutId)).toEqual([]);
    expect(records()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Comparaison au record existant
// ---------------------------------------------------------------------------

describe('comparaison au meilleur record existant', () => {
  /** Un record déjà en base pour l'exercice `squat`. */
  function seedExistingRecord(
    type: string,
    value: number,
    opts?: { userId?: string; deleted?: boolean },
  ): void {
    seed('personal_records', [
      {
        user_id: opts?.userId ?? 'user-1',
        exercise_id: 'squat',
        type,
        value,
        reps: 5,
        weight_kg: value,
        workout_id: 'ancienne-seance',
        achieved_at: '2020-01-01T00:00:00.000Z',
        ...(opts?.deleted ? { deleted_at: new Date().toISOString() } : {}),
      },
    ]);
  }

  it('insère quand la valeur est strictement supérieure', async () => {
    seedExercise('squat', 'Squat barre');
    seedExistingRecord('max_weight', 100);
    const workoutId = seedWorkout([{ reps: 5, weightKg: 105 }]);

    const beaten = await evaluateWorkoutRecords(workoutId);

    expect(beaten.find((b) => b.type === 'max_weight')?.value).toBe(105);
    expect(recordsOfType('max_weight')).toHaveLength(2);
  });

  it('n’insère rien à valeur égale — égaler n’est pas battre', async () => {
    seedExercise('squat', 'Squat barre');
    seedExistingRecord('max_weight', 100);
    const workoutId = seedWorkout([{ weightKg: 100 }]);

    const beaten = await evaluateWorkoutRecords(workoutId);

    expect(beaten.find((b) => b.type === 'max_weight')).toBeUndefined();
    expect(recordsOfType('max_weight')).toHaveLength(1);
  });

  it('n’insère rien en dessous du record', async () => {
    seedExercise('squat', 'Squat barre');
    seedExistingRecord('max_weight', 100);
    const workoutId = seedWorkout([{ weightKg: 90 }]);

    expect((await evaluateWorkoutRecords(workoutId)).find((b) => b.type === 'max_weight'))
      .toBeUndefined();
    expect(recordsOfType('max_weight')).toHaveLength(1);
  });

  it('compare au MEILLEUR record, pas au plus récent', async () => {
    seedExercise('squat', 'Squat barre');
    seedExistingRecord('max_weight', 140);
    seedExistingRecord('max_weight', 120); // plus récent mais inférieur
    const workoutId = seedWorkout([{ weightKg: 130 }]);

    await evaluateWorkoutRecords(workoutId);

    expect(recordsOfType('max_weight')).toHaveLength(2);
  });

  it('ignore un record supprimé', async () => {
    seedExercise('squat', 'Squat barre');
    seedExistingRecord('max_weight', 200, { deleted: true });
    const workoutId = seedWorkout([{ weightKg: 100 }]);

    await evaluateWorkoutRecords(workoutId);

    expect(recordsOfType('max_weight')).toHaveLength(1);
  });

  it('ignore le record d’un autre utilisateur', async () => {
    seedExercise('squat', 'Squat barre');
    seedExistingRecord('max_weight', 200, { userId: 'user-2' });
    const workoutId = seedWorkout([{ weightKg: 100 }]);

    await evaluateWorkoutRecords(workoutId);

    expect(recordsOfType('max_weight').filter((r) => r.user_id === 'user-1')).toHaveLength(1);
  });

  it('ne compare pas un exercice à un autre', async () => {
    seedExercise('squat', 'Squat barre');
    seedExercise('bench', 'Développé couché');
    seedExistingRecord('max_weight', 200); // sur le squat
    const workoutId = seedWorkout([{ exerciseId: 'bench', weightKg: 60 }]);

    await evaluateWorkoutRecords(workoutId);

    expect(records().filter((r) => r.exercise_id === 'bench')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Libellé et robustesse
// ---------------------------------------------------------------------------

describe('résolution du libellé', () => {
  it('garde le nom d’un exercice archivé — un record est un fait passé (US ADMIN-01)', async () => {
    seedExercise('squat', 'Squat barre', { archived: true });
    const workoutId = seedWorkout([{ reps: 5, weightKg: 100 }]);

    const beaten = await evaluateWorkoutRecords(workoutId);

    expect(beaten.every((b) => b.exerciseName === 'Squat barre')).toBe(true);
  });

  it('n’échoue pas sur un exercice absent du catalogue — le record reste enregistré', async () => {
    const workoutId = seedWorkout([{ reps: 5, weightKg: 100 }]);

    const beaten = await evaluateWorkoutRecords(workoutId);

    expect(beaten.every((b) => b.exerciseName === '')).toBe(true);
    expect(records()).toHaveLength(3);
  });
});

describe('plusieurs exercices dans la même séance', () => {
  it('évalue chaque exercice indépendamment', async () => {
    seedExercise('squat', 'Squat barre');
    seedExercise('bench', 'Développé couché');
    const workoutId = seedWorkout([
      { exerciseId: 'squat', reps: 5, weightKg: 100 },
      { exerciseId: 'bench', reps: 8, weightKg: 60 },
    ]);

    await evaluateWorkoutRecords(workoutId);

    expect(records().filter((r) => r.exercise_id === 'squat')).toHaveLength(3);
    expect(records().filter((r) => r.exercise_id === 'bench')).toHaveLength(3);
  });

  it('horodate tous les records d’une même évaluation à l’identique', async () => {
    seedExercise('squat', 'Squat barre');
    seedExercise('bench', 'Développé couché');
    const workoutId = seedWorkout([
      { exerciseId: 'squat', reps: 5, weightKg: 100 },
      { exerciseId: 'bench', reps: 8, weightKg: 60 },
    ]);

    await evaluateWorkoutRecords(workoutId);

    expect(new Set(records().map((r) => r.achieved_at)).size).toBe(1);
  });
});

describe('ré-évaluation de la même séance', () => {
  it('est idempotente : rejouer l’évaluation ne crée pas de doublon', async () => {
    seedExercise('squat', 'Squat barre');
    const workoutId = seedWorkout([{ reps: 5, weightKg: 100 }]);
    await evaluateWorkoutRecords(workoutId);

    const beaten = await evaluateWorkoutRecords(workoutId);

    // Les valeurs ne sont plus strictement supérieures à celles insérées au 1er passage.
    expect(beaten).toEqual([]);
    expect(records()).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Écart depuis la fois d'avant — recette MUSCU-UX01 §57.36 (11/09/2026)
// ---------------------------------------------------------------------------

/**
 * `SELECT_PREVIOUS_SETS` filtrait `w2.owner_id`. `workouts` porte `user_id` : la requête levait à
 * chaque ouverture du résumé, `useQuery` avalait l'erreur, et `useExerciseDeltas` rendait une carte
 * **toujours vide**. Aucun « ▲ +2,5 kg » n'a donc jamais pu s'afficher — pas même sur une séance
 * qui battait deux records le même soir, ce qui est exactement ce qu'a vu la recette.
 */
describe('SELECT_PREVIOUS_SETS — la référence de l’exercice', () => {
  const previousSets = (workoutId: string) =>
    testPowerSync.getAll<{ exercise_id: string; reps: number; weight_kg: number }>(
      SELECT_PREVIOUS_SETS,
      [workoutId, 'user-1', workoutId],
    );

  /** Une séance terminée, datée, pour maîtriser l'ordre chronologique. */
  function seedDatedWorkout(
    startedAt: string,
    sets: { exerciseId?: string; reps: number; weightKg: number; done?: boolean }[],
    opts: { userId?: string; status?: string } = {},
  ): string {
    const [workoutId] = seed('workouts', [
      {
        user_id: opts.userId ?? 'user-1',
        status: opts.status ?? 'completed',
        started_at: startedAt,
      },
    ]);
    seed(
      'workout_sets',
      sets.map((s, i) => ({
        workout_id: workoutId,
        user_id: opts.userId ?? 'user-1',
        exercise_id: s.exerciseId ?? 'squat',
        order_index: i,
        set_type: 'normal',
        reps: s.reps,
        weight_kg: s.weightKg,
        done: s.done === false ? 0 : 1,
      })),
    );
    return workoutId!;
  }

  it('ramène les séries du passage précédent sur le même exercice', async () => {
    seedDatedWorkout('2026-09-04T18:00:00Z', [{ reps: 5, weightKg: 60 }]);
    const current = seedDatedWorkout('2026-09-11T21:00:00Z', [{ reps: 8, weightKg: 80 }]);

    const rows = await previousSets(current);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.weight_kg).toBe(60);
    expect(rows[0]!.reps).toBe(5);
  });

  it('ne ramène rien pour un premier passage — pas de référence, donc pas de « = »', async () => {
    const current = seedDatedWorkout('2026-09-11T21:00:00Z', [{ reps: 8, weightKg: 80 }]);

    expect(await previousSets(current)).toEqual([]);
  });

  it('prend la référence exercice par exercice, pas « la séance d’avant »', async () => {
    seedDatedWorkout('2026-09-01T18:00:00Z', [{ exerciseId: 'bench', reps: 8, weightKg: 70 }]);
    seedDatedWorkout('2026-09-04T18:00:00Z', [{ exerciseId: 'squat', reps: 5, weightKg: 100 }]);
    const current = seedDatedWorkout('2026-09-11T21:00:00Z', [
      { exerciseId: 'squat', reps: 5, weightKg: 105 },
      { exerciseId: 'bench', reps: 8, weightKg: 75 },
    ]);

    const rows = await previousSets(current);

    expect(rows.map((r) => [r.exercise_id, r.weight_kg])).toEqual(
      expect.arrayContaining([
        ['squat', 100],
        ['bench', 70],
      ]),
    );
  });

  it('ignore les séances d’un autre utilisateur', async () => {
    seedDatedWorkout('2026-09-04T18:00:00Z', [{ reps: 5, weightKg: 60 }], { userId: 'user-2' });
    const current = seedDatedWorkout('2026-09-11T21:00:00Z', [{ reps: 8, weightKg: 80 }]);

    expect(await previousSets(current)).toEqual([]);
  });

  it('ignore une séance non terminée', async () => {
    seedDatedWorkout('2026-09-04T18:00:00Z', [{ reps: 5, weightKg: 60 }], { status: 'in_progress' });
    const current = seedDatedWorkout('2026-09-11T21:00:00Z', [{ reps: 8, weightKg: 80 }]);

    expect(await previousSets(current)).toEqual([]);
  });
});

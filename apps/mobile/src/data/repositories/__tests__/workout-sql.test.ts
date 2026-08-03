/**
 * Pilier Musculation — écritures de `workout-repository`, exécutées sur **du vrai SQLite**.
 *
 * Lot 1 de [strategie-tests.md](../../../../../../docs/specs/technical/strategie-tests.md) :
 * ce repository (1 187 lignes) est le cœur du pilier muscu et sous-tend une bonne partie des US
 * en recette. Ce qui est vérifié ici sortait jusqu'à présent du seul test device : au plus une
 * séance active, séries pré-remplies depuis un programme, idempotence de la clôture, ordre des
 * exercices renuméroté, remplacement qui n'écrase pas l'historique, unicité des paires superset.
 *
 * Les **règles pures** (`isWorkoutStale`, `computeReorderedExerciseOrder`) restent testées dans
 * `@wellness/shared` ; on ne les rejoue pas, on vérifie qu'elles sont **bien câblées à la base**.
 */

import {
  addExerciseToWorkout,
  addSet,
  autoCloseStaleWorkout,
  cancelWorkout,
  finishWorkout,
  linkSupersetPair,
  parseTargetReps,
  removeSet,
  reorderExercise,
  replaceExercise,
  sendExerciseToEnd,
  setExerciseNote,
  setWorkoutFeedback,
  startWorkout,
  startWorkoutFromSession,
  unlinkSupersetPair,
  updateSet,
} from '../workout-repository';
import { resetTestDb, rowsOf, seed, testPowerSync } from '@/test-utils/sqlite-harness';

// Branche le repository sur la base en mémoire (remplace le mock global de jest.setup.ts).
jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

// Effets de bord « fire-and-forget » de la clôture : hors périmètre de ce fichier, et
// `pushWorkout` toucherait un module natif Android.
jest.mock('@/lib/analytics', () => ({
  ANALYTICS_EVENTS: { workoutStarted: 'workout_started', workoutCompleted: 'workout_completed' },
  track: jest.fn(async () => undefined),
}));
jest.mock('@/lib/health-connect', () => ({
  pushWorkout: jest.fn(async () => undefined),
}));

// ---------------------------------------------------------------------------
// Aides
// ---------------------------------------------------------------------------

type SetRow = {
  id: string;
  workout_id: string;
  exercise_id: string;
  order_index: number;
  set_type: string;
  reps: number | null;
  weight_kg: number | null;
  planned_weight_kg: number | null;
  done: number;
};

type WorkoutRow = {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  rpe: number | null;
  notes: string | null;
  session_id: string | null;
  program_id: string | null;
  planned_session_id: string | null;
};

/** Séries d'une séance, dans l'ordre affiché. */
function setsOf(workoutId: string): SetRow[] {
  return rowsOf<SetRow>('workout_sets')
    .filter((s) => s.workout_id === workoutId)
    .sort((a, b) => a.order_index - b.order_index);
}

/** Ordre des exercices tel que l'UI le dérive : première apparition par `order_index`. */
function exerciseOrder(workoutId: string): string[] {
  const seen: string[] = [];
  for (const s of setsOf(workoutId)) if (!seen.includes(s.exercise_id)) seen.push(s.exercise_id);
  return seen;
}

const workout = (id: string) => rowsOf<WorkoutRow>('workouts').find((w) => w.id === id);

beforeEach(() => {
  resetTestDb();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------

describe('startWorkout', () => {
  it('crée une séance active vide', async () => {
    const id = await startWorkout();

    expect(workout(id)).toMatchObject({ status: 'active', finished_at: null, session_id: null });
    expect(setsOf(id)).toHaveLength(0);
  });

  it('n’en crée jamais une seconde : rend la main sur la séance active existante', async () => {
    const first = await startWorkout();
    const second = await startWorkout();

    expect(second).toBe(first);
    expect(rowsOf('workouts')).toHaveLength(1);
  });

  it('en crée une nouvelle après clôture de la précédente', async () => {
    const first = await startWorkout();
    await finishWorkout(first);

    const second = await startWorkout();

    expect(second).not.toBe(first);
    expect(rowsOf('workouts')).toHaveLength(2);
  });

  it('ignore une séance active supprimée (soft delete)', async () => {
    const first = await startWorkout();
    await cancelWorkout(first);

    expect(await startWorkout()).not.toBe(first);
  });
});

describe('parseTargetReps', () => {
  it.each([
    ['8-12', 8],
    ['10', 10],
    ['AMRAP', null],
    [null, null],
    ['', null],
  ])('« %s » → %s', (input, expected) => {
    expect(parseTargetReps(input)).toBe(expected);
  });
});

describe('startWorkoutFromSession', () => {
  /** Un programme d'une séance, avec deux exercices planifiés. */
  function seedProgram(): { sessionId: string } {
    const [programId] = seed('programs', [{ owner_id: 'user-1', is_active: 1 }]);
    const [sessionId] = seed('sessions', [
      { program_id: programId, owner_id: 'user-1', order_index: 0 },
    ]);
    seed('exercise_plans', [
      {
        session_id: sessionId,
        owner_id: 'user-1',
        exercise_id: 'squat',
        order_index: 0,
        set_type: 'normal',
        target_sets: 3,
        target_reps: '8-12',
        target_weight_kg: 60,
      },
      {
        session_id: sessionId,
        owner_id: 'user-1',
        exercise_id: 'bench',
        order_index: 1,
        set_type: 'normal',
        target_sets: null,
        target_reps: '10',
        target_weight_kg: null,
      },
    ]);
    return { sessionId: sessionId! };
  }

  it('pré-remplit les séries depuis le plan, dans l’ordre, avec un order_index continu', async () => {
    const { sessionId } = seedProgram();

    const id = await startWorkoutFromSession(sessionId);

    const sets = setsOf(id);
    // 3 séries pour le squat (target_sets), 1 pour le développé (max(1, null)).
    expect(sets).toHaveLength(4);
    expect(sets.map((s) => s.exercise_id)).toEqual(['squat', 'squat', 'squat', 'bench']);
    expect(sets.map((s) => s.order_index)).toEqual([0, 1, 2, 3]);
    expect(sets[0]).toMatchObject({
      reps: 8, // « 8-12 » → 8
      weight_kg: 60,
      planned_weight_kg: 60, // la charge cible est conservée à part, pour la comparaison
      done: 0,
    });
    expect(sets[3]).toMatchObject({ reps: 10, weight_kg: null });
  });

  it('rattache la séance au programme et à l’occurrence planifiée', async () => {
    const { sessionId } = seedProgram();
    const [plannedId] = seed('planned_sessions', [
      { owner_id: 'user-1', session_id: sessionId, scheduled_date: '2026-08-03', status: 'planned' },
    ]);

    const id = await startWorkoutFromSession(sessionId, { plannedSessionId: plannedId });

    expect(workout(id)).toMatchObject({ session_id: sessionId, planned_session_id: plannedId });
    expect(workout(id)?.program_id).not.toBeNull();
  });

  it('laisse la base intacte si la séance de programme est introuvable', async () => {
    await expect(startWorkoutFromSession('inconnue')).rejects.toThrow(/introuvable/);

    // La transaction a été annulée : ni séance, ni séries orphelines.
    expect(rowsOf('workouts')).toHaveLength(0);
    expect(rowsOf('workout_sets')).toHaveLength(0);
  });

  it('rend la main sur la séance active existante sans dupliquer les séries', async () => {
    const { sessionId } = seedProgram();
    const first = await startWorkout();

    const second = await startWorkoutFromSession(sessionId);

    expect(second).toBe(first);
    expect(rowsOf('workout_sets')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Séries
// ---------------------------------------------------------------------------

describe('addExerciseToWorkout / addSet', () => {
  it('ajoute l’exercice avec une première série neutre en fin de séance', async () => {
    const id = await startWorkout();

    await addExerciseToWorkout(id, 'squat');

    expect(setsOf(id)).toHaveLength(1);
    expect(setsOf(id)[0]).toMatchObject({
      exercise_id: 'squat',
      order_index: 0,
      set_type: 'normal',
      reps: null,
      weight_kg: null,
      done: 0,
    });
  });

  it('hérite reps / poids / type de la dernière série de l’exercice', async () => {
    const id = await startWorkout();
    await addExerciseToWorkout(id, 'squat');
    await updateSet(setsOf(id)[0]!.id, { reps: 10, weightKg: 80, done: true });

    await addSet(id, 'squat');

    expect(setsOf(id)[1]).toMatchObject({ reps: 10, weight_kg: 80, set_type: 'normal', done: 0 });
  });

  it('repart à zéro après un échauffement — une charge d’échauffement n’est pas un point de départ', async () => {
    const id = await startWorkout();
    await addExerciseToWorkout(id, 'squat');
    await updateSet(setsOf(id)[0]!.id, { reps: 15, weightKg: 20, setType: 'warmup' });

    await addSet(id, 'squat');

    expect(setsOf(id)[1]).toMatchObject({ set_type: 'normal', reps: null, weight_kg: null });
  });

  it('réutilise l’index libéré par une suppression — la numérotation reste dense', async () => {
    const id = await startWorkout();
    await addExerciseToWorkout(id, 'squat');
    await addSet(id, 'squat');
    await removeSet(setsOf(id)[1]!.id);

    await addSet(id, 'squat');

    // `nextOrderIndex` prend le MAX des séries **non supprimées** : la série retirée ne réserve
    // pas son index. Voulu — sans quoi l'ordre se creuserait de trous au fil des suppressions.
    expect(setsOf(id).map((s) => s.order_index)).toEqual([0, 1]);
  });
});

describe('updateSet', () => {
  it('ne touche que les clés fournies', async () => {
    const id = await startWorkout();
    await addExerciseToWorkout(id, 'squat');
    const setId = setsOf(id)[0]!.id;
    await updateSet(setId, { reps: 8, weightKg: 100 });

    await updateSet(setId, { done: true });

    expect(setsOf(id)[0]).toMatchObject({ reps: 8, weight_kg: 100, done: 1 });
  });

  it('stocke le booléen `done` en 0/1', async () => {
    const id = await startWorkout();
    await addExerciseToWorkout(id, 'squat');
    const setId = setsOf(id)[0]!.id;

    await updateSet(setId, { done: true });
    expect(setsOf(id)[0]?.done).toBe(1);

    await updateSet(setId, { done: false });
    expect(setsOf(id)[0]?.done).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Clôture
// ---------------------------------------------------------------------------

describe('finishWorkout', () => {
  it('calcule la durée depuis le démarrage et passe la séance en terminée', async () => {
    const startedAt = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    const [id] = seed('workouts', [
      { user_id: 'user-1', status: 'active', started_at: startedAt },
    ]);
    const finishedAt = new Date().toISOString();

    await finishWorkout(id!, { finishedAt, rpe: 7, notes: 'ok' });

    expect(workout(id!)).toMatchObject({
      status: 'completed',
      finished_at: finishedAt,
      duration_seconds: 2700,
      rpe: 7,
      notes: 'ok',
    });
  });

  it('est idempotente : un second appel ne re-stampe rien (double-tap « Terminer »)', async () => {
    const id = await startWorkout();
    await finishWorkout(id, { rpe: 7 });
    const first = workout(id);

    await finishWorkout(id, { rpe: 9 });

    expect(workout(id)).toMatchObject({ finished_at: first?.finished_at, rpe: 7 });
  });

  it('ne clôture pas une séance supprimée ni une séance inconnue', async () => {
    const id = await startWorkout();
    await cancelWorkout(id);

    await finishWorkout(id);
    await finishWorkout('inconnue'); // ne jette pas

    // La séance annulée est en soft delete : on la relit en incluant les lignes supprimées.
    const cancelled = rowsOf<WorkoutRow>('workouts', true).find((w) => w.id === id);
    expect(cancelled).toMatchObject({ status: 'cancelled', finished_at: null });
  });

  it('n’enregistre jamais une durée négative si la fin précède le début', async () => {
    const [id] = seed('workouts', [
      { user_id: 'user-1', status: 'active', started_at: new Date().toISOString() },
    ]);

    await finishWorkout(id!, { finishedAt: new Date(Date.now() - 60_000).toISOString() });

    expect(workout(id!)?.duration_seconds).toBe(0);
  });

  it('marque l’occurrence planifiée liée comme faite', async () => {
    const [plannedId] = seed('planned_sessions', [
      { owner_id: 'user-1', scheduled_date: '2026-08-03', status: 'planned' },
    ]);
    const [id] = seed('workouts', [
      {
        user_id: 'user-1',
        status: 'active',
        started_at: new Date().toISOString(),
        planned_session_id: plannedId,
      },
    ]);

    await finishWorkout(id!);

    const planned = rowsOf<{ id: string; status: string; completed_at: string | null }>(
      'planned_sessions',
    )[0];
    expect(planned).toMatchObject({ status: 'done' });
    expect(planned?.completed_at).not.toBeNull();
  });
});

describe('cancelWorkout', () => {
  it('supprime en douceur la séance et toutes ses séries', async () => {
    const id = await startWorkout();
    await addExerciseToWorkout(id, 'squat');
    await addSet(id, 'squat');

    await cancelWorkout(id);

    expect(rowsOf('workouts')).toHaveLength(0);
    expect(rowsOf('workout_sets')).toHaveLength(0);
    // Soft delete : les lignes subsistent, marquées supprimées, et le statut est conservé.
    expect(rowsOf<WorkoutRow>('workouts', true)[0]?.status).toBe('cancelled');
    expect(rowsOf('workout_sets', true)).toHaveLength(2);
  });
});

describe('autoCloseStaleWorkout (spec 3.37)', () => {
  it('date la fin sur la dernière activité réelle, pas sur « maintenant »', async () => {
    const startedAt = new Date(Date.now() - 10 * 3600 * 1000).toISOString();
    const lastActivity = new Date(Date.now() - 8 * 3600 * 1000).toISOString();
    const [id] = seed('workouts', [
      { user_id: 'user-1', status: 'active', started_at: startedAt },
    ]);
    seed('workout_sets', [
      {
        workout_id: id,
        user_id: 'user-1',
        exercise_id: 'squat',
        order_index: 0,
        set_type: 'normal',
        done: 1,
        updated_at: lastActivity,
      },
    ]);

    await autoCloseStaleWorkout();

    expect(workout(id!)).toMatchObject({ status: 'completed', finished_at: lastActivity });
    // ~2 h, et non ~10 h : sans ça les stats de temps seraient faussées.
    expect(workout(id!)?.duration_seconds).toBe(2 * 3600);
  });

  it('retombe sur `started_at` quand la séance périmée n’a aucune série', async () => {
    const startedAt = new Date(Date.now() - 10 * 3600 * 1000).toISOString();
    const [id] = seed('workouts', [
      { user_id: 'user-1', status: 'active', started_at: startedAt },
    ]);

    await autoCloseStaleWorkout();

    expect(workout(id!)).toMatchObject({ finished_at: startedAt, duration_seconds: 0 });
  });

  it('laisse tranquille une séance active récente', async () => {
    const id = await startWorkout();

    await autoCloseStaleWorkout();

    expect(workout(id)?.status).toBe('active');
  });
});

describe('setWorkoutFeedback', () => {
  it('écrit le ressenti a posteriori sans toucher au statut', async () => {
    const id = await startWorkout();
    await finishWorkout(id);

    await setWorkoutFeedback(id, { rpe: 8, notes: 'jambes lourdes' });

    expect(workout(id)).toMatchObject({ status: 'completed', rpe: 8, notes: 'jambes lourdes' });
  });
});

// ---------------------------------------------------------------------------
// Ordre des exercices
// ---------------------------------------------------------------------------

describe('reorderExercise / sendExerciseToEnd', () => {
  /** Séance à 3 exercices, une série chacun. */
  async function seedThree(): Promise<string> {
    const id = await startWorkout();
    for (const ex of ['squat', 'bench', 'row']) await addExerciseToWorkout(id, ex);
    return id;
  }

  it('remonte un exercice et renumérote toutes les séries sans trou', async () => {
    const id = await seedThree();

    await reorderExercise(id, 'bench', 'up');

    expect(exerciseOrder(id)).toEqual(['bench', 'squat', 'row']);
    expect(setsOf(id).map((s) => s.order_index)).toEqual([0, 1, 2]);
  });

  it('garde l’ordre relatif des séries d’un même exercice', async () => {
    const id = await startWorkout();
    await addExerciseToWorkout(id, 'squat');
    await addSet(id, 'squat');
    await addExerciseToWorkout(id, 'bench');

    await reorderExercise(id, 'bench', 'up');

    expect(setsOf(id).map((s) => s.exercise_id)).toEqual(['bench', 'squat', 'squat']);
    expect(setsOf(id).map((s) => s.order_index)).toEqual([0, 1, 2]);
  });

  it('envoie un exercice en fin de séance', async () => {
    const id = await seedThree();

    await sendExerciseToEnd(id, 'squat');

    expect(exerciseOrder(id)).toEqual(['bench', 'row', 'squat']);
  });

  it('laisse les exercices déjà validés à leur position absolue', async () => {
    const id = await seedThree();
    // Le squat est terminé : il ne doit pas bouger quand on réordonne le reste.
    await updateSet(setsOf(id)[0]!.id, { done: true });

    await sendExerciseToEnd(id, 'bench');

    expect(exerciseOrder(id)).toEqual(['squat', 'row', 'bench']);
  });
});

describe('replaceExercise', () => {
  it('ne remplace que les séries non validées — l’historique n’est pas réécrit', async () => {
    const id = await startWorkout();
    await addExerciseToWorkout(id, 'squat');
    await addSet(id, 'squat');
    await updateSet(setsOf(id)[0]!.id, { done: true });

    await replaceExercise(id, 'squat', 'legpress');

    expect(setsOf(id).map((s) => s.exercise_id)).toEqual(['squat', 'legpress']);
  });

  it('ne déborde pas sur une autre séance', async () => {
    const first = await startWorkout();
    await addExerciseToWorkout(first, 'squat');
    await finishWorkout(first);
    const second = await startWorkout();
    await addExerciseToWorkout(second, 'squat');

    await replaceExercise(second, 'squat', 'legpress');

    expect(setsOf(first)[0]?.exercise_id).toBe('squat');
    expect(setsOf(second)[0]?.exercise_id).toBe('legpress');
  });
});

// ---------------------------------------------------------------------------
// Notes d'exercice
// ---------------------------------------------------------------------------

describe('setExerciseNote', () => {
  it('crée puis met à jour la note sans jamais créer de doublon', async () => {
    await setExerciseNote('squat', 'talons surélevés');
    await setExerciseNote('squat', 'barre basse');

    const notes = rowsOf<{ note: string | null }>('exercise_notes');
    expect(notes).toHaveLength(1);
    expect(notes[0]?.note).toBe('barre basse');
  });

  it('normalise une note blanche en null, sans supprimer la ligne', async () => {
    await setExerciseNote('squat', 'barre basse');

    await setExerciseNote('squat', '   ');

    expect(rowsOf<{ note: string | null }>('exercise_notes')[0]?.note).toBeNull();
    expect(rowsOf('exercise_notes')).toHaveLength(1);
  });

  it('rogne les espaces autour de la note', async () => {
    await setExerciseNote('squat', '  barre basse  ');

    expect(rowsOf<{ note: string | null }>('exercise_notes')[0]?.note).toBe('barre basse');
  });
});

// ---------------------------------------------------------------------------
// Supersets
// ---------------------------------------------------------------------------

describe('linkSupersetPair / unlinkSupersetPair', () => {
  const pairs = (workoutId: string) =>
    rowsOf<{ workout_id: string; exercise_id_a: string; exercise_id_b: string }>(
      'workout_superset_pairs',
    ).filter((p) => p.workout_id === workoutId);

  it('crée la paire', async () => {
    const id = await startWorkout();

    await linkSupersetPair(id, 'squat', 'bench');

    expect(pairs(id)).toEqual([
      expect.objectContaining({ exercise_id_a: 'squat', exercise_id_b: 'bench' }),
    ]);
  });

  it('rompt la paire précédente d’un exercice : au plus un partenaire, jamais de circuit', async () => {
    const id = await startWorkout();
    await linkSupersetPair(id, 'squat', 'bench');

    await linkSupersetPair(id, 'bench', 'row');

    expect(pairs(id)).toEqual([
      expect.objectContaining({ exercise_id_a: 'bench', exercise_id_b: 'row' }),
    ]);
  });

  it('n’affecte pas les paires d’une autre séance', async () => {
    const first = await startWorkout();
    await linkSupersetPair(first, 'squat', 'bench');
    await finishWorkout(first);
    const second = await startWorkout();

    await linkSupersetPair(second, 'squat', 'row');

    expect(pairs(first)).toHaveLength(1);
    expect(pairs(second)).toHaveLength(1);
  });

  it('rompt la paire depuis l’un ou l’autre des deux exercices', async () => {
    const id = await startWorkout();
    await linkSupersetPair(id, 'squat', 'bench');

    await unlinkSupersetPair(id, 'bench');

    expect(pairs(id)).toHaveLength(0);
  });

  it('ne jette pas quand il n’y a aucune paire à rompre', async () => {
    const id = await startWorkout();

    await expect(unlinkSupersetPair(id, 'squat')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Atomicité
// ---------------------------------------------------------------------------

describe('atomicité des transactions', () => {
  it('annule toute l’écriture si la transaction échoue en cours de route', async () => {
    const id = await startWorkout();

    await expect(
      testPowerSync.writeTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO workout_sets (id, workout_id, user_id, exercise_id, order_index, set_type, done)
           VALUES ('s1', ?, 'user-1', 'squat', 0, 'normal', 0)`,
          [id],
        );
        throw new Error('échec simulé');
      }),
    ).rejects.toThrow('échec simulé');

    expect(rowsOf('workout_sets', true)).toHaveLength(0);
  });
});

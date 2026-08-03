/**
 * US OBJ-01 (objectifs) et STREAK-01 (joker de série) — écritures sur **du vrai SQLite**.
 *
 * Lot 1 de [strategie-tests.md](../../../../../../docs/specs/technical/strategie-tests.md).
 * Ces deux repositories partagent le même point dur, et c'est lui qu'on teste ici : le quota est
 * **relu en base au moment de l'écriture**, jamais repris de l'affichage. Sans ça, un second
 * appareil (ou un écran resté ouvert) laisserait passer un 4ᵉ objectif ou un 2ᵉ joker dans le
 * mois — une divergence qu'une recette sur un seul téléphone ne peut pas produire.
 *
 * Les règles pures (`jokersRemaining`, `estimate1RM`, `MAX_ACTIVE_GOALS`) sont testées dans
 * `@wellness/shared` ; on vérifie ici leur câblage aux requêtes.
 */

import { createGoal, currentBest1RM, deleteGoal } from '../goal-repository';
import { consumeJoker } from '../streak-joker-repository';
import { resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

type GoalRow = {
  id: string;
  user_id: string;
  kind: string;
  target_value: number;
  start_value: number | null;
  exercise_id: string | null;
  start_date: string;
  deadline: string;
};

const goals = (includeDeleted = false) => rowsOf<GoalRow>('personal_goals', includeDeleted);
const jokers = () => rowsOf<{ user_id: string; log_date: string }>('streak_jokers');

/** Clé de jour local, décalée de `offsetDays`. */
function dayKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Un objectif déjà en base, actif par défaut (échéance future). */
function seedGoal(deadline: string): void {
  seed('personal_goals', [
    {
      user_id: 'user-1',
      kind: 'run_distance',
      target_value: 50_000,
      start_date: dayKey(-1),
      deadline,
    },
  ]);
}

const runGoal = {
  kind: 'run_distance' as const,
  targetValue: 50_000,
  startDate: dayKey(),
  deadline: dayKey(30),
};

beforeEach(() => {
  resetTestDb();
});

// ---------------------------------------------------------------------------
// Objectifs — US OBJ-01
// ---------------------------------------------------------------------------

describe('createGoal', () => {
  it('crée l’objectif avec son propriétaire et ses bornes', async () => {
    const id = await createGoal(runGoal);

    expect(goals()).toHaveLength(1);
    expect(goals()[0]).toMatchObject({
      id,
      user_id: 'user-1',
      kind: 'run_distance',
      target_value: 50_000,
      start_value: null,
      exercise_id: null,
      deadline: dayKey(30),
    });
  });

  it('fige la valeur de départ d’un objectif de 1RM (décision D6)', async () => {
    await createGoal({
      kind: 'exercise_1rm',
      targetValue: 120,
      exerciseId: 'squat',
      startValue: 100.5,
      startDate: dayKey(),
      deadline: dayKey(60),
    });

    expect(goals()[0]).toMatchObject({ exercise_id: 'squat', start_value: 100.5 });
  });

  it('accepte 3 objectifs actifs et refuse le 4ᵉ', async () => {
    await createGoal(runGoal);
    await createGoal(runGoal);
    await createGoal(runGoal);

    await expect(createGoal(runGoal)).rejects.toThrow(/Plafond atteint/);
    expect(goals()).toHaveLength(3);
  });

  it('ne compte pas les objectifs échus dans le plafond', async () => {
    seedGoal(dayKey(-1)); // échu hier
    seedGoal(dayKey(-30));
    seedGoal(dayKey(-60));

    await expect(createGoal(runGoal)).resolves.toBeDefined();
  });

  it('compte un objectif dont l’échéance est aujourd’hui comme encore actif', async () => {
    seedGoal(dayKey());
    seedGoal(dayKey(10));
    seedGoal(dayKey(20));

    await expect(createGoal(runGoal)).rejects.toThrow(/Plafond atteint/);
  });

  it('ne compte pas les objectifs supprimés — supprimer libère une place', async () => {
    const first = await createGoal(runGoal);
    await createGoal(runGoal);
    await createGoal(runGoal);

    await deleteGoal(first);

    await expect(createGoal(runGoal)).resolves.toBeDefined();
    expect(goals()).toHaveLength(3);
  });
});

describe('deleteGoal', () => {
  it('supprime en douceur, y compris un objectif échu (décision D3)', async () => {
    seedGoal(dayKey(-1));
    const id = goals()[0]!.id;

    await deleteGoal(id);

    expect(goals()).toHaveLength(0);
    expect(goals(true)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// currentBest1RM
// ---------------------------------------------------------------------------

describe('currentBest1RM', () => {
  /** Une séance terminée avec une série sur `squat`. */
  function seedSet(
    reps: number | null,
    weightKg: number | null,
    opts?: { status?: string; done?: boolean; setType?: string; deleted?: boolean },
  ): void {
    const [workoutId] = seed('workouts', [
      {
        user_id: 'user-1',
        status: opts?.status ?? 'completed',
        started_at: new Date().toISOString(),
      },
    ]);
    seed('workout_sets', [
      {
        workout_id: workoutId,
        user_id: 'user-1',
        exercise_id: 'squat',
        order_index: 0,
        set_type: opts?.setType ?? 'normal',
        reps,
        weight_kg: weightKg,
        done: opts?.done === false ? 0 : 1,
        ...(opts?.deleted ? { deleted_at: new Date().toISOString() } : {}),
      },
    ]);
  }

  it('renvoie null quand l’exercice n’a jamais été travaillé', async () => {
    expect(await currentBest1RM('squat')).toBeNull();
  });

  it('retient le meilleur 1RM estimé toutes séances confondues', async () => {
    seedSet(10, 80); // ≈ 106,7
    seedSet(3, 100); // ≈ 110

    const best = await currentBest1RM('squat');

    expect(best).toBeCloseTo(110, 1);
  });

  it('ignore les séances non terminées, les séries non validées, les échauffements et les supprimées', async () => {
    seedSet(1, 300, { status: 'active' });
    seedSet(1, 300, { done: false });
    seedSet(1, 300, { setType: 'warmup' });
    seedSet(1, 300, { deleted: true });
    seedSet(5, 100);

    const best = await currentBest1RM('squat');

    expect(best).toBeLessThan(200);
  });

  it('ignore les séries sans reps ou sans charge', async () => {
    seedSet(null, 100);
    seedSet(10, null);

    expect(await currentBest1RM('squat')).toBeNull();
  });

  it('ne mélange pas deux exercices', async () => {
    seedSet(5, 100);

    expect(await currentBest1RM('bench')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Joker de série — US STREAK-01
// ---------------------------------------------------------------------------

describe('consumeJoker', () => {
  it('couvre le jour manqué et ne crée QUE la ligne de joker (décision D3)', async () => {
    expect(await consumeJoker(dayKey(-1))).toBe(true);

    expect(jokers()).toEqual([
      expect.objectContaining({ user_id: 'user-1', log_date: dayKey(-1) }),
    ]);
    // Un joker protège la série et rien d'autre : aucune séance ni sortie fabriquée.
    expect(rowsOf('workouts')).toHaveLength(0);
    expect(rowsOf('runs')).toHaveLength(0);
  });

  it('est idempotent : un jour déjà couvert ne consomme pas un second joker', async () => {
    await consumeJoker(dayKey(-1));

    expect(await consumeJoker(dayKey(-1))).toBe(false);
    expect(jokers()).toHaveLength(1);
  });

  it('refuse au-delà du quota du mois, en relisant la base', async () => {
    await consumeJoker(dayKey(-1));

    await expect(consumeJoker(dayKey(-2))).rejects.toThrow(/Aucun joker disponible/);
    expect(jokers()).toHaveLength(1);
  });

  it('ne décompte pas un joker posé un autre mois', async () => {
    seed('streak_jokers', [{ user_id: 'user-1', log_date: '2020-03-15' }]);

    await expect(consumeJoker(dayKey(-1))).resolves.toBe(true);
  });

  it('ignore un joker supprimé dans le décompte', async () => {
    seed('streak_jokers', [
      {
        user_id: 'user-1',
        log_date: dayKey(-5),
        deleted_at: new Date().toISOString(),
      },
    ]);

    await expect(consumeJoker(dayKey(-1))).resolves.toBe(true);
  });

  it.each(['03/08/2026', '2026-8-3', 'hier', ''])(
    'refuse une date illisible (« %s ») avant toute écriture',
    async (bad) => {
      await expect(consumeJoker(bad)).rejects.toThrow(/Date illisible/);
      expect(jokers()).toHaveLength(0);
    },
  );
});

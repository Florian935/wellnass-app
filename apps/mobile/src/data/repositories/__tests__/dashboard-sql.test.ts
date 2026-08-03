/**
 * Dashboard — les requêtes du hub et des widgets, exécutées sur **du vrai SQLite**.
 *
 * Lot 2 de [strategie-tests.md](../../../../../../docs/specs/technical/strategie-tests.md).
 * Le dashboard est la première chose que l'utilisateur voit ; ses requêtes joignent jusqu'à
 * 4 tables et filtrent sur propriétaire, pilier et date. Une jointure fausse affiche **la mauvaise
 * séance** ou le record de quelqu'un d'autre — sans jamais planter, donc sans qu'aucune recette ne
 * le remarque tant qu'on n'a qu'un compte et qu'un programme sur le téléphone.
 *
 * C'est exactement ce que ces tests couvrent : la présence de plusieurs propriétaires, plusieurs
 * piliers et plusieurs langues en base, qu'un device de recette n'a jamais.
 */

import {
  SELECT_MOST_RECENT_STRENGTH_RECORD,
  SELECT_NEXT_UPCOMING,
  SELECT_RECENT_STRENGTH_RECORDS,
  SELECT_TODAY_OCCURRENCES,
  SELECT_WEEKLY_STRENGTH_VOLUME,
} from '../dashboard-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

const query = <T>(sql: string, params: unknown[]) => testPowerSync.getAll<T>(sql, params);

const TODAY = '2026-08-03';

// ---------------------------------------------------------------------------
// Semis
// ---------------------------------------------------------------------------

/** Un programme possédé, avec son libellé FR (et EN si fourni). */
function seedProgram(opts: {
  pillar?: string;
  ownerId?: string;
  nameFr?: string;
  nameEn?: string;
  deleted?: boolean;
}): string {
  const [programId] = seed('programs', [
    {
      owner_id: opts.ownerId ?? 'user-1',
      pillar: opts.pillar ?? 'strength',
      is_active: 1,
      ...(opts.deleted ? { deleted_at: new Date().toISOString() } : {}),
    },
  ]);
  const translations: Record<string, unknown>[] = [];
  if (opts.nameFr) {
    translations.push({ program_id: programId, lang: 'fr', name: opts.nameFr });
  }
  if (opts.nameEn) {
    translations.push({ program_id: programId, lang: 'en', name: opts.nameEn });
  }
  if (translations.length > 0) seed('program_translations', translations);
  return programId!;
}

/** Une séance du programme, avec `exerciseCount` exercices planifiés. */
function seedSession(
  programId: string,
  opts: { name?: string; orderIndex?: number; exerciseCount?: number; deleted?: boolean } = {},
): string {
  const [sessionId] = seed('sessions', [
    {
      program_id: programId,
      owner_id: 'user-1',
      order_index: opts.orderIndex ?? 0,
      name: opts.name ?? 'Séance A',
      ...(opts.deleted ? { deleted_at: new Date().toISOString() } : {}),
    },
  ]);
  if (opts.exerciseCount) {
    seed(
      'exercise_plans',
      Array.from({ length: opts.exerciseCount }, (_, i) => ({
        session_id: sessionId,
        owner_id: 'user-1',
        exercise_id: `ex-${i}`,
        order_index: i,
        set_type: 'normal',
      })),
    );
  }
  return sessionId!;
}

/** Une occurrence planifiée. */
function seedOccurrence(opts: {
  programId: string;
  sessionId: string;
  date: string;
  status?: string;
  ownerId?: string;
  deleted?: boolean;
}): string {
  const [id] = seed('planned_sessions', [
    {
      owner_id: opts.ownerId ?? 'user-1',
      program_id: opts.programId,
      session_id: opts.sessionId,
      scheduled_date: opts.date,
      status: opts.status ?? 'planned',
      ...(opts.deleted ? { deleted_at: new Date().toISOString() } : {}),
    },
  ]);
  return id!;
}

beforeEach(() => {
  resetTestDb();
});

// ---------------------------------------------------------------------------
// SELECT_TODAY_OCCURRENCES
// ---------------------------------------------------------------------------

describe('SELECT_TODAY_OCCURRENCES', () => {
  type Row = {
    id: string;
    session_id: string;
    status: string;
    session_name: string | null;
    exercise_count: number;
    program_name: string | null;
  };

  const today = (lang = 'fr', userId = 'user-1', pillar = 'strength') =>
    query<Row>(SELECT_TODAY_OCCURRENCES, [lang, userId, pillar, TODAY]);

  it('renvoie l’occurrence du jour avec son nom de séance, son programme et son nombre d’exercices', async () => {
    const programId = seedProgram({ nameFr: 'Full body 3j' });
    const sessionId = seedSession(programId, { name: 'Séance A', exerciseCount: 5 });
    const id = seedOccurrence({ programId, sessionId, date: TODAY });

    expect(await today()).toEqual([
      expect.objectContaining({
        id,
        session_id: sessionId,
        status: 'planned',
        session_name: 'Séance A',
        exercise_count: 5,
        program_name: 'Full body 3j',
      }),
    ]);
  });

  it('renvoie aussi les occurrences déjà faites — l’appelant distingue `planned` de `done`', async () => {
    const programId = seedProgram({ nameFr: 'Full body' });
    const sessionId = seedSession(programId);
    seedOccurrence({ programId, sessionId, date: TODAY, status: 'done' });

    expect((await today())[0]?.status).toBe('done');
  });

  it('trie par ordre de séance dans le programme', async () => {
    const programId = seedProgram({ nameFr: 'Full body' });
    const second = seedSession(programId, { name: 'Séance B', orderIndex: 1 });
    const first = seedSession(programId, { name: 'Séance A', orderIndex: 0 });
    seedOccurrence({ programId, sessionId: second, date: TODAY });
    seedOccurrence({ programId, sessionId: first, date: TODAY });

    expect((await today()).map((r) => r.session_name)).toEqual(['Séance A', 'Séance B']);
  });

  it('résout le libellé du programme dans la langue demandée, avec repli sur le français', async () => {
    const bilingual = seedProgram({ nameFr: 'Full body', nameEn: 'Full body EN' });
    const frOnly = seedProgram({ nameFr: 'Prise de masse' });
    seedOccurrence({
      programId: bilingual,
      sessionId: seedSession(bilingual, { orderIndex: 0 }),
      date: TODAY,
    });
    seedOccurrence({
      programId: frOnly,
      sessionId: seedSession(frOnly, { orderIndex: 1 }),
      date: TODAY,
    });

    expect((await today('en')).map((r) => r.program_name)).toEqual([
      'Full body EN',
      'Prise de masse', // pas de traduction anglaise : repli sur le français
    ]);
  });

  it('ne renvoie rien pour un autre jour, un autre pilier ou un autre propriétaire', async () => {
    const programId = seedProgram({ nameFr: 'Full body' });
    const sessionId = seedSession(programId);
    seedOccurrence({ programId, sessionId, date: '2026-08-04' });
    seedOccurrence({ programId, sessionId, date: TODAY, ownerId: 'user-2' });

    expect(await today()).toEqual([]);
    expect(await today('fr', 'user-1', 'running')).toEqual([]);
  });

  it('ignore une occurrence, une séance ou un programme supprimés', async () => {
    const programId = seedProgram({ nameFr: 'Full body' });
    const sessionId = seedSession(programId);
    seedOccurrence({ programId, sessionId, date: TODAY, deleted: true });

    const deletedSession = seedSession(programId, { deleted: true });
    seedOccurrence({ programId, sessionId: deletedSession, date: TODAY });

    const deletedProgram = seedProgram({ nameFr: 'Ancien', deleted: true });
    seedOccurrence({
      programId: deletedProgram,
      sessionId: seedSession(deletedProgram),
      date: TODAY,
    });

    expect(await today()).toEqual([]);
  });

  it('ne compte pas les exercices planifiés supprimés', async () => {
    const programId = seedProgram({ nameFr: 'Full body' });
    const sessionId = seedSession(programId, { exerciseCount: 3 });
    seed('exercise_plans', [
      {
        session_id: sessionId,
        owner_id: 'user-1',
        exercise_id: 'retire',
        order_index: 9,
        set_type: 'normal',
        deleted_at: new Date().toISOString(),
      },
    ]);
    seedOccurrence({ programId, sessionId, date: TODAY });

    expect((await today())[0]?.exercise_count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// SELECT_NEXT_UPCOMING
// ---------------------------------------------------------------------------

describe('SELECT_NEXT_UPCOMING', () => {
  type Row = { scheduled_date: string; session_name: string | null };

  const next = (userId = 'user-1', pillar = 'strength') =>
    query<Row>(SELECT_NEXT_UPCOMING, [userId, pillar, TODAY]);

  it('renvoie la prochaine occurrence, strictement après aujourd’hui', async () => {
    const programId = seedProgram({});
    const sessionId = seedSession(programId, { name: 'Séance A' });
    seedOccurrence({ programId, sessionId, date: TODAY });
    seedOccurrence({ programId, sessionId, date: '2026-08-05' });
    seedOccurrence({ programId, sessionId, date: '2026-08-07' });

    expect(await next()).toEqual([
      expect.objectContaining({ scheduled_date: '2026-08-05', session_name: 'Séance A' }),
    ]);
  });

  it('ignore les occurrences déjà faites ou sautées', async () => {
    const programId = seedProgram({});
    const sessionId = seedSession(programId);
    seedOccurrence({ programId, sessionId, date: '2026-08-04', status: 'done' });
    seedOccurrence({ programId, sessionId, date: '2026-08-05', status: 'skipped' });
    seedOccurrence({ programId, sessionId, date: '2026-08-06', status: 'planned' });

    expect((await next())[0]?.scheduled_date).toBe('2026-08-06');
  });

  it('ne regarde ni un autre pilier ni un autre propriétaire', async () => {
    const running = seedProgram({ pillar: 'running' });
    seedOccurrence({
      programId: running,
      sessionId: seedSession(running),
      date: '2026-08-05',
    });
    const other = seedProgram({ ownerId: 'user-2' });
    seedOccurrence({
      programId: other,
      sessionId: seedSession(other),
      date: '2026-08-05',
      ownerId: 'user-2',
    });

    expect(await next()).toEqual([]);
  });

  it('ne renvoie rien quand plus rien n’est planifié', async () => {
    expect(await next()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

describe('records du dashboard', () => {
  type Row = { type: string; value: number; achieved_at: string; exercise_name: string | null };

  /** Un record, avec le libellé d'exercice associé. */
  function seedRecord(opts: {
    exerciseId: string;
    value: number;
    achievedAt: string;
    userId?: string;
    deleted?: boolean;
  }): void {
    seed('personal_records', [
      {
        user_id: opts.userId ?? 'user-1',
        exercise_id: opts.exerciseId,
        type: 'max_weight',
        value: opts.value,
        achieved_at: opts.achievedAt,
        ...(opts.deleted ? { deleted_at: new Date().toISOString() } : {}),
      },
    ]);
  }

  beforeEach(() => {
    seed('exercises', [{ id: 'squat' }, { id: 'bench' }]);
    seed('exercise_translations', [
      { exercise_id: 'squat', lang: 'fr', name: 'Squat' },
      { exercise_id: 'squat', lang: 'en', name: 'Back squat' },
      { exercise_id: 'bench', lang: 'fr', name: 'Développé couché' },
    ]);
  });

  it('renvoie le record le plus récent, libellé résolu', async () => {
    seedRecord({ exerciseId: 'bench', value: 80, achievedAt: '2026-07-01T10:00:00.000Z' });
    seedRecord({ exerciseId: 'squat', value: 120, achievedAt: '2026-08-01T10:00:00.000Z' });

    const rows = await query<Row>(SELECT_MOST_RECENT_STRENGTH_RECORD, ['fr', 'user-1']);

    expect(rows).toEqual([expect.objectContaining({ value: 120, exercise_name: 'Squat' })]);
  });

  it('replie sur le français quand la traduction manque', async () => {
    seedRecord({ exerciseId: 'bench', value: 80, achievedAt: '2026-08-01T10:00:00.000Z' });

    const rows = await query<Row>(SELECT_MOST_RECENT_STRENGTH_RECORD, ['en', 'user-1']);

    expect(rows[0]?.exercise_name).toBe('Développé couché');
  });

  it('ne montre jamais le record d’un autre utilisateur', async () => {
    seedRecord({
      exerciseId: 'squat',
      value: 300,
      achievedAt: '2026-08-02T10:00:00.000Z',
      userId: 'user-2',
    });
    seedRecord({ exerciseId: 'squat', value: 120, achievedAt: '2026-08-01T10:00:00.000Z' });

    const rows = await query<Row>(SELECT_MOST_RECENT_STRENGTH_RECORD, ['fr', 'user-1']);

    expect(rows[0]?.value).toBe(120);
  });

  it('ignore les records supprimés', async () => {
    seedRecord({
      exerciseId: 'squat',
      value: 300,
      achievedAt: '2026-08-02T10:00:00.000Z',
      deleted: true,
    });

    expect(await query(SELECT_MOST_RECENT_STRENGTH_RECORD, ['fr', 'user-1'])).toEqual([]);
  });

  it('liste les N derniers records, du plus récent au plus ancien', async () => {
    for (let day = 1; day <= 5; day++) {
      seedRecord({
        exerciseId: 'squat',
        value: 100 + day,
        achievedAt: `2026-08-0${day}T10:00:00.000Z`,
      });
    }

    const rows = await query<Row>(SELECT_RECENT_STRENGTH_RECORDS, ['fr', 'user-1', 4]);

    expect(rows.map((r) => r.value)).toEqual([105, 104, 103, 102]);
  });
});

// ---------------------------------------------------------------------------
// SELECT_WEEKLY_STRENGTH_VOLUME
// ---------------------------------------------------------------------------

describe('SELECT_WEEKLY_STRENGTH_VOLUME', () => {
  const SINCE = '2026-07-27T00:00:00.000Z';

  /** Une séance démarrée à `startedAt`, avec ses séries. */
  function seedWorkout(
    startedAt: string,
    sets: { reps?: number | null; weightKg?: number | null; setType?: string; done?: boolean }[],
    opts?: { status?: string; deleted?: boolean },
  ): void {
    const [workoutId] = seed('workouts', [
      {
        user_id: 'user-1',
        status: opts?.status ?? 'completed',
        started_at: startedAt,
        ...(opts?.deleted ? { deleted_at: new Date().toISOString() } : {}),
      },
    ]);
    seed(
      'workout_sets',
      sets.map((s, i) => ({
        workout_id: workoutId,
        user_id: 'user-1',
        exercise_id: 'squat',
        order_index: i,
        set_type: s.setType ?? 'normal',
        reps: s.reps ?? null,
        weight_kg: s.weightKg ?? null,
        done: s.done === false ? 0 : 1,
      })),
    );
  }

  const volume = async () => {
    const rows = await query<{ reps: number | null; weight_kg: number | null }>(
      SELECT_WEEKLY_STRENGTH_VOLUME,
      [SINCE],
    );
    return rows.reduce((sum, r) => sum + (r.reps ?? 0) * (r.weight_kg ?? 0), 0);
  };

  it('renvoie les séries validées de la fenêtre', async () => {
    seedWorkout('2026-07-28T10:00:00.000Z', [
      { reps: 10, weightKg: 80 },
      { reps: 8, weightKg: 90 },
    ]);

    expect(await volume()).toBe(10 * 80 + 8 * 90);
  });

  it('exclut échauffements et séries non validées', async () => {
    seedWorkout('2026-07-28T10:00:00.000Z', [
      { reps: 5, weightKg: 100 },
      { reps: 15, weightKg: 40, setType: 'warmup' },
      { reps: 5, weightKg: 100, done: false },
    ]);

    expect(await volume()).toBe(500);
  });

  it('exclut les séances antérieures à la fenêtre et les séances supprimées', async () => {
    seedWorkout('2026-07-26T23:59:00.000Z', [{ reps: 5, weightKg: 100 }]);
    seedWorkout('2026-07-28T10:00:00.000Z', [{ reps: 5, weightKg: 100 }], { deleted: true });

    expect(await volume()).toBe(0);
  });

  it('compte la séance EN COURS — la requête ne filtre pas sur le statut', async () => {
    seedWorkout('2026-07-28T10:00:00.000Z', [{ reps: 5, weightKg: 100 }], { status: 'active' });

    // Voulu : l'alerte déficit/volume doit refléter l'effort déjà fourni aujourd'hui, y compris
    // celui d'une séance qu'on n'a pas encore terminée. Divergence assumée avec le bilan
    // hebdomadaire (`SELECT_STRENGTH`), qui n'admet que les séances closes.
    expect(await volume()).toBe(500);
  });
});

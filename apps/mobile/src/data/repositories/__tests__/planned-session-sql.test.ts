/**
 * Planification — `planProgram` et le cycle de vie des occurrences, sur **du vrai SQLite**.
 *
 * Lot 1 de [strategie-tests.md](../../../../../../docs/specs/technical/strategie-tests.md).
 * `planProgram` est la plus grosse transaction de l'app (8 étapes, 3 tables) et **l'ordre des
 * étapes est porteur de sens** : le retrait des occurrences futures de l'ancien programme doit
 * précéder la désactivation, sans quoi le sous-select `is_active = 1` ne trouve plus rien et
 * l'ancien planning survit en silence. Vérifier ça en recette suppose de planifier deux
 * programmes puis d'inspecter un calendrier — ici c'est un test de 15 lignes.
 *
 * La règle pure `generatePlannedSessions` (alignement au lundi) est testée dans
 * `@wellness/shared` ; on vérifie ici son câblage et les gardes de transaction.
 */

import {
  markPlannedSessionDone,
  planProgram,
  reschedulePlannedSession,
  SELECT_COMPLETED_STRENGTH_IN_WINDOW,
  SELECT_PLANNED_STRENGTH_IN_WINDOW,
  skipPlannedSession,
} from '../planned-session-repository';
import { resetTestDb, rowsOf, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

type PlannedRow = {
  id: string;
  program_id: string | null;
  session_id: string | null;
  scheduled_date: string;
  status: string;
  week_index: number | null;
  completed_at: string | null;
};

type ProgramRow = { id: string; pillar: string; is_active: number };

const planned = (includeDeleted = false) =>
  rowsOf<PlannedRow>('planned_sessions', includeDeleted).sort((a, b) =>
    a.scheduled_date.localeCompare(b.scheduled_date),
  );

const programs = () => rowsOf<ProgramRow>('programs');

/** Un programme de `sessionCount` séances, possédé par l'utilisateur courant. */
function seedProgram(
  sessionCount: number,
  opts?: { pillar?: string; isActive?: boolean },
): { programId: string; sessionIds: string[] } {
  const [programId] = seed('programs', [
    {
      owner_id: 'user-1',
      pillar: opts?.pillar ?? 'strength',
      is_active: opts?.isActive ? 1 : 0,
      status: 'published',
    },
  ]);
  const sessionIds = seed(
    'sessions',
    Array.from({ length: sessionCount }, (_, i) => ({
      program_id: programId,
      owner_id: 'user-1',
      order_index: i,
      name: `Séance ${i + 1}`,
    })),
  );
  return { programId: programId!, sessionIds };
}

/** Affecte chaque séance à un jour de la semaine (0 = lundi). */
const assign = (sessionIds: string[], days: number[]): Record<string, number> =>
  Object.fromEntries(sessionIds.map((id, i) => [id, days[i] ?? 0]));

beforeEach(() => {
  resetTestDb();
});

// ---------------------------------------------------------------------------
// planProgram
// ---------------------------------------------------------------------------

describe('planProgram', () => {
  it('génère une occurrence par séance et par semaine, avec son index de semaine', async () => {
    const { programId, sessionIds } = seedProgram(2);

    const count = await planProgram(programId, {
      startDate: '2026-08-03', // un lundi
      durationWeeks: 3,
      dayAssignments: assign(sessionIds, [0, 3]), // lundi + jeudi
    });

    expect(count).toBe(6);
    expect(planned()).toHaveLength(6);
    expect(planned().map((p) => p.scheduled_date)).toEqual([
      '2026-08-03',
      '2026-08-06',
      '2026-08-10',
      '2026-08-13',
      '2026-08-17',
      '2026-08-20',
    ]);
    expect(planned().map((p) => p.week_index)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(planned().every((p) => p.status === 'planned')).toBe(true);
  });

  it('active le programme planifié et désactive l’ancien actif du même pilier', async () => {
    const previous = seedProgram(1, { isActive: true });
    const next = seedProgram(1);

    await planProgram(next.programId, {
      startDate: '2026-08-03',
      durationWeeks: 1,
      dayAssignments: assign(next.sessionIds, [0]),
    });

    expect(programs().find((p) => p.id === previous.programId)?.is_active).toBe(0);
    expect(programs().find((p) => p.id === next.programId)?.is_active).toBe(1);
  });

  it('n’éteint pas le programme actif d’un AUTRE pilier', async () => {
    const running = seedProgram(1, { pillar: 'running', isActive: true });
    const strength = seedProgram(1, { pillar: 'strength' });

    await planProgram(strength.programId, {
      startDate: '2026-08-03',
      durationWeeks: 1,
      dayAssignments: assign(strength.sessionIds, [0]),
    });

    expect(programs().find((p) => p.id === running.programId)?.is_active).toBe(1);
  });

  it('remplace proprement une planification existante au lieu de l’empiler', async () => {
    const { programId, sessionIds } = seedProgram(1);
    const input = {
      startDate: '2026-08-03',
      durationWeeks: 2,
      dayAssignments: assign(sessionIds, [0]),
    };
    await planProgram(programId, input);

    await planProgram(programId, { ...input, durationWeeks: 1 });

    expect(planned()).toHaveLength(1);
    // Les anciennes occurrences sont en soft delete, pas effacées.
    expect(planned(true)).toHaveLength(3);
  });

  it('conserve l’historique fait/sauté lors d’une re-planification', async () => {
    const { programId, sessionIds } = seedProgram(1);
    const input = {
      startDate: '2026-08-03',
      durationWeeks: 2,
      dayAssignments: assign(sessionIds, [0]),
    };
    await planProgram(programId, input);
    await markPlannedSessionDone(planned()[0]!.id);

    await planProgram(programId, input);

    // La séance faite survit : seules les occurrences encore `planned` sont remplacées.
    expect(planned().filter((p) => p.status === 'done')).toHaveLength(1);
  });

  it('retire les occurrences futures de l’ancien programme sur demande, en gardant le passé', async () => {
    const previous = seedProgram(1, { isActive: true });
    seed('planned_sessions', [
      {
        owner_id: 'user-1',
        program_id: previous.programId,
        session_id: previous.sessionIds[0],
        scheduled_date: '2020-01-01', // passé
        status: 'planned',
      },
      {
        owner_id: 'user-1',
        program_id: previous.programId,
        session_id: previous.sessionIds[0],
        scheduled_date: '2099-01-01', // futur
        status: 'planned',
      },
    ]);
    const next = seedProgram(1);

    await planProgram(
      next.programId,
      {
        startDate: '2026-08-03',
        durationWeeks: 1,
        dayAssignments: assign(next.sessionIds, [0]),
      },
      { removePreviousFuture: true },
    );

    const remaining = planned().filter((p) => p.program_id === previous.programId);
    expect(remaining.map((p) => p.scheduled_date)).toEqual(['2020-01-01']);
  });

  it('laisse l’ancien planning intact quand `removePreviousFuture` n’est pas demandé', async () => {
    const previous = seedProgram(1, { isActive: true });
    seed('planned_sessions', [
      {
        owner_id: 'user-1',
        program_id: previous.programId,
        session_id: previous.sessionIds[0],
        scheduled_date: '2099-01-01',
        status: 'planned',
      },
    ]);
    const next = seedProgram(1);

    await planProgram(next.programId, {
      startDate: '2026-08-03',
      durationWeeks: 1,
      dayAssignments: assign(next.sessionIds, [0]),
    });

    expect(planned().filter((p) => p.program_id === previous.programId)).toHaveLength(1);
  });
});

describe('planProgram — gardes', () => {
  it('refuse un programme sans séance, sans rien activer', async () => {
    const [programId] = seed('programs', [
      { owner_id: 'user-1', pillar: 'strength', is_active: 0 },
    ]);

    await expect(
      planProgram(programId!, { startDate: '2026-08-03', durationWeeks: 4, dayAssignments: {} }),
    ).rejects.toThrow(/Aucune séance/);

    expect(programs()[0]?.is_active).toBe(0);
    expect(planned(true)).toHaveLength(0);
  });

  it('refuse une séance sans jour affecté — pas de skip silencieux', async () => {
    const { programId, sessionIds } = seedProgram(2);

    await expect(
      planProgram(programId, {
        startDate: '2026-08-03',
        durationWeeks: 1,
        dayAssignments: { [sessionIds[0]!]: 0 }, // la 2ᵉ séance n'a pas de jour
      }),
    ).rejects.toThrow(/Aucun jour affecté/);

    // Transaction annulée : aucune occurrence partielle.
    expect(planned(true)).toHaveLength(0);
  });

  it.each([
    ['durée nulle', 0],
    ['durée négative', -3],
    ['durée non entière', 2.5],
  ])('refuse une %s avant toute écriture', async (_label, durationWeeks) => {
    const { programId, sessionIds } = seedProgram(1);

    await expect(
      planProgram(programId, {
        startDate: '2026-08-03',
        durationWeeks,
        dayAssignments: assign(sessionIds, [0]),
      }),
    ).rejects.toThrow();

    expect(planned(true)).toHaveLength(0);
    expect(programs()[0]?.is_active).toBe(0);
  });

  it('ignore les séances d’un autre propriétaire', async () => {
    const { programId } = seedProgram(0);
    const [foreignSession] = seed('sessions', [
      { program_id: programId, owner_id: 'quelqu-un-dautre', order_index: 0 },
    ]);

    await expect(
      planProgram(programId, {
        startDate: '2026-08-03',
        durationWeeks: 1,
        dayAssignments: { [foreignSession!]: 0 },
      }),
    ).rejects.toThrow(/Aucune séance/);
  });
});

// ---------------------------------------------------------------------------
// Cycle de vie d'une occurrence
// ---------------------------------------------------------------------------

describe('cycle de vie d’une occurrence', () => {
  /** Une occurrence planifiée isolée. */
  function seedOne(): string {
    const [id] = seed('planned_sessions', [
      { owner_id: 'user-1', scheduled_date: '2026-08-03', status: 'planned' },
    ]);
    return id!;
  }

  it('reporte à une nouvelle date sans changer le statut', async () => {
    const id = seedOne();

    await reschedulePlannedSession(id, '2026-08-05');

    expect(planned()[0]).toMatchObject({ scheduled_date: '2026-08-05', status: 'planned' });
  });

  it('marque comme sautée', async () => {
    const id = seedOne();

    await skipPlannedSession(id);

    expect(planned()[0]).toMatchObject({ status: 'skipped', completed_at: null });
  });

  it('marque comme faite et horodate', async () => {
    const id = seedOne();

    await markPlannedSessionDone(id);

    expect(planned()[0]?.status).toBe('done');
    expect(planned()[0]?.completed_at).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SELECT_PLANNED_STRENGTH_IN_WINDOW / SELECT_COMPLETED_STRENGTH_IN_WINDOW (US MUSC-20)
// ---------------------------------------------------------------------------

describe('SELECT_PLANNED_STRENGTH_IN_WINDOW (fenêtre bornée, spec R2/D1)', () => {
  const WINDOW_START = '2026-07-06'; // 28 j avant TODAY
  const TODAY = '2026-08-03';

  const query = <T>(sql: string, params: unknown[]) => testPowerSync.getAll<T>(sql, params);

  it('exclut les occurrences avant et APRÈS la fenêtre — bug trouvé en revue : la borne haute avait été perdue entre le plan et le code', async () => {
    const { programId, sessionIds } = seedProgram(1);
    seed('planned_sessions', [
      {
        owner_id: 'user-1',
        program_id: programId,
        session_id: sessionIds[0],
        scheduled_date: '2026-06-01', // avant la fenêtre
        status: 'planned',
      },
      {
        owner_id: 'user-1',
        program_id: programId,
        session_id: sessionIds[0],
        scheduled_date: '2026-07-20', // dans la fenêtre
        status: 'done',
      },
      {
        owner_id: 'user-1',
        program_id: programId,
        session_id: sessionIds[0],
        scheduled_date: '2026-09-01', // après aujourd'hui — reste du programme généré à l'avance
        status: 'planned',
      },
    ]);

    const rows = await query<{ status: string }>(SELECT_PLANNED_STRENGTH_IN_WINDOW, [
      'user-1',
      WINDOW_START,
      TODAY,
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('done');
  });

  it('ignore le pilier course (programs.pillar différent de strength)', async () => {
    const { programId, sessionIds } = seedProgram(1, { pillar: 'running' });
    seed('planned_sessions', [
      {
        owner_id: 'user-1',
        program_id: programId,
        session_id: sessionIds[0],
        scheduled_date: '2026-07-20',
        status: 'done',
      },
    ]);

    const rows = await query(SELECT_PLANNED_STRENGTH_IN_WINDOW, ['user-1', WINDOW_START, TODAY]);
    expect(rows).toHaveLength(0);
  });
});

describe('SELECT_COMPLETED_STRENGTH_IN_WINDOW (spec R1)', () => {
  const WINDOW_START_UTC = '2026-07-06T00:00:00.000Z';

  const query = <T>(sql: string, params: unknown[]) => testPowerSync.getAll<T>(sql, params);

  it('ne retient que les séances terminées dans la fenêtre', async () => {
    seed('workouts', [
      { user_id: 'user-1', status: 'completed', finished_at: '2026-06-01T10:00:00.000Z' }, // avant
      { user_id: 'user-1', status: 'completed', finished_at: '2026-07-20T10:00:00.000Z' }, // dedans
      { user_id: 'user-1', status: 'active', finished_at: null }, // pas terminée
    ]);

    const rows = await query<{ finished_at: string }>(SELECT_COMPLETED_STRENGTH_IN_WINDOW, [
      WINDOW_START_UTC,
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.finished_at).toBe('2026-07-20T10:00:00.000Z');
  });
});

/**
 * US CIBLE-01 — la lecture **par plage** des séances planifiées (`SELECT_PLANNED_DAYS_BETWEEN`) retient
 * exactement les jours que `SELECT_HAS_PLANNED` retient jour par jour (spec R5) : c'est ce qui permet à
 * l'historique, au planning repas et au widget de lire une plage en une requête sans changer la règle
 * du jour d'entraînement de `useIsTrainingDay` (et de Noryn).
 *
 * Joué sur le harnais SQLite, avec les requêtes réelles.
 */

import { renderHook } from '@testing-library/react-native';
import { useQuery } from '@powersync/react';

import { SELECT_HAS_PLANNED, SELECT_PLANNED_DAYS_BETWEEN, usePlannedDayKeys } from '../planned-session-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

const OWNER = 'owner-1';
const DAYS = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];

beforeEach(() => {
  resetTestDb();
  const [program] = seed('programs', [{ owner_id: OWNER, pillar: 'strength', is_active: 1 }]);
  const [deletedProgram] = seed('programs', [{ owner_id: OWNER, pillar: 'running', is_active: 0, deleted_at: '2026-10-01T00:00:00Z' }]);
  const [session] = seed('sessions', [{ program_id: program, name: 'A', order_index: 0 }]);
  const [deletedSession] = seed('sessions', [{ program_id: program, name: 'B', order_index: 1, deleted_at: '2026-10-01T00:00:00Z' }]);
  const occurrence = (date: string, status: string, extra: Record<string, unknown> = {}) => ({
    owner_id: OWNER,
    program_id: program,
    session_id: session,
    scheduled_date: date,
    status,
    ...extra,
  });
  seed('planned_sessions', [
    occurrence('2026-10-04', 'planned'),
    occurrence('2026-10-05', 'done'),
    occurrence('2026-10-06', 'skipped'),
    occurrence('2026-10-07', 'planned', { deleted_at: '2026-10-02T00:00:00Z' }),
    occurrence('2026-10-08', 'planned', { owner_id: 'someone-else' }),
    // Programme supprimé : l'app supprime ses occurrences en cascade (`deleteProgram`).
    occurrence('2026-10-09', 'planned', { program_id: deletedProgram, deleted_at: '2026-10-01T00:00:00Z' }),
    // Séance-modèle supprimée hors de l'app, occurrence restée : comptée des deux côtés (aucune jointure).
    occurrence('2026-10-10', 'planned', { session_id: deletedSession }),
    // Deux occurrences le même jour, l'une sautée : le jour compte.
    occurrence('2026-10-11', 'skipped'),
    occurrence('2026-10-11', 'planned'),
  ]);
});

const hasPlanned = async (day: string) => (await testPowerSync.getAll(SELECT_HAS_PLANNED, [OWNER, day])).length > 0;
const between = async (from: string, to: string) =>
  (await testPowerSync.getAll<{ scheduled_date: string }>(SELECT_PLANNED_DAYS_BETWEEN, [OWNER, from, to])).map(
    (r) => r.scheduled_date,
  );

describe('SELECT_PLANNED_DAYS_BETWEEN', () => {
  it('jour par jour, les mêmes jours que SELECT_HAS_PLANNED', async () => {
    const range = new Set(await between(DAYS[0]!, DAYS[DAYS.length - 1]!));
    for (const day of DAYS) {
      expect({ day, inRange: range.has(day) }).toEqual({ day, inRange: await hasPlanned(day) });
    }
  });

  it('le détail : `planned` et `done`, sans `skipped`, ni supprimée, ni d’un autre propriétaire', async () => {
    expect((await between('2026-10-01', '2026-10-31')).sort()).toEqual(['2026-10-04', '2026-10-05', '2026-10-10', '2026-10-11']);
  });

  it('bornes incluses ; un jour une seule fois', async () => {
    expect(await between('2026-10-05', '2026-10-05')).toEqual(['2026-10-05']);
    expect(await between('2026-10-11', '2026-10-11')).toEqual(['2026-10-11']);
  });

  it('plage vide (début après la fin) : aucun jour', async () => {
    expect(await between('2026-10-12', '2026-10-04')).toEqual([]);
  });
});

describe('usePlannedDayKeys', () => {
  it('une seule requête pour la plage, et les jours qu’elle rend', async () => {
    const mockQuery = useQuery as jest.Mock;
    mockQuery.mockClear();
    mockQuery.mockReturnValueOnce({ data: [{ scheduled_date: '2026-10-08' }, { scheduled_date: '2026-10-10' }], isLoading: false });
    const { result } = await renderHook(() => usePlannedDayKeys('2026-10-08', '2026-11-30'));
    expect(mockQuery.mock.calls.filter(([sql]) => sql === SELECT_PLANNED_DAYS_BETWEEN)).toHaveLength(1);
    expect(mockQuery.mock.calls[0]![1]).toEqual([expect.any(String), '2026-10-08', '2026-11-30']);
    expect([...result.current.dayKeys]).toEqual(['2026-10-08', '2026-10-10']);
  });
});

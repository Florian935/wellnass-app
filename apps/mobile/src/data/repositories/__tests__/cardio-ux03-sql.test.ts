/**
 * US CARDIO-UX03 — les requêtes du hub Course en trois onglets, sur du vrai SQLite.
 *
 *  - `SELECT_HISTORY` ramène la séance de programme réalisée (« la dernière fois », R3) ;
 *  - `SELECT_PLANNED_RUNNING_DAYS` : les jours de course prévus du calendrier (R8) ;
 *  - `SELECT_RUN_PROGRAM_PROGRESS` / `SELECT_RUN_PROGRAM_RACE` : « Ton programme » (D8, R11).
 */

import { SELECT_PLANNED_RUNNING_DAYS } from '../planned-session-repository';
import { SELECT_HISTORY_FOR_TEST } from '../run-repository';
import { SELECT_RUN_PROGRAM_PROGRESS, SELECT_RUN_PROGRAM_RACE } from '../run-hub-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

const USER = 'user-1';

beforeEach(() => {
  resetTestDb();
  seed('programs', [
    {
      id: 'prog-10k',
      owner_id: USER,
      pillar: 'running',
      is_active: 1,
      target_date: '2026-11-08',
      target_time_seconds: 2940,
      event_name: 'Les 10 km du lac',
    },
    { id: 'prog-muscu', owner_id: USER, pillar: 'strength', is_active: 1 },
  ]);
  seed('sessions', [
    { id: 'frac', program_id: 'prog-10k', owner_id: USER, session_type: 'fractionne', order_index: 0 },
    { id: 'sl', program_id: 'prog-10k', owner_id: USER, session_type: 'sortie_longue', order_index: 1, target_distance_m: 12000 },
    { id: 'course', program_id: 'prog-10k', owner_id: USER, session_type: 'course', order_index: 2, target_distance_m: 10000 },
    { id: 'legs', program_id: 'prog-muscu', owner_id: USER, order_index: 0 },
  ]);
});

describe('SELECT_HISTORY — la séance réalisée (R3)', () => {
  it('ramène session_id pour une course de programme, null pour une course libre', async () => {
    seed('planned_sessions', [
      { id: 'ps-1', owner_id: USER, program_id: 'prog-10k', session_id: 'frac', scheduled_date: '2026-09-18', status: 'done' },
    ]);
    seed('runs', [
      { id: 'r-seance', user_id: USER, status: 'completed', started_at: '2026-09-18T16:30:00Z', finished_at: '2026-09-18T17:14:00Z', planned_session_id: 'ps-1' },
      { id: 'r-libre', user_id: USER, status: 'completed', started_at: '2026-09-16T10:30:00Z', finished_at: '2026-09-16T10:54:00Z' },
    ]);

    const rows = await testPowerSync.getAll<{ id: string; session_id: string | null; session_type: string | null }>(
      SELECT_HISTORY_FOR_TEST,
    );
    expect(rows.map((r) => [r.id, r.session_id, r.session_type])).toEqual([
      ['r-seance', 'frac', 'fractionne'],
      ['r-libre', null, null],
    ]);
  });

  it('🔴 une occurrence supprimée depuis ne rattache plus la course à une séance', async () => {
    seed('planned_sessions', [
      {
        id: 'ps-1',
        owner_id: USER,
        program_id: 'prog-10k',
        session_id: 'frac',
        scheduled_date: '2026-09-18',
        status: 'done',
        deleted_at: '2026-09-19T08:00:00Z',
      },
    ]);
    seed('runs', [
      { id: 'r-1', user_id: USER, status: 'completed', started_at: '2026-09-18T16:30:00Z', finished_at: '2026-09-18T17:14:00Z', planned_session_id: 'ps-1' },
    ]);
    const rows = await testPowerSync.getAll<{ session_id: string | null }>(SELECT_HISTORY_FOR_TEST);
    expect(rows[0]!.session_id).toBeNull();
  });
});

describe('SELECT_PLANNED_RUNNING_DAYS — les jours prévus du calendrier (R8)', () => {
  it('les occurrences de course prévues, bornes incluses, sans les faites ni la muscu', async () => {
    seed('planned_sessions', [
      { id: 'a', owner_id: USER, program_id: 'prog-10k', session_id: 'frac', scheduled_date: '2026-09-25', status: 'planned' },
      { id: 'b', owner_id: USER, program_id: 'prog-10k', session_id: 'sl', scheduled_date: '2026-09-27', status: 'planned' },
      { id: 'c', owner_id: USER, program_id: 'prog-10k', session_id: 'sl', scheduled_date: '2026-09-30', status: 'planned' },
      { id: 'fait', owner_id: USER, program_id: 'prog-10k', session_id: 'frac', scheduled_date: '2026-09-26', status: 'done' },
      { id: 'saute', owner_id: USER, program_id: 'prog-10k', session_id: 'frac', scheduled_date: '2026-09-28', status: 'skipped' },
      { id: 'muscu', owner_id: USER, program_id: 'prog-muscu', session_id: 'legs', scheduled_date: '2026-09-29', status: 'planned' },
      { id: 'hors', owner_id: USER, program_id: 'prog-10k', session_id: 'frac', scheduled_date: '2026-10-02', status: 'planned' },
      { id: 'autre', owner_id: 'user-2', program_id: 'prog-10k', session_id: 'frac', scheduled_date: '2026-09-26', status: 'planned' },
    ]);
    const rows = await testPowerSync.getAll<{ scheduled_date: string }>(SELECT_PLANNED_RUNNING_DAYS, [
      USER,
      '2026-09-25',
      '2026-09-30',
    ]);
    expect(rows.map((r) => r.scheduled_date)).toEqual(['2026-09-25', '2026-09-27', '2026-09-30']);
  });
});

describe('« Ton programme » — avancement et échéance (D8, R11)', () => {
  it('séances faites, total et semaine courante (0-based), sans les occurrences supprimées', async () => {
    seed('planned_sessions', [
      { id: 'w0a', owner_id: USER, program_id: 'prog-10k', session_id: 'frac', scheduled_date: '2026-09-11', status: 'done', week_index: 0 },
      { id: 'w0b', owner_id: USER, program_id: 'prog-10k', session_id: 'sl', scheduled_date: '2026-09-13', status: 'done', week_index: 0 },
      { id: 'w1a', owner_id: USER, program_id: 'prog-10k', session_id: 'frac', scheduled_date: '2026-09-18', status: 'done', week_index: 1 },
      { id: 'w1b', owner_id: USER, program_id: 'prog-10k', session_id: 'sl', scheduled_date: '2026-09-20', status: 'skipped', week_index: 1 },
      { id: 'w2a', owner_id: USER, program_id: 'prog-10k', session_id: 'frac', scheduled_date: '2026-09-25', status: 'planned', week_index: 2 },
      { id: 'w2b', owner_id: USER, program_id: 'prog-10k', session_id: 'sl', scheduled_date: '2026-09-27', status: 'planned', week_index: 2 },
      { id: 'suppr', owner_id: USER, program_id: 'prog-10k', session_id: 'sl', scheduled_date: '2026-09-27', status: 'planned', week_index: 2, deleted_at: '2026-09-20T08:00:00Z' },
    ]);
    const rows = await testPowerSync.getAll<{ done_count: number; total_count: number; current_week: number }>(
      SELECT_RUN_PROGRAM_PROGRESS,
      [USER, 'prog-10k'],
    );
    expect(rows[0]).toEqual({ done_count: 3, total_count: 6, current_week: 2 });
  });

  it('l’échéance, l’objectif, l’événement et la distance de la séance « course »', async () => {
    const rows = await testPowerSync.getAll<Record<string, unknown>>(SELECT_RUN_PROGRAM_RACE, ['prog-10k']);
    expect(rows[0]).toEqual({
      target_date: '2026-11-08',
      target_time_seconds: 2940,
      event_name: 'Les 10 km du lac',
      race_distance_m: 10000,
    });
  });

  it('sans séance « course », la distance de course est inconnue', async () => {
    seed('programs', [{ id: 'prog-reprise', owner_id: USER, pillar: 'running', is_active: 0 }]);
    seed('sessions', [
      { id: 'ef', program_id: 'prog-reprise', owner_id: USER, session_type: 'endurance', order_index: 0, target_distance_m: 6000 },
    ]);
    const rows = await testPowerSync.getAll<Record<string, unknown>>(SELECT_RUN_PROGRAM_RACE, ['prog-reprise']);
    expect(rows[0]).toMatchObject({ target_date: null, race_distance_m: null });
  });
});

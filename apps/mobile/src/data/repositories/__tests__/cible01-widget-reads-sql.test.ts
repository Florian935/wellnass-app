/**
 * US CIBLE-01 — le widget lit les séances par `SELECT_WORKOUTS` (la requête de la dépense), là où
 * `useIsTrainingDay` lit l'historique (`SELECT_HISTORY` de `workout-repository`, qui calcule aussi noms,
 * volumes et records). Pour le jour d'entraînement, seules comptent les séances **terminées**, non
 * supprimées, avec une fin : les deux requêtes doivent retenir les mêmes séances (spec R6).
 *
 * Joué sur le harnais SQLite, avec les requêtes réelles.
 */

import { SELECT_WORKOUTS } from '../energy-repository';
import { SELECT_HISTORY as SELECT_WORKOUT_HISTORY } from '../workout-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

beforeEach(() => {
  resetTestDb();
  const workout = (id: string, status: string, finishedAt: string | null, extra: Record<string, unknown> = {}) => ({
    id,
    user_id: 'user-1',
    status,
    started_at: '2026-10-08T16:00:00.000Z',
    finished_at: finishedAt,
    ...extra,
  });
  seed('workouts', [
    workout('w-done', 'completed', '2026-10-08T17:00:00.000Z'),
    workout('w-late', 'completed', '2026-10-07T21:50:00.000Z'),
    workout('w-no-end', 'completed', null),
    workout('w-active', 'active', null),
    workout('w-cancelled', 'cancelled', '2026-10-06T17:00:00.000Z'),
    workout('w-deleted', 'completed', '2026-10-05T17:00:00.000Z', { deleted_at: '2026-10-05T18:00:00.000Z' }),
  ]);
});

const finishedIds = (rows: { id: string; finished_at: string | null }[]) =>
  rows.filter((r) => r.finished_at != null).map((r) => r.id).sort();

describe('SELECT_WORKOUTS contre l’historique des séances', () => {
  it('les mêmes séances terminées, avec une fin', async () => {
    const energy = await testPowerSync.getAll<{ id: string; finished_at: string | null }>(SELECT_WORKOUTS);
    const history = await testPowerSync.getAll<{ id: string; finished_at: string | null }>(SELECT_WORKOUT_HISTORY, ['fr', 'fr']);
    expect(finishedIds(energy)).toEqual(['w-done', 'w-late']);
    expect(finishedIds(energy)).toEqual(finishedIds(history));
  });
});

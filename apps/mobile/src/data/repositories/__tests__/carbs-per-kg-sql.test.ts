/**
 * US FUEL-01 — la requête des types de séance de course du jour, exécutée pour de vrai.
 *
 * C'est elle qui alimente `classifyRunningDay` (RN-06). Sans ce fichier, la décision D4 (« une
 * course libre ne se classe pas ») ne serait tenue par rien côté données : la logique pure est bien
 * testée dans `carb-target.test.ts`, mais elle reçoit ce que cette requête lui donne.
 *
 * Ce que ces tests figent, et pourquoi chacun compte :
 *  - **l'owner-scoping** — le harness sème deux utilisateurs ; sans `owner_id` on classerait la
 *    journée d'après le planning de quelqu'un d'autre, et le test resterait vert sur un seul compte ;
 *  - **le filtre pilier** — une séance de muscu le même jour ne doit pas rendre la journée « dure »
 *    au sens de la course ;
 *  - **`status <> 'skipped'`** — une séance sautée n'est pas la nature de la journée, une séance
 *    `done` l'est toujours ;
 *  - **l'absence de `LIMIT`** — deux séances le même jour existent (badge MR-01) et R5 veut que la
 *    plus exigeante gagne : un `LIMIT 1` casserait la règle sans casser aucun autre test ;
 *  - **`session_type` NULL** — c'est ainsi qu'une course libre se présente en base. Le hook le
 *    traduit en `'course_libre'` pour que `classifyRunningDay` renvoie `unavailable` (D4).
 */
import { SELECT_TODAY_RUN_SESSION_TYPES } from '@/data/repositories/nutrition-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-me' } } }) },
}));

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

const ME = 'user-me';
const OTHER = 'user-other';
const TODAY = '2026-08-07';

/** Une séance planifiée d'un pilier donné, avec son type, à une date donnée. */
function seedPlanned(opts: {
  id: string;
  sessionType: string | null;
  pillar?: string;
  ownerId?: string;
  status?: string;
  date?: string;
}) {
  const sessionId = `session-${opts.id}`;
  const programId = `program-${opts.id}`;
  seed('programs', [
    { id: programId, owner_id: opts.ownerId ?? ME, pillar: opts.pillar ?? 'running' },
  ]);
  seed('sessions', [
    {
      id: sessionId,
      owner_id: opts.ownerId ?? ME,
      program_id: programId,
      session_type: opts.sessionType,
      order_index: 0,
    },
  ]);
  seed('planned_sessions', [
    {
      id: opts.id,
      owner_id: opts.ownerId ?? ME,
      program_id: programId,
      session_id: sessionId,
      scheduled_date: opts.date ?? TODAY,
      status: opts.status ?? 'planned',
    },
  ]);
}

async function run(): Promise<string[]> {
  const rows = await testPowerSync.getAll<{ session_type: string | null }>(
    SELECT_TODAY_RUN_SESSION_TYPES,
    [ME, TODAY],
  );
  return rows.map((r) => r.session_type ?? 'course_libre');
}

describe('SELECT_TODAY_RUN_SESSION_TYPES (FUEL-01, RN-06)', () => {
  beforeEach(() => {
    resetTestDb();
  });

  it('remonte le type de la séance de course du jour', async () => {
    seedPlanned({ id: 'p1', sessionType: 'fractionne' });
    await expect(run()).resolves.toEqual(['fractionne']);
  });

  it('ignore les séances d’un autre utilisateur (owner-scoping)', async () => {
    seedPlanned({ id: 'p1', sessionType: 'fractionne', ownerId: OTHER });
    await expect(run()).resolves.toEqual([]);
  });

  it('ignore les séances de musculation — le pilier est filtré', async () => {
    seedPlanned({ id: 'p1', sessionType: null, pillar: 'strength' });
    await expect(run()).resolves.toEqual([]);
  });

  it('ignore un autre jour', async () => {
    seedPlanned({ id: 'p1', sessionType: 'endurance', date: '2026-08-06' });
    await expect(run()).resolves.toEqual([]);
  });

  it('exclut une séance sautée, garde une séance déjà faite', async () => {
    seedPlanned({ id: 'p1', sessionType: 'fractionne', status: 'skipped' });
    seedPlanned({ id: 'p2', sessionType: 'endurance', status: 'done' });
    await expect(run()).resolves.toEqual(['endurance']);
  });

  it('remonte LES DEUX séances quand il y en a deux le même jour (aucun LIMIT)', async () => {
    seedPlanned({ id: 'p1', sessionType: 'endurance' });
    seedPlanned({ id: 'p2', sessionType: 'fractionne' });
    const types = await run();
    expect(types).toHaveLength(2);
    expect(types.sort()).toEqual(['endurance', 'fractionne']);
  });

  it('un session_type NULL (course libre) remonte et devient course_libre', async () => {
    seedPlanned({ id: 'p1', sessionType: null });
    await expect(run()).resolves.toEqual(['course_libre']);
  });

  it('ignore une séance soft-deletée', async () => {
    seedPlanned({ id: 'p1', sessionType: 'fractionne' });
    testPowerSync.execute(`UPDATE planned_sessions SET deleted_at = ? WHERE id = ?`, [
      '2026-08-07T10:00:00Z',
      'p1',
    ]);
    await expect(run()).resolves.toEqual([]);
  });
});

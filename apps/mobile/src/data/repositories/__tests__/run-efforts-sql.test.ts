/**
 * US EFFORT-01 — le journal des efforts, contre du **vrai SQL** et le **vrai schéma local**.
 *
 * ── Ce que ce fichier ferme comme piège ─────────────────────────────────────────────────────────
 * Une table absente de `powersync/schema.ts` existe côté Postgres et **reste invisible du client** :
 * l'écriture lève, l'appelant avale le rejet, et l'écran affiche « pas de donnée » — un état
 * parfaitement légitime. Aucun crash, aucun log, aucun test rouge. C'est la panne de
 * `cycle_tracking_enabled` (CYCLE-01, 31/07/2026) et de `daily_step_goal` (03/08/2026).
 *
 * Ici, la base SQLite est construite **à partir de `AppSchema`** : si `run_efforts` manquait au
 * schéma local, chaque cas de ce fichier échouerait sur `no such table`.
 *
 * ── Ce qui est vérifié ──────────────────────────────────────────────────────────────────────────
 *  1. le journal s'écrit, et la course est **marquée traitée** ;
 *  2. une course **sans effort** (tapis, trace trop courte) est marquée **quand même** — sinon le
 *     rattrapage la reprendrait indéfiniment (spec R20) ;
 *  3. l'écriture est **idempotente** : rejouer ne duplique rien ;
 *  4. le **rattrapage** traite l'historique et se reprend là où il s'est arrêté ;
 *  5. la suppression d'une course **emporte ses efforts** — sinon un coureur resterait classé
 *     contre une sortie qui n'existe plus (spec R18).
 */

import {
  resetTestDb,
  rowsOf,
  seed,
  testPowerSync,
} from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

import {
  backfillRunEfforts,
  softDeleteRunEfforts,
  storeRunEfforts,
  storeRunEffortsFromPoints,
} from '../run-effort-repository';

/** Trace rectiligne : `n` points espacés de `stepM` mètres et `stepS` secondes. */
const line = (n: number, stepM: number, stepS: number) =>
  Array.from({ length: n }, (_, i) => ({
    lat: 45 + (i * stepM) / 111320,
    lng: 3,
    t: i * stepS,
  }));

/** Une course terminée dans la base de test. */
function seedRun(id: string, overrides: Record<string, unknown> = {}) {
  seed('runs', [
    {
      id,
      user_id: 'user-1',
      status: 'completed',
      source: 'gps',
      started_at: '2026-09-20T07:00:00.000Z',
      finished_at: '2026-09-20T07:45:00.000Z',
      gps_track: 'non-vide',
      efforts_computed_at: null,
      created_at: '2026-09-20T07:45:00.000Z',
      updated_at: '2026-09-20T07:45:00.000Z',
      ...overrides,
    },
  ]);
}

/** Les efforts d'une course, **lignes supprimées comprises** — c'est le soft delete qu'on teste. */
const effortsOf = (runId: string) =>
  rowsOf<{ run_id: string; distance_key: string; deleted_at: string | null }>(
    'run_efforts',
    true,
  ).filter((e) => e.run_id === runId);

const runMarker = async (runId: string) =>
  (
    await testPowerSync.getOptional<{ efforts_computed_at: string | null }>(
      `SELECT efforts_computed_at FROM runs WHERE id = ?`,
      [runId],
    )
  )?.efforts_computed_at ?? null;

beforeEach(() => {
  resetTestDb();
});

describe('storeRunEffortsFromPoints', () => {
  it('écrit un effort par distance atteinte et marque la course', async () => {
    seedRun('run-1');

    // ~2 km à 5:00 /km → 400 m, demi-mile, 1 km, mile.
    const written = await storeRunEffortsFromPoints(
      'run-1',
      line(201, 10, 3),
      '2026-09-20T07:45:00.000Z',
    );

    expect(written).toBe(4);
    expect(effortsOf('run-1').map((e) => e.distance_key)).toEqual([
      '400m',
      'halfmile',
      '1k',
      'mile',
    ]);
    expect(await runMarker('run-1')).not.toBeNull();
  });

  it('marque la course MÊME sans aucun effort (spec R20)', async () => {
    seedRun('run-tapis', { source: 'manual', gps_track: null });

    const written = await storeRunEffortsFromPoints('run-tapis', [], '2026-09-20T07:45:00.000Z');

    expect(written).toBe(0);
    expect(effortsOf('run-tapis')).toHaveLength(0);
    // 🔴 Le cœur du test : sans ce marqueur, le rattrapage reprendrait cette course à **chaque**
    // démarrage de l'app, pour ne jamais rien écrire.
    expect(await runMarker('run-tapis')).not.toBeNull();
  });
});

describe('storeRunEfforts (depuis l’identifiant)', () => {
  it('est idempotent : une course déjà traitée n’est pas retouchée', async () => {
    seedRun('run-1');
    await storeRunEffortsFromPoints('run-1', line(201, 10, 3), '2026-09-20T07:45:00.000Z');
    const before = effortsOf('run-1').length;

    const written = await storeRunEfforts('run-1');

    expect(written).toBe(0);
    expect(effortsOf('run-1')).toHaveLength(before);
  });

  it('ignore une course non terminée, et ne la marque pas', async () => {
    seedRun('run-active', { status: 'active', finished_at: null });

    expect(await storeRunEfforts('run-active')).toBe(0);
    expect(await runMarker('run-active')).toBeNull();
  });

  it('ignore une course inconnue sans lever', async () => {
    await expect(storeRunEfforts('run-fantome')).resolves.toBe(0);
  });
});

describe('backfillRunEfforts', () => {
  it('traite les courses jamais traitées et saute les autres', async () => {
    seedRun('run-a', { gps_track: null, source: 'manual' });
    seedRun('run-b', { gps_track: null, source: 'manual' });
    seedRun('run-deja', {
      gps_track: null,
      source: 'manual',
      efforts_computed_at: '2026-09-19T10:00:00.000Z',
    });

    const done = await backfillRunEfforts();

    expect(done).toBe(2);
    expect(await runMarker('run-a')).not.toBeNull();
    expect(await runMarker('run-b')).not.toBeNull();
    // Inchangée : le rattrapage ne réécrit pas ce qui l'a déjà été.
    expect(await runMarker('run-deja')).toBe('2026-09-19T10:00:00.000Z');
  });

  it('ne traite pas deux fois de suite (le second passage n’a plus rien à faire)', async () => {
    seedRun('run-a', { gps_track: null, source: 'manual' });

    expect(await backfillRunEfforts()).toBe(1);
    expect(await backfillRunEfforts()).toBe(0);
  });

  it('une base sans course ne fait rien et ne lève pas', async () => {
    await expect(backfillRunEfforts()).resolves.toBe(0);
  });
});

describe('softDeleteRunEfforts', () => {
  it('efface logiquement les efforts d’une course, et seulement les siens', async () => {
    seedRun('run-1');
    seedRun('run-2');
    await storeRunEffortsFromPoints('run-1', line(201, 10, 3), '2026-09-20T07:45:00.000Z');
    await storeRunEffortsFromPoints('run-2', line(201, 10, 3), '2026-09-20T08:45:00.000Z');

    await softDeleteRunEfforts('run-1');

    expect(effortsOf('run-1').every((e) => e.deleted_at !== null)).toBe(true);
    // 🔴 L'autre course garde les siens : sinon un coureur perdrait tout son classement en
    // supprimant une seule sortie.
    expect(effortsOf('run-2').every((e) => e.deleted_at === null)).toBe(true);
  });
});

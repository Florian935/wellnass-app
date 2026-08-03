/**
 * Pilier Running — écritures de `run-repository`, exécutées sur **du vrai SQLite**.
 *
 * Lot 1 de [strategie-tests.md](../../../../../../docs/specs/technical/strategie-tests.md).
 * Ce fichier cible les gardes que seule une course réelle mettait à l'épreuve jusqu'ici, et qui
 * sont **coûteuses à reproduire sur device** (il faut sortir courir) :
 *  - au plus une course active à la fois ;
 *  - un flush GPS **tardif** (la tâche de fond résout après `finishRun`) ne doit pas ressusciter
 *    ni réécrire une course close — c'est le scénario de corruption le plus vicieux du pilier ;
 *  - la **sérialisation** des flushs concurrents : deux read-append-write entrelacés perdraient
 *    un segment de trace ;
 *  - l'idempotence de la clôture, et le calcul d'allure depuis les scalaires flushés.
 *
 * Les règles pures (`appendToTrack`, `averagePace`, `decodeTrack`) restent testées dans
 * `@wellness/shared` : on vérifie ici leur **câblage à la base**.
 */

import {
  cancelRun,
  finishManualRun,
  finishRun,
  flushTrack,
  setManualRunDistance,
  setRunFeedback,
  setRunTerrain,
  startRun,
} from '../run-repository';
import { resetTestDb, rowsOf } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

jest.mock('@/lib/analytics', () => ({
  ANALYTICS_EVENTS: { runStarted: 'run_started', runCompleted: 'run_completed' },
  track: jest.fn(async () => undefined),
}));
jest.mock('@/lib/health-connect', () => ({
  pushRun: jest.fn(async () => undefined),
}));

type RunRow = {
  id: string;
  status: string;
  source: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  distance_m: number | null;
  avg_pace_s_per_km: number | null;
  gps_track: string | null;
  rpe: number | null;
  notes: string | null;
  planned_session_id: string | null;
  terrain: string | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
};

const run = (id: string, includeDeleted = false) =>
  rowsOf<RunRow>('runs', includeDeleted).find((r) => r.id === id);

/** Segment de trace factice — le contenu importe peu, seul l'assemblage est testé ici. */
const segment = (label: string) => ({
  segmentEncoded: label,
  distanceM: 0,
  durationSeconds: 0,
  elevationGainM: 0,
  elevationLossM: 0,
});

beforeEach(() => {
  resetTestDb();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------

describe('startRun', () => {
  it('crée une course active vide', async () => {
    const id = await startRun('gps');

    expect(run(id)).toMatchObject({
      status: 'active',
      source: 'gps',
      finished_at: null,
      distance_m: null,
      gps_track: null,
    });
  });

  it('n’en crée jamais une seconde : rend la main sur la course active existante', async () => {
    const first = await startRun('gps');

    expect(await startRun('gps')).toBe(first);
    expect(rowsOf('runs')).toHaveLength(1);
  });

  it('pose le lien vers l’occurrence planifiée à la création', async () => {
    const id = await startRun('gps', 'planned-1');

    expect(run(id)?.planned_session_id).toBe('planned-1');
  });

  it('ne réécrit jamais le lien planifié d’une course déjà active', async () => {
    const first = await startRun('gps');

    const second = await startRun('gps', 'planned-1');

    expect(second).toBe(first);
    expect(run(first)?.planned_session_id).toBeNull();
  });

  it('ignore une course active supprimée', async () => {
    const first = await startRun('gps');
    await cancelRun(first);

    expect(await startRun('gps')).not.toBe(first);
  });
});

// ---------------------------------------------------------------------------
// Trace GPS
// ---------------------------------------------------------------------------

describe('flushTrack', () => {
  it('accumule les segments et écrase les scalaires par ceux du tracker', async () => {
    const id = await startRun('gps');

    await flushTrack(id, {
      segmentEncoded: 'aaa',
      distanceM: 1200,
      durationSeconds: 300,
      elevationGainM: 12,
      elevationLossM: 3,
    });
    await flushTrack(id, {
      segmentEncoded: 'bb',
      distanceM: 2500,
      durationSeconds: 640,
      elevationGainM: 20,
      elevationLossM: 8,
    });

    expect(run(id)).toMatchObject({
      // Encodage `longueur:contenu` d'`appendToTrack`, concaténé dans l'ordre des flushs.
      gps_track: '3:aaa2:bb',
      distance_m: 2500,
      duration_seconds: 640,
      elevation_gain_m: 20,
      elevation_loss_m: 8,
    });
  });

  it('sérialise les flushs concurrents sans perdre de segment', async () => {
    const id = await startRun('gps');

    // Lancés sans await intermédiaire : c'est le cas réel (tâche de fond GPS + flush de pause).
    await Promise.all([
      flushTrack(id, segment('a')),
      flushTrack(id, segment('b')),
      flushTrack(id, segment('c')),
    ]);

    expect(run(id)?.gps_track).toBe('1:a1:b1:c');
  });

  it('jette un flush tardif arrivé après la clôture — une course close n’est jamais réécrite', async () => {
    const id = await startRun('gps');
    await flushTrack(id, { ...segment('a'), distanceM: 5000, durationSeconds: 1500 });
    await finishRun(id);

    await flushTrack(id, { ...segment('zzz'), distanceM: 99999, durationSeconds: 99999 });

    expect(run(id)).toMatchObject({
      status: 'completed',
      gps_track: '1:a',
      distance_m: 5000,
      duration_seconds: 1500,
    });
  });

  it('jette un flush tardif sur une course annulée, et sur une course inconnue', async () => {
    const id = await startRun('gps');
    await cancelRun(id);

    await flushTrack(id, segment('zzz'));
    await expect(flushTrack('inconnue', segment('zzz'))).resolves.toBeUndefined();

    expect(run(id, true)?.gps_track).toBeNull();
  });

  it('ne casse pas la chaîne de flushs après un échec', async () => {
    const id = await startRun('gps');

    // Course inconnue : no-op, mais la chaîne module-level doit rester utilisable ensuite.
    await flushTrack('inconnue', segment('x'));
    await flushTrack(id, segment('a'));

    expect(run(id)?.gps_track).toBe('1:a');
  });
});

// ---------------------------------------------------------------------------
// Clôture
// ---------------------------------------------------------------------------

describe('finishRun', () => {
  it('calcule l’allure moyenne depuis les scalaires flushés', async () => {
    const id = await startRun('gps');
    await flushTrack(id, { ...segment('a'), distanceM: 5000, durationSeconds: 1500 });

    await finishRun(id, { rpe: 6, notes: 'facile' });

    expect(run(id)).toMatchObject({
      status: 'completed',
      distance_m: 5000,
      avg_pace_s_per_km: 300, // 1500 s / 5 km
      rpe: 6,
      notes: 'facile',
    });
    expect(run(id)?.finished_at).not.toBeNull();
  });

  it('laisse l’allure nulle quand la distance est inconnue', async () => {
    const id = await startRun('manual');

    await finishRun(id);

    expect(run(id)).toMatchObject({ status: 'completed', avg_pace_s_per_km: null });
  });

  it('est idempotente : un second appel ne re-stampe rien', async () => {
    const id = await startRun('gps');
    await finishRun(id, { rpe: 5 });
    const first = run(id);

    await finishRun(id, { rpe: 9 });

    expect(run(id)).toMatchObject({ finished_at: first?.finished_at, rpe: 5 });
  });

  it('ne clôture ni une course supprimée ni une course inconnue', async () => {
    const id = await startRun('gps');
    await cancelRun(id);

    await finishRun(id);
    await expect(finishRun('inconnue')).resolves.toBeUndefined();

    expect(run(id, true)).toMatchObject({ status: 'cancelled', finished_at: null });
  });

  it('n’applique la distance manuelle qu’à une course de source manuelle', async () => {
    const gps = await startRun('gps');
    await flushTrack(gps, { ...segment('a'), distanceM: 5000, durationSeconds: 1500 });

    await finishManualRun(gps, 42_000);

    expect(run(gps)?.distance_m).toBe(5000);
  });

  it('applique la distance manuelle et recalcule l’allure sur une course manuelle', async () => {
    const id = await startRun('manual');
    // La durée d'une course manuelle est posée par le tracker avant la clôture ; la distance,
    // elle, reste à saisir à la main.
    await flushTrack(id, { ...segment('a'), durationSeconds: 1800 });

    await finishManualRun(id, 6000);

    expect(run(id)).toMatchObject({ distance_m: 6000, avg_pace_s_per_km: 300 });
  });
});

describe('cancelRun', () => {
  it('passe la course en annulée puis la supprime en douceur', async () => {
    const id = await startRun('gps');

    await cancelRun(id);

    expect(rowsOf('runs')).toHaveLength(0);
    expect(run(id, true)).toMatchObject({ status: 'cancelled' });
  });
});

// ---------------------------------------------------------------------------
// Compléments post-course
// ---------------------------------------------------------------------------

describe('setRunFeedback / setRunTerrain', () => {
  it('complète une course déjà close sans toucher au statut', async () => {
    const id = await startRun('gps');
    await finishRun(id);

    await setRunFeedback(id, { rpe: 8 });
    await setRunTerrain(id, 'trail');

    expect(run(id)).toMatchObject({ status: 'completed', rpe: 8, terrain: 'trail' });
  });

  it('n’écrit que les clés présentes — omettre `notes` ne l’efface pas', async () => {
    const id = await startRun('gps');
    await finishRun(id, { notes: 'sortie longue' });

    await setRunFeedback(id, { rpe: 7 });

    expect(run(id)).toMatchObject({ rpe: 7, notes: 'sortie longue' });
  });
});

describe('setManualRunDistance', () => {
  it('écrit la distance et recalcule l’allure sur une course manuelle', async () => {
    const id = await startRun('manual');
    await flushTrack(id, { ...segment('a'), durationSeconds: 1200 });
    await finishRun(id);

    await setManualRunDistance(id, 4000);

    expect(run(id)).toMatchObject({ distance_m: 4000, avg_pace_s_per_km: 300 });
  });

  it('ne touche pas une course GPS', async () => {
    const id = await startRun('gps');
    await flushTrack(id, { ...segment('a'), distanceM: 5000, durationSeconds: 1500 });
    await finishRun(id);

    await setManualRunDistance(id, 42_000);

    expect(run(id)?.distance_m).toBe(5000);
  });

  it('est un no-op sur une course inconnue', async () => {
    await expect(setManualRunDistance('inconnue', 1000)).resolves.toBeUndefined();
  });
});

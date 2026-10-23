/**
 * US CARDIO-02 — comment l'allure de référence bouge après qu'on l'a donnée, sur **du vrai SQLite**.
 *
 *  - **R18** : un record 5 km de fin de course ne remplace l'allure que s'il est plus rapide. Avant,
 *    le premier footing de 5 km écrasait l'allure qu'un coureur venait de donner — le défaut latent
 *    trouvé au cadrage, que les quatre portes auraient rendu fréquent.
 *  - **R19** : le recalcul des records n'écrit jamais l'allure, et deux recalculs ne se chevauchent pas.
 *  - **R20** : supprimer la course du record dont venait l'allure la fait suivre le record suivant ;
 *    une allure donnée par le coureur reste intacte.
 */

import { appendToTrack, encodeSegment, type GpsPoint } from '@wellness/shared';

import { deleteRun } from '../run-repository';
import { backfillRunningRecords, detectAndStoreRunRecords } from '../running-record-repository';
import { getTestDb, resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

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

type PaceRecordRow = { distance_key: string; best_time_seconds: number; run_id: string };
const refPace = () =>
  rowsOf<{ ref_5k_pace_s_per_km: number | null }>('running_profiles')[0]?.ref_5k_pace_s_per_km ?? null;
const record5k = () => rowsOf<PaceRecordRow>('running_pace_records').find((r) => r.distance_key === '5k');

/** Trace rectiligne de `km` kilomètres à `paceSPerKm`, un point tous les 100 m (vrai encodage). */
function track(km: number, paceSPerKm: number): string {
  const points: GpsPoint[] = [];
  const steps = km * 10;
  for (let i = 0; i <= steps; i++) {
    points.push({ lat: 48.85 + i * 0.000899, lng: 2.35, t: Math.round((i / 10) * paceSPerKm) });
  }
  return appendToTrack('', encodeSegment(points));
}

function seedRun(gpsTrack: string, finishedAt = '2026-10-01T09:00:00.000Z'): string {
  const [id] = seed('runs', [
    {
      user_id: 'user-1',
      source: 'gps',
      status: 'completed',
      started_at: '2026-10-01T08:00:00.000Z',
      finished_at: finishedAt,
      gps_track: gpsTrack,
    },
  ]);
  return id!;
}

function seedProfile(refSPerKm: number | null) {
  seed('running_profiles', [{ user_id: 'user-1', ref_5k_pace_s_per_km: refSPerKm }]);
}

beforeEach(() => {
  resetTestDb();
});

describe('R18 — à la fin d’une course, un record plus rapide seulement', () => {
  it('🔴 un premier record 5 km PLUS LENT ne touche pas l’allure donnée', async () => {
    seedProfile(302); // un 10 km en 52:30, donné par une porte
    const footing = seedRun(track(6, 390)); // premier 5 km, en footing à 6:30

    await detectAndStoreRunRecords(footing);

    expect(record5k()).toBeDefined(); // le record, lui, est bien enregistré
    expect(refPace()).toBe(302);
  });

  it('un record plus rapide la remplace', async () => {
    seedProfile(302);
    const rapide = seedRun(track(6, 295));

    await detectAndStoreRunRecords(rapide);

    expect(refPace()).toBe(Math.round(record5k()!.best_time_seconds / 5));
    expect(refPace()).toBeLessThan(302);
  });

  it('sans allure, le premier record la pose', async () => {
    const sortie = seedRun(track(6, 390));

    await detectAndStoreRunRecords(sortie);

    expect(refPace()).toBe(Math.round(record5k()!.best_time_seconds / 5));
  });
});

describe('R19 — le recalcul des records', () => {
  it('n’écrit jamais l’allure de référence', async () => {
    seedProfile(400);
    seedRun(track(6, 300)); // un 5 km plus rapide, jamais traité

    await backfillRunningRecords();

    expect(record5k()).toBeDefined();
    expect(refPace()).toBe(400);
  });

  it('sans profil, n’en crée pas', async () => {
    seedRun(track(6, 300));

    await backfillRunningRecords();

    expect(rowsOf('running_profiles')).toHaveLength(0);
  });

  it('un second appel pendant un recalcul attend, puis repasse', async () => {
    seedRun(track(2, 330));

    const premier = backfillRunningRecords();
    // Une course arrive pendant le premier passage : le second appel doit la voir.
    const rapide = seedRun(track(2, 270));
    const second = backfillRunningRecords();
    await Promise.all([premier, second]);

    const record1k = rowsOf<PaceRecordRow>('running_pace_records').find((r) => r.distance_key === '1k');
    expect(record1k?.run_id).toBe(rapide);
  });
});

describe('R20 — supprimer la course du record', () => {
  it('l’allure venait du record supprimé → elle suit le record suivant', async () => {
    const lente = seedRun(track(6, 330), '2026-10-01T09:00:00.000Z');
    const rapide = seedRun(track(6, 300), '2026-10-02T09:00:00.000Z');
    await detectAndStoreRunRecords(lente);
    await detectAndStoreRunRecords(rapide);
    const suivant = Math.round(
      rowsOf<PaceRecordRow>('running_pace_records').find((r) => r.distance_key === '5k')!.best_time_seconds / 5,
    );
    expect(refPace()).toBe(suivant);

    await deleteRun(rapide);

    expect(record5k()?.run_id).toBe(lente);
    expect(refPace()).toBe(Math.round(record5k()!.best_time_seconds / 5));
  });

  it('sans 5 km restant → elle s’efface', async () => {
    const seule = seedRun(track(6, 300));
    await detectAndStoreRunRecords(seule);
    expect(refPace()).not.toBeNull();

    await deleteRun(seule);

    expect(record5k()).toBeUndefined();
    expect(refPace()).toBeNull();
  });

  it('une allure donnée par le coureur reste intacte, même face à un record restant plus rapide', async () => {
    const lente = seedRun(track(6, 324));
    const rapide = seedRun(track(6, 300));
    await detectAndStoreRunRecords(lente);
    await detectAndStoreRunRecords(rapide);
    // Le coureur se sait moins en forme et donne 5:30 par une porte.
    getTestDb().prepare('UPDATE running_profiles SET ref_5k_pace_s_per_km = 330').run();

    await deleteRun(rapide);

    expect(refPace()).toBe(330);
  });
});

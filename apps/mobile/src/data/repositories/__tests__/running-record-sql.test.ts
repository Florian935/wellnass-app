/**
 * Records d'allure — détection, idempotence et backfill, sur **du vrai SQLite**.
 *
 * Un record d'allure est un **fait définitif** dérivé d'une trace GPS, et il alimente en cascade
 * l'allure de référence du profil coureur — donc les zones et les prédictions. Trois propriétés
 * portent le tout, et aucune n'est reproductible sur un téléphone sans aller courir :
 *
 *  1. **L'idempotence par l'arrondi.** Le temps est arrondi **une seule fois**, et la comparaison
 *     se fait arrondi ↔ arrondi. Comparer le flottant brut au temps déjà stocké (entier) casserait
 *     tout : 299,6 s stocké à 300 rebattrait 300 à chaque rejeu — donc une re-célébration à chaque
 *     ouverture de l'app, sur un record vieux de six mois.
 *  2. **Le périmètre GPS.** Une course manuelle n'a pas de trace : elle ne peut produire aucun
 *     record. Sans cette garde, une distance saisie à la main deviendrait un record d'allure.
 *  3. **La cascade vers le profil.** Battre le 5 km met à jour l'allure de référence — et
 *     **seulement** le 5 km.
 */

import { appendToTrack, encodeSegment, type GpsPoint } from '@wellness/shared';

import {
  backfillRunningRecords,
  detectAndStoreRunRecords,
} from '../running-record-repository';
import { resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

type PaceRecordRow = {
  id: string;
  user_id: string;
  distance_key: string;
  best_time_seconds: number;
  run_id: string;
  achieved_at: string;
};

type RunnerProfileRow = { user_id: string; ref_5k_pace_s_per_km: number | null };

const records = (d = false) => rowsOf<PaceRecordRow>('running_pace_records', d);
const recordFor = (key: string) => records().find((r) => r.distance_key === key);
const runnerProfile = () => rowsOf<RunnerProfileRow>('running_profiles')[0];

/**
 * Trace rectiligne de `km` kilomètres à `paceSPerKm` secondes au kilomètre.
 *
 * Construite avec **les vraies fonctions d'encodage** : le format est versionné et compressé, une
 * trace écrite à la main cesserait d'être représentative au premier changement de format.
 * Un point tous les 100 m — assez fin pour que `bestSegmentTime` interpole proprement.
 */
function track(km: number, paceSPerKm: number): string {
  const points: GpsPoint[] = [];
  const steps = km * 10; // un point tous les 100 m
  for (let i = 0; i <= steps; i++) {
    points.push({
      // 0,000899° de latitude ≈ 100 m.
      lat: 48.85 + i * 0.000899,
      lng: 2.35,
      t: Math.round((i / 10) * paceSPerKm),
    });
  }
  return appendToTrack('', encodeSegment(points));
}

/** Une course terminée avec la trace fournie. */
function seedRun(
  gpsTrack: string | null,
  over?: { source?: string; status?: string; finishedAt?: string; deleted?: boolean },
): string {
  const [id] = seed('runs', [
    {
      user_id: 'user-1',
      source: over?.source ?? 'gps',
      status: over?.status ?? 'completed',
      started_at: '2026-08-01T08:00:00.000Z',
      finished_at: over?.finishedAt ?? '2026-08-01T09:00:00.000Z',
      gps_track: gpsTrack,
      ...(over?.deleted ? { deleted_at: new Date().toISOString() } : {}),
    },
  ]);
  return id!;
}

beforeEach(() => {
  resetTestDb();
});

// ---------------------------------------------------------------------------
// Détection
// ---------------------------------------------------------------------------

describe('detectAndStoreRunRecords', () => {
  it('enregistre les records atteignables et retourne leurs clés', async () => {
    const runId = seedRun(track(6, 300)); // 6 km à 5:00/km

    const beaten = await detectAndStoreRunRecords(runId);

    expect(beaten).toEqual(expect.arrayContaining(['1k', '5k']));
    expect(recordFor('1k')).toMatchObject({ user_id: 'user-1', run_id: runId });
    expect(recordFor('5k')?.best_time_seconds).toBeCloseTo(1500, -1);
  });

  it('n’enregistre pas une distance non atteinte', async () => {
    const runId = seedRun(track(3, 300)); // 3 km : pas de 5 km

    await detectAndStoreRunRecords(runId);

    expect(recordFor('5k')).toBeUndefined();
    expect(recordFor('1k')).toBeDefined();
  });

  it('horodate le record à la fin de la course, pas à maintenant', async () => {
    const runId = seedRun(track(2, 300), { finishedAt: '2026-07-15T10:30:00.000Z' });

    await detectAndStoreRunRecords(runId);

    // Un record est un fait daté : le backfill d'un historique doit reproduire les vraies dates.
    expect(recordFor('1k')?.achieved_at).toBe('2026-07-15T10:30:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// Idempotence — le cœur du sujet
// ---------------------------------------------------------------------------

describe('idempotence', () => {
  it('🔴 rejouer la MÊME course ne bat plus rien', async () => {
    const runId = seedRun(track(6, 300));
    const first = await detectAndStoreRunRecords(runId);
    expect(first.length).toBeGreaterThan(0);

    const second = await detectAndStoreRunRecords(runId);

    // Sans la comparaison arrondi ↔ arrondi, un temps de 299,6 s stocké à 300 rebattrait 300 à
    // chaque rejeu : re-célébration à chaque ouverture de l'app, sur un record vieux de six mois.
    expect(second).toEqual([]);
    expect(records()).toHaveLength(first.length);
  });

  it('ne crée aucun doublon au rejeu', async () => {
    const runId = seedRun(track(6, 300));

    await detectAndStoreRunRecords(runId);
    await detectAndStoreRunRecords(runId);
    await detectAndStoreRunRecords(runId);

    expect(records().filter((r) => r.distance_key === '1k')).toHaveLength(1);
  });

  it('améliore le record quand la course est STRICTEMENT plus rapide', async () => {
    const lent = seedRun(track(2, 300)); // 5:00/km
    await detectAndStoreRunRecords(lent);
    const avant = recordFor('1k')!.best_time_seconds;

    const rapide = seedRun(track(2, 270)); // 4:30/km
    const beaten = await detectAndStoreRunRecords(rapide);

    expect(beaten).toContain('1k');
    expect(recordFor('1k')!.best_time_seconds).toBeLessThan(avant);
    expect(recordFor('1k')?.run_id).toBe(rapide);
  });

  it('ne dégrade JAMAIS un record avec une course plus lente', async () => {
    const rapide = seedRun(track(2, 270));
    await detectAndStoreRunRecords(rapide);
    const meilleur = recordFor('1k')!.best_time_seconds;

    const lent = seedRun(track(2, 330));
    const beaten = await detectAndStoreRunRecords(lent);

    expect(beaten).not.toContain('1k');
    expect(recordFor('1k')).toMatchObject({ best_time_seconds: meilleur, run_id: rapide });
  });
});

// ---------------------------------------------------------------------------
// Périmètre GPS
// ---------------------------------------------------------------------------

describe('périmètre', () => {
  it('ignore une course MANUELLE — une distance saisie n’est pas un record d’allure', async () => {
    const runId = seedRun(track(6, 300), { source: 'manual' });

    expect(await detectAndStoreRunRecords(runId)).toEqual([]);
    expect(records()).toHaveLength(0);
  });

  it('ignore une course non terminée', async () => {
    const runId = seedRun(track(6, 300), { status: 'active' });

    expect(await detectAndStoreRunRecords(runId)).toEqual([]);
  });

  it('ignore une course sans trace', async () => {
    const runId = seedRun(null);

    expect(await detectAndStoreRunRecords(runId)).toEqual([]);
  });

  it('ignore une course supprimée', async () => {
    const runId = seedRun(track(6, 300), { deleted: true });

    expect(await detectAndStoreRunRecords(runId)).toEqual([]);
  });

  it('ignore une course inconnue, sans lever', async () => {
    await expect(detectAndStoreRunRecords('inconnue')).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Cascade vers le profil coureur
// ---------------------------------------------------------------------------

describe('allure de référence', () => {
  it('met à jour l’allure de référence quand le 5 km est battu', async () => {
    const runId = seedRun(track(6, 300)); // 5 km ≈ 1 500 s → 300 s/km

    await detectAndStoreRunRecords(runId);

    expect(runnerProfile()?.ref_5k_pace_s_per_km).toBeCloseTo(300, -1);
  });

  it('ne la touche PAS quand seul le 1 km est battu', async () => {
    const runId = seedRun(track(2, 300)); // pas de 5 km

    await detectAndStoreRunRecords(runId);

    // L'allure de référence sert aux zones et aux prédictions : la dériver d'un 1 km la
    // surestimerait nettement.
    expect(runnerProfile()).toBeUndefined();
  });

  it('la dérive du temps ARRONDI retenu, cohérent avec le record stocké', async () => {
    const runId = seedRun(track(6, 300));

    await detectAndStoreRunRecords(runId);

    const stored = recordFor('5k')!.best_time_seconds;
    expect(runnerProfile()?.ref_5k_pace_s_per_km).toBe(Math.round(stored / 5));
  });
});

// ---------------------------------------------------------------------------
// Backfill
// ---------------------------------------------------------------------------

describe('backfillRunningRecords', () => {
  it('rejoue tout l’historique GPS terminé et retient le meilleur', async () => {
    seedRun(track(2, 330));
    const rapide = seedRun(track(2, 270));
    seedRun(track(2, 300));

    await backfillRunningRecords();

    expect(recordFor('1k')?.run_id).toBe(rapide);
  });

  it('exclut les courses manuelles, actives et supprimées', async () => {
    seedRun(track(2, 300), { source: 'manual' });
    seedRun(track(2, 300), { status: 'active' });
    seedRun(track(2, 300), { deleted: true });

    await backfillRunningRecords();

    expect(records()).toHaveLength(0);
  });

  it('est idempotent : un second passage ne change rien', async () => {
    seedRun(track(6, 300));
    await backfillRunningRecords();
    const avant = records().map((r) => ({ ...r }));

    await backfillRunningRecords();

    expect(records()).toHaveLength(avant.length);
    expect(records().map((r) => r.best_time_seconds)).toEqual(
      avant.map((r) => r.best_time_seconds),
    );
  });

  it('ne fait rien sur un historique vide', async () => {
    await expect(backfillRunningRecords()).resolves.toBeUndefined();
    expect(records()).toHaveLength(0);
  });
});

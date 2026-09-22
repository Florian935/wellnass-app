/**
 * US CONF-06 / AUTRE-01 — ce que l'app **écrit** dans Health Connect, et ce qu'elle en **lit**.
 *
 * `health-connect-state.test.ts` couvre la disponibilité, les permissions et les throttles. Restait
 * le gros du fichier : les cinq chemins d'écriture, les deux imports, et surtout la **reprise
 * unitaire** — la règle la plus importante et la moins visible de ce module.
 *
 * ── Pourquoi la reprise unitaire compte ──────────────────────────────────────────────────────────
 * `insertRecords` refuse un lot **entier** dès qu'un seul record est en cause (chevauchement de
 * sessions, horodatage aberrant, quota). Sans reprise record par record, un rattrapage de 30 jours
 * serait **tout-ou-rien** : l'utilisateur lirait « 0 activité synchronisée » sans pouvoir
 * distinguer « rien à envoyer » de « tout a échoué ». C'est un comportement qu'aucune recette ne
 * produit à la demande — il faut un record fautif en base pour le voir.
 *
 * ── Deux autres règles vérifiées ici ─────────────────────────────────────────────────────────────
 * - **Le compte rendu porte sur les SESSIONS, pas sur les records.** Une course avec distance
 *   produit deux records ; annoncer « 6 activités » pour 3 courses serait faux pour l'utilisateur.
 * - **L'opt-in éteint ne produit aucun rapport d'erreur.** Ce n'est pas une panne, c'est un choix :
 *   remonter « permissions non accordées » à quelqu'un qui a désactivé la synchro afficherait une
 *   alarme pour un fonctionnement normal.
 *
 * ⚠️ Même mise en scène que `health-connect-state.test.ts`, y compris la garde d'isolation du
 * module natif qui y est documentée (§3.5 et la dette du 07/08/2026).
 */

import { Platform } from 'react-native';

// Préfixe `mock` obligatoire : `jest.mock()` est hissé au-dessus des imports.
const mockGetSdkStatus = jest.fn<Promise<number>, [string]>();
const mockInitialize = jest.fn<Promise<boolean>, [string]>();
const mockGetGrantedPermissions =
  jest.fn<Promise<{ accessType: string; recordType: string }[]>, []>();
const mockInsertRecords = jest.fn<Promise<unknown>, [unknown[]]>();
const mockReadRecords = jest.fn<Promise<{ records: unknown[] }>, [string, unknown]>();
const mockAggregate = jest.fn<Promise<unknown[]>, [unknown]>();
const mockOpenHealthConnectSettings = jest.fn<Promise<void>, []>();

const mockGetHealthConnectEnabled = jest.fn<Promise<boolean>, []>();
const mockGetCycleHealthConnectEnabled = jest.fn<Promise<boolean>, []>();

const mockGetOptional = jest.fn();
const mockGetAll = jest.fn();
const mockLogWeight = jest.fn(async () => undefined);
const mockUpsertDailySteps = jest.fn(async () => 0);

jest.mock('react-native-health-connect', () => ({
  getSdkStatus: (pkg: string) => mockGetSdkStatus(pkg),
  initialize: (pkg: string) => mockInitialize(pkg),
  getGrantedPermissions: () => mockGetGrantedPermissions(),
  requestPermission: jest.fn(async () => []),
  insertRecords: (records: unknown[]) => mockInsertRecords(records),
  readRecords: (type: string, options: unknown) => mockReadRecords(type, options),
  aggregateGroupByPeriod: (options: unknown) => mockAggregate(options),
  openHealthConnectSettings: () => mockOpenHealthConnectSettings(),
}));

jest.mock('@/data/repositories/settings-repository', () => ({
  getHealthConnectEnabled: () => mockGetHealthConnectEnabled(),
  getCycleHealthConnectEnabled: () => mockGetCycleHealthConnectEnabled(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('@/powersync/system', () => ({
  powerSync: {
    getOptional: (...args: unknown[]) => mockGetOptional(...args),
    getAll: (...args: unknown[]) => mockGetAll(...args),
  },
}));

jest.mock('@/data/repositories/bodyweight-repository', () => ({
  logWeight: (...args: unknown[]) => mockLogWeight(...(args as [])),
}));

jest.mock('@/data/repositories/daily-steps-repository', () => ({
  upsertDailySteps: (...args: unknown[]) => mockUpsertDailySteps(...(args as [])),
}));

import {
  DEFAULT_WINDOW_DAYS,
  getLastSyncReport,
  importSteps,
  importWeight,
  openSettings,
  pushActivity,
  pushRecent,
  pushRun,
  pushWorkout,
} from '../health-connect';

const SDK_AVAILABLE = 3;
const SDK_UNAVAILABLE = 1;

const ALL_GRANTED = [
  { accessType: 'write', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'Distance' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'Steps' },
];

function setPlatform(os: 'android' | 'ios'): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

/** Une séance de musculation terminée, telle que la requête la rend. */
const workoutRow = (over: Record<string, unknown> = {}) => ({
  id: 'w-1',
  started_at: '2026-09-20T18:00:00.000Z',
  finished_at: '2026-09-20T19:00:00.000Z',
  updated_at: '2026-09-20T19:00:00.000Z',
  session_name: 'Haut du corps',
  ...over,
});

const runRow = (over: Record<string, unknown> = {}) => ({
  id: 'r-1',
  started_at: '2026-09-20T07:00:00.000Z',
  finished_at: '2026-09-20T08:00:00.000Z',
  updated_at: '2026-09-20T08:00:00.000Z',
  distance_m: 10000,
  source: 'gps',
  ...over,
});

const activityRow = (over: Record<string, unknown> = {}) => ({
  id: 'a-1',
  activity_type: 'cycling',
  started_at: '2026-09-20T10:00:00.000Z',
  duration_seconds: 3600,
  updated_at: '2026-09-20T11:00:00.000Z',
  ...over,
});

/** Tous les records passés à `insertRecords`, tous appels confondus. */
const insertedRecords = () => mockInsertRecords.mock.calls.flatMap((c) => c[0]);

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('android');
  mockGetSdkStatus.mockResolvedValue(SDK_AVAILABLE);
  mockInitialize.mockResolvedValue(true);
  mockGetGrantedPermissions.mockResolvedValue(ALL_GRANTED);
  mockGetHealthConnectEnabled.mockResolvedValue(true);
  mockGetCycleHealthConnectEnabled.mockResolvedValue(true);
  mockInsertRecords.mockResolvedValue([]);
  mockReadRecords.mockResolvedValue({ records: [] });
  mockAggregate.mockResolvedValue([]);
  mockGetAll.mockResolvedValue([]);
  mockGetOptional.mockResolvedValue(null);
  mockUpsertDailySteps.mockResolvedValue(0);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

// ---------------------------------------------------------------------------
// Les gardes communes à tous les chemins d'écriture
// ---------------------------------------------------------------------------

describe('les gardes avant écriture', () => {
  it('🔴 n’écrit rien ET ne signale aucune erreur quand l’opt-in est éteint', async () => {
    mockGetHealthConnectEnabled.mockResolvedValue(false);

    await pushWorkout('w-1');

    expect(mockInsertRecords).not.toHaveBeenCalled();
    // Pas un rapport d'erreur : la synchro désactivée est un choix, pas une panne.
    expect(getLastSyncReport()?.error).toBeUndefined();
  });

  it('signale l’indisponibilité de Health Connect, elle', async () => {
    mockGetSdkStatus.mockResolvedValue(SDK_UNAVAILABLE);

    await pushWorkout('w-1');

    expect(getLastSyncReport()?.error).toContain('indisponible');
  });

  it('signale un initialize() refusé — sans lui, tous les appels suivants échouent', async () => {
    mockInitialize.mockResolvedValue(false);

    await pushWorkout('w-1');

    expect(getLastSyncReport()?.error).toContain('initialize');
  });

  it('signale des permissions manquantes', async () => {
    mockGetGrantedPermissions.mockResolvedValue([]);

    await pushWorkout('w-1');

    expect(getLastSyncReport()?.error).toContain('permissions');
  });

  it('ne laisse pas remonter une exception du module natif', async () => {
    mockGetSdkStatus.mockRejectedValue(new Error('boom'));

    await expect(pushWorkout('w-1')).resolves.toBeUndefined();
    expect(getLastSyncReport()?.error).toContain('boom');
  });
});

// ---------------------------------------------------------------------------
// pushWorkout
// ---------------------------------------------------------------------------

describe('pushWorkout', () => {
  it('écrit une séance terminée avec son titre de programme', async () => {
    mockGetOptional.mockResolvedValue(workoutRow());

    await pushWorkout('w-1');

    expect(insertedRecords()).toHaveLength(1);
    expect(insertedRecords()[0]).toMatchObject({
      recordType: 'ExerciseSession',
      title: 'Haut du corps',
    });
    expect(getLastSyncReport()).toMatchObject({ kind: 'workout', written: 1 });
  });

  it('retombe sur le libellé traduit fourni par l’appelant pour une séance libre', async () => {
    mockGetOptional.mockResolvedValue(workoutRow({ session_name: null }));

    await pushWorkout('w-1', 'Séance libre');

    expect(insertedRecords()[0]).toMatchObject({ title: 'Séance libre' });
  });

  it('ne met aucun titre quand ni le programme ni l’appelant n’en donnent', async () => {
    mockGetOptional.mockResolvedValue(workoutRow({ session_name: null }));

    await pushWorkout('w-1');

    expect(insertedRecords()[0]).not.toHaveProperty('title');
  });

  it('signale une séance introuvable ou non terminée sans rien écrire', async () => {
    mockGetOptional.mockResolvedValue(null);

    await pushWorkout('w-inconnue');

    expect(mockInsertRecords).not.toHaveBeenCalled();
    expect(getLastSyncReport()?.error).toContain('introuvable');
  });

  it('signale un record non constructible plutôt que d’écrire un intervalle vide', async () => {
    mockGetOptional.mockResolvedValue(workoutRow({ finished_at: null }));

    await pushWorkout('w-1');

    expect(mockInsertRecords).not.toHaveBeenCalled();
    expect(getLastSyncReport()?.error).toContain('non constructible');
  });

  it('remonte l’échec d’écriture dans le compte rendu', async () => {
    mockGetOptional.mockResolvedValue(workoutRow());
    mockInsertRecords.mockRejectedValue(new Error('quota dépassé'));

    await pushWorkout('w-1');

    expect(getLastSyncReport()).toMatchObject({ written: 0 });
    expect(getLastSyncReport()?.error).toContain('quota');
  });
});

// ---------------------------------------------------------------------------
// pushActivity
// ---------------------------------------------------------------------------

describe('pushActivity', () => {
  it('écrit une autre activité avec le type d’exercice de son sport', async () => {
    mockGetOptional.mockResolvedValue(activityRow());

    await pushActivity('a-1', 'Vélo');

    expect(insertedRecords()[0]).toMatchObject({ recordType: 'ExerciseSession', title: 'Vélo' });
    expect(getLastSyncReport()).toMatchObject({ kind: 'activity', written: 1 });
  });

  it('⚠️ n’écrit AUCUNE calorie : ce serait un 7ᵉ type dans la déclaration Play', async () => {
    mockGetOptional.mockResolvedValue(activityRow());

    await pushActivity('a-1');

    for (const record of insertedRecords() as Record<string, unknown>[]) {
      expect(record.recordType).not.toBe('ActiveCaloriesBurned');
    }
  });

  it('signale une activité introuvable', async () => {
    mockGetOptional.mockResolvedValue(null);

    await pushActivity('a-inconnue');

    expect(getLastSyncReport()?.error).toContain('introuvable');
  });

  it('refuse une durée nulle plutôt que d’écrire une session de zéro seconde', async () => {
    mockGetOptional.mockResolvedValue(activityRow({ duration_seconds: 0 }));

    await pushActivity('a-1');

    expect(mockInsertRecords).not.toHaveBeenCalled();
    expect(getLastSyncReport()?.error).toContain('non constructible');
  });
});

// ---------------------------------------------------------------------------
// pushRun
// ---------------------------------------------------------------------------

describe('pushRun', () => {
  it('écrit la session ET la distance, en deux appels homogènes', async () => {
    mockGetOptional.mockResolvedValue(runRow());

    await pushRun('r-1', 'Course');

    // Deux appels : `insertRecords` refuse les lots hétérogènes.
    expect(mockInsertRecords).toHaveBeenCalledTimes(2);
    const types = (insertedRecords() as { recordType: string }[]).map((r) => r.recordType);
    expect(types).toEqual(expect.arrayContaining(['ExerciseSession', 'Distance']));
  });

  it('🔴 compte la course une fois, pas deux, bien qu’elle produise deux records', async () => {
    mockGetOptional.mockResolvedValue(runRow());

    await pushRun('r-1');

    expect(getLastSyncReport()).toMatchObject({ kind: 'run', written: 1 });
  });

  it('n’écrit pas de distance pour une course sans distance mesurée', async () => {
    mockGetOptional.mockResolvedValue(runRow({ distance_m: null }));

    await pushRun('r-1');

    const types = (insertedRecords() as { recordType: string }[]).map((r) => r.recordType);
    expect(types).not.toContain('Distance');
  });

  it('signale une course introuvable', async () => {
    mockGetOptional.mockResolvedValue(null);

    await pushRun('r-inconnue');

    expect(getLastSyncReport()?.error).toContain('introuvable');
  });

  it('signale des records non constructibles sur une course jamais terminée', async () => {
    mockGetOptional.mockResolvedValue(runRow({ finished_at: null }));

    await pushRun('r-1');

    expect(getLastSyncReport()?.error).toContain('non constructibles');
  });
});

// ---------------------------------------------------------------------------
// pushRecent — le rattrapage, et la reprise unitaire
// ---------------------------------------------------------------------------

describe('pushRecent', () => {
  /** Séances et courses rendues par les deux requêtes, dans l'ordre où le code les émet. */
  const inBase = (workouts: unknown[], runs: unknown[]) => {
    mockGetAll.mockResolvedValueOnce(workouts).mockResolvedValueOnce(runs);
  };

  it('écrit toutes les séances et courses de la fenêtre', async () => {
    inBase([workoutRow({ id: 'w-1' }), workoutRow({ id: 'w-2' })], [runRow()]);

    const written = await pushRecent(30, { workout: 'Séance', run: 'Course' });

    expect(written).toBe(3);
  });

  it('🔴 compte des ACTIVITÉS, pas des records : 3 courses ne font pas 6 activités', async () => {
    inBase([], [runRow({ id: 'r-1' }), runRow({ id: 'r-2' }), runRow({ id: 'r-3' })]);

    expect(await pushRecent()).toBe(3);
  });

  it('groupe les écritures par type : un lot de sessions, un lot de distances', async () => {
    inBase([workoutRow()], [runRow()]);

    await pushRecent();

    expect(mockInsertRecords).toHaveBeenCalledTimes(2);
  });

  it('borne la fenêtre sur le nombre de jours demandé', async () => {
    inBase([], []);

    await pushRecent(7);

    const since = mockGetAll.mock.calls[0]![1][0] as string;
    const days = Math.round((Date.now() - new Date(since).getTime()) / 86_400_000);
    expect(days).toBe(7);
  });

  it('utilise une fenêtre par défaut quand aucune n’est demandée', async () => {
    inBase([], []);

    await pushRecent();

    const since = mockGetAll.mock.calls[0]![1][0] as string;
    const days = Math.round((Date.now() - new Date(since).getTime()) / 86_400_000);
    expect(days).toBe(DEFAULT_WINDOW_DAYS);
  });

  it('🔴 dit ce qu’il a trouvé quand il n’y a rien à écrire — le silence est trompeur', async () => {
    inBase([], []);

    await pushRecent(30);

    expect(getLastSyncReport()?.error).toContain('aucune activité terminée');
    expect(getLastSyncReport()?.error).toContain('30 jours');
  });

  it('écarte silencieusement une séance non constructible sans perdre les autres', async () => {
    inBase([workoutRow({ id: 'w-ok' }), workoutRow({ id: 'w-ko', finished_at: null })], []);

    expect(await pushRecent()).toBe(1);
  });

  it('écarte une course non constructible sans perdre les séances', async () => {
    inBase([workoutRow()], [runRow({ finished_at: null })]);

    expect(await pushRecent()).toBe(1);
  });

  it('🔴 retente record par record quand le lot entier est refusé', async () => {
    inBase([workoutRow({ id: 'w-1' }), workoutRow({ id: 'w-2' }), workoutRow({ id: 'w-3' })], []);
    // Le lot de trois est refusé ; les reprises unitaires passent.
    mockInsertRecords.mockRejectedValueOnce(new Error('chevauchement')).mockResolvedValue([]);

    expect(await pushRecent()).toBe(3);
  });

  it('🔴 sauve ce qui peut l’être quand un seul record est fautif', async () => {
    inBase([workoutRow({ id: 'w-1' }), workoutRow({ id: 'w-2' }), workoutRow({ id: 'w-3' })], []);
    mockInsertRecords
      .mockRejectedValueOnce(new Error('lot refusé')) // le lot
      .mockResolvedValueOnce([]) // w-1
      .mockRejectedValueOnce(new Error('record fautif')) // w-2
      .mockResolvedValueOnce([]); // w-3

    const written = await pushRecent();

    expect(written).toBe(2);
    expect(getLastSyncReport()?.error).toContain('record fautif');
  });

  it('ne signale aucune erreur quand la reprise unitaire a tout sauvé', async () => {
    inBase([workoutRow({ id: 'w-1' }), workoutRow({ id: 'w-2' })], []);
    mockInsertRecords.mockRejectedValueOnce(new Error('lot refusé')).mockResolvedValue([]);

    await pushRecent();

    expect(getLastSyncReport()?.error).toBeNull();
  });

  it('ne retente pas un lot d’un seul record : il n’y a rien à sauver', async () => {
    inBase([workoutRow()], []);
    mockInsertRecords.mockRejectedValue(new Error('refusé'));

    expect(await pushRecent()).toBe(0);
    expect(mockInsertRecords).toHaveBeenCalledTimes(1);
  });

  it('rend 0 et signale l’erreur quand la lecture locale échoue', async () => {
    mockGetAll.mockRejectedValue(new Error('base verrouillée'));

    expect(await pushRecent()).toBe(0);
    expect(getLastSyncReport()?.error).toContain('base verrouillée');
  });

  it('rend 0 sans rapport d’erreur quand l’opt-in est éteint', async () => {
    mockGetHealthConnectEnabled.mockResolvedValue(false);

    expect(await pushRecent()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// importWeight
// ---------------------------------------------------------------------------

describe('importWeight', () => {
  const remoteWeight = (time: string, kg: number, pkg = 'com.autre.app') => ({
    time,
    weight: { inKilograms: kg },
    metadata: { dataOrigin: pkg, id: `hc-${time}` },
  });

  it('crée les jours absents localement', async () => {
    mockReadRecords.mockResolvedValue({
      records: [remoteWeight(new Date('2026-09-20T07:00:00').toISOString(), 72.4)],
    });
    mockGetAll.mockResolvedValue([]);

    expect(await importWeight(30)).toBe(1);
    expect(mockLogWeight).toHaveBeenCalledWith('2026-09-20', 72.4);
  });

  it('🔴 n’écrase jamais une saisie locale existante', async () => {
    mockReadRecords.mockResolvedValue({
      records: [remoteWeight(new Date('2026-09-20T07:00:00').toISOString(), 72.4)],
    });
    mockGetAll.mockResolvedValue([{ log_date: '2026-09-20' }]);

    expect(await importWeight(30)).toBe(0);
    expect(mockLogWeight).not.toHaveBeenCalled();
  });

  it('🔴 relit les jours SUPPRIMÉS aussi : sans quoi une pesée effacée ressusciterait', async () => {
    mockReadRecords.mockResolvedValue({ records: [] });

    await importWeight(30);

    // La requête ne filtre pas sur `deleted_at` — c'est délibéré.
    expect(mockGetAll.mock.calls[0]![0]).not.toContain('deleted_at');
  });

  it('borne la lecture sur la fenêtre demandée', async () => {
    await importWeight(7);

    const filter = (mockReadRecords.mock.calls[0]![1] as { timeRangeFilter: { startTime: string } })
      .timeRangeFilter;
    const days = Math.round((Date.now() - new Date(filter.startTime).getTime()) / 86_400_000);
    expect(days).toBe(7);
  });

  it('distingue « rien de neuf » de « rien lu du tout »', async () => {
    mockReadRecords.mockResolvedValue({ records: [] });

    await importWeight(30);

    expect(getLastSyncReport()?.error).toContain('aucune pesée lue');
  });

  it('ne signale rien quand il a lu des pesées, même déjà connues', async () => {
    mockReadRecords.mockResolvedValue({
      records: [remoteWeight(new Date('2026-09-20T07:00:00').toISOString(), 72.4)],
    });
    mockGetAll.mockResolvedValue([{ log_date: '2026-09-20' }]);

    await importWeight(30);

    expect(getLastSyncReport()?.error).toBeNull();
  });

  it('rend 0 et signale l’erreur quand la lecture native échoue', async () => {
    mockReadRecords.mockRejectedValue(new Error('lecture refusée'));

    expect(await importWeight()).toBe(0);
    expect(getLastSyncReport()?.error).toContain('lecture refusée');
  });

  it('rend 0 sans rapport quand l’opt-in est éteint', async () => {
    mockGetHealthConnectEnabled.mockResolvedValue(false);

    expect(await importWeight()).toBe(0);
    expect(mockReadRecords).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// importSteps
// ---------------------------------------------------------------------------

describe('importSteps', () => {
  it('agrège les pas par jour et rend le nombre de jours écrits', async () => {
    mockAggregate.mockResolvedValue([
      {
        startTime: new Date('2026-09-20T00:00:00').toISOString(),
        endTime: new Date('2026-09-21T00:00:00').toISOString(),
        result: { COUNT_TOTAL: 8432 },
      },
    ]);
    mockUpsertDailySteps.mockResolvedValue(1);

    expect(await importSteps(30)).toBe(1);
    expect(mockUpsertDailySteps).toHaveBeenCalled();
  });

  it('demande bien un découpage par journée', async () => {
    await importSteps(30);

    expect(mockAggregate.mock.calls[0]![0]).toMatchObject({
      recordType: 'Steps',
      timeRangeSlicer: { period: 'DAYS', length: 1 },
    });
  });

  it('🔴 distingue une panne de lecture d’une journée sans marche (leçon CONF-06)', async () => {
    mockAggregate.mockResolvedValue([]);

    await importSteps(30);

    expect(getLastSyncReport()?.error).toContain('aucun pas lu');
  });

  it('rend 0 et signale l’erreur quand l’agrégation échoue', async () => {
    mockAggregate.mockRejectedValue(new Error('agrégation impossible'));

    expect(await importSteps()).toBe(0);
    expect(getLastSyncReport()?.error).toContain('agrégation impossible');
  });

  it('rend 0 sans rapport quand l’opt-in est éteint', async () => {
    mockGetHealthConnectEnabled.mockResolvedValue(false);

    expect(await importSteps()).toBe(0);
    expect(mockAggregate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Ouverture des réglages
// ---------------------------------------------------------------------------

describe('openSettings', () => {
  it('ouvre les réglages Health Connect', async () => {
    await openSettings();

    expect(mockOpenHealthConnectSettings).toHaveBeenCalled();
  });

  it('ne lève pas quand l’ouverture échoue — un bouton ne fait pas planter l’écran', async () => {
    mockOpenHealthConnectSettings.mockRejectedValue(new Error('activité introuvable'));

    await expect(openSettings()).resolves.toBeUndefined();
  });

  it('ne tente rien hors Android', async () => {
    setPlatform('ios');

    await openSettings();

    expect(mockOpenHealthConnectSettings).not.toHaveBeenCalled();
  });
});

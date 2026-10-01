/**
 * US BIEN-06 — la nuit lue dans Health Connect (décision D3 du 01/10/2026).
 *
 * Ce qui est verrouillé ici, et qu'aucune recette ne vérifie sans révoquer des permissions une à une :
 *
 *  - **`READ_SLEEP` est à part.** Comme le cycle (R20), la mêler aux permissions générales ferait
 *    repasser en `permissions_missing` tous les comptes qui synchronisent leurs séances sans avoir
 *    jamais activé le pilier Bien-être ;
 *  - **la lecture dépend du pilier ET de son interrupteur**, pas de la synchro générale : lire sa nuit
 *    ne demande pas d'écrire ses séances dans Health Connect ;
 *  - **l'import passe par les règles partagées** (`nightsFromSleepSessions`) et écrit via le repository
 *    (`upsertImportedNights`, qui protège la saisie manuelle) ; ses propres sessions sont ignorées ;
 *  - **le throttle d'une heure** au retour au premier plan.
 */

import { Platform } from 'react-native';

const mockGetSdkStatus = jest.fn<Promise<number>, [string]>();
const mockInitialize = jest.fn<Promise<boolean>, [string]>();
const mockGetGrantedPermissions = jest.fn<Promise<{ accessType: string; recordType: string }[]>, []>();
const mockRequestPermission = jest.fn<Promise<unknown>, [unknown]>();
const mockReadRecords = jest.fn<Promise<{ records: unknown[] }>, [string, unknown]>();

const mockGetSleepImportSettings = jest.fn<Promise<{ pillar: boolean; sleep: boolean }>, []>();
const mockUpsertImportedNights = jest.fn<Promise<number>, [unknown[], string]>();

const mockGetItemAsync = jest.fn<Promise<string | null>, [string]>();
const mockSetItemAsync = jest.fn<Promise<void>, [string, string]>();

jest.mock('react-native-health-connect', () => ({
  getSdkStatus: (pkg: string) => mockGetSdkStatus(pkg),
  initialize: (pkg: string) => mockInitialize(pkg),
  getGrantedPermissions: () => mockGetGrantedPermissions(),
  requestPermission: (perms: unknown) => mockRequestPermission(perms),
  readRecords: (type: string, opts: unknown) => mockReadRecords(type, opts),
  aggregateGroupByPeriod: jest.fn(async () => []),
  insertRecords: jest.fn(async () => []),
}));

jest.mock('@/data/repositories/settings-repository', () => ({
  getHealthConnectEnabled: jest.fn(async () => true),
  getCycleHealthConnectEnabled: jest.fn(async () => false),
  getSleepImportSettings: () => mockGetSleepImportSettings(),
}));

jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({
  upsertImportedNights: (nights: unknown[], todayKey: string) => mockUpsertImportedNights(nights, todayKey),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: (key: string) => mockGetItemAsync(key),
  setItemAsync: (key: string, value: string) => mockSetItemAsync(key, value),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('@/powersync/system', () => ({ powerSync: { getOptional: jest.fn(), getAll: jest.fn() } }));

import {
  getLastSyncReport,
  getSleepState,
  hasPermissions,
  hasSleepPermissions,
  importSleep,
  importSleepIfDue,
  requestSleepPermissions,
  SLEEP_IMPORT_WINDOW_DAYS,
} from '../health-connect';

const SDK_AVAILABLE = 3;
const SDK_UNAVAILABLE = 1;

const GENERAL_GRANTED = [
  { accessType: 'write', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'Distance' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'Steps' },
];
const SLEEP_GRANTED = [{ accessType: 'read', recordType: 'SleepSession' }];

function setPlatform(os: 'android' | 'ios'): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

/** Une nuit de 7 h 30, écrite par Samsung Health. La règle « quelle nuit » est testée dans `@wellness/shared`. */
const session = (origin = 'com.sec.android.app.shealth') => ({
  startTime: '2026-09-30T21:40:00.000Z',
  endTime: '2026-10-01T05:10:00.000Z',
  metadata: { dataOrigin: origin },
});

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('android');
  mockGetSdkStatus.mockResolvedValue(SDK_AVAILABLE);
  mockInitialize.mockResolvedValue(true);
  mockGetGrantedPermissions.mockResolvedValue([...GENERAL_GRANTED, ...SLEEP_GRANTED]);
  mockRequestPermission.mockResolvedValue(undefined);
  mockReadRecords.mockResolvedValue({ records: [session()] });
  mockGetSleepImportSettings.mockResolvedValue({ pillar: true, sleep: true });
  mockUpsertImportedNights.mockResolvedValue(1);
  mockGetItemAsync.mockResolvedValue(null);
  mockSetItemAsync.mockResolvedValue(undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("garde d'isolation du module natif", () => {
  it('résout bien le mock de CE fichier pour `react-native-health-connect`', async () => {
    const native = await import('react-native-health-connect');
    await native.getSdkStatus('sonde-sommeil');
    expect(mockGetSdkStatus).toHaveBeenCalledWith('sonde-sommeil');
  });
});

describe('permission du sommeil — à part des permissions générales', () => {
  it('exige la lecture de SleepSession', async () => {
    expect(await hasSleepPermissions()).toBe(true);

    mockGetGrantedPermissions.mockResolvedValue(GENERAL_GRANTED);
    expect(await hasSleepPermissions()).toBe(false);
  });

  it('🔴 les permissions générales ne dépendent PAS de READ_SLEEP', async () => {
    mockGetGrantedPermissions.mockResolvedValue(GENERAL_GRANTED);

    // Sinon chaque compte qui synchronise ses séances basculerait en « permissions manquantes »
    // le jour où le pilier Bien-être est livré.
    expect(await hasPermissions()).toBe(true);
  });

  it('ne se satisfait pas d’un accès en écriture', async () => {
    mockGetGrantedPermissions.mockResolvedValue([{ accessType: 'write', recordType: 'SleepSession' }]);

    expect(await hasSleepPermissions()).toBe(false);
  });

  it('demande SEULEMENT la lecture du sommeil, puis relit l’état réel', async () => {
    mockGetGrantedPermissions.mockResolvedValue(GENERAL_GRANTED);

    expect(await requestSleepPermissions()).toBe(false);
    expect(mockRequestPermission).toHaveBeenCalledWith([{ accessType: 'read', recordType: 'SleepSession' }]);
  });

  it('ne lève pas si la demande échoue, et rien hors Android', async () => {
    mockRequestPermission.mockRejectedValue(new Error('annulé'));
    expect(await requestSleepPermissions()).toBe(false);

    setPlatform('ios');
    expect(await hasSleepPermissions()).toBe(false);
    expect(await requestSleepPermissions()).toBe(false);
  });
});

describe('getSleepState', () => {
  it('« ready » quand pilier, lecture et permission sont là', async () => {
    expect(await getSleepState()).toBe('ready');
  });

  it('« off » quand le pilier OU la lecture est éteint, sans lire les permissions', async () => {
    mockGetSleepImportSettings.mockResolvedValue({ pillar: false, sleep: true });
    expect(await getSleepState()).toBe('off');
    mockGetSleepImportSettings.mockResolvedValue({ pillar: true, sleep: false });
    expect(await getSleepState()).toBe('off');
    expect(mockGetGrantedPermissions).not.toHaveBeenCalled();
  });

  it('« permissions_missing » quand l’interrupteur est allumé mais la permission retirée', async () => {
    mockGetGrantedPermissions.mockResolvedValue(GENERAL_GRANTED);
    expect(await getSleepState()).toBe('permissions_missing');
  });

  it('la disponibilité du fournisseur prime', async () => {
    mockGetSdkStatus.mockResolvedValue(SDK_UNAVAILABLE);
    expect(await getSleepState()).toBe('provider_missing');
  });
});

describe('importSleep', () => {
  it('lit les sessions de la fenêtre (+1 jour) et écrit via le repository', async () => {
    const before = Date.now();
    expect(await importSleep()).toBe(1);

    expect(mockReadRecords).toHaveBeenCalledWith('SleepSession', expect.objectContaining({ timeRangeFilter: expect.objectContaining({ operator: 'between' }) }));
    const filter = (mockReadRecords.mock.calls[0]![1] as { timeRangeFilter: { startTime: string; endTime: string } }).timeRangeFilter;
    const spanDays = (Date.parse(filter.endTime) - Date.parse(filter.startTime)) / 86_400_000;
    // Un jour de plus que la fenêtre : la nuit du plus vieux matin a commencé la veille au soir.
    expect(spanDays).toBeCloseTo(SLEEP_IMPORT_WINDOW_DAYS + 1, 3);
    expect(Date.parse(filter.endTime)).toBeGreaterThanOrEqual(before);

    expect(mockUpsertImportedNights).toHaveBeenCalledTimes(1);
    const [nights] = mockUpsertImportedNights.mock.calls[0]!;
    expect(nights).toHaveLength(1);
    expect(nights[0]).toEqual(expect.objectContaining({ minutes: 450 }));
    expect(mockSetItemAsync).toHaveBeenCalledWith('healthConnect.lastSleepImportAt', expect.any(String));
    expect(getLastSyncReport()).toEqual(expect.objectContaining({ kind: 'sleep', written: 1, error: null }));
  });

  it('ignore les sessions écrites par l’app elle-même', async () => {
    mockReadRecords.mockResolvedValue({ records: [session('com.wellness.app')] });

    await importSleep();
    expect(mockUpsertImportedNights.mock.calls[0]![0]).toEqual([]);
  });

  it('dit « aucune session lue » plutôt que rien — c’est le cas sans app source', async () => {
    mockReadRecords.mockResolvedValue({ records: [] });
    mockUpsertImportedNights.mockResolvedValue(0);

    expect(await importSleep()).toBe(0);
    expect(getLastSyncReport()?.error).toMatch(/aucune session de sommeil/);
  });

  it('ne lit rien, et ne signale rien, pilier ou lecture éteints', async () => {
    mockGetSleepImportSettings.mockResolvedValue({ pillar: true, sleep: false });

    expect(await importSleep()).toBe(0);
    expect(mockReadRecords).not.toHaveBeenCalled();
    expect(mockUpsertImportedNights).not.toHaveBeenCalled();
  });

  it('ne lit rien sans la permission, et le dit', async () => {
    mockGetGrantedPermissions.mockResolvedValue(GENERAL_GRANTED);

    expect(await importSleep()).toBe(0);
    expect(mockReadRecords).not.toHaveBeenCalled();
    expect(getLastSyncReport()).toEqual(expect.objectContaining({ kind: 'sleep', error: expect.stringMatching(/permission sommeil/) }));
  });

  it('ne lève pas si la lecture native échoue', async () => {
    mockReadRecords.mockRejectedValue(new Error('SecurityException'));

    await expect(importSleep()).resolves.toBe(0);
    expect(getLastSyncReport()?.error).toMatch(/SecurityException/);
  });
});

describe('importSleepIfDue — throttle d’une heure', () => {
  it('importe au premier passage', async () => {
    await importSleepIfDue();
    expect(mockReadRecords).toHaveBeenCalled();
  });

  it('ne relit pas dans l’heure', async () => {
    mockGetItemAsync.mockResolvedValue(new Date(Date.now() - 20 * 60_000).toISOString());

    expect(await importSleepIfDue()).toBe(0);
    expect(mockReadRecords).not.toHaveBeenCalled();
  });

  it('relit passé l’heure', async () => {
    mockGetItemAsync.mockResolvedValue(new Date(Date.now() - 2 * 3600_000).toISOString());

    await importSleepIfDue();
    expect(mockReadRecords).toHaveBeenCalled();
  });

  it('rien hors Android', async () => {
    setPlatform('ios');

    expect(await importSleepIfDue()).toBe(0);
    expect(mockGetItemAsync).not.toHaveBeenCalled();
  });
});

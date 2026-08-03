/**
 * Health Connect — machine d'état des Réglages et throttles d'import.
 *
 * Lot 3 de [strategie-tests.md](../../../../../docs/specs/technical/strategie-tests.md).
 * Complète [`health-connect-inactive.test.ts`](./health-connect-inactive.test.ts), qui verrouille
 * la frontière « abandon normal ≠ échec » dans le compte rendu de synchro.
 *
 * Ce qui est testé ici est **ce que l'utilisateur voit dans les Réglages**, et rien d'autre :
 * `getState()` renvoie l'un de six états, et c'est lui qui décide entre « installe Health
 * Connect », « active la synchro » et « accorde les permissions ». Se tromper d'état, c'est
 * envoyer quelqu'un régler un problème qu'il n'a pas.
 *
 * Deux subtilités du domaine sont fixées par des tests parce qu'elles se sont déjà retournées
 * contre nous :
 *
 *  - **`hasPermissions()` est un ET logique** sur une liste. Quand `Steps` y a été ajoutée
 *    (US PAS-01, après CONF-06), tous les comptes déjà autorisés sont repassés en
 *    `permissions_missing`. C'est le comportement voulu, mais il faut qu'il reste **délibéré** :
 *    un test échouera si quelqu'un ajoute une permission sans y penser.
 *  - **Les permissions du cycle sont à part.** Les mêler à la liste générale ferait repasser en
 *    `permissions_missing` des comptes qui n'ont jamais activé le suivi du cycle, et n'ont aucune
 *    raison de le faire (opt-in indépendant, R20).
 *
 * Aucun de ces cas n'est reproductible sur un téléphone de recette sans désinstaller Health
 * Connect ou révoquer des permissions une par une dans les réglages Android.
 */

import { Platform } from 'react-native';

// Préfixe `mock` obligatoire : babel-plugin-jest-hoist remonte les `jest.mock()` au-dessus des
// imports, donc les variables référencées dans les fabriques doivent être hissables.
const mockGetSdkStatus = jest.fn<Promise<number>, [string]>();
const mockInitialize = jest.fn<Promise<boolean>, [string]>();
const mockGetGrantedPermissions =
  jest.fn<Promise<{ accessType: string; recordType: string }[]>, []>();
const mockRequestPermission = jest.fn<Promise<unknown>, [unknown]>();

const mockGetHealthConnectEnabled = jest.fn<Promise<boolean>, []>();
const mockGetCycleHealthConnectEnabled = jest.fn<Promise<boolean>, []>();

const mockGetItemAsync = jest.fn<Promise<string | null>, [string]>();

jest.mock('react-native-health-connect', () => ({
  getSdkStatus: (pkg: string) => mockGetSdkStatus(pkg),
  initialize: (pkg: string) => mockInitialize(pkg),
  getGrantedPermissions: () => mockGetGrantedPermissions(),
  requestPermission: (perms: unknown) => mockRequestPermission(perms),
  aggregateGroupByPeriod: jest.fn(async () => []),
  readRecords: jest.fn(async () => ({ records: [] })),
  insertRecords: jest.fn(async () => []),
}));

jest.mock('@/data/repositories/settings-repository', () => ({
  getHealthConnectEnabled: () => mockGetHealthConnectEnabled(),
  getCycleHealthConnectEnabled: () => mockGetCycleHealthConnectEnabled(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: (key: string) => mockGetItemAsync(key),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('@/powersync/system', () => ({ powerSync: { getOptional: jest.fn(), getAll: jest.fn() } }));

import {
  getAvailability,
  getCycleState,
  getState,
  hasCyclePermissions,
  hasPermissions,
  HEALTH_CONNECT_PACKAGE,
  importStepsIfDue,
  importWeightIfDue,
  requestPermissions,
} from '../health-connect';

/** Valeurs de `getSdkStatus()` (constantes `SdkAvailabilityStatus` de la lib v3). */
const SDK_UNAVAILABLE = 1;
const SDK_UPDATE_REQUIRED = 2;
const SDK_AVAILABLE = 3;

/** Les 4 permissions générales, toutes accordées. */
const ALL_GRANTED = [
  { accessType: 'write', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'Distance' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'Steps' },
];

/** Les 4 permissions du cycle, toutes accordées. */
const CYCLE_GRANTED = [
  { accessType: 'read', recordType: 'MenstruationPeriod' },
  { accessType: 'write', recordType: 'MenstruationPeriod' },
  { accessType: 'read', recordType: 'MenstruationFlow' },
  { accessType: 'write', recordType: 'MenstruationFlow' },
];

function setPlatform(os: 'android' | 'ios'): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('android');
  mockGetSdkStatus.mockResolvedValue(SDK_AVAILABLE);
  mockInitialize.mockResolvedValue(true);
  mockGetGrantedPermissions.mockResolvedValue([...ALL_GRANTED, ...CYCLE_GRANTED]);
  mockGetHealthConnectEnabled.mockResolvedValue(true);
  mockGetCycleHealthConnectEnabled.mockResolvedValue(true);
  mockGetItemAsync.mockResolvedValue(null);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Disponibilité du fournisseur
// ---------------------------------------------------------------------------

describe('getAvailability', () => {
  it('interroge le paquet Health Connect officiel', async () => {
    await getAvailability();

    expect(mockGetSdkStatus).toHaveBeenCalledWith(HEALTH_CONNECT_PACKAGE);
  });

  it.each([
    [SDK_AVAILABLE, 'available'],
    [SDK_UPDATE_REQUIRED, 'provider_update_required'],
    [SDK_UNAVAILABLE, 'provider_missing'],
  ])('traduit le statut %s en « %s »', async (status, expected) => {
    mockGetSdkStatus.mockResolvedValue(status);

    expect(await getAvailability()).toBe(expected);
  });

  it('retombe sur « provider_missing » devant un statut inconnu', async () => {
    mockGetSdkStatus.mockResolvedValue(99);

    expect(await getAvailability()).toBe('provider_missing');
  });

  it('renvoie « unsupported » hors Android sans même appeler le natif', async () => {
    setPlatform('ios');

    expect(await getAvailability()).toBe('unsupported');
    expect(mockGetSdkStatus).not.toHaveBeenCalled();
  });

  it('ne lève pas si l’appel natif échoue', async () => {
    mockGetSdkStatus.mockRejectedValue(new Error('module absent'));

    expect(await getAvailability()).toBe('provider_missing');
  });
});

// ---------------------------------------------------------------------------
// Permissions générales
// ---------------------------------------------------------------------------

describe('hasPermissions', () => {
  it('exige les QUATRE permissions — c’est un ET, pas un OU', async () => {
    expect(await hasPermissions()).toBe(true);

    // Retirer la lecture des pas suffit à faire basculer l'état : c'est exactement ce qui est
    // arrivé aux comptes existants quand PAS-01 a ajouté `Steps` à la liste.
    mockGetGrantedPermissions.mockResolvedValue(
      ALL_GRANTED.filter((p) => p.recordType !== 'Steps'),
    );
    expect(await hasPermissions()).toBe(false);
  });

  it('distingue le type d’accès — lire n’est pas écrire', async () => {
    mockGetGrantedPermissions.mockResolvedValue(
      ALL_GRANTED.map((p) => ({ ...p, accessType: 'read' })),
    );

    expect(await hasPermissions()).toBe(false);
  });

  it('ne dépend PAS des permissions du cycle', async () => {
    mockGetGrantedPermissions.mockResolvedValue(ALL_GRANTED);

    // Sinon un compte n'ayant jamais activé le suivi du cycle basculerait en
    // `permissions_missing` sans raison (opt-in indépendant, R20).
    expect(await hasPermissions()).toBe(true);
  });

  it('renvoie false si l’initialisation du module échoue', async () => {
    mockInitialize.mockResolvedValue(false);

    expect(await hasPermissions()).toBe(false);
    expect(mockGetGrantedPermissions).not.toHaveBeenCalled();
  });

  it('ne lève pas si la lecture des permissions échoue', async () => {
    mockGetGrantedPermissions.mockRejectedValue(new Error('sécurité'));

    expect(await hasPermissions()).toBe(false);
  });

  it('renvoie false hors Android sans toucher au natif', async () => {
    setPlatform('ios');

    expect(await hasPermissions()).toBe(false);
    expect(mockInitialize).not.toHaveBeenCalled();
  });
});

describe('requestPermissions', () => {
  it('relit l’état RÉEL après la demande au lieu de croire son retour', async () => {
    mockRequestPermission.mockResolvedValue(undefined);
    mockGetGrantedPermissions.mockResolvedValue(
      ALL_GRANTED.filter((p) => p.recordType !== 'Steps'),
    );

    // L'utilisateur peut n'accorder qu'une partie des permissions dans l'écran système : se fier
    // au retour de la demande donnerait un « ready » mensonger.
    expect(await requestPermissions()).toBe(false);
    expect(mockRequestPermission).toHaveBeenCalled();
  });

  it('renvoie true quand tout a été accordé', async () => {
    mockRequestPermission.mockResolvedValue(undefined);

    expect(await requestPermissions()).toBe(true);
  });

  it('ne lève pas si la demande échoue', async () => {
    mockRequestPermission.mockRejectedValue(new Error('annulé'));

    expect(await requestPermissions()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// État affiché dans les Réglages
// ---------------------------------------------------------------------------

describe('getState', () => {
  it('renvoie « ready » quand tout est en place', async () => {
    expect(await getState()).toBe('ready');
  });

  it('fait primer la disponibilité du fournisseur sur tout le reste', async () => {
    mockGetSdkStatus.mockResolvedValue(SDK_UNAVAILABLE);
    mockGetHealthConnectEnabled.mockResolvedValue(false);

    // Inutile de dire « active la synchro » à quelqu'un qui n'a pas Health Connect installé.
    expect(await getState()).toBe('provider_missing');
  });

  it('renvoie « off » quand l’opt-in est désactivé, sans lire les permissions', async () => {
    mockGetHealthConnectEnabled.mockResolvedValue(false);

    expect(await getState()).toBe('off');
    expect(mockGetGrantedPermissions).not.toHaveBeenCalled();
  });

  it('renvoie « permissions_missing » quand l’opt-in est actif mais les droits absents', async () => {
    mockGetGrantedPermissions.mockResolvedValue([]);

    expect(await getState()).toBe('permissions_missing');
  });

  it('renvoie « unsupported » hors Android', async () => {
    setPlatform('ios');

    expect(await getState()).toBe('unsupported');
  });
});

// ---------------------------------------------------------------------------
// Cycle — opt-in et permissions indépendants (R20)
// ---------------------------------------------------------------------------

describe('cycle', () => {
  it('exige les quatre permissions du cycle', async () => {
    expect(await hasCyclePermissions()).toBe(true);

    mockGetGrantedPermissions.mockResolvedValue(
      CYCLE_GRANTED.filter((p) => p.recordType !== 'MenstruationFlow'),
    );
    expect(await hasCyclePermissions()).toBe(false);
  });

  it('ne se satisfait pas des permissions générales', async () => {
    mockGetGrantedPermissions.mockResolvedValue(ALL_GRANTED);

    expect(await hasCyclePermissions()).toBe(false);
  });

  it('dépend de SON opt-in, pas de celui de la synchro générale', async () => {
    mockGetHealthConnectEnabled.mockResolvedValue(false);
    mockGetCycleHealthConnectEnabled.mockResolvedValue(true);

    expect(await getCycleState()).toBe('ready');
    expect(await getState()).toBe('off');
  });

  it('renvoie « off » quand seul l’opt-in du cycle est éteint', async () => {
    mockGetCycleHealthConnectEnabled.mockResolvedValue(false);

    expect(await getCycleState()).toBe('off');
    expect(await getState()).toBe('ready');
  });
});

// ---------------------------------------------------------------------------
// Throttles d'import
// ---------------------------------------------------------------------------

describe('imports throttlés', () => {
  it('importe au premier passage, quand aucun curseur n’existe', async () => {
    mockGetItemAsync.mockResolvedValue(null);

    // Le curseur absent doit valoir « jamais importé », pas « importé à l'instant » : sinon un
    // nouvel appareil n'importerait jamais rien.
    await importWeightIfDue();
    expect(mockInitialize).toHaveBeenCalled();
  });

  it('ne réimporte pas le poids dans la fenêtre de throttle', async () => {
    mockGetItemAsync.mockResolvedValue(new Date().toISOString());

    expect(await importWeightIfDue()).toBe(0);
    expect(mockInitialize).not.toHaveBeenCalled();
  });

  it('réimporte le poids une fois la fenêtre écoulée', async () => {
    mockGetItemAsync.mockResolvedValue(new Date(Date.now() - 7 * 3600_000).toISOString());

    await importWeightIfDue();
    expect(mockInitialize).toHaveBeenCalled();
  });

  it('applique au pas une fenêtre PLUS COURTE qu’au poids', async () => {
    // 2 h : au-delà de la fenêtre des pas (1 h), en deçà de celle du poids (6 h).
    mockGetItemAsync.mockResolvedValue(new Date(Date.now() - 2 * 3600_000).toISOString());

    expect(await importWeightIfDue()).toBe(0);
    await importStepsIfDue();
    expect(mockInitialize).toHaveBeenCalled();
  });

  it('ne tente aucun import hors Android', async () => {
    setPlatform('ios');

    expect(await importWeightIfDue()).toBe(0);
    expect(await importStepsIfDue()).toBe(0);
    expect(mockGetItemAsync).not.toHaveBeenCalled();
  });

  it('ne lève pas si le curseur est illisible', async () => {
    mockGetItemAsync.mockRejectedValue(new Error('keystore'));

    await expect(importWeightIfDue()).resolves.toEqual(expect.any(Number));
  });
});

/**
 * Non-régression du 30/07/2026 : **un opt-in sur OFF n'est pas une panne.**
 *
 * Les Réglages affichent `getLastSyncReport()` dans un bandeau bordé `danger` dès que `error` est
 * non nul. Avant ce correctif, `ready()` renvoyait une `reason` pour l'opt-in désactivé exactement
 * comme pour un vrai échec : tout utilisateur n'ayant simplement pas activé Health Connect voyait
 * « Dernière tentative (steps) en échec : [r4] synchronisation désactivée (opt-in OFF) » — l'état
 * normal de l'app présenté comme une erreur. Constaté en passe device, cf. docs/plan-de-test.md.
 *
 * Ce test verrouille la frontière : **abandon normal → aucun compte rendu ; échec réel → compte
 * rendu**. Il s'arrête au niveau du module `lib` (frontière d'E/S) : rien de natif n'est atteint,
 * puisque `ready()` sort avant.
 */

import { Platform } from 'react-native';

import { getLastSyncReport, pushWorkout } from '../health-connect';

// babel-plugin-jest-hoist remonte les `jest.mock()` au-dessus de ces imports : les placer en
// tête satisfait `import/first` sans changer l'ordre d'exécution réel.
// Préfixe `mock` obligatoire : Jest hisse les `jest.mock()` avant les déclarations.
const mockGetHealthConnectEnabled = jest.fn<Promise<boolean>, []>();

jest.mock('@/data/repositories/settings-repository', () => ({
  getHealthConnectEnabled: () => mockGetHealthConnectEnabled(),
}));

// `pushWorkout` n'atteint jamais ces modules quand `ready()` abandonne — on les neutralise pour que
// l'import du module sous test n'entraîne pas tout le graphe natif.
jest.mock('@/powersync/system', () => ({ powerSync: { getOptional: jest.fn() } }));
jest.mock('@/data/repositories/bodyweight-repository', () => ({ logWeight: jest.fn() }));
jest.mock('@/data/repositories/daily-steps-repository', () => ({ upsertDailySteps: jest.fn() }));
jest.mock('react-native-health-connect', () => ({}), { virtual: true });

describe('Health Connect — opt-in OFF n’est pas une erreur', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Sous Jest, `Platform.OS` vaut « ios » : sans ceci, `ready()` sortirait dès la garde de
    // plateforme et le test passerait **pour la mauvaise raison**, sans jamais évaluer l'opt-in.
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  });

  it('opt-in OFF → aucun compte rendu d’échec (pas de bandeau rouge dans les Réglages)', async () => {
    mockGetHealthConnectEnabled.mockResolvedValue(false);

    await pushWorkout('workout-1');

    const report = getLastSyncReport();
    // Rien du tout, ou au moins rien qui porte une erreur : l'UI ne doit avoir aucune raison
    // d'afficher un bandeau.
    expect(report?.error ?? null).toBeNull();
  });

  it('la garde d’opt-in est bien consultée avant toute écriture', async () => {
    mockGetHealthConnectEnabled.mockResolvedValue(false);

    await pushWorkout('workout-1');

    expect(mockGetHealthConnectEnabled).toHaveBeenCalled();
  });

  it('opt-in ON mais échec réel → le compte rendu porte bien une erreur', async () => {
    // L'autre côté de la frontière : le correctif ne doit pas avoir rendu les vraies pannes
    // silencieuses. Opt-in ON → `ready()` va jusqu'au module natif, que l'on a stubé à `{}` : le
    // `getSdkStatus` manquant lève, et l'abandon doit être signalé.
    mockGetHealthConnectEnabled.mockResolvedValue(true);

    await pushWorkout('workout-1');

    expect(getLastSyncReport()?.error).toBeTruthy();
  });
});

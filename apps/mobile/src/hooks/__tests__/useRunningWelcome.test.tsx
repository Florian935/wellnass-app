/**
 * US CARDIO-02 (R14, R15) — quand l'accueil du pilier Course s'ouvre, et son marqueur.
 *
 * 🔴 Les gardes qui comptent :
 *  - **en ligne, et synchronisé pendant ce lancement** : un second téléphone rouvert hors ligne,
 *    synchronisé avant que le profil existe, écrirait une seconde ligne de profil ; l'unicité de
 *    `user_id` la refuserait au serveur et bloquerait toute sa file d'envoi ;
 *  - **le focus du hub** : l'onglet reste monté sous les autres écrans ;
 *  - **une relecture de la table** au moment d'ouvrir.
 */
import { act, renderHook } from '@testing-library/react-native';
import { useStatus } from '@powersync/react';
import { useRouter } from 'expo-router';

import { resetRunningWelcomeForTests, useRunningWelcome } from '../useRunningWelcome';
import { useActiveRun } from '@/data/repositories/run-repository';
import {
  hasRunnerProfile,
  upsertRunnerProfile,
  useRunnerProfile,
} from '@/data/repositories/running-profile-repository';
import { markAppLaunched } from '@/lib/app-launch';

let mockFocused = true;
jest.mock('@powersync/react', () => ({ useStatus: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  // Comme `useFocusEffect` : l'effet ne tourne que si l'écran a le focus.
  useFocusEffect: (effect: () => void | (() => void)) =>
    require('react').useEffect(() => (mockFocused ? effect() : undefined), [effect]),
}));
jest.mock('@/data/repositories/run-repository', () => ({ useActiveRun: jest.fn() }));
jest.mock('@/data/repositories/running-profile-repository', () => ({
  useRunnerProfile: jest.fn(),
  upsertRunnerProfile: jest.fn(),
  hasRunnerProfile: jest.fn(),
}));

const mockStatus = useStatus as jest.Mock;
const mockRouter = useRouter as jest.Mock;
const mockActive = useActiveRun as jest.Mock;
const mockProfile = useRunnerProfile as jest.Mock;
const mockUpsert = upsertRunnerProfile as jest.Mock;
const mockHasProfile = hasRunnerProfile as jest.Mock;
const push = jest.fn();

// Le lancement a eu lieu « maintenant » : une synchro postérieure est de ce lancement.
markAppLaunched(Date.now());
const synchroDeCeLancement = () => new Date(Date.now() + 1000);

/** Monte le hook et laisse passer la relecture asynchrone de la table. */
const monter = async () => {
  const rendu = await renderHook(() => useRunningWelcome());
  await act(async () => {});
  return rendu;
};

beforeEach(() => {
  jest.clearAllMocks();
  resetRunningWelcomeForTests();
  mockFocused = true;
  mockRouter.mockReturnValue({ push });
  mockStatus.mockReturnValue({ connected: true, lastSyncedAt: synchroDeCeLancement() });
  mockActive.mockReturnValue({ run: null, isLoading: false });
  mockProfile.mockReturnValue({ runnerProfile: null, isLoading: false });
  mockUpsert.mockResolvedValue(undefined);
  mockHasProfile.mockResolvedValue(false);
});

it('🔴 s’ouvre pour un compte sans profil, et pose le marqueur à l’ouverture', async () => {
  await monter();

  expect(mockUpsert).toHaveBeenCalledWith({});
  expect(push).toHaveBeenCalledWith('/running-welcome');
});

it('🔴 une seule fois par lancement, même si le profil tarde à apparaître', async () => {
  const { rerender } = await monter();
  mockStatus.mockReturnValue({ connected: true, lastSyncedAt: new Date(Date.now() + 2000) });
  await rerender({});
  await monter();

  expect(push).toHaveBeenCalledTimes(1);
  expect(mockUpsert).toHaveBeenCalledTimes(1);
});

it('🔴 jamais quand le hub n’a pas le focus (fin de course, autre onglet)', async () => {
  mockFocused = false;
  await monter();

  expect(push).not.toHaveBeenCalled();
  expect(mockUpsert).not.toHaveBeenCalled();
});

it('🔴 relit la table avant d’ouvrir : une ligne arrivée par la synchro l’emporte', async () => {
  mockHasProfile.mockResolvedValue(true);
  await monter();

  expect(push).not.toHaveBeenCalled();
  expect(mockUpsert).not.toHaveBeenCalled();
});

it('🔴 jamais hors ligne', async () => {
  mockStatus.mockReturnValue({ connected: false, lastSyncedAt: synchroDeCeLancement() });
  await monter();

  expect(push).not.toHaveBeenCalled();
  expect(mockUpsert).not.toHaveBeenCalled();
});

it('🔴 jamais sur la foi d’une synchro d’un lancement précédent', async () => {
  mockStatus.mockReturnValue({ connected: true, lastSyncedAt: new Date(2026, 0, 1), hasSynced: true });
  await monter();

  expect(push).not.toHaveBeenCalled();
  expect(mockUpsert).not.toHaveBeenCalled();
});

it('jamais avec un profil, même vide', async () => {
  mockProfile.mockReturnValue({ runnerProfile: { ref5kPaceSPerKm: null }, isLoading: false });
  await monter();

  expect(push).not.toHaveBeenCalled();
});

it('jamais pendant une course, ni tant que les données chargent', async () => {
  mockActive.mockReturnValue({ run: { id: 'r1' }, isLoading: false });
  await monter();
  expect(push).not.toHaveBeenCalled();

  mockActive.mockReturnValue({ run: null, isLoading: true });
  await monter();
  expect(push).not.toHaveBeenCalled();

  mockActive.mockReturnValue({ run: null, isLoading: false });
  mockProfile.mockReturnValue({ runnerProfile: null, isLoading: true });
  await monter();
  expect(push).not.toHaveBeenCalled();
});


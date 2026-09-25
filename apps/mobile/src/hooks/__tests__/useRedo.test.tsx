/**
 * Refaire une séance (US MUSCU-UX07, R4) — le même geste depuis le hub, l'historique et le détail.
 *
 * Le défaut que ce hook ferme : `startWorkoutFromWorkout` renvoyait **en silence** la séance en
 * cours s'il y en avait une ; l'utilisateur atterrissait dans une autre séance que celle demandée.
 */
import { Alert } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { useRedo } from '../useRedo';
import { hasActiveWorkout, startWorkoutFromWorkout } from '@/data/repositories/workout-repository';

jest.mock('@/data/repositories/workout-repository', () => ({
  hasActiveWorkout: jest.fn(),
  startWorkoutFromWorkout: jest.fn(),
}));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const push = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ push });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

const refaire = async (id: string) => {
  const { result } = await renderHook(() => useRedo());
  await act(async () => {
    result.current(id);
  });
};

it('sans séance en cours : rejoue la séance, puis l’ouvre', async () => {
  (hasActiveWorkout as jest.Mock).mockResolvedValue(false);
  (startWorkoutFromWorkout as jest.Mock).mockResolvedValue('w-neuve');

  await refaire('w-legs');

  expect(startWorkoutFromWorkout).toHaveBeenCalledWith('w-legs');
  expect(push).toHaveBeenCalledWith('/workout');
});

it('🔴 pendant une séance : une alerte, et RIEN n’est créé', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (hasActiveWorkout as jest.Mock).mockResolvedValue(true);

  await refaire('w-legs');

  expect(startWorkoutFromWorkout).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith('strengthHub.redo.busyTitle', 'strengthHub.redo.busyMessage', expect.any(Array));

  // « Reprendre » rouvre la séance en cours.
  const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
  buttons.find((b) => b.text === 'strengthHub.resumeLine.action')!.onPress!();
  expect(push).toHaveBeenCalledWith('/workout');
  alert.mockRestore();
});

it('une séance d’origine introuvable : rien n’est ouvert', async () => {
  (hasActiveWorkout as jest.Mock).mockResolvedValue(false);
  (startWorkoutFromWorkout as jest.Mock).mockRejectedValue(new Error('introuvable'));

  await refaire('w-supprimee');

  expect(push).not.toHaveBeenCalled();
});

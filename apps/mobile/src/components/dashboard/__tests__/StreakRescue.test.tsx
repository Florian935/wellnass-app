/**
 * Sauver la série par un vrai geste (`StreakRescue`, US ACCUEIL-07, constat 5).
 *
 * Testé jusqu'ici à travers la scène de l'accueil ; depuis ACCUEIL-08 les sorties vivent dans la
 * carte du moment (série en jeu le soir), et ces tests les suivent (repris de `HomeStage.test.tsx`).
 * Le CHOIX des sorties est fait par `streakRescueOptions` (`streak-rescue.test.ts`).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { StreakRescueOption } from '@wellness/shared';
import { StreakRescue } from '../StreakRescue';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ scheme: 'light', colors: { background: '#fffaf2' } }),
}));
jest.mock('@/hooks/useAppReducedMotion', () => ({ useAppReducedMotion: jest.fn(() => false) }));
jest.mock('@/lib/haptics', () => ({ hapticConfirm: jest.fn(), hapticSelect: jest.fn(), hapticMilestone: jest.fn() }));

const handlers = { onWalk: jest.fn(), onActivity: jest.fn(), onJoker: jest.fn() };
const TOUTES: StreakRescueOption[] = [{ kind: 'walk', stepsLeft: 1900, minutes: 20 }, { kind: 'activity' }, { kind: 'joker' }];

const afficher = (options: StreakRescueOption[]) =>
  render(<StreakRescue options={options} {...handlers} busy={false} formatSteps={(n) => `${n}`} />);

beforeEach(() => jest.clearAllMocks());

it('les trois vrais gestes, chacun avec ce qu’il coûte', async () => {
  await afficher(TOUTES);

  expect(screen.getByText('stage.home.rescue.walk:{"minutes":20}')).toBeTruthy();
  expect(screen.getByText('stage.home.rescue.walkSub:{"steps":"1900"}')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('streak-rescue-walk'));
  await fireEvent.press(screen.getByTestId('streak-rescue-activity'));
  await fireEvent.press(screen.getByTestId('streak-rescue-joker'));
  expect(handlers.onWalk).toHaveBeenCalledTimes(1);
  expect(handlers.onActivity).toHaveBeenCalledTimes(1);
  expect(handlers.onJoker).toHaveBeenCalledTimes(1);
});

it('🔴 plus de « Sauver ma série » qui ouvrait le planning', async () => {
  await afficher(TOUTES);
  expect(screen.queryByText('stage.home.saveStreak')).toBeNull();
});

it('n’affiche que les sorties proposées — sans joker, pas de joker', async () => {
  await afficher([{ kind: 'activity' }]);
  expect(screen.queryByTestId('streak-rescue-joker')).toBeNull();
  expect(screen.queryByTestId('streak-rescue-walk')).toBeNull();
  expect(screen.getByTestId('streak-rescue-activity')).toBeTruthy();
});

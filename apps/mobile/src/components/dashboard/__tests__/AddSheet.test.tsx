/**
 * Le « + » de l'accueil et sa feuille « Noter » (`AddSheet`, US ACCUEIL-08, décision D4).
 *
 * Trois exigences :
 *  1. **les tuiles suivent les piliers actifs** (décision H) — une tuile vers un pilier masqué
 *     mènerait à un écran que l'utilisateur a choisi de ne pas voir ;
 *  2. **le repas proposé est celui de l'heure passée par l'écran**, jamais d'une horloge lue au rendu
 *     (React Compiler la figerait au montage de la feuille) ;
 *  3. **le verre d'eau s'écrit sur place** : c'est le seul geste d'un tap, il ne navigue pas.
 */
import '@/i18n';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DEFAULT_GLASS_ML } from '@wellness/shared';
import { useRouter } from 'expo-router';
import { AddFab, AddSheet } from '../AddSheet';
import { addWater } from '@/data/repositories/water-repository';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/data/repositories/water-repository', () => ({ addWater: jest.fn(() => Promise.resolve()) }));
jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: () => '2026-10-25' }));
jest.mock('@/hooks/useAppReducedMotion', () => ({ useAppReducedMotion: jest.fn(() => false) }));
jest.mock('@/lib/haptics', () => ({ hapticConfirm: jest.fn(), hapticSelect: jest.fn(), hapticMilestone: jest.fn() }));

const push = jest.fn();
const onClose = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ push });
});

const tiles = () =>
  screen
    .queryAllByTestId(/^home-add-(?!sheet|fab)/)
    .map((node) => String(node.props.testID).replace('home-add-', ''));

describe('les tuiles suivent les piliers actifs (décision H)', () => {
  it('les trois piliers : les huit gestes, dans l’ordre de la feuille', async () => {
    await render(<AddSheet visible onClose={onClose} pillars={['strength', 'running', 'nutrition']} hour={12} />);
    expect(tiles()).toEqual(['meal', 'scan', 'weigh', 'checkin', 'water', 'activity', 'run', 'workout']);
  });

  it('🔴 nutrition seule : ni course ni séance', async () => {
    await render(<AddSheet visible onClose={onClose} pillars={['nutrition']} hour={12} />);
    expect(tiles()).toEqual(['meal', 'scan', 'weigh', 'checkin', 'water', 'activity']);
  });

  it('🔴 musculation seule : ni repas, ni scan, ni eau', async () => {
    await render(<AddSheet visible onClose={onClose} pillars={['strength']} hour={12} />);
    expect(tiles()).toEqual(['weigh', 'checkin', 'activity', 'workout']);
  });
});

describe('le repas du moment', () => {
  it('à 8 h, le petit-déjeuner', async () => {
    await render(<AddSheet visible onClose={onClose} pillars={['nutrition']} hour={8} />);
    await fireEvent.press(screen.getByTestId('home-add-meal'));
    expect(onClose).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith({ pathname: '/food-picker', params: { date: '2026-10-25', meal: 'breakfast' } });
  });

  it('🔴 la même feuille, montée le matin, propose le dîner quand l’écran passe 20 h', async () => {
    // La feuille reste montée tant que l'accueil l'est : l'heure doit venir de l'écran.
    const vue = await render(<AddSheet visible onClose={onClose} pillars={['nutrition']} hour={8} />);
    await vue.rerender(<AddSheet visible onClose={onClose} pillars={['nutrition']} hour={20} />);
    await fireEvent.press(screen.getByTestId('home-add-scan'));
    expect(push).toHaveBeenCalledWith({ pathname: '/food-scan', params: { date: '2026-10-25', meal: 'dinner' } });
  });
});

describe('les autres gestes', () => {
  it('🔴 le verre d’eau s’écrit SUR PLACE, sans navigation', async () => {
    const onWaterAdded = jest.fn();
    await render(
      <AddSheet visible onClose={onClose} pillars={['nutrition']} hour={12} onWaterAdded={onWaterAdded} />,
    );
    await fireEvent.press(screen.getByTestId('home-add-water'));
    expect(addWater).toHaveBeenCalledWith('2026-10-25', DEFAULT_GLASS_ML);
    expect(onClose).toHaveBeenCalled();
    expect(onWaterAdded).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('le check-in ouvre le formulaire complet, la séance libre le hub muscu', async () => {
    await render(<AddSheet visible onClose={onClose} pillars={['strength']} hour={12} />);
    await fireEvent.press(screen.getByTestId('home-add-checkin'));
    expect(push).toHaveBeenLastCalledWith('/wellbeing');
    await fireEvent.press(screen.getByTestId('home-add-workout'));
    expect(push).toHaveBeenLastCalledWith('/(tabs)/strength');
  });
});

describe('le « + » flottant', () => {
  it('se nomme pour les lecteurs d’écran et ouvre la feuille', async () => {
    const onPress = jest.fn();
    await render(<AddFab onPress={onPress} />);
    const fab = screen.getByTestId('home-add-fab');
    expect(fab.props.accessibilityLabel).toBe('Noter quelque chose');
    await fireEvent.press(fab);
    expect(onPress).toHaveBeenCalled();
  });
});

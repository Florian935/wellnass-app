import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { PressableScale } from '../PressableScale';
import { hapticConfirm, hapticMilestone, hapticSelect } from '@/lib/haptics';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';

jest.mock('@/lib/haptics', () => ({
  hapticSelect: jest.fn(),
  hapticConfirm: jest.fn(),
  hapticMilestone: jest.fn(),
}));

jest.mock('@/hooks/useAppReducedMotion', () => ({
  useAppReducedMotion: jest.fn(() => false),
}));

const reduced = useAppReducedMotion as jest.MockedFunction<typeof useAppReducedMotion>;

describe('PressableScale', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reduced.mockReturnValue(false);
  });

  it('appelle onPress', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <PressableScale onPress={onPress}>
        <Text>Valider la série</Text>
      </PressableScale>,
    );

    await fireEvent.press(getByText('Valider la série'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('vibre à l’enfoncement, pas au relâchement', async () => {
    const { getByText } = await render(
      <PressableScale onPress={jest.fn()}>
        <Text>Valider</Text>
      </PressableScale>,
    );

    // Le retour est attendu au moment où le doigt touche : c'est ce qui distingue un appui
    // « reçu » d'un appui « peut-être passé ».
    await fireEvent(getByText('Valider'), 'pressIn');

    expect(hapticSelect).toHaveBeenCalledTimes(1);
  });

  it.each([
    { haptic: 'select' as const, fn: hapticSelect },
    { haptic: 'confirm' as const, fn: hapticConfirm },
    { haptic: 'milestone' as const, fn: hapticMilestone },
  ])('déclenche l’haptique $haptic', async ({ haptic, fn }) => {
    const { getByText } = await render(
      <PressableScale onPress={jest.fn()} haptic={haptic}>
        <Text>Appui</Text>
      </PressableScale>,
    );

    await fireEvent(getByText('Appui'), 'pressIn');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reste muet quand l’haptique est à none', async () => {
    const { getByText } = await render(
      <PressableScale onPress={jest.fn()} haptic="none">
        <Text>Onglet</Text>
      </PressableScale>,
    );

    await fireEvent(getByText('Onglet'), 'pressIn');

    expect(hapticSelect).not.toHaveBeenCalled();
  });

  it('ne vibre pas et n’appelle pas onPress quand il est désactivé', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <PressableScale onPress={onPress} disabled>
        <Text>Indisponible</Text>
      </PressableScale>,
    );

    await fireEvent(getByText('Indisponible'), 'pressIn');
    await fireEvent.press(getByText('Indisponible'));

    expect(hapticSelect).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('garde l’haptique quand le mouvement est coupé', async () => {
    // Le point sensible de l'US : couper les animations retire le mouvement **visuel**. Quelqu'un
    // qui les coupe pour cause de sensibilité vestibulaire a toujours besoin de sentir qu'il a
    // validé sa série.
    reduced.mockReturnValue(true);
    const onPress = jest.fn();

    const { getByText } = await render(
      <PressableScale onPress={onPress}>
        <Text>Valider</Text>
      </PressableScale>,
    );

    await fireEvent(getByText('Valider'), 'pressIn');
    await fireEvent.press(getByText('Valider'));

    expect(hapticSelect).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('transmet le rôle et le nom accessibles', async () => {
    // Le cas qui compte : un bouton dont le libellé visible est un glyphe (« ▶ », « − », « + »)
    // n'annonce rien d'exploitable sans nom accessible explicite (US PAS-01). La primitive doit
    // laisser passer les deux attributs sans les absorber.
    const { getByLabelText } = await render(
      <PressableScale onPress={jest.fn()} accessibilityRole="button" accessibilityLabel="Démarrer">
        <Text>▶</Text>
      </PressableScale>,
    );

    expect(getByLabelText('Démarrer').props.accessibilityRole).toBe('button');
  });
});

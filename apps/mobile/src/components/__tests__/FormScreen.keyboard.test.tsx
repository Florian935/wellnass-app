/**
 * US CLAV-01 — **K2** : `FormScreen`, le conteneur de neuf formulaires (connexion, inscription,
 * onboarding, activité, fins de séance et de course…).
 *
 * ── Ce qui a changé, et ce qui ne devait pas ────────────────────────────────────────────────────
 * Jusqu'au 22/10/2026, `FormScreen` passait par `KeyboardAvoidingView` : `'padding'` sur iOS,
 * `'height'` sur Android depuis le 18/07 (`b50ff64b`). Ce calcul compare un cadre **relatif à son
 * parent** à un bord de clavier **absolu** : sous un en-tête natif (inscription, mot de passe oublié,
 * saisie d'activité), le décalage était court de la hauteur de l'en-tête. Le conteneur commun de
 * CLAV-01 mesure son bas dans la fenêtre : le décalage est juste partout.
 *
 * Ce test a d'abord **figé le montage d'avant** (filet de l'étape 1 du plan : KAV `'height'` /
 * `'padding'`, arêtes haut + bas, `ScrollView` « handled », padding 24 / gap 16 / `flexGrow: 1`) ;
 * à l'étape 3, seules deux attentes ont changé — plus de `KeyboardAvoidingView`, et l'arête basse
 * passe du `SafeAreaView` au conteneur (`safeAreaBottom`). Le `ScrollView` et son style, eux, n'ont
 * **jamais** bougé.
 */

import { Platform, StyleSheet, Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { FormScreen } from '../FormScreen';
import { flatStyle, hasBottomEdge, hostNodes } from '@/test-utils/host-tree';

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ colors: { background: '#f7eede' } }),
}));

/** Un `KeyboardAvoidingView` rendu se signalerait par `testID="kav"`. */
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: (props: object) => <View testID="kav" {...props} /> };
});

/** Clavier simulé : l'abonnement natif ne se propage pas au rendu sous RNTL v14. */
const mockFrame = { visible: false, height: 0, screenY: 0 };
jest.mock('@/components/keyboard/useKeyboardFrame', () => ({
  ...jest.requireActual('@/components/keyboard/useKeyboardFrame'),
  useKeyboardFrame: () => mockFrame,
}));
/** Le conteneur touche le bas d'un écran de 640 (le cadre du mock de safe area). */
jest.mock('@/components/keyboard/useMeasuredBottom', () => ({
  useMeasuredBottom: () => ({ bottom: 640, measure: () => {} }),
}));

const setOS = (os: 'android' | 'ios') =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
const originalOS = Platform.OS;

afterEach(() => {
  setOS(originalOS as 'android' | 'ios');
  Object.assign(mockFrame, { visible: false, height: 0, screenY: 0 });
});

const mount = () =>
  render(
    <FormScreen>
      <Text>champ</Text>
    </FormScreen>,
  );

describe('FormScreen — K2', () => {
  it.each(['android', 'ios'] as const)(
    'ne passe plus par `KeyboardAvoidingView` (%s) : un seul mécanisme, le conteneur commun',
    async (os) => {
      setOS(os);
      await mount();
      expect(screen.queryByTestId('kav')).toBeNull();
    },
  );

  it('le `SafeAreaView` ne porte plus l’arête basse : le conteneur la reprend (`safeAreaBottom`)', async () => {
    await mount();
    const safe = hostNodes(screen.toJSON()).find((n) => n.type === 'RNCSafeAreaView');
    expect(safe).toBeDefined();
    expect(hasBottomEdge(safe!)).toBe(false);
  });

  it('`edges` sans `bottom` : le conteneur ne reprend rien (aucun padding bas clavier fermé)', async () => {
    await render(
      <FormScreen edges={['top']}>
        <Text>champ</Text>
      </FormScreen>,
    );
    const paddings = hostNodes(screen.toJSON()).map((n) => flatStyle(n).paddingBottom ?? 0);
    expect(paddings.every((p) => p === 0)).toBe(true);
  });

  it('clavier ouvert, le contenu remonte exactement de ce que le clavier recouvre', async () => {
    // Écran de 640, clavier dont le bord haut est à 340 : 300 recouverts.
    Object.assign(mockFrame, { visible: true, height: 300, screenY: 340 });
    await mount();
    const paddings = hostNodes(screen.toJSON()).map((n) => flatStyle(n).paddingBottom);
    expect(paddings).toContain(300);
  });

  it('🔒 le `ScrollView` n’a pas bougé : `keyboardShouldPersistTaps="handled"`, padding 24, gap 16, `flexGrow: 1`', async () => {
    await mount();
    const scroll = hostNodes(screen.toJSON()).find((n) => n.type === 'RCTScrollView');
    expect(scroll).toBeDefined();
    expect(scroll!.props.keyboardShouldPersistTaps).toBe('handled');
    expect(StyleSheet.flatten(scroll!.props.contentContainerStyle as object)).toMatchObject({
      padding: 24,
      gap: 16,
      flexGrow: 1,
    });
  });
});

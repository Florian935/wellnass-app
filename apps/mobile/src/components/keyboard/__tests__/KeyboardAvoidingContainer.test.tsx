/**
 * US CLAV-01 — le conteneur d'évitement du clavier : ce qu'il pose, et quand il se tait.
 *
 * Le clavier et la mesure sont **simulés** : sous RNTL v14, un `setState` déclenché par un abonnement
 * natif ne se propage pas au rendu, et `measureInWindow` ne rappelle jamais sous Jest. La mesure a
 * son propre test (`useMeasuredBottom.test.tsx`).
 */

import { Modal, Text, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { KeyboardAvoidingContainer } from '../KeyboardAvoidingContainer';
import { flatStyle } from '@/test-utils/host-tree';

const mockFrame = { visible: false, height: 0, screenY: 0 };
jest.mock('../useKeyboardFrame', () => ({
  ...jest.requireActual('../useKeyboardFrame'),
  useKeyboardFrame: () => mockFrame,
}));
const mockBottom = { value: 914 };
const mockMeasure = jest.fn();
jest.mock('../useMeasuredBottom', () => ({
  useMeasuredBottom: () => ({ bottom: mockBottom.value, measure: mockMeasure }),
}));
const mockInsets = { top: 0, bottom: 24, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => {
  const mock = jest.requireActual('react-native-safe-area-context/jest/mock');
  return { ...(mock.default ?? mock), useSafeAreaInsets: () => mockInsets };
});

/** Pixel 6a : écran de 914, clavier ouvert à 600 → 314 recouverts depuis le bas de l'écran. */
const openKeyboard = () => Object.assign(mockFrame, { visible: true, height: 290, screenY: 600 });

afterEach(() => {
  Object.assign(mockFrame, { visible: false, height: 0, screenY: 0 });
  mockBottom.value = 914;
  mockMeasure.mockClear();
});

const paddingOf = (testID: string) => flatStyle(screen.getByTestId(testID) as never).paddingBottom;

describe('KeyboardAvoidingContainer', () => {
  it('clavier ouvert : pose exactement le recouvrement', async () => {
    openKeyboard();
    await render(
      <KeyboardAvoidingContainer testID="c">
        <Text>x</Text>
      </KeyboardAvoidingContainer>,
    );
    expect(paddingOf('c')).toBe(314);
  });

  it('🔴 clavier fermé, sans `safeAreaBottom` : aucun padding ajouté — l’écran ne change pas', async () => {
    await render(
      <KeyboardAvoidingContainer testID="c">
        <Text>x</Text>
      </KeyboardAvoidingContainer>,
    );
    expect(paddingOf('c') ?? 0).toBe(0);
  });

  it('le padding bas de l’appelant est conservé et additionné, jamais écrasé', async () => {
    await render(
      <KeyboardAvoidingContainer testID="c" style={{ padding: 16 }}>
        <Text>x</Text>
      </KeyboardAvoidingContainer>,
    );
    expect(paddingOf('c')).toBe(16);
    await screen.unmount();
    openKeyboard();
    await render(
      <KeyboardAvoidingContainer testID="c" style={{ padding: 16 }}>
        <Text>x</Text>
      </KeyboardAvoidingContainer>,
    );
    expect(paddingOf('c')).toBe(16 + 314);
    expect(flatStyle(screen.getByTestId('c') as never).padding).toBe(16);
  });

  it('`safeAreaBottom` : l’inset clavier fermé, le recouvrement seul clavier ouvert', async () => {
    await render(
      <KeyboardAvoidingContainer testID="c" safeAreaBottom>
        <Text>x</Text>
      </KeyboardAvoidingContainer>,
    );
    expect(paddingOf('c')).toBe(24);
    await screen.unmount();
    openKeyboard();
    await render(
      <KeyboardAvoidingContainer testID="c" safeAreaBottom>
        <Text>x</Text>
      </KeyboardAvoidingContainer>,
    );
    expect(paddingOf('c')).toBe(314);
  });

  it('au-dessus d’une barre d’onglets, la mesure la déduit', async () => {
    openKeyboard();
    mockBottom.value = 834;
    await render(
      <KeyboardAvoidingContainer testID="c">
        <Text>x</Text>
      </KeyboardAvoidingContainer>,
    );
    expect(paddingOf('c')).toBe(234);
  });

  it('`enabled={false}` : ne décale pas', async () => {
    openKeyboard();
    await render(
      <KeyboardAvoidingContainer testID="c" enabled={false}>
        <Text>x</Text>
      </KeyboardAvoidingContainer>,
    );
    expect(paddingOf('c') ?? 0).toBe(0);
  });

  it('🔴 un conteneur dans un conteneur de la même fenêtre est passif : un seul décalage', async () => {
    openKeyboard();
    await render(
      <KeyboardAvoidingContainer testID="outer">
        <KeyboardAvoidingContainer testID="inner">
          <Text>x</Text>
        </KeyboardAvoidingContainer>
      </KeyboardAvoidingContainer>,
    );
    expect(paddingOf('outer')).toBe(314);
    expect(paddingOf('inner') ?? 0).toBe(0);
  });

  it('🔴 `kind="sheet"` dans un conteneur d’écran reste actif — une `Modal` est une autre fenêtre', async () => {
    openKeyboard();
    await render(
      <KeyboardAvoidingContainer testID="screen">
        <Modal visible transparent>
          <KeyboardAvoidingContainer testID="sheet" kind="sheet">
            <KeyboardAvoidingContainer testID="inside-sheet">
              <View />
            </KeyboardAvoidingContainer>
          </KeyboardAvoidingContainer>
        </Modal>
      </KeyboardAvoidingContainer>,
    );
    expect(paddingOf('screen')).toBe(314);
    expect(paddingOf('sheet')).toBe(314);
    // …et ce qu'on pose dans la feuille redevient passif.
    expect(paddingOf('inside-sheet') ?? 0).toBe(0);
  });

  it('🔒 passif avec `safeAreaBottom`, clavier ouvert : l’inset n’est pas ajouté au décalage de l’extérieur', async () => {
    openKeyboard();
    await render(
      <KeyboardAvoidingContainer testID="outer">
        <KeyboardAvoidingContainer testID="inner" safeAreaBottom>
          <Text>x</Text>
        </KeyboardAvoidingContainer>
      </KeyboardAvoidingContainer>,
    );
    expect(paddingOf('outer')).toBe(314);
    expect(paddingOf('inner') ?? 0).toBe(0);
  });
});

describe('KeyboardAvoidingContainer — il se mesure (sinon tout décalage serait faux hors du bas de l’écran)', () => {
  // Constat de la revue du 23/10/2026 : tous les tests de rendu simulent la mesure ; retirer les appels
  // à `measure()` du conteneur laissait la suite verte. La valeur de repli (« bas du cadre de l'app »)
  // décalerait trop tout conteneur qui ne touche pas le bas de la fenêtre (hubs, `Screen`, feuilles).
  const layout = { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 600 } } };

  it('à chaque mise en page', async () => {
    await render(
      <KeyboardAvoidingContainer testID="c">
        <Text>x</Text>
      </KeyboardAvoidingContainer>,
    );
    mockMeasure.mockClear();
    await fireEvent(screen.getByTestId('c'), 'layout', layout);
    expect(mockMeasure).toHaveBeenCalledTimes(1);
  });

  it('à l’ouverture du clavier', async () => {
    const tree = () => (
      <KeyboardAvoidingContainer testID="c">
        <Text>x</Text>
      </KeyboardAvoidingContainer>
    );
    await render(tree());
    mockMeasure.mockClear();
    openKeyboard();
    await screen.rerender(tree());
    expect(mockMeasure).toHaveBeenCalled();
  });

  it('jamais pour un conteneur passif', async () => {
    openKeyboard();
    await render(
      <KeyboardAvoidingContainer testID="outer">
        <KeyboardAvoidingContainer testID="inner">
          <Text>x</Text>
        </KeyboardAvoidingContainer>
      </KeyboardAvoidingContainer>,
    );
    mockMeasure.mockClear();
    await fireEvent(screen.getByTestId('inner'), 'layout', layout);
    expect(mockMeasure).not.toHaveBeenCalled();
  });
});

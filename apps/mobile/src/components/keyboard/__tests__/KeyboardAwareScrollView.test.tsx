/**
 * US CLAV-01 — `KeyboardAwareScrollView` remplace un `ScrollView` de formulaire sans toucher à son
 * style, et impose `keyboardShouldPersistTaps="handled"` (D8).
 */

import { createRef } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { KeyboardAwareScrollView } from '../KeyboardAwareScrollView';
import { flatStyle, hostNodes } from '@/test-utils/host-tree';

const mockFrame = { visible: false, height: 0, screenY: 0 };
jest.mock('../useKeyboardFrame', () => ({
  ...jest.requireActual('../useKeyboardFrame'),
  useKeyboardFrame: () => mockFrame,
}));
jest.mock('../useMeasuredBottom', () => ({
  useMeasuredBottom: () => ({ bottom: 640, measure: () => {} }),
}));

afterEach(() => Object.assign(mockFrame, { visible: false, height: 0, screenY: 0 }));

const scrollNode = () => hostNodes(screen.toJSON()).find((n) => n.type === 'RCTScrollView')!;

describe('KeyboardAwareScrollView', () => {
  it('transmet props et style au `ScrollView`, et reprend son fond sur le conteneur', async () => {
    await render(
      <KeyboardAwareScrollView
        testID="scroll"
        style={{ backgroundColor: '#f7eede' }}
        contentContainerStyle={{ padding: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Text>x</Text>
      </KeyboardAwareScrollView>,
    );
    const scroll = scrollNode();
    expect(scroll.props.testID).toBe('scroll');
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle as object)).toEqual({
      padding: 20,
    });
    expect(scroll.props.showsVerticalScrollIndicator).toBe(false);
    const container = hostNodes(screen.toJSON())[0]!;
    expect(flatStyle(container).backgroundColor).toBe('#f7eede');
  });

  it('🔴 impose `keyboardShouldPersistTaps="handled"`, même si l’appelant demande « never »', async () => {
    await render(
      <KeyboardAwareScrollView keyboardShouldPersistTaps="never">
        <Text>x</Text>
      </KeyboardAwareScrollView>,
    );
    expect(scrollNode().props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('transmet la `ref` au `ScrollView` (`useScrollToTop` des hubs en dépend)', async () => {
    const ref = createRef<ScrollView>();
    await render(
      <KeyboardAwareScrollView ref={ref}>
        <Text>x</Text>
      </KeyboardAwareScrollView>,
    );
    expect(ref.current).not.toBeNull();
    expect(typeof ref.current?.scrollTo).toBe('function');
  });

  it('clavier ouvert : le conteneur se décale, pas le contenu du `ScrollView`', async () => {
    Object.assign(mockFrame, { visible: true, height: 300, screenY: 340 });
    await render(
      <KeyboardAwareScrollView contentContainerStyle={{ padding: 20 }}>
        <Text>x</Text>
      </KeyboardAwareScrollView>,
    );
    expect(flatStyle(hostNodes(screen.toJSON())[0]!).paddingBottom).toBe(300);
  });
});

/**
 * US CLAV-01 — la mesure du bas d'un conteneur dans sa fenêtre.
 *
 * ⚠️ `View` est remplacée par une version **mesurable** : sous Jest, une `ref` de composant hôte vaut
 * `null` et RNTL 14 a supprimé `createNodeMock`. Sans ce mock, `measure` ne mesurerait rien et le test
 * passerait au vert sur la seule valeur de repli — le piège du test vert parce que le code testé ne
 * s'exécute pas (même patron que `planning-screen.test.tsx`).
 */

import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { useMeasuredBottom } from '../useMeasuredBottom';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const React = require('react');
  const ViewMesurable = React.forwardRef(
    (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => {
          cb(0, 120, 320, 480); // bas = 600
        },
      }));
      return React.createElement(RN.View, props);
    },
  );
  ViewMesurable.displayName = 'ViewMesurable';
  return new Proxy(RN, {
    get: (cible, prop) => (prop === 'View' ? ViewMesurable : Reflect.get(cible, prop)),
  });
});

/** La fonction de mesure de la sonde, exposée au test (posée dans un effet, pas au rendu). */
const sonde = { mesurer: () => {} };

function Sonde({ withRef = true }: { withRef?: boolean }) {
  const ref = useRef<View>(null);
  const { bottom, measure } = useMeasuredBottom(ref);
  useEffect(() => {
    sonde.mesurer = measure;
  });
  return (
    <View ref={withRef ? ref : undefined}>
      <Text testID="bottom">{String(bottom)}</Text>
    </View>
  );
}

describe('useMeasuredBottom', () => {
  it('avant toute mesure : le bas du cadre de l’app (640 sous le mock de safe area)', async () => {
    await render(<Sonde />);
    expect(screen.getByTestId('bottom').props.children).toBe('640');
  });

  it('après mesure : `y + height` dans la fenêtre', async () => {
    await render(<Sonde />);
    await act(async () => sonde.mesurer());
    expect(screen.getByTestId('bottom').props.children).toBe('600');
  });

  it('sans `ref` (démontée, ou jamais posée) : aucune exception, la valeur de repli reste', async () => {
    await render(<Sonde withRef={false} />);
    await act(async () => sonde.mesurer());
    expect(screen.getByTestId('bottom').props.children).toBe('640');
  });
});

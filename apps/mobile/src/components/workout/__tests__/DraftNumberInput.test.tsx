/**
 * Le champ de séance qui laisse taper une décimale — MUSCU-FIX02, passe 2.
 *
 * Les champs de séance sont contrôlés : chaque frappe est parsée puis ré-affichée depuis la valeur
 * stockée. « 82, » ne se parse pas en nombre : le champ se vidait, et « 136,5 » devenait « 1365 ».
 * La sonde ci-dessous reproduit exactement le parent (`workout.tsx`) : stocker, puis ré-afficher.
 */

import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { DraftNumberInput, sameDuration, sameNumber } from '../DraftNumberInput';

/** Le parent tel que l'écran de séance : un nombre stocké, ré-affiché à une décimale. */
function Parent() {
  const [kg, setKg] = useState<number | null>(80);
  const shown = kg === null ? '' : String(Number(kg.toFixed(1)));
  return (
    <>
      <DraftNumberInput
        accessibilityLabel="charge"
        value={shown}
        onChangeText={(text) => {
          const normalized = text.trim().replace(',', '.').replace(/\.$/, '');
          const parsed = /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : null;
          setKg(parsed);
        }}
      />
      <Pressable accessibilityLabel="plus" onPress={() => setKg((v) => (v ?? 0) + 2.5)} />
      <Text testID="stocke">{String(kg)}</Text>
    </>
  );
}

const taper = async (texte: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText('charge'), texte);
  });
};
const affiche = () => screen.getByLabelText('charge').props.value;

describe('DraftNumberInput', () => {
  it('🔴 garde « 82, » à l’écran le temps de taper la décimale — puis stocke 82,5', async () => {
    await render(<Parent />);

    await taper('8');
    await taper('82');
    await taper('82,');
    expect(affiche()).toBe('82,');
    await taper('82,5');

    expect(affiche()).toBe('82,5');
    expect(screen.getByTestId('stocke').props.children).toBe('82.5');
  });

  it('un − / + venu d’ailleurs reprend la main sur la saisie', async () => {
    await render(<Parent />);
    await taper('82,5');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('plus'));
    });

    expect(affiche()).toBe('85');
  });

  it('en quittant le champ, la valeur stockée s’affiche telle quelle', async () => {
    await render(<Parent />);
    await taper('82,');

    await act(async () => {
      fireEvent(screen.getByLabelText('charge'), 'blur');
    });

    expect(affiche()).toBe('82');
  });
});

describe('sameNumber / sameDuration', () => {
  it('compare des nombres en cours de saisie, à l’arrondi d’affichage près', () => {
    expect(sameNumber('82,', '82')).toBe(true);
    expect(sameNumber('82,25', '82.3')).toBe(true);
    expect(sameNumber('82,5', '85')).toBe(false);
    expect(sameNumber('', '')).toBe(true);
    expect(sameNumber('', '80')).toBe(false);
  });

  it('compare des durées en m:ss ou en secondes', () => {
    expect(sameDuration('1:3', '1:03')).toBe(true);
    expect(sameDuration('90', '1:30')).toBe(true);
    expect(sameDuration('1:3', '1:30')).toBe(false);
  });
});

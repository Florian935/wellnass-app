/**
 * Les lueurs d'Aurore (`AuroraGlows`, US ACCUEIL-07 → 09).
 *
 * Le dosage à l'heure (`auroraDose`) et son enveloppe de contraste sont testés dans
 * `theme/__tests__/stage.test.ts`. Ici, le contrat du composant au repos : chaque lueur se pose à
 * EXACTEMENT son dosage de l'heure — la respiration ne peut que le baisser —, sans échelle, et ne
 * capte aucun appui (décor pur, R1).
 */
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { auroraDose } from '@/theme/stage';
import { AuroraGlows } from '../matter/AuroraGlows';

jest.mock('@/hooks/useAppReducedMotion', () => ({ useAppReducedMotion: jest.fn(() => false) }));

const styleOf = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID).props.style) as { opacity: number; transform: { scale: number }[] };

it.each([7.25, 13, 18.25, 20.75, 1.75, 16.5])('🔴 à %s h, chaque lueur est à son dosage exact', async (hour) => {
  await render(<AuroraGlows hour={hour} />);
  const [turquoise, framboise] = auroraDose(hour);
  expect(styleOf('aurora-turquoise').opacity).toBeCloseTo(turquoise, 5);
  expect(styleOf('aurora-framboise').opacity).toBeCloseTo(framboise, 5);
});

it('souffle coupé : aucune échelle, la lueur ne déborde pas de son coin', async () => {
  await render(<AuroraGlows hour={13} active={false} />);
  expect(styleOf('aurora-turquoise').transform).toEqual([{ scale: 1 }]);
});

it('décor pur : aucun appui capté', async () => {
  await render(<AuroraGlows hour={13} />);
  expect(screen.getByTestId('aurora-glows').props.pointerEvents).toBe('none');
});

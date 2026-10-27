/**
 * Le check-in du matin en visages (`CheckinFaces`, US ACCUEIL-07, constat 9).
 *
 * Testé jusqu'ici à travers la scène de l'accueil ; depuis ACCUEIL-08 les visages vivent dans la
 * carte du moment, et ces tests les suivent (repris de `HomeStage.test.tsx`).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CheckinFaces } from '../CheckinFaces';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));
jest.mock('@/hooks/useAppReducedMotion', () => ({ useAppReducedMotion: jest.fn(() => false) }));
jest.mock('@/lib/haptics', () => ({ hapticConfirm: jest.fn(), hapticSelect: jest.fn(), hapticMilestone: jest.fn() }));

const afficher = (onPick = jest.fn(), disabled = false) =>
  render(<CheckinFaces onPick={onPick} disabled={disabled} ink="#fff" glass="rgba(255,255,255,0.07)" glassBorder="rgba(255,255,255,0.14)" />);

beforeEach(() => jest.clearAllMocks());

it('pose UNE question — l’énergie, en cinq visages', async () => {
  const onPick = jest.fn();
  await afficher(onPick);
  const pastilles = screen.getAllByRole('radio');
  expect(pastilles).toHaveLength(5);
  await fireEvent.press(pastilles[3]!);
  expect(onPick).toHaveBeenCalledWith(4);
});

it('🔴 chaque visage porte son mot à l’écran — plus « 1 2 3 4 5 » (constat 9)', async () => {
  await afficher();
  for (const level of [1, 2, 3, 4, 5]) {
    expect(screen.getByText(`wellbeing.levels.energy.${level}`)).toBeTruthy();
  }
  expect(screen.queryByText('1')).toBeNull();
});

it('🔴 pendant l’enregistrement, les pastilles ne répondent plus', async () => {
  // Sans ça, cinq appuis rapides écrivent cinq fois la même journée.
  const onPick = jest.fn();
  await afficher(onPick, true);
  await fireEvent.press(screen.getAllByRole('radio')[0]!);
  expect(onPick).not.toHaveBeenCalled();
});

describe('US ACCUEIL-09 — le visage choisi s’allume', () => {
  it('🔴 le choix se voit ET s’annonce : le visage choisi est coché, allumé, les autres s’effacent', async () => {
    await afficher();
    expect(screen.queryByTestId('checkin-face-lit-4')).toBeNull();

    await fireEvent.press(screen.getByTestId('checkin-face-4'));

    expect(screen.getByTestId('checkin-face-lit-4')).toBeTruthy();
    expect(screen.getByTestId('checkin-face-4').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('checkin-face-2').props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByTestId('checkin-face-2')).toHaveStyle({ opacity: 0.55 });
  });

  it('un autre choix déplace la lumière', async () => {
    await afficher();
    await fireEvent.press(screen.getByTestId('checkin-face-4'));
    await fireEvent.press(screen.getByTestId('checkin-face-2'));
    expect(screen.getByTestId('checkin-face-lit-2')).toBeTruthy();
    expect(screen.queryByTestId('checkin-face-lit-4')).toBeNull();
  });
});

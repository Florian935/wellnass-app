/**
 * US DASH-01 — la scène de l'accueil, testée sur son **contrat**.
 *
 * US ACCUEIL-07 — la salutation et la phrase du jour en tête, sous les lueurs d'Aurore.
 *
 * US ACCUEIL-08 — la scène devient **le ciel** de « Ta journée » : elle ne porte plus de moments à
 * elle. Ce qu'elle testait a déménagé avec ce qu'elle montrait :
 *  - les visages du check-in → `CheckinFaces.test.tsx` (ils vivent dans la carte du moment) ;
 *  - les sorties de la série en jeu → `StreakRescue.test.tsx` (idem) ;
 *  - la carte « retour » et « Premiers pas » → `HomeSky.test.tsx` ;
 *  - le verdict de forme → le cadran Récupérer (`HomeDials.test.tsx`) ;
 *  - les anneaux de la semaine et la série → « Ta semaine » (`WeekStrip.test.tsx`).
 */
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { HomeStage } from '../HomeStage';

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ scheme: 'light', colors: { background: '#fffaf2' } }),
}));

const afficher = (children?: React.ReactNode, trailing?: React.ReactNode) =>
  render(
    <HomeStage
      greeting="Bonjour Florian"
      sentence="Il te reste 1 450 kcal aujourd'hui."
      dateLabel="lundi 14 septembre"
      glowMoment="jour"
      trailing={trailing}
    >
      {children}
    </HomeStage>,
  );

describe('l’en-tête (constat 6)', () => {
  it('🔴 la salutation est le titre, la phrase du jour la suit — deux textes distincts', async () => {
    await afficher();
    expect(screen.getByRole('header').props.children).toBe('Bonjour Florian');
    expect(screen.getByText("Il te reste 1 450 kcal aujourd'hui.")).toBeTruthy();
  });

  it('la date, et à sa droite ce que l’écran y pose (synchro, réglages)', async () => {
    await afficher(null, <Text>RÉGLAGES</Text>);
    expect(screen.getByText('lundi 14 septembre')).toBeTruthy();
    expect(screen.getByText('RÉGLAGES')).toBeTruthy();
  });

  it('pose les lueurs d’Aurore sous le contenu', async () => {
    await afficher();
    expect(screen.getByTestId('aurora-glows')).toBeTruthy();
  });
});

describe('le ciel (US ACCUEIL-08)', () => {
  it('porte ce que l’écran lui confie, sous la phrase du jour', async () => {
    await afficher(<Text>LES TROIS CADRANS</Text>);
    expect(screen.getByText('LES TROIS CADRANS')).toBeTruthy();
  });

  it('🔴 ne pose plus de moments à elle : ni check-in, ni série, ni anneaux', async () => {
    await afficher();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByTestId('home-streak', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('streak-rescue-walk')).toBeNull();
  });
});

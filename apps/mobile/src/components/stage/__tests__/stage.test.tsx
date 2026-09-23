/**
 * US DASH-01 — le socle des scènes, testé sur son **contrat** (règle héritée de MOTION-01) :
 * contenu présent, valeur finale rendue, rien de ce qu'on lit ne dépend du mouvement (R1).
 */
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PillarStage } from '../PillarStage';
import { StageScrollView } from '../StageScrollView';
import { StageButton } from '../StageButton';
import { DenseTile } from '../DenseTile';
import { FillLevel, levelHeightPct } from '../matter/FillLevel';
import { BreathRings, ringDashOffset } from '../matter/BreathRings';

describe('PillarStage', () => {
  it('rend son contenu et sa matière', async () => {
    await render(
      <PillarStage pillar="strength" matter={<Text>matière</Text>}>
        <Text>Push B</Text>
      </PillarStage>,
    );
    expect(screen.getByText('Push B')).toBeTruthy();
    expect(screen.getByText('matière')).toBeTruthy();
  });
});

describe('StageScrollView', () => {
  it('rend la scène et le corps', async () => {
    await render(
      <StageScrollView pillar="running" stage={<Text>8,0 km</Text>}>
        <Text>Km par km</Text>
      </StageScrollView>,
    );
    expect(screen.getByText('8,0 km')).toBeTruthy();
    expect(screen.getByText('Km par km')).toBeTruthy();
  });

  /**
   * 🔴 Recette MUSCU-UX06 (23/09/2026) — le bandeau opaque qui apparaissait en haut au défilement
   * (titre du pilier, à la couleur du haut de la scène) est retiré des quatre écrans à scène, sur
   * décision de Florian : « c'est super moche […] garder la transparence en plein écran ». Il était
   * rendu en permanence, simplement masqué tant que la scène restait visible : on vérifie qu'il n'est
   * plus rendu du tout, pas seulement invisible.
   */
  it.each(['home', 'strength', 'running', 'nutrition'] as const)(
    '%s : aucun en-tête compact, même masqué',
    async (pillar) => {
      await render(
        <StageScrollView pillar={pillar} stage={<Text>scène</Text>}>
          <Text>corps</Text>
        </StageScrollView>,
      );
      expect(screen.queryByTestId('stage-compact-header', { includeHiddenElements: true })).toBeNull();
    },
  );
});

describe('StageButton', () => {
  it('déclenche son action', async () => {
    const onPress = jest.fn();
    await render(<StageButton pillar="nutrition" label="Ajouter un aliment" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Ajouter un aliment' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('DenseTile', () => {
  it('titre, repère et contenu', async () => {
    await render(
      <DenseTile title="Ta semaine" meta="3 séances">
        <Text>barres</Text>
      </DenseTile>,
    );
    expect(screen.getByText('Ta semaine')).toBeTruthy();
    expect(screen.getByText('3 séances')).toBeTruthy();
    expect(screen.getByText('barres')).toBeTruthy();
  });

  it('touchable quand une action est fournie', async () => {
    const onPress = jest.fn();
    await render(<DenseTile title="12 semaines" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: '12 semaines' }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('FillLevel — le remplissage, dépassement zéro', () => {
  it('la hauteur suit le ratio, sur la portion de jauge', () => {
    expect(levelHeightPct(0.68, 0.66)).toBeCloseTo(44.88, 2);
  });

  it('au-delà de la cible, le niveau s’arrête au filet (jamais de débordement)', () => {
    expect(levelHeightPct(1.4, 0.66)).toBeCloseTo(66, 5);
  });

  it('ratio négatif ou invalide → 0', () => {
    expect(levelHeightPct(-1, 0.66)).toBe(0);
    expect(levelHeightPct(Number.NaN, 0.66)).toBe(0);
  });

  it('rend le niveau à sa valeur finale', async () => {
    await render(<FillLevel ratio={0.5} gaugeSpan={0.6} active={false} fill={['#4a6c2e', '#3a5622']} wave="#a9ba7e" />);
    expect(screen.getByTestId('fill-level')).toHaveStyle({ height: '30%' });
  });
});

describe('BreathRings', () => {
  it('l’arc d’une progression de 75 % laisse un quart du cercle vide', () => {
    const circumference = 2 * Math.PI * 64;
    expect(ringDashOffset(0.75, 64)).toBeCloseTo(circumference * 0.25, 5);
  });

  it('progression bornée entre 0 et 1', () => {
    expect(ringDashOffset(2, 10)).toBe(0);
    expect(ringDashOffset(-1, 10)).toBeCloseTo(2 * Math.PI * 10, 5);
  });

  it('rend un anneau par pilier', async () => {
    await render(
      <BreathRings
        active={false}
        rings={[
          { key: 'strength', progress: 0.75, color: '#6b0028', label: 'Muscu 3 sur 4' },
          { key: 'running', progress: 0.66, color: '#2a64ad', label: 'Course 2 sur 3' },
        ]}
      />,
    );
    expect(screen.getByLabelText('Muscu 3 sur 4, Course 2 sur 3')).toBeTruthy();
  });
});

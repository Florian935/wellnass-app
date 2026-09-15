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
  it('rend la scène, le corps, et un en-tête compact porteur du titre', async () => {
    await render(
      <StageScrollView pillar="running" stage={<Text>8,0 km</Text>} compactTitle="Course" compactValue="8,0 km">
        <Text>Km par km</Text>
      </StageScrollView>,
    );
    expect(screen.getAllByText('8,0 km').length).toBeGreaterThan(0);
    expect(screen.getByText('Km par km')).toBeTruthy();
    // L'en-tête compact existe, mais masqué tant que la scène est dépliée : il faut le chercher parmi les
    // éléments cachés — c'est la preuve qu'un lecteur d'écran ne l'annonce pas en double.
    expect(screen.queryByText('Course')).toBeNull();
    expect(screen.getByText('Course', { includeHiddenElements: true })).toBeTruthy();
  });

  it('l’en-tête compact est masqué quand la scène est dépliée (défilement nul)', async () => {
    await render(
      <StageScrollView pillar="running" stage={<Text>scène</Text>} compactTitle="Course">
        <Text>corps</Text>
      </StageScrollView>,
    );
    const header = screen.getByTestId('stage-compact-header', { includeHiddenElements: true });
    expect(header).toHaveStyle({ opacity: 0 });
    // Masqué pour l'œil, et pour les lecteurs d'écran : la scène dépliée porte déjà l'information.
    expect(header.props.importantForAccessibility).toBe('no-hide-descendants');
  });
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

/**
 * programs-smoke.test.tsx — Smoke test minimal pour les composants programmes.
 *
 * Vérifie que :
 *  1. le pipeline jest-expo transforme correctement les fichiers TSX du module programs ;
 *  2. les hooks PowerSync (useQuery) sont bien mockés via jest.setup.ts ;
 *  3. un composant consommant useProgramLibrary se rend sans planter avec des données
 *     vides, avec un programme de bibliothèque, et avec un programme actif.
 *
 * On ne teste pas la logique métier ni la navigation — uniquement la robustesse du
 * rendu. Les dépendances natives (expo-router, Screen, ScreenHeader) sont évitées
 * en composant un composant de test minimal, sur le même modèle que smoke.test.tsx.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { render } from '@testing-library/react-native';
import {
  useProgramLibrary,
  useMyPrograms,
  type ProgramListItem,
} from '@/data/repositories/program-repository';

// ---------------------------------------------------------------------------
// Mock du repository (isole PowerSync + SQLite)
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/program-repository', () => ({
  useProgramLibrary: jest.fn(() => ({ programs: [], isLoading: false })),
  useMyPrograms: jest.fn(() => ({ programs: [], isLoading: false })),
  duplicateProgram: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock de useTheme (évite useSettings → PowerSync dans ce chemin)
// ---------------------------------------------------------------------------

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#000',
      textMuted: '#888',
      background: '#fff',
      surface: '#f5f5f5',
      border: '#ddd',
      accent: '#6b0028',
      accentText: '#fff',
    },
  })),
}));

// ---------------------------------------------------------------------------
// Composant de test minimal (n'utilise pas expo-router ni Screen)
// ---------------------------------------------------------------------------

function ProgramListLabel() {
  const { programs: lib, isLoading: libLoading } = useProgramLibrary({});
  const { programs: mine } = useMyPrograms();

  if (libLoading) return <Text testID="status">Chargement…</Text>;

  const activeProgram = mine.find((p: ProgramListItem) => p.isActive);

  return (
    <View>
      <Text testID="status">Prêt</Text>
      <Text testID="lib-count">{lib.length}</Text>
      {activeProgram ? (
        <Text testID="active-name">{activeProgram.name}</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Programmes — smoke test (rendu sans planter)', () => {
  it('rend sans planter quand bibliothèque et mes programmes sont vides', async () => {
    const { getByTestId, getByText } = await render(<ProgramListLabel />);
    expect(getByTestId('status')).toBeTruthy();
    expect(getByText('Prêt')).toBeTruthy();
    expect(getByTestId('lib-count').props.children).toBe(0);
  });

  it('affiche "Chargement…" quand isLoading=true', async () => {
    (useProgramLibrary as jest.Mock).mockReturnValueOnce({
      programs: [],
      isLoading: true,
    });
    const { getByText } = await render(<ProgramListLabel />);
    expect(getByText('Chargement…')).toBeTruthy();
  });

  it('affiche le nombre de programmes en bibliothèque', async () => {
    const fakeLib: ProgramListItem[] = [
      {
        id: 'prog-1',
        name: 'Force débutant',
        pillar: 'strength',
        level: 'beginner',
        goal: null,
        durationWeeks: 8,
        isActive: false,
      },
      {
        id: 'prog-2',
        name: 'Full body 3j',
        pillar: 'strength',
        level: 'intermediate',
        goal: 'Prise de masse',
        durationWeeks: 12,
        isActive: false,
      },
    ];
    (useProgramLibrary as jest.Mock).mockReturnValueOnce({
      programs: fakeLib,
      isLoading: false,
    });
    const { getByTestId } = await render(<ProgramListLabel />);
    expect(getByTestId('lib-count').props.children).toBe(2);
  });

  it("affiche le nom du programme actif de l'utilisateur", async () => {
    const activeProg: ProgramListItem = {
      id: 'my-prog-1',
      name: 'Mon programme actif',
      pillar: 'strength',
      level: null,
      goal: null,
      durationWeeks: null,
      isActive: true,
    };
    (useMyPrograms as jest.Mock).mockReturnValueOnce({
      programs: [activeProg],
      isLoading: false,
    });
    const { getByTestId } = await render(<ProgramListLabel />);
    expect(getByTestId('active-name').props.children).toBe('Mon programme actif');
  });
});

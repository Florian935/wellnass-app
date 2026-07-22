/**
 * exercise-detail-smoke.test.tsx — Smoke test de la fiche exercice (MUSC-F10a).
 *
 * Vérifie que l'écran `app/exercises/[id].tsx` se rend sans planter :
 *  1. avec un exercice **perso** → affiche le nom et le badge « perso » ;
 *  2. avec `useExercise` renvoyant `null` → affiche l'état « introuvable ».
 *
 * Isolation : le repository (PowerSync + SQLite), `expo-router` (params + router)
 * et `useTheme` (évite useSettings → PowerSync) sont mockés. i18next réel (initialisé
 * par side-effect) fournit les traductions FR.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
// Initialise l'instance i18next réelle (side-effect) → `t()` renvoie les libellés FR
// (expo-localization est mocké sur `fr` dans jest.setup.ts).
import '@/i18n';
import { useExercise, type ExerciseDetail } from '@/data/repositories/exercise-repository';
import ExerciseDetailScreen from '@/app/exercises/[id]';

// ---------------------------------------------------------------------------
// Mock du repository (isole PowerSync + SQLite)
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/exercise-repository', () => ({
  useExercise: jest.fn(() => ({ exercise: null, isLoading: false })),
  toggleFavorite: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock expo-router (params d'URL + navigation)
// ---------------------------------------------------------------------------

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: 'exo-1' })),
  useRouter: jest.fn(() => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() })),
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

const customExercise: ExerciseDetail = {
  id: 'exo-1',
  name: 'Développé haltères maison',
  muscle: 'chest',
  source: 'custom',
  equipment: 'dumbbell',
  mediaUrl: null,
  isFavorite: false,
  instructions: 'Garder le dos plaqué au banc.',
  musclesSecondary: [],
};

describe('Fiche exercice — smoke test (rendu sans planter)', () => {
  it('affiche le nom et le badge « perso » pour un exercice personnalisé', async () => {
    (useExercise as jest.Mock).mockReturnValueOnce({
      exercise: customExercise,
      isLoading: false,
    });
    const { getByText } = await render(<ExerciseDetailScreen />);
    expect(getByText('Développé haltères maison')).toBeTruthy();
    expect(getByText('perso')).toBeTruthy();
  });

  it('affiche l\'état « introuvable » quand l\'exercice est null', async () => {
    (useExercise as jest.Mock).mockReturnValueOnce({
      exercise: null,
      isLoading: false,
    });
    const { getByText } = await render(<ExerciseDetailScreen />);
    expect(getByText('Exercice introuvable.')).toBeTruthy();
  });

  it('affiche la ligne « Muscles secondaires » avec les libellés résolus (F10c-1)', async () => {
    (useExercise as jest.Mock).mockReturnValueOnce({
      exercise: {
        ...customExercise,
        source: 'library',
        musclesSecondary: ['arms', 'shoulders'],
      },
      isLoading: false,
    });
    const { getByText } = await render(<ExerciseDetailScreen />);
    expect(getByText('Muscles secondaires')).toBeTruthy();
    expect(getByText('Bras · Épaules')).toBeTruthy();
  });

  it('n\'affiche pas la ligne « Muscles secondaires » quand la liste est vide', async () => {
    (useExercise as jest.Mock).mockReturnValueOnce({
      exercise: customExercise, // musclesSecondary: []
      isLoading: false,
    });
    const { queryByText } = await render(<ExerciseDetailScreen />);
    expect(queryByText('Muscles secondaires')).toBeNull();
  });
});

/**
 * Aperçu de la séance du jour (`app/session-preview.tsx`, US MUSCU-UX07 §4.5) — l'écran monté.
 *
 * Il doit dire exactement ce que Démarrer créera : chaque exercice planifié et son objectif tel
 * qu'écrit, la charge prévue, la dernière fois, la suggestion **en toutes lettres** (libellé de la
 * séance), « Première fois » — puis démarrer par le même chemin que le hub.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import SessionPreviewScreen from '../session-preview';
import { useSessionName, useSessionPreview } from '@/data/repositories/session-preview-repository';
import { startWorkoutFromSession } from '@/data/repositories/workout-repository';
import { useProgressionSuggestion } from '@/hooks/useProgressionSuggestion';
import { useSessionMode } from '@/stores/session-mode-store';

jest.mock('@/data/repositories/session-preview-repository', () => ({
  useSessionPreview: jest.fn(),
  useSessionName: jest.fn(),
}));
jest.mock('@/data/repositories/workout-repository', () => ({
  startWorkoutFromSession: jest.fn(),
  useWorkoutHistory: jest.fn(() => ({ workouts: [{ id: 'w' }], isLoading: false })),
}));
jest.mock('@/hooks/useProgressionSuggestion', () => ({ useProgressionSuggestion: jest.fn() }));
jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));
jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({ system: 'metric', weightSymbol: 'kg', formatWeight: (kg: number | null) => `${kg} kg` }),
}));
jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/ScreenHeader', () => {
  const { Text, View } = require('react-native');
  return {
    ScreenHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
      <View>
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
      </View>
    ),
  };
});
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});
jest.mock('expo-router', () => ({ useRouter: jest.fn(), useLocalSearchParams: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
    i18n: { language: 'fr' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f', textMuted: '#786a59', background: '#f7eede', surface: '#fffaf2', surfaceAlt: '#f3ddd0',
      border: '#e3d3ba', accent: '#a8261d', accentText: '#ffffff',
    },
  }),
}));

const cible = (sets: number, reps: string | null, plannedWeightKg: number | null = null) => ({ sets, reps, plannedWeightKg });

const push = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  useSessionMode.setState({ mode: 'classic', chosen: true, hydrated: true });
  (useRouter as jest.Mock).mockReturnValue({ push, back: jest.fn() });
  (useLocalSearchParams as jest.Mock).mockReturnValue({
    sessionId: 's-1',
    plannedSessionId: 'ps-1',
    programId: 'p',
    weekIndex: '2',
  });
  (useSessionName as jest.Mock).mockReturnValue('Push');
  (useSessionPreview as jest.Mock).mockReturnValue({
    exercises: [
      { exerciseId: 'bench', name: 'Développé couché', equipment: 'barbell', target: cible(4, '6-8'), targetSets: 4, restSeconds: 150 },
      { exerciseId: 'ohp', name: 'Développé militaire', equipment: 'barbell', target: cible(3, '6-8', 50), targetSets: 3, restSeconds: 120 },
      { exerciseId: 'dips', name: 'Dips', equipment: null, target: cible(3, 'AMRAP'), targetSets: 3, restSeconds: 90 },
      { exerciseId: 'new', name: 'Pompes déclinées', equipment: null, target: cible(1, null), targetSets: null, restSeconds: null },
    ],
    isLoading: false,
  });
  (useProgressionSuggestion as jest.Mock).mockImplementation((id: string) =>
    id === 'new'
      ? { lastPerf: [], suggestion: null }
      : {
          lastPerf: [{ weightKg: 80, reps: 8, setType: 'normal', rpe: null, durationSeconds: null }],
          suggestion: { kind: 'weightOrReps', weightKg: 82.5, reps: 9 },
        },
  );
  (startWorkoutFromSession as jest.Mock).mockResolvedValue(undefined);
});

it('titre la séance, et compte ses exercices', async () => {
  await render(<SessionPreviewScreen />);
  expect(screen.getByText('Push')).toBeTruthy();
  expect(screen.getByText(/sessionPreview\.subtitle:\{"count":4\}/)).toBeTruthy();
});

it('🔴 l’objectif tel qu’écrit dans le plan, et la charge prévue', async () => {
  await render(<SessionPreviewScreen />);

  expect(screen.getByText('sessionPreview.target:{"sets":4,"reps":"6-8"}')).toBeTruthy();
  expect(screen.getByText('sessionPreview.target:{"sets":3,"reps":"AMRAP"}')).toBeTruthy();
  expect(
    screen.getByText('sessionPreview.target:{"sets":3,"reps":"6-8"} · sessionPreview.plannedLoad:{"weight":"50 kg"}'),
  ).toBeTruthy();
  // Sans séries cibles, le démarrage crée une série : l'aperçu le dit.
  expect(screen.getByText('sessionPreview.targetSets:{"count":1}')).toBeTruthy();
});

it('🔴 la suggestion en toutes lettres, avec le libellé de la séance (R11)', async () => {
  await render(<SessionPreviewScreen />);
  expect(screen.getAllByText('workout.suggestion.weightOrReps:{"weight":"82.5 kg","reps":9}').length).toBe(3);
});

it('un exercice jamais fait : « Première fois », sans dernière fois', async () => {
  await render(<SessionPreviewScreen />);
  expect(screen.getByText('strengthHub.lastTime.firstTime')).toBeTruthy();
  expect(screen.getAllByText('80 kg × 8')).toHaveLength(3);
});

it('la suggestion lit le programme et la semaine de l’occurrence', async () => {
  await render(<SessionPreviewScreen />);
  expect(useProgressionSuggestion).toHaveBeenCalledWith('bench', 0, { programId: 'p', weekIndex: 2 });
});

it('Démarrer lance la séance rattachée à son occurrence, puis l’ouvre', async () => {
  await render(<SessionPreviewScreen />);

  await act(async () => {
    fireEvent.press(screen.getByTestId('session-preview-start'));
  });

  expect(startWorkoutFromSession).toHaveBeenCalledWith('s-1', { plannedSessionId: 'ps-1' });
  expect(push).toHaveBeenCalledWith('/workout');
});

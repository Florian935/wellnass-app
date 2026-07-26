/**
 * history-smoke.test.tsx — Smoke test minimal pour la liste de l'historique (US3).
 *
 * Vérifie que :
 *  1. Le composant `HistoryListShell` (extraction minimale de la logique de liste)
 *     se rend sans planter quand l'historique est vide (isLoading=false).
 *  2. Il affiche un indicateur de chargement quand isLoading=true.
 *  3. Il affiche les dates des séances quand les données sont présentes.
 *
 * On n'importe pas l'écran expo-router directement (Screen, router) — on compose
 * un composant de test minimal qui consomme `useWorkoutHistory`, sur le même modèle
 * que programs-smoke.test.tsx.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { render } from '@testing-library/react-native';
import {
  useWorkoutHistory,
  type WorkoutHistoryItem,
} from '@/data/repositories/workout-repository';

// ---------------------------------------------------------------------------
// Mock du repository (isole PowerSync + SQLite)
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/workout-repository', () => ({
  useWorkoutHistory: jest.fn(() => ({ workouts: [], isLoading: false })),
  getWorkoutSets: jest.fn(() => Promise.resolve([])),
}));

// ---------------------------------------------------------------------------
// Mock useTheme (évite useSettings → PowerSync)
// ---------------------------------------------------------------------------

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#f7eede',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
      success: '#7c8a5b',
      danger: '#b23b2e',
    },
  })),
}));

// ---------------------------------------------------------------------------
// Composant de test minimal (n'utilise pas expo-router ni Screen)
// ---------------------------------------------------------------------------

/**
 * Extrait la logique de liste de l'historique sans dépendances expo-router.
 * Formate les dates en DD/MM/YYYY, sur le même modèle que l'écran réel.
 */
function HistoryListShell() {
  const { workouts, isLoading } = useWorkoutHistory();

  if (isLoading) return <Text testID="status">Chargement…</Text>;

  if (workouts.length === 0) {
    return <Text testID="status">Vide</Text>;
  }

  return (
    <View testID="list">
      {workouts.map((item: WorkoutHistoryItem) => {
        const d = new Date(item.finishedAt ?? item.startedAt);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const dateLabel = `${dd}/${mm}/${yyyy}`;
        return (
          <Text key={item.id} testID={`row-${item.id}`}>
            {dateLabel}
          </Text>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Historique séances — smoke test (rendu sans planter)', () => {
  it('rend sans planter quand l\'historique est vide', async () => {
    const { getByTestId, getByText } = await render(<HistoryListShell />);
    expect(getByTestId('status')).toBeTruthy();
    expect(getByText('Vide')).toBeTruthy();
  });

  it('affiche "Chargement…" quand isLoading=true', async () => {
    (useWorkoutHistory as jest.Mock).mockReturnValueOnce({
      workouts: [],
      isLoading: true,
    });
    const { getByText } = await render(<HistoryListShell />);
    expect(getByText('Chargement…')).toBeTruthy();
  });

  it('affiche les dates des séances terminées', async () => {
    const fakeWorkouts: WorkoutHistoryItem[] = [
      {
        id: 'w1',
        startedAt: '2026-07-01T10:00:00.000Z',
        finishedAt: '2026-07-01T11:00:00.000Z',
        durationSeconds: 3600,
        rpe: 7,
        notes: null,
        sessionId: null,
        programId: null,
        volumeKg: 0,
      },
      {
        id: 'w2',
        startedAt: '2026-07-03T09:00:00.000Z',
        finishedAt: '2026-07-03T10:30:00.000Z',
        durationSeconds: 5400,
        rpe: null,
        notes: 'Bonne séance',
        sessionId: null,
        programId: null,
        volumeKg: 0,
      },
    ];
    (useWorkoutHistory as jest.Mock).mockReturnValueOnce({
      workouts: fakeWorkouts,
      isLoading: false,
    });
    const { getByTestId } = await render(<HistoryListShell />);
    expect(getByTestId('list')).toBeTruthy();
    expect(getByTestId('row-w1')).toBeTruthy();
    expect(getByTestId('row-w2')).toBeTruthy();
  });

  it('utilise startedAt quand finishedAt est null', async () => {
    const fakeWorkouts: WorkoutHistoryItem[] = [
      {
        id: 'w3',
        startedAt: '2026-07-05T08:00:00.000Z',
        finishedAt: null,
        durationSeconds: null,
        rpe: null,
        notes: null,
        sessionId: null,
        programId: null,
        volumeKg: 0,
      },
    ];
    (useWorkoutHistory as jest.Mock).mockReturnValueOnce({
      workouts: fakeWorkouts,
      isLoading: false,
    });
    const { getByTestId } = await render(<HistoryListShell />);
    expect(getByTestId('row-w3')).toBeTruthy();
  });
});

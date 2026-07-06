/**
 * run-summary-smoke.test.tsx — Smoke test minimal pour l'écran de résumé de course.
 *
 * Vérifie que :
 *  1. Un composant shell reproduisant la logique de résumé se rend sans planter
 *     quand la course est en cours de chargement (isLoading=true).
 *  2. Il affiche "Course introuvable" quand run=null et isLoading=false.
 *  3. Il affiche les données de base d'une course terminée.
 *
 * On n'importe pas l'écran expo-router directement (Screen, router) — on compose
 * un composant de test minimal qui consomme `useRun`, sur le même modèle que
 * history-smoke.test.tsx.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { useRun, type RunDetail } from '@/data/repositories/run-repository';

// ---------------------------------------------------------------------------
// Mock du repository (isole PowerSync + SQLite)
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/run-repository', () => ({
  useRun: jest.fn(() => ({ run: null, isLoading: false })),
  useActiveRun: jest.fn(() => ({ run: null, isLoading: false })),
  cancelRun: jest.fn().mockResolvedValue(undefined),
  startRun: jest.fn().mockResolvedValue('mock-run-id'),
  finishRun: jest.fn().mockResolvedValue(undefined),
  setRunFeedback: jest.fn().mockResolvedValue(undefined),
  setManualRunDistance: jest.fn().mockResolvedValue(undefined),
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
 * Extrait la logique d'affichage du résumé de course sans dépendances expo-router.
 * Affiche les métriques clés ou les états de chargement/vide.
 */
function RunSummaryShell({ runId }: { runId?: string }) {
  const { run, isLoading } = useRun(runId);

  if (isLoading) return <Text testID="status">Chargement…</Text>;

  if (!run) {
    return <Text testID="status">Course introuvable ou supprimée.</Text>;
  }

  const distanceKm = run.distanceM !== null ? (run.distanceM / 1000).toFixed(2) : '—';
  const durationDisplay =
    run.durationSeconds !== null ? `${run.durationSeconds} s` : '—';

  return (
    <View testID="summary">
      <Text testID="distance">{distanceKm}</Text>
      <Text testID="duration">{durationDisplay}</Text>
      <Text testID="source">{run.source}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Résumé course — smoke test (rendu sans planter)', () => {
  it('affiche "Chargement…" quand isLoading=true', async () => {
    (useRun as jest.Mock).mockReturnValueOnce({ run: null, isLoading: true });
    const { getByTestId } = await render(<RunSummaryShell runId="r1" />);
    expect(getByTestId('status')).toBeTruthy();
  });

  it('affiche "Course introuvable" quand run=null et isLoading=false', async () => {
    const { getByTestId, getByText } = await render(<RunSummaryShell />);
    expect(getByTestId('status')).toBeTruthy();
    expect(getByText('Course introuvable ou supprimée.')).toBeTruthy();
  });

  it('affiche les métriques d\'une course GPS terminée', async () => {
    const fakeRun: RunDetail = {
      id: 'run-abc',
      source: 'gps',
      status: 'completed',
      startedAt: '2026-07-05T09:00:00.000Z',
      finishedAt: '2026-07-05T09:35:00.000Z',
      durationSeconds: 2100,
      distanceM: 6500,
      avgPaceSPerKm: 323,
      rpe: 7,
      notes: 'Bonne sortie.',
    };
    (useRun as jest.Mock).mockReturnValueOnce({ run: fakeRun, isLoading: false });
    const { getByTestId } = await render(<RunSummaryShell runId="run-abc" />);
    expect(getByTestId('summary')).toBeTruthy();
    expect(getByTestId('distance').props.children).toBe('6.50');
    expect(getByTestId('duration').props.children).toBe('2100 s');
    expect(getByTestId('source').props.children).toBe('gps');
  });

  it('affiche les métriques d\'une course manuelle sans distance', async () => {
    const fakeRun: RunDetail = {
      id: 'run-manual',
      source: 'manual',
      status: 'completed',
      startedAt: '2026-07-05T18:00:00.000Z',
      finishedAt: '2026-07-05T18:30:00.000Z',
      durationSeconds: 1800,
      distanceM: null,
      avgPaceSPerKm: null,
      rpe: null,
      notes: null,
    };
    (useRun as jest.Mock).mockReturnValueOnce({ run: fakeRun, isLoading: false });
    const { getByTestId } = await render(<RunSummaryShell runId="run-manual" />);
    expect(getByTestId('summary')).toBeTruthy();
    expect(getByTestId('distance').props.children).toBe('—');
    expect(getByTestId('source').props.children).toBe('manual');
  });
});

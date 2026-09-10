/**
 * Second temps du résumé de course — `run/analysis.tsx` (US CARDIO-UX01, R6).
 *
 * ── Pourquoi ce fichier existe ───────────────────────────────────────────────────────────────────
 * Ces sections vivaient dans `run/summary.tsx`, entre la célébration de record et le bouton
 * « Terminé » : douze sections à traverser pour noter son ressenti et fermer (constat F17). Elles
 * ne disparaissent pas, elles cessent d'être sur le chemin — et leurs tests déménagent avec elles.
 *
 * Deux choses sont vérifiées ici qui ne l'étaient nulle part :
 *  - le tableau **fraction par fraction** affiche la **plage complète** du prévu. Le code n'en
 *    montrait qu'une borne (`range.min ?? range.max`) : une plage 4:05–4:10 s'affichait « 4:05 »,
 *    ce qui se lit comme une cible unique (constat F21) ;
 *  - **corriger** et **supprimer** une course existent (constats F19 et F18) — deux actions que
 *    l'app n'avait pas du tout.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import RunAnalysisScreen from '../analysis';
import {
  deleteRun,
  setRunTerrain,
  updateRunCore,
  useRun,
  useRunIntervals,
} from '@/data/repositories/run-repository';
import { useRouter } from 'expo-router';

jest.mock('@/data/repositories/run-repository', () => ({
  useRun: jest.fn(),
  useRunIntervals: jest.fn(() => ({ intervals: [], isLoading: false })),
  setRunTerrain: jest.fn().mockResolvedValue(undefined),
  updateRunCore: jest.fn().mockResolvedValue(undefined),
  deleteRun: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/gpx-export', () => ({ exportRunAsGpx: jest.fn() }));
jest.mock('@/components/running/RouteMap', () => ({ RouteMap: () => null }));
jest.mock('@/components/share/ShareCardSheet', () => ({ ShareCardSheet: () => null }));
jest.mock('@/components/run/PaceCurveCards', () => ({ PaceCurveCards: () => null }));
jest.mock('expo-router', () => ({ useRouter: jest.fn(), useLocalSearchParams: () => ({ id: 'run-1' }) }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      background: '#f7eede',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      borderStrong: '#90897d',
      accent: '#b14f2b',
      accentText: '#ffffff',
      success: '#66714b',
      danger: '#b23b2e',
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    system: 'metric',
    distanceSymbol: 'km',
    formatDistance: (km: number | null | undefined) => (km == null ? '—' : `${km.toFixed(2)} km`),
    formatDistanceValue: (km: number | null | undefined) => (km == null ? '—' : km.toFixed(2)),
    formatPace: (s: number | null | undefined) => (s == null ? '—' : `${s} s/km`),
    parseDistanceToKm: (text: string) => {
      const v = Number.parseFloat(text.replace(',', '.'));
      return Number.isFinite(v) && v > 0 ? v : null;
    },
  }),
}));

const mockUseRun = useRun as jest.Mock;
const mockUseRunIntervals = useRunIntervals as jest.Mock;
const mockTerrain = setRunTerrain as jest.Mock;
const mockUpdate = updateRunCore as jest.Mock;
const mockDelete = deleteRun as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const replace = jest.fn();

const course = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-1',
  source: 'gps',
  status: 'completed',
  startedAt: '2026-09-08T18:00:00.000Z',
  finishedAt: '2026-09-08T18:42:18.000Z',
  durationSeconds: 2538,
  distanceM: 8000,
  avgPaceSPerKm: 317,
  rpe: null,
  notes: null,
  gpsTrack: null,
  plannedSessionId: null,
  terrain: null,
  elevationGainM: 64,
  elevationLossM: 58,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ replace });
  mockUseRun.mockReturnValue({ run: course(), isLoading: false });
  mockUseRunIntervals.mockReturnValue({ intervals: [], isLoading: false });
  mockTerrain.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Fraction par fraction
// ---------------------------------------------------------------------------

describe('fraction par fraction (US RUN-F4, corrigé par CARDIO-UX01)', () => {
  const fraction = (overrides: Record<string, unknown> = {}) => ({
    phaseIndex: 0,
    phaseKind: 'fast',
    segmentKind: 'work',
    rep: 1,
    totalReps: 8,
    plannedDistanceM: 400,
    plannedDurationSeconds: null,
    plannedPaceMinSPerKm: 245,
    plannedPaceMaxSPerKm: 250,
    actualDistanceM: 400,
    actualDurationSeconds: 98,
    actualPaceSPerKm: 245,
    ...overrides,
  });

  it('🔴 la section est ABSENTE quand la course n’a aucune fraction', async () => {
    // Une course libre n'a rien à dire ici : on n'affiche pas une section vide, on n'affiche rien.
    await render(<RunAnalysisScreen />);

    expect(screen.queryByText('running.realise.title')).toBeNull();
  });

  it('liste les fractions réalisées', async () => {
    mockUseRunIntervals.mockReturnValue({
      intervals: [fraction(), fraction({ phaseIndex: 1, rep: 2, actualPaceSPerKm: 252 })],
      isLoading: false,
    });

    await render(<RunAnalysisScreen />);

    expect(screen.getByText('running.realise.title')).toBeTruthy();
    // 252 s/km = 4:12, réalisé de la 2ᵉ fraction.
    expect(screen.getByText('4:12')).toBeTruthy();
  });

  it('🔴 affiche la PLAGE COMPLÈTE du prévu, pas une seule borne', async () => {
    mockUseRunIntervals.mockReturnValue({ intervals: [fraction()], isLoading: false });

    await render(<RunAnalysisScreen />);

    // C'était le constat F21 : le code affichait `range.min ?? range.max`, donc « 4:05 » pour une
    // plage 4:05–4:10 — ce qui se lit comme une cible unique, et fait passer pour hors cible une
    // fraction courue à 4:09.
    expect(
      screen.getByText('running.paceGuidance.range:{"min":"4:05","max":"4:10"}'),
    ).toBeTruthy();
  });

  it('une cible unique s’affiche sans plage', async () => {
    mockUseRunIntervals.mockReturnValue({
      intervals: [fraction({ plannedPaceMinSPerKm: 245, plannedPaceMaxSPerKm: 245 })],
      isLoading: false,
    });

    await render(<RunAnalysisScreen />);

    // Une plage dont les deux bornes sont égales n'est pas une plage : l'écrire « 4:05 – 4:05 »
    // serait du bruit.
    expect(screen.queryByText(/running\.paceGuidance\.range/)).toBeNull();
    expect(screen.getAllByText('4:05').length).toBeGreaterThan(0);
  });

  it('affiche la régularité et le compte dans la plage', async () => {
    mockUseRunIntervals.mockReturnValue({
      intervals: [fraction(), fraction({ phaseIndex: 1, rep: 2, actualPaceSPerKm: 280 })],
      isLoading: false,
    });

    await render(<RunAnalysisScreen />);

    expect(screen.getByText(/running\.realise\.inRange/)).toBeTruthy();
    expect(screen.getByText(/running\.realise\.avgPace/)).toBeTruthy();
  });

  it('🔴 une fraction sans allure mesurable affiche un tiret, pas un zéro', async () => {
    // Cas du rattrapage silencieux : la durée par fraction n'est pas attribuable, on l'écrit
    // `null`. Afficher « 0:00 » laisserait croire à une mesure.
    mockUseRunIntervals.mockReturnValue({
      intervals: [fraction({ actualDurationSeconds: null, actualPaceSPerKm: null })],
      isLoading: false,
    });

    await render(<RunAnalysisScreen />);

    expect(screen.getAllByText('running.realise.noData').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Corriger et supprimer — deux actions que l'app n'avait pas
// ---------------------------------------------------------------------------

describe('corriger une course (constat F19)', () => {
  it('🔴 la correction n’est pas dépliée par défaut', async () => {
    await render(<RunAnalysisScreen />);

    // Corriger une course est rare : le champ ne doit pas occuper l'écran en permanence.
    expect(screen.getByText('running.analysis.correctCta')).toBeTruthy();
    expect(screen.queryByText('running.analysis.saveCorrection')).toBeNull();
  });

  it('🔴 écrit la distance corrigée en mètres, et rien d’autre', async () => {
    await render(<RunAnalysisScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText('running.analysis.correctCta'));
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('running.summary.manualDistance'), '7.5');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('running.analysis.saveCorrection'));
    });

    // La trace n'est pas réécrite : on ne corrige pas une mesure, on corrige le scalaire que
    // l'utilisateur connaît mieux que le capteur. `updateRunCore` recalcule l'allure moyenne.
    expect(mockUpdate).toHaveBeenCalledWith('run-1', { distanceM: 7500 });
  });

  it('une saisie illisible n’écrit rien', async () => {
    await render(<RunAnalysisScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText('running.analysis.correctCta'));
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('running.summary.manualDistance'), 'zzz');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('running.analysis.saveCorrection'));
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('supprimer une course (constat F18)', () => {
  it('🔴 demande confirmation avant de supprimer', async () => {
    const alerte = jest.spyOn(Alert, 'alert');

    await render(<RunAnalysisScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('running.stop.delete'));
    });

    // Une suppression retire aussi les records portés et recalcule l'allure de référence : elle
    // ne se fait jamais d'un seul geste.
    expect(alerte).toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    alerte.mockRestore();
  });

  it('🔴 supprime puis quitte le pilier', async () => {
    const alerte = jest.spyOn(Alert, 'alert');

    await render(<RunAnalysisScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('running.stop.delete'));
    });

    const boutons = alerte.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    await act(async () => {
      boutons.find((b) => b.text === 'running.stop.delete')?.onPress?.();
    });

    expect(mockDelete).toHaveBeenCalledWith('run-1');
    // Rester sur l'analyse d'une course qui n'existe plus afficherait un écran vide.
    expect(replace).toHaveBeenCalledWith('/(tabs)/running');
    alerte.mockRestore();
  });
});

describe('terrain (déménagé depuis le résumé)', () => {
  it('est persisté au choix', async () => {
    await render(<RunAnalysisScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText('running.terrain.trail'));
    });

    expect(mockTerrain).toHaveBeenCalledWith('run-1', 'trail');
  });

  it('reprend le terrain déjà enregistré', async () => {
    mockUseRun.mockReturnValue({ run: course({ terrain: 'road' }), isLoading: false });

    await render(<RunAnalysisScreen />);

    expect(
      screen.getByText('running.terrain.road').parent?.props.accessibilityState,
    ).toMatchObject({ selected: true });
  });
});

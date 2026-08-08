/**
 * Résumé de course (`app/run/summary.tsx`) — le **vrai** écran, monté.
 *
 * ⚠️ Ce fichier **remplace** `run-summary-smoke.test.tsx`, qui testait une réécriture locale
 * (`RunSummaryShell`) au lieu de l'écran. On pouvait supprimer l'écran entier : il restait vert.
 * Voir §3.7 de `strategie-tests.md`.
 *
 * L'écran est le point d'arrivée d'une course : c'est là que le feedback s'écrit, que les records
 * se détectent, et c'est la dernière chance de rattraper une distance manquante. Ce qui compte :
 *
 *  1. **La détection de records ne part qu'UNE fois, et seulement quand elle a un sens** — course
 *     GPS terminée. La rejouer sur un remontage re-célébrerait un record déjà connu ; la lancer
 *     sur une course manuelle calculerait des allures sur une distance saisie à la main.
 *  2. **Chaque saisie de feedback est persistée immédiatement**, et un échec d'écriture ne fait
 *     pas tomber l'écran : la course est déjà enregistrée, seul le confort se perd.
 *  3. **La distance manuelle n'est écrite que si elle se lit comme un nombre.** Un `NaN` en base
 *     contaminerait toutes les statistiques agrégées, sans jamais lever d'erreur.
 *  4. **Chargement, introuvable et affiché sont trois états distincts** — et « introuvable » garde
 *     une sortie, sinon l'écran est un cul-de-sac.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import RunSummaryScreen from '../summary';
import {
  setManualRunDistance,
  setRunFeedback,
  setRunTerrain,
  useRun,
  useRunTarget,
} from '@/data/repositories/run-repository';
import { detectAndStoreRunRecords } from '@/data/repositories/running-record-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/run-repository', () => ({
  useRun: jest.fn(() => ({ run: null, isLoading: false })),
  useRunTarget: jest.fn(() => null),
  setRunFeedback: jest.fn().mockResolvedValue(undefined),
  setRunTerrain: jest.fn().mockResolvedValue(undefined),
  setManualRunDistance: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/data/repositories/running-record-repository', () => ({
  detectAndStoreRunRecords: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/gpx-export', () => ({ exportRunAsGpx: jest.fn() }));

// Rendus natifs (carte, feuille de partage, graphes) : testés chez eux.
jest.mock('@/components/running/RouteMap', () => ({ RouteMap: () => null }));
jest.mock('@/components/share/ShareCardSheet', () => ({ ShareCardSheet: () => null }));
jest.mock('@/components/run/PaceCurveCards', () => ({ PaceCurveCards: () => null }));
jest.mock('@/components/CelebrationCard', () => {
  const { Text } = require('react-native');
  return {
    CelebrationCard: ({ title }: { title: string }) => <Text testID="celebration">{title}</Text>,
  };
});
jest.mock('@/components/FormScreen', () => {
  const { View } = require('react-native');
  return { FormScreen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/ScreenHeader', () => {
  const { Text } = require('react-native');
  return { ScreenHeader: ({ title }: { title: string }) => <Text>{title}</Text> };
});
jest.mock('@/components/Card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: () => ({ id: 'run-1' }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
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
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    system: 'metric',
    distanceSymbol: 'km',
    formatDistance: (km: number | null | undefined) => (km == null ? '—' : `${km.toFixed(2)} km`),
    formatDistanceValue: (km: number | null | undefined) => (km == null ? '—' : km.toFixed(2)),
    formatPace: (s: number | null | undefined) => (s == null ? '—' : `${s} s/km`),
    // Volontairement la vraie règle : une saisie non numérique doit rendre `null`, c'est ce qui
    // protège la base d'un `NaN`.
    parseDistanceToKm: (txt: string) => {
      const n = Number(txt.replace(',', '.'));
      return Number.isFinite(n) && n > 0 ? n : null;
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockUseRun = useRun as jest.Mock;
const mockUseRunTarget = useRunTarget as jest.Mock;
const mockFeedback = setRunFeedback as jest.Mock;
const mockTerrain = setRunTerrain as jest.Mock;
const mockManualDistance = setManualRunDistance as jest.Mock;
const mockDetect = detectAndStoreRunRecords as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const replace = jest.fn();

/** Une course terminée. */
const course = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-1',
  source: 'gps',
  status: 'completed',
  startedAt: '2026-08-05T07:00:00.000Z',
  finishedAt: '2026-08-05T07:45:00.000Z',
  durationSeconds: 2700,
  distanceM: 8000,
  avgPaceSPerKm: 337,
  rpe: null,
  notes: null,
  gpsTrack: null,
  plannedSessionId: null,
  terrain: null,
  elevationGainM: null,
  elevationLossM: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ replace });
  mockUseRun.mockReturnValue({ run: course(), isLoading: false });
  mockUseRunTarget.mockReturnValue(null);
  mockFeedback.mockResolvedValue(undefined);
  mockTerrain.mockResolvedValue(undefined);
  mockManualDistance.mockResolvedValue(undefined);
  mockDetect.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// États d'écran
// ---------------------------------------------------------------------------

describe('états d’écran', () => {
  it('🔴 pendant le chargement, n’annonce PAS une course introuvable', async () => {
    mockUseRun.mockReturnValue({ run: null, isLoading: true });

    await render(<RunSummaryScreen />);

    // On arrive ici juste après avoir cliqué « Arrêter » : voir « course introuvable » une
    // fraction de seconde suffirait à croire que la sortie est perdue.
    expect(screen.getByText('running.summary.loading')).toBeTruthy();
    expect(screen.queryByText('running.summary.notFound')).toBeNull();
  });

  it('🔴 course introuvable → l’écran garde une SORTIE', async () => {
    mockUseRun.mockReturnValue({ run: null, isLoading: false });

    await render(<RunSummaryScreen />);

    // Sans bouton, l'écran est un cul-de-sac : la seule issue serait de tuer l'app.
    expect(screen.getByText('running.summary.notFound')).toBeTruthy();
    expect(screen.getByText('running.summary.done')).toBeTruthy();
  });

  it('quitter renvoie à l’onglet course', async () => {
    mockUseRun.mockReturnValue({ run: null, isLoading: false });

    await render(<RunSummaryScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('running.summary.done'));
    });

    expect(replace).toHaveBeenCalledWith('/(tabs)/running');
  });

  it('affiche la distance et la durée de la course', async () => {
    await render(<RunSummaryScreen />);

    expect(screen.getByText('8.00 km')).toBeTruthy();
    expect(screen.getByText(/45 min/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Détection de records
// ---------------------------------------------------------------------------

describe('détection de records', () => {
  it('se déclenche sur une course GPS terminée', async () => {
    await render(<RunSummaryScreen />);

    expect(mockDetect).toHaveBeenCalledWith('run-1');
  });

  it('🔴 ne se déclenche PAS sur une course manuelle', async () => {
    mockUseRun.mockReturnValue({ run: course({ source: 'manual' }), isLoading: false });

    await render(<RunSummaryScreen />);

    // La distance d'une course manuelle est saisie à la main : en dériver des records d'allure
    // reviendrait à décerner un record sur une estimation.
    expect(mockDetect).not.toHaveBeenCalled();
  });

  it('🔴 ne se déclenche PAS sur une course non terminée', async () => {
    mockUseRun.mockReturnValue({ run: course({ status: 'active' }), isLoading: false });

    await render(<RunSummaryScreen />);

    expect(mockDetect).not.toHaveBeenCalled();
  });

  it('🔴 ne part qu’UNE fois, même sur plusieurs rendus', async () => {
    const vue = await render(<RunSummaryScreen />);

    await act(async () => {
      vue.rerender(<RunSummaryScreen />);
    });

    // Le verrou est un ref : sans lui, chaque re-rendu relancerait la détection, et l'écran
    // re-célébrerait un record déjà connu.
    expect(mockDetect).toHaveBeenCalledTimes(1);
  });

  it('célèbre les records battus', async () => {
    mockDetect.mockResolvedValue(['5k']);

    await render(<RunSummaryScreen />);

    expect(screen.getByTestId('celebration')).toBeTruthy();
  });

  it('🔴 aucun record → aucun bandeau', async () => {
    await render(<RunSummaryScreen />);

    // Un bandeau de célébration vide banaliserait celui qui compte.
    expect(screen.queryByTestId('celebration')).toBeNull();
  });

  it('🔴 un échec de détection ne fait pas tomber l’écran', async () => {
    mockDetect.mockRejectedValue(new Error('base indisponible'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await render(<RunSummaryScreen />);

    // Les records sont un enrichissement : la course est enregistrée, l'écran doit rester lisible.
    expect(screen.getByText('8.00 km')).toBeTruthy();
    (console.warn as jest.Mock).mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

describe('feedback', () => {
  it('la difficulté est persistée dès la sélection', async () => {
    await render(<RunSummaryScreen />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('7'));
    });

    // Pas de bouton « enregistrer » : l'écriture immédiate est ce qui évite de perdre la saisie
    // quand on quitte l'écran d'un geste.
    expect(mockFeedback).toHaveBeenCalledWith('run-1', { rpe: 7 });
  });

  it('🔴 un échec d’écriture ne fait pas tomber l’écran', async () => {
    mockFeedback.mockRejectedValue(new Error('hors ligne'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await render(<RunSummaryScreen />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('7'));
    });

    // La course est déjà en base ; seul le confort se perd. Planter ici perdrait aussi le reste.
    expect(screen.getByText('8.00 km')).toBeTruthy();
    (console.warn as jest.Mock).mockRestore();
  });

  it('le terrain est persisté au choix', async () => {
    await render(<RunSummaryScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText('running.terrain.trail'));
    });

    expect(mockTerrain).toHaveBeenCalledWith('run-1', 'trail');
  });

  it('reprend le feedback déjà enregistré', async () => {
    mockUseRun.mockReturnValue({
      run: course({ rpe: 8, notes: 'Bonne sortie.', terrain: 'road' }),
      isLoading: false,
    });

    await render(<RunSummaryScreen />);

    // Réafficher un formulaire vide sur une course déjà commentée donnerait l'impression que la
    // note a été perdue — et inviterait à la ressaisir.
    expect(screen.getByDisplayValue('Bonne sortie.')).toBeTruthy();
    expect(screen.getByLabelText('8').props.accessibilityState).toMatchObject({ selected: true });
  });
});

// ---------------------------------------------------------------------------
// Distance manuelle
// ---------------------------------------------------------------------------

describe('distance manuelle', () => {
  const manuelle = () =>
    mockUseRun.mockReturnValue({
      run: course({ source: 'manual', distanceM: null, avgPaceSPerKm: null }),
      isLoading: false,
    });

  it('écrit la distance saisie, convertie en mètres', async () => {
    manuelle();

    await render(<RunSummaryScreen />);
    const champ = screen.getByPlaceholderText(/running\.summary\.manualDistance/);
    // Deux `act` distincts : la saisie doit être rendue avant la validation, sinon le
    // gestionnaire lit l'état d'avant la frappe (même mécanique que les gardes de double appui).
    await act(async () => {
      fireEvent.changeText(champ, '7.5');
    });
    await act(async () => {
      fireEvent(champ, 'submitEditing');
    });

    expect(mockManualDistance).toHaveBeenCalledWith('run-1', 7500);
  });

  it('🔴 une saisie non numérique n’écrit RIEN', async () => {
    manuelle();

    await render(<RunSummaryScreen />);
    const champ = screen.getByPlaceholderText(/running\.summary\.manualDistance/);
    await act(async () => {
      fireEvent.changeText(champ, 'à peu près 8');
    });
    await act(async () => {
      fireEvent(champ, 'submitEditing');
    });

    // Un `NaN` en base contaminerait toutes les agrégations (total, moyenne, ACWR) sans jamais
    // lever d'erreur — et sans qu'aucun écran ne dise d'où il vient.
    expect(mockManualDistance).not.toHaveBeenCalled();
  });

  it('🔴 le champ n’est pas proposé sur une course GPS', async () => {
    await render(<RunSummaryScreen />);

    // La distance vient du tracker : laisser la corriger à la main la ferait diverger de la trace.
    expect(screen.queryByPlaceholderText(/running\.summary\.manualDistance/)).toBeNull();
  });
});

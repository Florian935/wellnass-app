/**
 * Historique & progression de course (`app/running-history/index.tsx`) — le **vrai** écran, monté.
 *
 * Six sections empilées, toutes en lecture seule, toutes alimentées par des hooks différents. Ce
 * qui rend cet écran risqué n'est pas son calcul — il est délégué à `@wellness/shared`, testé là-bas
 * — mais ses **états vides** et ses **gardes** : chaque section peut légitimement n'avoir rien à
 * montrer, et la confusion entre « pas encore chargé » et « rien à montrer » y produit des
 * affichages faux plutôt que des plantages.
 *
 * Ce qui est vérifié :
 *  1. **La garde de chargement globale.** `runs = []` est l'état transitoire normal de PowerSync au
 *     démarrage. Sans la garde, l'écran affiche « 0 km, 0 course, aucune donnée » à quelqu'un qui a
 *     couru 400 km — puis se corrige. C'est la raison d'être du `isLoading` au niveau écran.
 *  2. **Le badge de comparaison n'est pas monté pour « depuis le début »** : il n'existe pas de
 *     période précédente à laquelle comparer. Un « +0 % » y serait une affirmation fausse.
 *  3. **Le backfill des records ne part qu'une fois, et seulement au bon moment** : ni pendant le
 *     chargement (il recalculerait tout l'historique GPS sur un `[]` transitoire), ni quand des
 *     records existent déjà.
 *  4. **Chaque section a un état vide rédigé**, jamais un graphique ou une carte vides.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import RunningHistoryScreen from '../index';
import { usePaceTrend, useRunHistory, useRunStatsAt } from '@/data/repositories/run-repository';
import {
  backfillRunningRecords,
  useRunningRecords,
} from '@/data/repositories/running-record-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/run-repository', () => ({
  useRunHistory: jest.fn(() => ({ runs: [], isLoading: false })),
  // Valeurs neutres écrites en dur : une fabrique `jest.mock` ne peut référencer aucune variable
  // du fichier (elle est hissée au-dessus). Les vraies valeurs sont posées dans `beforeEach`.
  useRunStatsAt: jest.fn(() => ({
    stats: {
      totalDistanceM: 0,
      totalDurationS: 0,
      count: 0,
      totalElevationGainM: 0,
      totalElevationLossM: 0,
    },
    isLoading: false,
  })),
  usePaceTrend: jest.fn(() => ({ points: [], trend: 'stable' })),
}));

jest.mock('@/data/repositories/running-record-repository', () => ({
  useRunningRecords: jest.fn(() => ({ records: [], isLoading: false })),
  backfillRunningRecords: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/analytics', () => ({
  ANALYTICS_EVENTS: { statsViewed: 'stats_viewed' },
  track: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/hooks/useTodayKey', () => ({
  useWindowStartKey: (jours: number) => (jours === 7 ? '2026-08-01' : '2026-07-11'),
}));

// Coquilles de présentation : testées chez elles, transparentes ici.
jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/ScreenHeader', () => {
  const { Text } = require('react-native');
  return { ScreenHeader: ({ title }: { title: string }) => <Text>{title}</Text> };
});
jest.mock('@/components/Card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/EmptyState', () => {
  const { Text } = require('react-native');
  return { EmptyState: ({ message }: { message: string }) => <Text>{message}</Text> };
});
jest.mock('@/components/DeltaBadge', () => {
  const { Text } = require('react-native');
  return { DeltaBadge: ({ change }: { change: number | null }) => <Text testID="delta">{String(change)}</Text> };
});
jest.mock('@/components/charts/ProgressLineChart', () => {
  const { Text } = require('react-native');
  return {
    ProgressLineChart: ({ data }: { data: unknown[] }) => (
      <Text testID="courbe">{String(data.length)}</Text>
    ),
  };
});

/** `Segment` rendu en boutons : c'est le seul geste de l'écran, il doit rester actionnable. */
jest.mock('@/components/Segment', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Segment: <T,>({
      options,
      onChange,
      label,
    }: {
      options: readonly T[];
      onChange: (v: T) => void;
      label: (v: T) => string;
    }) => (
      <>
        {options.map((o) => (
          <Pressable key={String(o)} onPress={() => onChange(o)}>
            <Text>{label(o)}</Text>
          </Pressable>
        ))}
      </>
    ),
  };
});

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

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
      success: '#7c8a5b',
      warn: '#fbf1dd',
      warnBorder: '#b5761f',
      warnText: '#b5761f',
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    system: 'metric',
    distanceSymbol: 'km',
    formatDistance: (km: number | null | undefined) => (km == null ? '—' : `${km.toFixed(2)} km`),
    formatPace: (s: number | null | undefined) => (s == null ? '—' : `${s} s/km`),
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function statsVides() {
  return {
    totalDistanceM: 0,
    totalDurationS: 0,
    count: 0,
    totalElevationGainM: 0,
    totalElevationLossM: 0,
  };
}

const mockUseRunHistory = useRunHistory as jest.Mock;
const mockUseRunStatsAt = useRunStatsAt as jest.Mock;
const mockUsePaceTrend = usePaceTrend as jest.Mock;
const mockUseRunningRecords = useRunningRecords as jest.Mock;
const mockBackfill = backfillRunningRecords as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

/** Une course terminée de l'historique. */
const course = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-1',
  startedAt: '2026-08-05T07:00:00.000Z',
  finishedAt: '2026-08-05T07:45:00.000Z',
  durationSeconds: 2700,
  distanceM: 8000,
  avgPaceSPerKm: 337,
  rpe: 6,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  mockUseRunHistory.mockReturnValue({ runs: [], isLoading: false });
  mockUseRunStatsAt.mockReturnValue({ stats: statsVides(), isLoading: false });
  mockUsePaceTrend.mockReturnValue({ points: [], trend: 'stable' });
  mockUseRunningRecords.mockReturnValue({ records: [], isLoading: false });
  mockBackfill.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Garde de chargement
// ---------------------------------------------------------------------------

describe('garde de chargement', () => {
  it('🔴 pendant le chargement, n’affiche AUCUNE section', async () => {
    mockUseRunHistory.mockReturnValue({ runs: [], isLoading: true });

    await render(<RunningHistoryScreen />);

    // `runs = []` est l'état transitoire normal de PowerSync au démarrage. Sans cette garde,
    // quelqu'un qui a couru 400 km voit « 0 course, aucune donnée » puis l'écran se corrige.
    expect(screen.queryByText('running.history.statsTitle')).toBeNull();
    expect(screen.queryByText('running.history.empty')).toBeNull();
  });

  it('le titre de l’écran reste affiché pendant le chargement', async () => {
    mockUseRunHistory.mockReturnValue({ runs: [], isLoading: true });

    await render(<RunningHistoryScreen />);

    expect(screen.getByText('running.history.title')).toBeTruthy();
  });

  it('une fois chargé, les six sections sont montées', async () => {
    await render(<RunningHistoryScreen />);

    for (const titre of [
      'running.history.statsTitle',
      'running.history.paceTitle',
      'running.history.runsSectionTitle',
      'running.records.sectionTitle',
      'running.predictions.title',
      'running.trainingLoad.title',
    ]) {
      expect(screen.getByText(titre)).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Statistiques
// ---------------------------------------------------------------------------

describe('statistiques', () => {
  it('affiche les totaux de la période', async () => {
    mockUseRunStatsAt.mockReturnValue({
      stats: {
        totalDistanceM: 42195,
        totalDurationS: 14400,
        count: 7,
        totalElevationGainM: 312.4,
        totalElevationLossM: 298.6,
      },
      isLoading: false,
    });

    await render(<RunningHistoryScreen />);

    expect(screen.getByText('42.20 km')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    // Le dénivelé est arrondi à l'entier : un « +312,4 m » suggère une précision que le GPS n'a pas.
    expect(screen.getByText('+312 m')).toBeTruthy();
    expect(screen.getByText('-299 m')).toBeTruthy();
  });

  it('compare à la période précédente par défaut (semaine)', async () => {
    await render(<RunningHistoryScreen />);

    expect(screen.getAllByTestId('delta')).toHaveLength(3);
  });

  it('🔴 « depuis le début » n’affiche AUCUN badge de comparaison', async () => {
    await render(<RunningHistoryScreen />);
    // `act` obligatoire : un `fireEvent.press` nu ne rafraîchit pas l'écran (§3.7).
    await act(async () => {
      fireEvent.press(screen.getByText('running.history.all'));
    });

    // Il n'existe pas de période précédant « depuis le début » : un « +0 % » y serait une
    // affirmation fausse, pas un affichage neutre.
    expect(screen.queryAllByTestId('delta')).toHaveLength(0);
  });

  it('masque la comparaison tant que la période précédente charge', async () => {
    // Le hook est appelé deux fois par rendu : période courante d'abord, période précédente
    // ensuite. On distingue par le **rang d'appel** et non par la clé de jour — une clé en dur
    // ferait passer ce test uniquement le jour où il a été écrit.
    let appel = 0;
    mockUseRunStatsAt.mockImplementation(() => {
      appel += 1;
      return { stats: statsVides(), isLoading: appel % 2 === 0 };
    });

    await render(<RunningHistoryScreen />);

    // Comparer à un total encore vide afficherait un « -100 % » qui n'a jamais existé.
    expect(screen.queryAllByTestId('delta')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Courbe d'allure
// ---------------------------------------------------------------------------

describe('courbe d’allure', () => {
  it('🔴 sans point, affiche une note et PAS un graphique vide', async () => {
    await render(<RunningHistoryScreen />);

    expect(screen.getByText('running.history.paceEmpty')).toBeTruthy();
    expect(screen.queryByTestId('courbe')).toBeNull();
  });

  it('trace la courbe dès qu’il y a des points', async () => {
    mockUsePaceTrend.mockReturnValue({
      points: [
        { dayKey: '2026-07-01', paceSPerKm: 340 },
        { dayKey: '2026-07-15', paceSPerKm: 325 },
      ],
      trend: 'improving',
    });

    await render(<RunningHistoryScreen />);

    expect(screen.getByTestId('courbe').props.children).toBe('2');
    expect(screen.getByText('running.history.trendImproving')).toBeTruthy();
  });

  it('change de fenêtre au tap — 90 jours par défaut, 30 sur demande', async () => {
    mockUsePaceTrend.mockReturnValue({ points: [], trend: 'stable' });

    await render(<RunningHistoryScreen />);
    expect(mockUsePaceTrend).toHaveBeenLastCalledWith(90);

    await act(async () => {
      fireEvent.press(screen.getByText('running.history.days30'));
    });

    expect(mockUsePaceTrend).toHaveBeenLastCalledWith(30);
  });
});

// ---------------------------------------------------------------------------
// Liste des courses
// ---------------------------------------------------------------------------

describe('liste des courses', () => {
  it('sans course, affiche un état vide rédigé', async () => {
    await render(<RunningHistoryScreen />);

    expect(screen.getByText('running.history.empty')).toBeTruthy();
  });

  it('affiche la date de chaque course terminée', async () => {
    mockUseRunHistory.mockReturnValue({ runs: [course()], isLoading: false });

    await render(<RunningHistoryScreen />);

    expect(screen.getByText('05/08/2026')).toBeTruthy();
  });

  it('🔴 une course sans date de fin n’affiche pas « Invalid Date »', async () => {
    mockUseRunHistory.mockReturnValue({ runs: [course({ finishedAt: null })], isLoading: false });

    await render(<RunningHistoryScreen />);

    expect(screen.getByText('running.active.noData')).toBeTruthy();
  });

  it('ouvre le détail au tap', async () => {
    mockUseRunHistory.mockReturnValue({ runs: [course({ id: 'run-42' })], isLoading: false });

    await render(<RunningHistoryScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('05/08/2026'));
    });

    expect(push).toHaveBeenCalledWith({ pathname: '/run/summary', params: { id: 'run-42' } });
  });
});

// ---------------------------------------------------------------------------
// Records — et le backfill
// ---------------------------------------------------------------------------

describe('records d’allure', () => {
  it('liste les cinq distances canoniques, même sans aucun record', async () => {
    await render(<RunningHistoryScreen />);

    // Montrer les cases vides dit à l'utilisateur ce qu'il peut atteindre ; masquer les distances
    // sans record ne laisserait qu'une section vide et muette.
    expect(screen.getAllByText('running.records.none')).toHaveLength(5);
  });

  it('affiche l’allure dérivée du meilleur temps', async () => {
    mockUseRunningRecords.mockReturnValue({
      records: [
        {
          distanceKey: '5k',
          bestTimeSeconds: 1500,
          achievedAt: '2026-07-20T09:00:00.000Z',
          runId: 'run-5k',
        },
      ],
      isLoading: false,
    });

    await render(<RunningHistoryScreen />);

    // 1500 s sur 5 km = 300 s/km.
    expect(screen.getByText('300 s/km')).toBeTruthy();
    expect(screen.getAllByText('running.records.none')).toHaveLength(4);
  });

  it('ouvre la course du record au tap', async () => {
    mockUseRunningRecords.mockReturnValue({
      records: [
        {
          distanceKey: '10k',
          bestTimeSeconds: 3000,
          achievedAt: '2026-07-20T09:00:00.000Z',
          runId: 'run-10k',
        },
      ],
      isLoading: false,
    });

    await render(<RunningHistoryScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('running.records.distance10k'));
    });

    expect(push).toHaveBeenCalledWith({ pathname: '/run/summary', params: { id: 'run-10k' } });
  });

  describe('rattrapage des records manquants', () => {
    it('se déclenche quand la requête est résolue et qu’aucun record n’existe', async () => {
      await render(<RunningHistoryScreen />);

      expect(mockBackfill).toHaveBeenCalledTimes(1);
    });

    it('🔴 ne se déclenche PAS pendant le chargement', async () => {
      mockUseRunningRecords.mockReturnValue({ records: [], isLoading: true });

      await render(<RunningHistoryScreen />);

      // `[]` en cours de chargement n'est pas « aucun record » : rejouer la détection sur tout
      // l'historique GPS à chaque montage serait un coût pur, pour rien.
      expect(mockBackfill).not.toHaveBeenCalled();
    });

    it('ne se déclenche pas quand des records existent déjà', async () => {
      mockUseRunningRecords.mockReturnValue({
        records: [
          {
            distanceKey: '5k',
            bestTimeSeconds: 1500,
            achievedAt: '2026-07-20T09:00:00.000Z',
            runId: 'r',
          },
        ],
        isLoading: false,
      });

      await render(<RunningHistoryScreen />);

      expect(mockBackfill).not.toHaveBeenCalled();
    });

    it('🔴 un échec du rattrapage ne fait pas tomber l’écran', async () => {
      mockBackfill.mockRejectedValue(new Error('lecture GPS impossible'));
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      await render(<RunningHistoryScreen />);

      // Offline-first : un enrichissement optionnel ne doit jamais empêcher de consulter ses stats.
      expect(screen.getByText('running.records.sectionTitle')).toBeTruthy();
      jest.restoreAllMocks();
    });
  });
});

// ---------------------------------------------------------------------------
// Prédictions
// ---------------------------------------------------------------------------

describe('objectifs estimés', () => {
  it('sans record de 5 km, affiche une note plutôt qu’une section vide', async () => {
    await render(<RunningHistoryScreen />);

    expect(screen.getByText('running.predictions.empty')).toBeTruthy();
  });

  it('🔴 ne prédit jamais une distance qui a déjà un vrai record', async () => {
    mockUseRunningRecords.mockReturnValue({
      records: [
        { distanceKey: '5k', bestTimeSeconds: 1500, achievedAt: '2026-07-20T09:00:00.000Z', runId: 'a' },
        { distanceKey: '10k', bestTimeSeconds: 3200, achievedAt: '2026-07-25T09:00:00.000Z', runId: 'b' },
      ],
      isLoading: false,
    });

    await render(<RunningHistoryScreen />);

    // Une estimation affichée à côté d'un temps réellement couru serait au mieux redondante, au
    // pire contradictoire. La règle vit dans `resolveRacePredictions` ; on vérifie le branchement.
    expect(screen.queryByText('running.records.distance10k')).toBeTruthy();
    expect(screen.getByText('running.predictions.marathonWarning')).toBeTruthy();
    // Le 10 km a un vrai record : il ne doit apparaître qu'une fois (la ligne de record), jamais
    // en estimation. Les prédictions restantes sont le semi et le marathon.
    expect(screen.getAllByText(/running\.predictions\.sourceLabel/)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Charge d'entraînement (ACWR)
// ---------------------------------------------------------------------------

describe('charge d’entraînement', () => {
  it('sans historique exploitable, affiche une note', async () => {
    await render(<RunningHistoryScreen />);

    expect(screen.getByText('running.trainingLoad.empty')).toBeTruthy();
  });

  it('affiche les trois zones, y compris hors risque', async () => {
    // 4 semaines de courses régulières, dont la dernière semaine identique aux précédentes.
    const runs = [
      course({ id: 'a', finishedAt: '2026-08-05T07:00:00.000Z' }),
      course({ id: 'b', finishedAt: '2026-07-29T07:00:00.000Z' }),
      course({ id: 'c', finishedAt: '2026-07-22T07:00:00.000Z' }),
      course({ id: 'd', finishedAt: '2026-07-15T07:00:00.000Z' }),
    ];
    mockUseRunHistory.mockReturnValue({ runs, isLoading: false });

    await render(<RunningHistoryScreen />);

    // Écran de stats consulté à la demande, pas une alerte : la zone est toujours affichée,
    // contrairement au widget du dashboard qui se replie hors zone de risque (spec §1/R3).
    expect(screen.getByText('running.trainingLoad.ratioLabel')).toBeTruthy();
    expect(screen.queryByText('running.trainingLoad.empty')).toBeNull();
  });

  it('🔴 ignore les courses hors fenêtre, sur la date de FIN', async () => {
    mockUseRunHistory.mockReturnValue({
      runs: [course({ id: 'vieille', finishedAt: '2025-01-01T07:00:00.000Z' })],
      isLoading: false,
    });

    await render(<RunningHistoryScreen />);

    // Une course de l'an dernier gonflerait la charge chronique et écraserait le ratio.
    expect(screen.getByText('running.trainingLoad.empty')).toBeTruthy();
  });
});

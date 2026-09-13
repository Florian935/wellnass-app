/**
 * Écran d'accueil (`app/(tabs)/index.tsx`) — le **vrai** écran, monté.
 *
 * ⚠️ **Écran à 0 % avant ce fichier**, alors que c'est celui sur lequel l'app ouvre. Les hubs
 * Muscu et Nutrition avaient chacun leur test d'écran ; l'accueil, le plus lu des trois, n'en
 * avait aucun (US ACCUEIL-06).
 *
 * Ce que cet écran décide, et qui n'est vérifiable nulle part ailleurs, c'est **sa structure** :
 * quelles zones existent, lesquelles sont garanties, et ce que le mode édition fait disparaître.
 * Les contenus ont leurs propres tests (`NowCard`, `now-action`, `widgets`) — ici on vérifie
 * l'assemblage, c'est-à-dire précisément ce que la refonte a introduit.
 *
 * Les trois règles qui comptent :
 *  1. **les zones épinglées sont toujours là** hors édition — c'est tout l'objet de la refonte,
 *     un accueil où rien n'était garanti à l'écran ;
 *  2. **le mode édition masque le chrome** : garder une carte épinglée au-dessus d'une grille
 *     qu'on réorganise ferait croire qu'elle est déplaçable aussi ;
 *  3. **la forme effective de `real-life`** suit l'état de la période, sans réécrire la
 *     disposition de l'utilisateur.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import HomeScreen from '../index';
import { useNowAction } from '@/hooks/useNowAction';
import { useHomeScene } from '@/hooks/useHomeScene';
import { useRealLifeState } from '@/data/repositories/real-life-repository';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));
jest.mock('@/hooks/useNowAction', () => ({ useNowAction: jest.fn() }));
jest.mock('@/hooks/useSyncRefresh', () => ({
  useSyncRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }),
}));
jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: () => ({ profile: { firstName: 'Florian' } }),
}));
jest.mock('@/data/repositories/activation-path-repository', () => ({
  useActivationPath: () => ({ show: false }),
}));
jest.mock('@/data/repositories/insights-repository', () => ({
  useInsights: () => ({ insights: [], isLoading: false }),
}));
jest.mock('@/data/repositories/insights-context', () => ({
  InsightsProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/data/repositories/real-life-repository', () => ({
  useRealLifeState: jest.fn(() => ({ activePeriod: null, daysRemaining: null })),
  startRealLifePeriod: jest.fn(() => Promise.resolve('p-1')),
}));
// US DASH-01 — la scène est REELLE dans ce test (c'est l'assemblage qu'on vérifie) ; ce sont ses
// sources de données qui sont simulées.
jest.mock('@/hooks/useHomeScene', () => ({
  useHomeScene: jest.fn(),
  useMorningBriefFacts: jest.fn(() => ({
    verdict: null,
    todaySession: null,
    nearRecord: null,
    proteinGapG: null,
    streak: 4,
    realLifeActive: false,
  })),
}));
jest.mock('@/components/dashboard/MorningBriefCard', () => {
  const { Text } = require('react-native');
  return { MorningBriefCard: () => <Text>sonde-brief</Text> };
});
jest.mock('@/hooks/useWeekRings', () => ({ useWeekRings: jest.fn(() => []) }));
jest.mock('@/hooks/useTodayKey', () => ({
  useTodayKey: () => '2026-09-14',
  useTodayDate: () => new Date(2026, 8, 14),
  useCurrentHour: () => 9,
}));
jest.mock('@/data/repositories/goal-repository', () => ({
  useGoals: jest.fn(() => ({ active: [], finished: [], isLoading: false })),
}));
jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({
  saveWellbeing: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('@/lib/analytics', () => ({
  ANALYTICS_EVENTS: { dashboardCustomized: 'dashboard_customized' },
  track: jest.fn(),
}));

/** Zones remplacées par des sondes : leur contenu est testé chez elles. */
jest.mock('@/components/dashboard/NowCard', () => {
  const { Text } = require('react-native');
  return { NowCard: () => <Text>sonde-now</Text> };
});
jest.mock('@/components/dashboard/SinceLastVisitCard', () => {
  const { Text } = require('react-native');
  return { SinceLastVisitCard: () => <Text>sonde-depuis</Text> };
});
jest.mock('@/components/dashboard/WeeklyStoryCard', () => {
  const { Text } = require('react-native');
  return { WeeklyStoryCard: () => <Text>sonde-bilan</Text> };
});
jest.mock('@/components/goals/GoalCard', () => {
  const { Text } = require('react-native');
  return { GoalCard: () => <Text>sonde-objectif</Text> };
});
jest.mock('@/components/SyncStatus', () => {
  const { Text } = require('react-native');
  return { SyncStatus: () => <Text>sonde-sync</Text> };
});
jest.mock('expo-router', () => {
  const { View } = require('react-native');
  return {
    useRouter: () => ({ push: jest.fn() }),
    Link: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});
jest.mock('@/components/dashboard/QuickActions', () => {
  const { Text } = require('react-native');
  return {
    QuickActions: ({ highlightMeal }: { highlightMeal?: string }) => (
      <Text>sonde-quick:{highlightMeal ?? 'aucun'}</Text>
    ),
  };
});
jest.mock('@/components/dashboard/UpNext', () => {
  const { Pressable, Text } = require('react-native');
  return {
    UpNext: ({ onCustomize }: { onCustomize: () => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel="sonde-personnaliser" onPress={onCustomize}>
        <Text>sonde-upnext</Text>
      </Pressable>
    ),
  };
});

/**
 * La grille expose ses paramètres en texte : c'est le seul moyen de vérifier que l'écran lui
 * passe bien `sizeFor` et `editing`, qui sont les deux décisions de l'assemblage.
 */
jest.mock('@/components/widgets/WidgetGrid', () => {
  const { Text } = require('react-native');
  return {
    WidgetGrid: ({
      editing,
      sizeFor,
    }: {
      editing: boolean;
      sizeFor?: (id: string, stored: string) => string;
    }) => (
      <Text>
        sonde-grille:{editing ? 'edition' : 'affichage'}:
        {sizeFor ? sizeFor('real-life', 'row') : 'sans-sizeFor'}
      </Text>
    ),
  };
});
jest.mock('@/components/dashboard/dashboard-widgets', () => ({ DashboardWidget: () => null }));

jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // `i18n.language` sert à la date en clair de la scène : sans lui, l'écran ne peut plus la formater.
    i18n: { language: 'fr' },
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    // La scène dérive son dégradé du schéma : sans lui, `stageTheme` n'a pas de teinte.
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      accent: '#b14f2b',
      accentText: '#ffffff',
      surface: '#fffaf2',
      border: '#ece0cd',
    },
  }),
}));

const mockUseNowAction = useNowAction as jest.Mock;
const mockRealLife = useRealLifeState as jest.Mock;
const mockHomeScene = useHomeScene as jest.Mock;

/** Le moment « journée », celui de très loin le plus fréquent — les autres sont testés sur la scène. */
const COMPOSANTE_INDISPONIBLE = { state: 'unavailable' as const };

const FAITS_DU_JOUR = {
  moment: 'day' as const,
  streak: 4,
  verdict: null,
  // Le score de forme complet : c'est lui que « Pourquoi ? » détaille (§6.1).
  readiness: {
    show: false,
    verdict: null,
    load: COMPOSANTE_INDISPONIBLE,
    nutrition: COMPOSANTE_INDISPONIBLE,
    wellbeing: COMPOSANTE_INDISPONIBLE,
    negativeCount: 0,
    availableCount: 0,
  },
  checkinDone: true,
  hoursLeft: 5,
  jokersRemaining: 1,
  isLoading: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseNowAction.mockReturnValue({
    action: { kind: 'idle', moment: 'morning' },
    isLoading: false,
  });
  mockRealLife.mockReturnValue({ activePeriod: null, daysRemaining: null });
  mockHomeScene.mockReturnValue(FAITS_DU_JOUR);
});

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------
describe('les cinq zones', () => {
  it('🔴 monte les quatre zones fixes ET la grille', async () => {
    await render(<HomeScreen />);

    // La scène a remplacé l'en-tête : elle porte la date, l'accroche et la carte « maintenant ».
    expect(screen.getByTestId('home-stage')).toBeTruthy();
    expect(screen.getByText('sonde-now')).toBeTruthy();
    expect(screen.getByText('sonde-depuis')).toBeTruthy();
    expect(screen.getByText('sonde-bilan')).toBeTruthy();
    expect(screen.getByText(/sonde-quick/)).toBeTruthy();
    expect(screen.getByText(/sonde-grille/)).toBeTruthy();
    expect(screen.getByText('sonde-upnext')).toBeTruthy();
  });

  it('🔴 le brief du matin ne s’affiche QUE le matin', async () => {
    // Une « revue du matin » affichée à 19 h n'est plus un rendez-vous, c'est du remplissage.
    await render(<HomeScreen />);
    expect(screen.queryByText('sonde-brief')).toBeNull();

    mockHomeScene.mockReturnValue({ ...FAITS_DU_JOUR, moment: 'morning', checkinDone: true });
    await render(<HomeScreen />);
    expect(screen.getByText('sonde-brief')).toBeTruthy();
  });

  it('🔴 n’affiche plus le NOM DE L’APPLICATION en titre', async () => {
    // Le défaut d'origine : `common.appName` en Bricolage 28 px extra-bold occupait le pixel le
    // plus visible de l'écran le plus ouvert, pour une information que l'utilisateur possède déjà.
    await render(<HomeScreen />);
    expect(screen.queryByText('common.appName')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Mode édition
// ---------------------------------------------------------------------------
describe('mode édition', () => {
  it('masque le chrome épinglé et passe la grille en édition', async () => {
    await render(<HomeScreen />);
    await act(async () => fireEvent.press(screen.getByLabelText('sonde-personnaliser')));

    expect(screen.getByText(/sonde-grille:edition/)).toBeTruthy();
    // Une carte épinglée au-dessus d'une grille qu'on réorganise ferait croire qu'elle bouge aussi.
    expect(screen.queryByText('sonde-now')).toBeNull();
    expect(screen.queryByText(/sonde-quick/)).toBeNull();
    expect(screen.queryByText('sonde-upnext')).toBeNull();
    expect(screen.queryByTestId('home-stage')).toBeNull();
  });

  it('affiche la consigne de déplacement, invisible jusqu’à UX-04', async () => {
    await render(<HomeScreen />);
    await act(async () => fireEvent.press(screen.getByLabelText('sonde-personnaliser')));

    expect(screen.getByText('home.customize.editHint')).toBeTruthy();
    expect(screen.getByText('home.customize.dragHint')).toBeTruthy();
  });

  it('revient à l’affichage par « Terminé »', async () => {
    await render(<HomeScreen />);
    await act(async () => fireEvent.press(screen.getByLabelText('sonde-personnaliser')));
    await act(async () => fireEvent.press(screen.getByLabelText('home.customize.done')));

    expect(screen.getByText(/sonde-grille:affichage/)).toBeTruthy();
    expect(screen.getByText('sonde-now')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Forme effective de real-life
// ---------------------------------------------------------------------------
describe('forme effective de la carte « vie réelle »', () => {
  it('laisse la bande telle quelle hors période', async () => {
    await render(<HomeScreen />);
    // `sizeFor('real-life', 'row')` doit rendre 'row' : une ligne suffit hors période, et c'est
    // l'état de très loin le plus fréquent.
    expect(screen.getByText(/sonde-grille:affichage:row/)).toBeTruthy();
  });

  it('🔴 la remonte à `large` pendant une période — sinon la carte est tronquée', async () => {
    // Constaté en recette le 10/09/2026 : remontée à `wide` (170 px), la carte active était
    // coupée et ses deux boutons inatteignables. Son contenu fait ~230 px — échéance, jours
    // restants, trois lignes d objectif, puis « Prolonger » et « Reprendre le plan normal ».
    mockRealLife.mockReturnValue({
      activePeriod: { id: 'p1', endsOn: '2026-09-16' },
      daysRemaining: 7,
    });
    await render(<HomeScreen />);

    expect(screen.getByText(/sonde-grille:affichage:large/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Passage d'information entre zones
// ---------------------------------------------------------------------------
describe('cohérence entre zones', () => {
  it('met en avant le repas réclamé par la carte « maintenant »', async () => {
    // L'accroche, la carte et la pastille dérivent de la MÊME décision : elles ne peuvent donc
    // pas se contredire. C'est aussi pourquoi `useNowAction` n'est appelé qu'une fois dans l'écran.
    mockUseNowAction.mockReturnValue({
      action: { kind: 'meal-due', meal: 'dinner', deadlineHour: 20 },
      isLoading: false,
    });
    await render(<HomeScreen />);

    expect(screen.getByText('sonde-quick:dinner')).toBeTruthy();
  });

  it('ne met aucun repas en avant quand rien n’est réclamé', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('sonde-quick:aucun')).toBeTruthy();
  });
});

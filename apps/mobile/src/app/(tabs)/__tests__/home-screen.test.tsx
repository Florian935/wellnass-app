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
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import HomeScreen from '../index';
import { useNowAction } from '@/hooks/useNowAction';
import { useHomeScene } from '@/hooks/useHomeScene';
import { startRealLifePeriod, useRealLifeState } from '@/data/repositories/real-life-repository';
import { consumeJoker } from '@/data/repositories/streak-joker-repository';
import { useComebackChoice } from '@/stores/home-comeback-store';

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
  useAskQuestions: jest.fn(() => []),
}));
jest.mock('@/components/dashboard/MorningBrief', () => {
  const { Text } = require('react-native');
  return { MorningBrief: () => <Text>sonde-brief</Text> };
});
jest.mock('@/components/ask/AskCard', () => {
  const { Text } = require('react-native');
  return { AskCard: () => <Text>sonde-demande</Text> };
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
jest.mock('@/data/repositories/dashboard-repository', () => ({
  useNutritionSummary: jest.fn(() => ({ kcal: 850, effectiveTarget: 2300 })),
}));
jest.mock('@/data/repositories/streak-joker-repository', () => ({
  consumeJoker: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('@/lib/analytics', () => ({
  ANALYTICS_EVENTS: { dashboardCustomized: 'dashboard_customized', streakSavedEvening: 'streak_saved' },
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
const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { View } = require('react-native');
  return {
    useRouter: () => ({ push: mockPush }),
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
  coveredToday: false,
  rescue: [{ kind: 'walk', stepsLeft: 1900, minutes: 20 }, { kind: 'activity' }, { kind: 'joker' }],
  daysSinceLastActivity: 1,
  firstDay: false,
  isLoading: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseNowAction.mockReturnValue({
    action: { kind: 'idle', moment: 'morning', suggestion: 'activity' },
    isLoading: false,
  });
  mockRealLife.mockReturnValue({ activePeriod: null, daysRemaining: null });
  mockHomeScene.mockReturnValue(FAITS_DU_JOUR);
  useComebackChoice.setState({ normalChosenOn: null });
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
// US ACCUEIL-07 — l'en-tête dit vrai
// ---------------------------------------------------------------------------
describe('l’en-tête (constat 6)', () => {
  it('🔴 salue par le PRÉNOM, selon l’heure — il n’apparaissait jamais', async () => {
    await render(<HomeScreen />);
    // 9 h (mock de `useCurrentHour`) → « Bonjour Florian ».
    expect(screen.getByText('home.greet.morning:{"name":"Florian"}')).toBeTruthy();
  });

  it('🔴 la phrase du jour vient de la décision, pas de la carte', async () => {
    mockUseNowAction.mockReturnValue({
      action: { kind: 'meal-due', meal: { key: 'dinner', label: null, hour: 8.5, learned: true, logged: false } },
      isLoading: false,
    });
    await render(<HomeScreen />);
    // 2300 − 850 = 1450 kcal restantes, mis en forme par la langue.
    expect(screen.getByText(/home\.sentence\.mealDueKcal:\{"kcal":"1.450"\}/)).toBeTruthy();
  });

  it('« Content de te revoir » au retour d’une absence', async () => {
    mockHomeScene.mockReturnValue({ ...FAITS_DU_JOUR, moment: 'comeback', daysSinceLastActivity: 9 });
    await render(<HomeScreen />);
    expect(screen.getByText('home.greet.comeback:{"name":"Florian"}')).toBeTruthy();
  });
});

describe('la série en jeu (constat 5)', () => {
  const soir = { ...FAITS_DU_JOUR, moment: 'evening-at-risk' as const };

  it('🔴 marcher ouvre les pas, noter une activité ouvre l’activité — plus jamais le planning', async () => {
    mockHomeScene.mockReturnValue(soir);
    await render(<HomeScreen />);

    await act(async () => fireEvent.press(screen.getByTestId('streak-rescue-walk')));
    await act(async () => fireEvent.press(screen.getByTestId('streak-rescue-activity')));
    expect(mockPush).toHaveBeenCalledWith('/steps');
    expect(mockPush).toHaveBeenCalledWith('/activity');
    expect(mockPush).not.toHaveBeenCalledWith('/planning');
  });

  it('le joker se confirme avant d’être posé sur AUJOURD’HUI', async () => {
    mockHomeScene.mockReturnValue(soir);
    const alert = jest.spyOn(Alert, 'alert');
    await render(<HomeScreen />);

    await act(async () => fireEvent.press(screen.getByTestId('streak-rescue-joker')));
    expect(consumeJoker).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0]![2]!;
    await act(async () => buttons[1]!.onPress!());
    expect(consumeJoker).toHaveBeenCalledWith('2026-09-14');
  });
});

describe('le retour — VIE-02', () => {
  const retour = { ...FAITS_DU_JOUR, moment: 'comeback' as const, daysSinceLastActivity: 9 };

  it('🔴 « En douceur » démarre la période et RESTE sur l’accueil (plus de route /real-life)', async () => {
    mockHomeScene.mockReturnValue(retour);
    await render(<HomeScreen />);

    await act(async () => fireEvent.press(screen.getByLabelText('stage.home.gentleRestart')));
    expect(startRealLifePeriod).toHaveBeenCalledWith({ startedOn: '2026-09-14', endsOn: '2026-09-21' });
    expect(mockPush).not.toHaveBeenCalledWith('/real-life');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('la période en cours se lit sur place, avec sa date de fin', async () => {
    mockHomeScene.mockReturnValue(retour);
    mockRealLife.mockReturnValue({ activePeriod: { id: 'p1', endsOn: '2026-09-21' }, daysRemaining: 7 });
    await render(<HomeScreen />);

    expect(screen.getByText(/stage\.home\.gentleDone:\{"date":"21 septembre"\}/)).toBeTruthy();
  });

  it('« Mon plan normal » ne pousse plus le planning : la scène le confirme', async () => {
    mockHomeScene.mockReturnValue(retour);
    await render(<HomeScreen />);

    await act(async () => fireEvent.press(screen.getByLabelText('stage.home.normalPlan')));
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByText('stage.home.normalDone')).toBeTruthy();
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
      action: { kind: 'meal-due', meal: { key: 'dinner', label: null, hour: 20, learned: true, logged: false } },
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

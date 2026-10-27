/**
 * Écran d'accueil (`app/(tabs)/index.tsx`) — le **vrai** écran, monté.
 *
 * ⚠️ **Écran à 0 % avant ce fichier** (US ACCUEIL-06), alors que c'est celui sur lequel l'app ouvre.
 *
 * Ce que cet écran décide, et qui n'est vérifiable nulle part ailleurs, c'est **son assemblage** :
 * quelles zones existent, dans quel état chacune reçoit la décision du moment, et ce que le mode
 * édition fait disparaître. Les contenus ont leurs propres tests (`NowCard`, `HomeDayTimeline`,
 * `HomeDials`, `WeekStrip`, `HomeNews`, `AddSheet`, `HomeSky`, et les briques pures) — ici, des
 * sondes les remplacent et disent ce qu'elles ont reçu.
 *
 * ── US ACCUEIL-08 — « Ta journée » ───────────────────────────────────────────────────────────────
 * Le ciel (salutation, phrase du jour, « Écouter mon brief » le matin, séance en cours, les trois
 * cadrans — ou la carte « retour », ou « Premiers pas »), le fil « Ta journée » avec la carte du
 * moment, « Ta semaine », « Du nouveau », « Tes repères », le pied, et le « + ». Disparus :
 * « Demande-moi » (D3), la barre d'actions rapides (D4), « La suite », le bilan du lundi, la carte du
 * brief — le test le vérifie.
 *
 * ── US ACCUEIL-09 ────────────────────────────────────────────────────────────────────────────────
 * Le record à portée DE la séance du jour (une lecture, deux usages : l'astuce de la carte et « Du
 * nouveau »), le toast du verre d'eau, et Prisme du soir posé au bout du fil.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { DayTimeline, NowAction } from '@wellness/shared';

import HomeScreen from '../index';
import { useNowAction } from '@/hooks/useNowAction';
import { useHomeScene } from '@/hooks/useHomeScene';
import { useSettings } from '@/data/repositories/settings-repository';
import { useActivationPath } from '@/data/repositories/activation-path-repository';
import { startRealLifePeriod, useRealLifeState } from '@/data/repositories/real-life-repository';
import { consumeJoker } from '@/data/repositories/streak-joker-repository';
import { useSessionBrief } from '@/data/repositories/immersive-repository';
import { useNearRecords } from '@/data/repositories/records-repository';
import { useComebackChoice } from '@/stores/home-comeback-store';

// ---------------------------------------------------------------------------
// Mocks — les sources de données
// ---------------------------------------------------------------------------

jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));
jest.mock('@/hooks/useNowAction', () => ({ useNowAction: jest.fn() }));
jest.mock('@/hooks/useSyncRefresh', () => ({
  useSyncRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }),
}));
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
jest.mock('@/hooks/useHomeWeek', () => ({
  useHomeWeek: () => ({
    strip: { days: [], sessionsDone: 0, sessionsTotal: 0, daysInTarget: 0, loggedDays: 0 },
    // Une séance prévue aujourd'hui : le cadran Bouger a de quoi se dire.
    weekSessions: [{ pillar: 'strength', dayKey: '2026-09-14', done: false }],
  }),
}));
jest.mock('@/hooks/useTodayKey', () => ({
  useTodayKey: () => '2026-09-14',
  useTodayDate: () => new Date(2026, 8, 14),
}));
jest.mock('@/hooks/useAppReducedMotion', () => ({ useAppReducedMotion: jest.fn(() => false) }));
jest.mock('@/lib/haptics', () => ({ hapticConfirm: jest.fn(), hapticSelect: jest.fn(), hapticMilestone: jest.fn() }));
jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: () => ({ profile: { firstName: 'Florian' } }),
}));
jest.mock('@/data/repositories/settings-repository', () => ({ useSettings: jest.fn() }));
jest.mock('@/data/repositories/activation-path-repository', () => ({ useActivationPath: jest.fn() }));
jest.mock('@/data/repositories/real-life-repository', () => ({
  useRealLifeState: jest.fn(() => ({ activePeriod: null, daysRemaining: null })),
  startRealLifePeriod: jest.fn(() => Promise.resolve('p-1')),
}));
jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({
  saveWellbeing: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('@/data/repositories/dashboard-repository', () => ({
  useNutritionSummary: jest.fn(() => ({ kcal: 850, effectiveTarget: 2300, macros: { p: 60, c: 0, f: 0 }, trainingBonus: 0 })),
  useProteinTarget: jest.fn(() => 140),
}));
jest.mock('@/data/repositories/bodyweight-repository', () => ({
  useLatestWeight: () => ({ latest: null, isLoading: false }),
}));
jest.mock('@/data/repositories/immersive-repository', () => ({ useSessionBrief: jest.fn() }));
jest.mock('@/data/repositories/records-repository', () => ({ useNearRecords: jest.fn() }));
jest.mock('@/data/repositories/streak-joker-repository', () => ({
  consumeJoker: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('@/lib/analytics', () => ({
  ANALYTICS_EVENTS: {
    dashboardCustomized: 'dashboard_customized',
    streakSavedEvening: 'streak_saved',
    homeCheckinDone: 'home_checkin_done',
  },
  track: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — les zones, remplacées par des sondes qui disent ce qu'elles ont reçu
// ---------------------------------------------------------------------------

jest.mock('@/components/dashboard/NowCard', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    NowCard: ({
      action,
      rescue,
      tip,
    }: {
      action: { kind: string };
      rescue: null | { onWalk: () => void; onActivity: () => void; onJoker: () => void };
      tip: null | { key: string };
    }) => (
      <View>
        <Text>sonde-now:{action.kind}</Text>
        <Text>sonde-astuce:{tip ? tip.key : 'aucune'}</Text>
        {rescue ? (
          <>
            <Pressable testID="sonde-rescue-walk" onPress={rescue.onWalk} />
            <Pressable testID="sonde-rescue-activity" onPress={rescue.onActivity} />
            <Pressable testID="sonde-rescue-joker" onPress={rescue.onJoker} />
          </>
        ) : null}
      </View>
    ),
  };
});
jest.mock('@/components/dashboard/HomeDayTimeline', () => {
  const { View, Text } = require('react-native');
  return {
    HomeDayTimeline: ({
      nowCard,
      nowFirst,
      ending,
    }: {
      nowCard: React.ReactNode;
      nowFirst: boolean;
      ending: React.ReactNode;
    }) => (
      <View testID="sonde-fil">
        <Text>sonde-fil:{nowFirst ? 'carte-en-tete' : 'carte-a-sa-place'}</Text>
        {nowCard}
        <View testID="sonde-bout-du-fil">{ending}</View>
      </View>
    ),
  };
});
jest.mock('@/components/dashboard/HomeDials', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    HomeDials: ({ dials, onPress }: { dials: { key: string }[]; onPress: (k: string) => void }) => (
      <View>
        <Text>sonde-cadrans:{dials.map((d) => d.key).join(',')}</Text>
        {dials.map((d) => (
          <Pressable key={d.key} testID={`sonde-cadran-${d.key}`} onPress={() => onPress(d.key)} />
        ))}
      </View>
    ),
  };
});
jest.mock('@/components/dashboard/WeekStrip', () => {
  const { Text } = require('react-native');
  return {
    WeekStrip: ({ streak }: { streak: { kind: string; days?: number; weeks?: number } }) => (
      <Text>sonde-semaine:{streak.kind}:{streak.days ?? streak.weeks ?? '-'}</Text>
    ),
  };
});
jest.mock('@/components/dashboard/HomeNews', () => {
  const { Text } = require('react-native');
  return {
    HomeNews: ({ nearRecord }: { nearRecord: null | { exerciseName: string } }) => (
      <Text>sonde-nouveau:{nearRecord ? nearRecord.exerciseName : 'aucun-record'}</Text>
    ),
  };
});
jest.mock('@/components/dashboard/AddSheet', () => {
  const { Pressable, Text } = require('react-native');
  return {
    AddFab: ({ onPress }: { onPress: () => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel="sonde-plus" onPress={onPress} />
    ),
    AddSheet: ({ visible, hour, onWaterAdded }: { visible: boolean; hour: number; onWaterAdded: () => void }) =>
      visible ? (
        <>
          <Text>sonde-feuille-noter:{hour}</Text>
          <Pressable accessibilityLabel="sonde-eau" onPress={onWaterAdded} />
        </>
      ) : null,
  };
});
jest.mock('@/components/dashboard/EveningCard', () => {
  const { Text } = require('react-native');
  return { EveningCard: ({ variant }: { variant?: string }) => <Text>sonde-soir:{variant ?? 'carte'}</Text> };
});
jest.mock('@/components/dashboard/RealLifeCard', () => {
  const { Text } = require('react-native');
  return { RealLifeCard: ({ size }: { size: string }) => <Text>sonde-vie-reelle:{size}</Text> };
});
jest.mock('@/components/real-life/RealLifeSheet', () => {
  const { Text } = require('react-native');
  return { RealLifeSheet: ({ visible }: { visible: boolean }) => (visible ? <Text>sonde-alleger</Text> : null) };
});
jest.mock('@/components/explain/ExplainSheet', () => ({ ExplainSheet: () => null }));
jest.mock('@/components/SyncStatus', () => {
  const { Text } = require('react-native');
  return { SyncStatus: () => <Text>sonde-sync</Text> };
});
jest.mock('@/components/widgets/WidgetGrid', () => {
  const { Text } = require('react-native');
  return {
    WidgetGrid: ({ editing }: { editing: boolean }) => <Text>sonde-grille:{editing ? 'edition' : 'affichage'}</Text>,
  };
});
jest.mock('@/components/dashboard/dashboard-widgets', () => ({ DashboardWidget: () => null }));
jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { View } = require('react-native');
  return {
    useRouter: () => ({ push: mockPush }),
    Link: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // `i18n.language` sert à la date en clair et au séparateur de milliers.
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
      background: '#f7eede',
    },
  }),
}));

const mockUseNowAction = useNowAction as jest.Mock;
const mockRealLife = useRealLifeState as jest.Mock;
const mockHomeScene = useHomeScene as jest.Mock;
const mockSettings = useSettings as jest.Mock;
const mockActivation = useActivationPath as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COMPOSANTE_INDISPONIBLE = { state: 'unavailable' as const };

const FAITS_DU_JOUR = {
  moment: 'day' as const,
  streak: 4,
  verdict: null,
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
  steps: { tracked: false, today: 0, goal: 8000 },
  weeklyStreak: { unit: 'day' as const, current: 0 },
  offers: { restorableGap: null, offerSwitch: false },
};

/** La décision du moment, telle que `useNowAction` la rend à l'écran (calculée UNE fois). */
function decision(now: NowAction | { kind: 'checkin-due' }, hour = 9, over: Partial<DayTimeline> = {}) {
  return {
    action: now,
    timeline: { items: [], now, nowItemId: null, progress: { done: 0, total: 0 }, dayDone: false, ...over },
    hour,
    mealTotals: new Map(),
    checkinEnergy: null,
    isLoading: false,
  };
}

const IDLE: NowAction = { kind: 'idle', moment: 'morning', suggestion: 'activity' };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseNowAction.mockReturnValue(decision(IDLE));
  mockRealLife.mockReturnValue({ activePeriod: null, daysRemaining: null });
  mockHomeScene.mockReturnValue(FAITS_DU_JOUR);
  mockSettings.mockReturnValue({ settings: { activePillars: ['strength', 'running', 'nutrition'] } });
  mockActivation.mockReturnValue({ show: false, day: null, theme: null });
  useComebackChoice.setState({ normalChosenOn: null });
  (useSessionBrief as jest.Mock).mockReturnValue({ name: null, exercises: [] });
  (useNearRecords as jest.Mock).mockReturnValue({ items: [] });
});

const press = async (el: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    await fireEvent.press(el);
  });
};

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------
describe('les zones de « Ta journée »', () => {
  it('🔴 le ciel, le fil et sa carte, la semaine, du nouveau, les repères, le pied et le « + »', async () => {
    await render(<HomeScreen />);

    expect(screen.getByTestId('home-stage')).toBeTruthy();
    expect(screen.getByText(/^sonde-cadrans:/)).toBeTruthy();
    expect(screen.getByTestId('sonde-fil')).toBeTruthy();
    expect(screen.getByText('sonde-now:idle')).toBeTruthy();
    expect(screen.getByText(/^sonde-semaine:/)).toBeTruthy();
    expect(screen.getByText(/^sonde-nouveau:/)).toBeTruthy();
    expect(screen.getByTestId('home-reperes')).toBeTruthy();
    expect(screen.getByText('home.reperes.title')).toBeTruthy();
    expect(screen.getByText('sonde-grille:affichage')).toBeTruthy();
    expect(screen.getByText('home.footer.lighten')).toBeTruthy();
    expect(screen.getByText('home.footer.customize')).toBeTruthy();
    expect(screen.getByLabelText('sonde-plus')).toBeTruthy();
  });

  it('🔴 « Demande-moi » (D3) et la barre d’actions rapides (D4) ont quitté l’accueil', async () => {
    await render(<HomeScreen />);
    expect(screen.queryByText(/home\.ask\./)).toBeNull();
    expect(screen.queryByText(/home\.quick\./)).toBeNull();
    expect(screen.queryByText(/home\.upNext\./)).toBeNull();
  });

  it('🔴 n’affiche plus le NOM DE L’APPLICATION en titre', async () => {
    await render(<HomeScreen />);
    expect(screen.queryByText('common.appName')).toBeNull();
  });

  it('🔴 « Écouter mon brief » le matin SEULEMENT', async () => {
    // Une revue du matin proposée à 19 h n'est plus un rendez-vous, c'est du remplissage.
    await render(<HomeScreen />);
    expect(screen.getByTestId('home-listen-brief')).toBeTruthy();

    mockUseNowAction.mockReturnValue(decision(IDLE, 14));
    await render(<HomeScreen />);
    expect(screen.queryByTestId('home-listen-brief')).toBeNull();
  });

  it('🔴 US ACCUEIL-09 — Prisme du soir au BOUT du fil, dès 18 h (et plus de carte à part)', async () => {
    await render(<HomeScreen />);
    expect(screen.queryByText(/^sonde-soir/)).toBeNull();

    mockUseNowAction.mockReturnValue(decision(IDLE, 19));
    await render(<HomeScreen />);
    expect(screen.getByText('sonde-soir:fil')).toBeTruthy();
    expect(screen.getAllByText(/^sonde-soir/)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// L'en-tête — ACCUEIL-07, constat 6
// ---------------------------------------------------------------------------
describe('l’en-tête', () => {
  it('🔴 salue par le PRÉNOM, selon l’heure', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('home.greet.morning:{"name":"Florian"}')).toBeTruthy();
  });

  it('🔴 la phrase du jour vient de la MÊME décision que la carte du moment', async () => {
    const meal: NowAction = { kind: 'meal-due', meal: { key: 'dinner', label: null, hour: 8.5, learned: true, logged: false } };
    mockUseNowAction.mockReturnValue(decision(meal));
    await render(<HomeScreen />);
    // 2300 − 850 = 1450 kcal restantes, mis en forme par la langue.
    expect(screen.getByText(/home\.sentence\.mealDueKcal:\{"kcal":"1.450"\}/)).toBeTruthy();
    expect(screen.getByText('sonde-now:meal-due')).toBeTruthy();
  });

  it('le check-in du matin a sa phrase', async () => {
    mockUseNowAction.mockReturnValue(decision({ kind: 'checkin-due' }, 8));
    await render(<HomeScreen />);
    expect(screen.getByText(/^home\.sentence\.checkin/)).toBeTruthy();
  });

  it('« Content de te revoir » au retour d’une absence', async () => {
    mockHomeScene.mockReturnValue({ ...FAITS_DU_JOUR, moment: 'comeback', daysSinceLastActivity: 9 });
    await render(<HomeScreen />);
    expect(screen.getByText('home.greet.comeback:{"name":"Florian"}')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Le ciel — D2
// ---------------------------------------------------------------------------
describe('les cadrans (D2)', () => {
  it('🔴 un cadran par pilier actif : sans charge à lire, pas de Récupérer', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('sonde-cadrans:move,eat')).toBeTruthy();
  });

  it('🔴 nutrition seule, pas suivis : Manger et Marcher — jamais Bouger', async () => {
    mockSettings.mockReturnValue({ settings: { activePillars: ['nutrition'] } });
    mockHomeScene.mockReturnValue({ ...FAITS_DU_JOUR, steps: { tracked: true, today: 4200, goal: 8000 } });
    await render(<HomeScreen />);
    expect(screen.getByText('sonde-cadrans:eat,walk')).toBeTruthy();
  });

  it('chaque cadran ouvre son détail : Bouger le planning, Manger la nutrition', async () => {
    await render(<HomeScreen />);
    await press(screen.getByTestId('sonde-cadran-move'));
    await press(screen.getByTestId('sonde-cadran-eat'));
    expect(mockPush).toHaveBeenCalledWith('/planning');
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/nutrition');
  });

  it('le tout premier jour, « Premiers pas » remplace les cadrans', async () => {
    mockHomeScene.mockReturnValue({ ...FAITS_DU_JOUR, firstDay: true });
    mockActivation.mockReturnValue({ show: true, day: 1, theme: 'strength' });
    await render(<HomeScreen />);
    expect(screen.getByTestId('home-first-steps')).toBeTruthy();
    expect(screen.queryByText(/^sonde-cadrans:/)).toBeNull();
  });

  it('une séance en cours : le bandeau « Reprendre » au-dessus des cadrans', async () => {
    mockUseNowAction.mockReturnValue(decision({ kind: 'workout-active', workoutId: 'w-1' }, 18));
    await render(<HomeScreen />);
    expect(screen.getByTestId('home-live-banner')).toBeTruthy();
    await press(screen.getByLabelText('home.now.workoutActive.cta'));
    expect(mockPush).toHaveBeenCalledWith('/workout');
  });
});

// ---------------------------------------------------------------------------
// La série en jeu (constat 5)
// ---------------------------------------------------------------------------
describe('la série en jeu, le soir', () => {
  const soir = { ...FAITS_DU_JOUR, moment: 'evening-at-risk' as const, streak: 12 };

  it('🔴 la carte du moment passe EN TÊTE du fil, et la semaine dit la série en jeu', async () => {
    mockHomeScene.mockReturnValue(soir);
    mockUseNowAction.mockReturnValue(decision(IDLE, 21));
    await render(<HomeScreen />);
    expect(screen.getByText('sonde-fil:carte-en-tete')).toBeTruthy();
    expect(screen.getByText('sonde-semaine:at-risk:12')).toBeTruthy();
  });

  it('🔴 marcher ouvre les pas, noter une activité ouvre l’activité — jamais le planning', async () => {
    mockHomeScene.mockReturnValue(soir);
    await render(<HomeScreen />);
    await press(screen.getByTestId('sonde-rescue-walk'));
    await press(screen.getByTestId('sonde-rescue-activity'));
    expect(mockPush).toHaveBeenCalledWith('/steps');
    expect(mockPush).toHaveBeenCalledWith('/activity');
    expect(mockPush).not.toHaveBeenCalledWith('/planning');
  });

  it('le joker se confirme avant d’être posé sur AUJOURD’HUI', async () => {
    mockHomeScene.mockReturnValue(soir);
    const alert = jest.spyOn(Alert, 'alert');
    await render(<HomeScreen />);

    await press(screen.getByTestId('sonde-rescue-joker'));
    expect(consumeJoker).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0]![2]!;
    await act(async () => buttons[1]!.onPress!());
    expect(consumeJoker).toHaveBeenCalledWith('2026-09-14');
  });

  it('hors soirée à risque, la carte reste à sa place et ne propose aucune sortie', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('sonde-fil:carte-a-sa-place')).toBeTruthy();
    expect(screen.queryByTestId('sonde-rescue-walk')).toBeNull();
  });
});

describe('la série en pastille (SERIE-01)', () => {
  it('🔴 en semaines quand c’est l’unité choisie', async () => {
    mockHomeScene.mockReturnValue({ ...FAITS_DU_JOUR, weeklyStreak: { unit: 'week', current: 3 } });
    await render(<HomeScreen />);
    expect(screen.getByText('sonde-semaine:weeks:3')).toBeTruthy();
  });

  it('pas de série : elle commence, sans « 0 jour »', async () => {
    mockHomeScene.mockReturnValue({ ...FAITS_DU_JOUR, streak: 0 });
    await render(<HomeScreen />);
    expect(screen.getByText('sonde-semaine:start:-')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Le retour — VIE-02
// ---------------------------------------------------------------------------
describe('le retour — VIE-02', () => {
  const retour = { ...FAITS_DU_JOUR, moment: 'comeback' as const, daysSinceLastActivity: 9 };

  it('🔴 « En douceur » démarre la période et RESTE sur l’accueil', async () => {
    mockHomeScene.mockReturnValue(retour);
    await render(<HomeScreen />);

    await press(screen.getByTestId('home-gentle-restart'));
    expect(startRealLifePeriod).toHaveBeenCalledWith({ startedOn: '2026-09-14', endsOn: '2026-09-21' });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('la période en cours se lit sur place, avec sa date de fin', async () => {
    mockHomeScene.mockReturnValue(retour);
    mockRealLife.mockReturnValue({ activePeriod: { id: 'p1', endsOn: '2026-09-21' }, daysRemaining: 7 });
    await render(<HomeScreen />);
    expect(screen.getByText(/stage\.home\.gentleDone:\{"date":"21 septembre"\}/)).toBeTruthy();
  });

  it('« Mon plan normal » ne pousse plus le planning : la carte le confirme', async () => {
    mockHomeScene.mockReturnValue(retour);
    await render(<HomeScreen />);
    await press(screen.getByTestId('home-normal-plan'));
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByText('stage.home.normalDone')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Le pied et le « + »
// ---------------------------------------------------------------------------
describe('le pied', () => {
  it('« Semaine chargée ? Allège-la » ouvre la feuille de la vie réelle', async () => {
    await render(<HomeScreen />);
    await press(screen.getByText('home.footer.lighten'));
    expect(screen.getByText('sonde-alleger')).toBeTruthy();
  });

  it('🔴 une période en cours : sa carte, en grand (ses deux boutons restent atteignables)', async () => {
    // Constaté en recette le 10/09/2026 : plus petite, la carte active était coupée.
    mockRealLife.mockReturnValue({ activePeriod: { id: 'p1', endsOn: '2026-09-16' }, daysRemaining: 2 });
    await render(<HomeScreen />);
    expect(screen.getByText('sonde-vie-reelle:large')).toBeTruthy();
    expect(screen.queryByText('home.footer.lighten')).toBeNull();
  });
});

describe('le « + » (D4)', () => {
  it('ouvre la feuille « Noter », qui reçoit l’heure de l’écran', async () => {
    mockUseNowAction.mockReturnValue(decision(IDLE, 12.5));
    await render(<HomeScreen />);
    expect(screen.queryByText(/sonde-feuille-noter/)).toBeNull();
    await press(screen.getByLabelText('sonde-plus'));
    expect(screen.getByText('sonde-feuille-noter:12.5')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Mode édition
// ---------------------------------------------------------------------------
describe('mode édition', () => {
  it('🔴 masque tout sauf la grille : ni ciel, ni fil, ni « + »', async () => {
    await render(<HomeScreen />);
    await press(screen.getByText('home.reperes.customize'));

    expect(screen.getByText('sonde-grille:edition')).toBeTruthy();
    expect(screen.queryByTestId('home-stage')).toBeNull();
    expect(screen.queryByTestId('sonde-fil')).toBeNull();
    expect(screen.queryByText(/^sonde-semaine:/)).toBeNull();
    expect(screen.queryByLabelText('sonde-plus')).toBeNull();
    expect(screen.getByText('home.customize.editHint')).toBeTruthy();
    expect(screen.getByText('home.customize.dragHint')).toBeTruthy();
  });

  it('« Personnaliser l’accueil », au pied, y mène aussi — et « Terminé » en revient', async () => {
    await render(<HomeScreen />);
    await press(screen.getByText('home.footer.customize'));
    expect(screen.getByText('sonde-grille:edition')).toBeTruthy();

    await press(screen.getByLabelText('home.customize.done'));
    expect(screen.getByText('sonde-grille:affichage')).toBeTruthy();
    expect(screen.getByTestId('sonde-fil')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Passage d'information entre zones
// ---------------------------------------------------------------------------
describe('cohérence entre zones', () => {
  it('🔴 US ACCUEIL-09 — le record à portée est celui d’un exercice DE LA SÉANCE, pour la carte et « Du nouveau »', async () => {
    const training = {
      pillar: 'strength' as const,
      name: 'Jambes',
      scheduledTime: '18:00',
      exerciseCount: 6,
      targetDistanceM: null,
      targetDurationSeconds: null,
      programName: null,
      plannedSessionId: 'ps-1',
      sessionId: 's-1',
    };
    mockUseNowAction.mockReturnValue(
      decision({ kind: 'session-today', training }, 9, {
        items: [
          {
            id: 'training:ps-1',
            kind: 'training',
            pillar: 'strength',
            hour: 18,
            timeKnown: true,
            done: false,
            suggested: false,
            live: false,
            missed: false,
            training,
          },
        ],
        nowItemId: 'training:ps-1',
      }),
    );
    (useSessionBrief as jest.Mock).mockReturnValue({
      name: 'Jambes',
      exercises: [{ exerciseId: 'squat' }, { exerciseId: 'fentes' }],
    });
    (useNearRecords as jest.Mock).mockReturnValue({
      items: [
        // Le plus à portée n'est pas au programme du jour : il est écarté.
        { exerciseId: 'bench', exerciseName: 'Développé couché', gapKind: 'kg', gap: 1, ratio: 0.99 },
        { exerciseId: 'squat', exerciseName: 'Squat', gapKind: 'kg', gap: 2.5, ratio: 0.97 },
      ],
    });
    await render(<HomeScreen />);
    expect(useSessionBrief).toHaveBeenCalledWith('s-1', 'fr');
    expect(screen.getByText('sonde-nouveau:Squat')).toBeTruthy();
    expect(screen.getByText('sonde-astuce:home.tips.nearRecordKg')).toBeTruthy();
  });

  it('sans séance de musculation à faire, aucun record à portée', async () => {
    (useNearRecords as jest.Mock).mockReturnValue({
      items: [{ exerciseId: 'squat', exerciseName: 'Squat', gapKind: 'kg', gap: 2.5, ratio: 0.97 }],
    });
    await render(<HomeScreen />);
    expect(useSessionBrief).toHaveBeenCalledWith('', 'fr');
    expect(screen.getByText('sonde-nouveau:aucun-record')).toBeTruthy();
  });

  it('🔴 US ACCUEIL-09 — le verre d’eau noté depuis le « + » se confirme par le toast', async () => {
    await render(<HomeScreen />);
    await press(screen.getByLabelText('sonde-plus'));
    await press(screen.getByLabelText('sonde-eau'));
    expect(screen.getByText('home.toast.water')).toBeTruthy();
  });
});

/**
 * Hub Nutrition (`app/(tabs)/nutrition.tsx`) — le **vrai** écran, monté.
 *
 * Réécrit par US NUTRI-UX03 (trois onglets). Ce qui est vérifié porte sur ce que l'écran **décide** :
 *
 *  1. **Aujourd'hui est toujours aujourd'hui** (D4) : plus de flèches ni de trame, le journal suit le
 *     jour courant, et le passé s'ouvre sur sa propre page.
 *  2. **L'onglet affiché** (D3) : paramètre lu une fois, sinon le dernier choisi, sinon Aujourd'hui.
 *  3. **Reprendre, Comme hier, repas prévus** (R3, R4, R6) : ce qui accélère la saisie sans l'éloigner.
 *  4. **Le repas type porte un nom saisi** (R5) — plus jamais « Déjeuner ».
 *  5. Et, repris tels quels de NUTRI-UX01/02 : les entrées ORPHELINES ne sont jamais perdues, la
 *     modification d'une quantité recalcule le snapshot, deux types d'entrée ont deux formulaires, les
 *     micros ne mentent pas.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import NutritionScreen from '../nutrition';
import {
  copyMeal,
  duplicateDay,
  moveEntry,
  reassignEntryMeal,
  removeEntry,
  updateEntry,
  useDayEntries,
  useEntriesBetween,
  useMonthTotals,
} from '@/data/repositories/journal-repository';
import { consumePlannedEntry, useDayMealPlan } from '@/data/repositories/meal-plan-repository';
import { saveMealAsTemplate } from '@/data/repositories/meal-template-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useDayCalorieTarget } from '@/data/repositories/dashboard-repository';
import { useRealLifePeriods } from '@/data/repositories/real-life-repository';
import { useRecentFoods } from '@/data/repositories/food-repository';
import { useCurrentHour, useTodayKey } from '@/hooks/useTodayKey';
import { useNutritionSection } from '@/stores/nutrition-section-store';
import { DEFAULT_TRACKED_MICROS, useTrackedMicros } from '@/stores/tracked-micros';
import { useLocalSearchParams, useRouter, useScrollToTop } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/journal-repository', () => ({
  useDayEntries: jest.fn(() => ({ entries: [] })),
  removeEntry: jest.fn(),
  updateEntry: jest.fn(),
  moveEntry: jest.fn(),
  reassignEntryMeal: jest.fn(),
  duplicateDay: jest.fn(),
  copyMeal: jest.fn(),
  addFoodEntry: jest.fn(),
  // La ligne « … n'a rien de saisi » lit les totaux des six derniers jours.
  useMonthTotals: jest.fn(() => ({ totals: [], isLoading: false })),
  // US NUTRI-UX03 — les 60 jours de « Reprendre un repas ».
  useEntriesBetween: jest.fn(() => ({ rows: [], isLoading: false })),
  useDayQuality: jest.fn(() => ({
    quality: { fiber: 0, sugars: 0, saturatedFat: 0, coverageRatio: 0 },
    isLoading: false,
  })),
}));
jest.mock('@/data/repositories/meal-plan-repository', () => ({
  useDayMealPlan: jest.fn(() => ({ entries: [], isLoading: false })),
  consumePlannedEntry: jest.fn(),
}));
jest.mock('@/data/repositories/water-repository', () => ({
  useDayWater: jest.fn(() => ({ totalMl: 0, isLoading: false })),
  addWater: jest.fn(),
  removeLastWater: jest.fn(),
}));
jest.mock('@/data/repositories/food-catalog-repository', () => ({
  useHabitFoods: jest.fn(() => ({ entries: [], isLoading: false })),
  useCatalogSearch: jest.fn(() => ({ entries: [], isLoading: false })),
  useRecentFoodIds: jest.fn(() => []),
  getLastQuantityFor: jest.fn(() => Promise.resolve(null)),
  SEARCH_RESULT_LIMIT: 40,
}));
jest.mock('@/data/repositories/meal-template-repository', () => ({
  saveMealAsTemplate: jest.fn(),
}));
jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: jest.fn(() => ({ profile: null })),
}));
jest.mock('@/data/repositories/nutrition-repository', () => ({
  useNutritionProfile: jest.fn(() => ({ nutritionProfile: null })),
}));
jest.mock('@/data/repositories/dashboard-repository', () => ({
  useDayCalorieTarget: jest.fn(),
}));
jest.mock('@/data/repositories/real-life-repository', () => ({
  useRealLifePeriods: jest.fn(() => ({ periods: [] })),
}));
jest.mock('@/data/repositories/food-repository', () => ({
  useRecentFoods: jest.fn(() => ({ foods: [] })),
  // US NUTRI-UX02 — la feuille d'ajout sait dire « la bibliothèque n'est pas arrivée ». Ici elle l'est.
  useLibraryPresence: jest.fn(() => ({ count: 3244, isLoading: false, isEmpty: false })),
  // US NUTR-F2 — vivier de repli. Vide par défaut : ces tests ne portent pas sur la suggestion.
  useDenseFoodCandidates: jest.fn(() => ({ foods: [], isLoading: false })),
}));
jest.mock('@/hooks/useTodayKey', () => ({
  useTodayKey: jest.fn(),
  // NUTRI-UX01 (R2.6) : le repas se déduit de l'heure. 12 h → déjeuner.
  useCurrentHour: jest.fn(() => 12),
}));
jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));

/** Le balayage n'est pas rejouable hors device : on rend directement la ligne ET ses actions. */
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({
      children,
      renderRightActions,
    }: {
      children: React.ReactNode;
      renderRightActions: () => React.ReactNode;
    }) => (
      <View>
        {children}
        {renderRightActions()}
      </View>
    ),
  };
});

jest.mock('@/components/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      label,
      onPress,
      disabled,
    }: {
      label: string;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
      >
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});
jest.mock('@/components/TextField', () => {
  const { TextInput } = require('react-native');
  return {
    TextField: ({
      label,
      value,
      onChangeText,
    }: {
      label: string;
      value: string;
      onChangeText: (v: string) => void;
    }) => <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} />,
  };
});
jest.mock('@/components/MicronutrientDetails', () => ({ MicronutrientDetails: () => null }));
jest.mock('@/components/nutrition/MicroCoverageGrid', () => {
  const { Text } = require('react-native');
  return {
    MicroCoverageGrid: ({ cells }: { cells: { key: string; value: string }[] }) => (
      <Text>micros:{cells.map((c) => `${c.key}=${c.value}`).join(',')}</Text>
    ),
  };
});
jest.mock('@/components/nutrition/MacroSuggestionCard', () => {
  const { Text } = require('react-native');
  return { MacroSuggestionCard: () => <Text>suggestion</Text> };
});

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});

// Les cartes qui tirent toute la chaîne des repositories ont leurs propres tests.
jest.mock('@/components/energy/DayEnergyCard', () => ({ DayEnergyCard: () => null }));
jest.mock('@/components/nutrition/FuelTankCard', () => ({ FuelTankCard: () => null }));
// US NUTRI-UX03 — Historique et Progrès ont leurs propres tests ; ici on vérifie qu'ils s'affichent
// au bon onglet et qu'ils reçoivent ce que l'écran leur doit.
jest.mock('@/components/nutrition/sections/HistorySection', () => ({
  HistorySection: ({ mealOfHour, onToday }: { mealOfHour: string; onToday: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable onPress={onToday} accessibilityRole="button">
        <Text>{`historique:${mealOfHour}`}</Text>
      </Pressable>
    );
  },
}));
jest.mock('@/components/nutrition/sections/ProgressSection', () => ({
  ProgressSection: () => {
    const { Text } = require('react-native');
    return <Text>progres</Text>;
  },
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
  useScrollToTop: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    // US DASH-01 : `stageTheme(pilier, scheme)` lit le schéma — sans lui, la scène n'a pas de teinte.
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#fffaf2',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      borderStrong: '#d9c8b0',
      track: '#ece0cd',
      panel: '#33291f',
      panelText: '#ffffff',
      accent: '#c0562f',
      accentText: '#ffffff',
      danger: '#b23b2e',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockEntries = useDayEntries as jest.Mock;
const mockRemove = removeEntry as jest.Mock;
const mockUpdate = updateEntry as jest.Mock;
const mockMove = moveEntry as jest.Mock;
const mockReassign = reassignEntryMeal as jest.Mock;
const mockDuplicateDay = duplicateDay as jest.Mock;
const mockCopyMeal = copyMeal as jest.Mock;
const mockBetween = useEntriesBetween as jest.Mock;
const mockMonthTotals = useMonthTotals as jest.Mock;
const mockPlan = useDayMealPlan as jest.Mock;
const mockConsume = consumePlannedEntry as jest.Mock;
const mockSaveTemplate = saveMealAsTemplate as jest.Mock;
const mockProfile = useProfile as jest.Mock;
const mockNutritionProfile = useNutritionProfile as jest.Mock;
const mockTarget = useDayCalorieTarget as jest.Mock;
const mockRealLife = useRealLifePeriods as jest.Mock;
const mockRecent = useRecentFoods as jest.Mock;
const mockToday = useTodayKey as jest.Mock;
const mockHour = useCurrentHour as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockParams = useLocalSearchParams as jest.Mock;
const mockScrollToTop = useScrollToTop as jest.Mock;

const push = jest.fn();
const setParams = jest.fn();

const AUJOURDHUI = '2026-08-12';
const HIER = '2026-08-11';

const entree = (overrides: Record<string, unknown> = {}) => ({
  id: 'e-1',
  mealType: 'breakfast',
  foodId: 'f-1',
  name: 'Banane',
  quantityG: 100,
  kcal: 90,
  proteinG: 1,
  carbsG: 23,
  fatG: 0,
  micronutrients: {},
  createdAt: '2026-08-12T07:30:00.000Z',
  ...overrides,
});

/** Une ligne d'historique pour « Reprendre un repas » (R3). */
const passe = (logDate: string, mealType: string, name: string, orderIndex = 0) => ({
  logDate,
  mealType,
  foodId: `f-${name}`,
  name,
  kcal: 200,
  orderIndex,
});

const prevu = (overrides: Record<string, unknown> = {}) => ({
  id: 'p-1',
  planDate: AUJOURDHUI,
  mealKey: 'dinner',
  orderIndex: 0,
  sourceType: 'recipe',
  recipeId: 'r-1',
  templateId: null,
  foodId: null,
  quantityG: null,
  servings: 1,
  label: 'Poulet basquaise',
  kcal: 640,
  proteinG: 40,
  carbsG: 70,
  fatG: 18,
  consumedAt: null,
  ...overrides,
});

const afficher = async ({
  entries = [] as unknown[],
  hier = [] as unknown[],
  aujourdhui = AUJOURDHUI,
}: { entries?: unknown[]; hier?: unknown[]; aujourdhui?: string } = {}) => {
  mockToday.mockReturnValue(aujourdhui);
  // Deux lectures du journal : aujourd'hui, et la veille (« Comme hier », R4).
  mockEntries.mockImplementation((date: string) => ({ entries: date === aujourdhui ? entries : hier }));
  await render(<NutritionScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const saisir = async (label: string, valeur: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText(label), valeur);
  });
};

/**
 * Le grand chiffre, **espaces de groupement normalisés** : `AnimatedNumber` formate avec le
 * séparateur de la locale (une espace fine insécable en français).
 */
const kcalAffichees = () =>
  (screen.getByTestId('stage-kcal', { includeHiddenElements: true }).props.defaultValue as string)
    .replace(/[  \s]/g, ' ');

/** Ouvre le détail d'une entrée par un appui simple sur sa ligne. */
const ouvrirDetail = async (nom: string) => {
  await taper(screen.getByText(nom));
};

let boutonsAlerte: { text?: string; style?: string; onPress?: () => void }[] = [];
let titreAlerte: string | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  useTrackedMicros.setState({ tracked: DEFAULT_TRACKED_MICROS, hydrated: true });
  // Le store de l'onglet est un singleton en mémoire : chaque test repart d'un lancement à froid.
  useNutritionSection.setState({ section: null, historyMonth: null, historyTab: 'days', habitsMeal: null });
  jest.useFakeTimers();
  jest.setSystemTime(new Date(`${AUJOURDHUI}T10:00:00`));
  boutonsAlerte = [];
  titreAlerte = undefined;
  jest.spyOn(Alert, 'alert').mockImplementation((titre, _m, boutons) => {
    titreAlerte = titre;
    boutonsAlerte = (boutons ?? []) as typeof boutonsAlerte;
  });
  mockUseRouter.mockReturnValue({ push, setParams });
  mockParams.mockReturnValue({});
  mockHour.mockReturnValue(12);
  mockProfile.mockReturnValue({ profile: null });
  mockNutritionProfile.mockReturnValue({ nutritionProfile: null });
  mockRealLife.mockReturnValue({ periods: [] });
  mockRecent.mockReturnValue({ foods: [] });
  mockBetween.mockReturnValue({ rows: [], isLoading: false });
  mockMonthTotals.mockReturnValue({ totals: [], isLoading: false });
  mockPlan.mockReturnValue({ entries: [], isLoading: false });
  mockTarget.mockReturnValue({
    effectiveTarget: 2000,
    trainingBonus: 0,
    bonusSource: 'none',
    isTrainingDay: false,
    isLoading: false,
  });
  mockDuplicateDay.mockResolvedValue(3);
  mockCopyMeal.mockResolvedValue(2);
  mockConsume.mockResolvedValue(1);
  mockSaveTemplate.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
  // Les vraies écritures renvoient une promesse, que l'écran capture (`.catch`) : les simulations aussi.
  mockRemove.mockResolvedValue(undefined);
  mockMove.mockResolvedValue(undefined);
  mockReassign.mockResolvedValue(undefined);
});

afterEach(() => {
  // 🔴 Purger les timers AVANT de repasser en horloge réelle : la feuille d'ajout arme un
  // `setTimeout` de debounce, qui se déclencherait au test suivant, hors de tout `act()`.
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Aujourd'hui, toujours (D4)
// ---------------------------------------------------------------------------

describe('Aujourd’hui est toujours aujourd’hui (D4)', () => {
  it('ouvre sur aujourd’hui, nommé en tête du remplissage', async () => {
    await afficher();

    expect(mockEntries).toHaveBeenCalledWith(AUJOURDHUI);
    expect(screen.getByText(/nutritionHub\.eyebrow/)).toBeTruthy();
  });

  it('🔴 plus de flèches ni de trame : on ne note plus par mégarde sur un autre jour', async () => {
    await afficher();

    expect(screen.queryByLabelText('journal.prevDay')).toBeNull();
    expect(screen.queryByLabelText('journal.nextDay')).toBeNull();
    expect(screen.queryByTestId('back-to-today')).toBeNull();
  });

  it('🔴 au passage de minuit, le journal suit le jour courant', async () => {
    await afficher();

    mockToday.mockReturnValue('2026-08-13');
    await act(async () => {
      await screen.rerender(<NutritionScreen />);
    });

    // Sans ce suivi, l'app rouverte au petit-déjeuner ajouterait les aliments à la veille.
    expect(mockEntries).toHaveBeenCalledWith('2026-08-13');
    expect(mockTarget).toHaveBeenLastCalledWith('2026-08-13');
  });

  it('le jour sans saisie ouvre SA page, au lieu de faire basculer le hub', async () => {
    // Six jours passés, un seul saisi : la ligne nomme le plus récent des trous (le 11).
    mockMonthTotals.mockReturnValue({ totals: [{ logDate: '2026-08-10', kcal: 2100 }], isLoading: false });
    await afficher();

    await taper(screen.getByText(/stage\.nutrition\.missingDay/));

    expect(push).toHaveBeenCalledWith({ pathname: '/nutrition-day', params: { date: HIER } });
  });

  it('🔴 la cible est demandée pour aujourd’hui', async () => {
    await afficher({ entries: [entree()] });

    expect(mockTarget).toHaveBeenLastCalledWith(AUJOURDHUI);
  });
});

// ---------------------------------------------------------------------------
// Les onglets (D1 à D3)
// ---------------------------------------------------------------------------

describe('les trois onglets', () => {
  it('🔴 démarrage à froid : Aujourd’hui — le geste de vingt fois par jour, pas les analyses', async () => {
    await afficher({ entries: [entree()] });

    expect(screen.getByTestId('nutrition-tab-today').props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('nutritionHub.sections.history')).toBeTruthy();
    expect(screen.getByText('nutritionHub.sections.progress')).toBeTruthy();
    expect(screen.queryByText('progres')).toBeNull();
  });

  it('Historique remplace la journée, et reçoit le repas de l’heure', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getByTestId('nutrition-tab-history'));

    expect(screen.getByText('historique:lunch')).toBeTruthy();
    expect(screen.queryByText('journal.dayCard.title')).toBeNull();
    // Le remplissage est propre à Aujourd'hui : l'en-tête redevient compact.
    expect(screen.queryByTestId('stage-kcal', { includeHiddenElements: true })).toBeNull();
  });

  it('Progrès : l’ancienne « La semaine »', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getByTestId('nutrition-tab-progress'));

    expect(screen.getByText('progres')).toBeTruthy();
    expect(screen.queryByText('Banane')).toBeNull();
  });

  it('🔴 le dernier onglet choisi est rouvert — rien ne change d’onglet de force', async () => {
    useNutritionSection.setState({ section: 'progress' });
    await afficher({ entries: [entree()] });

    expect(screen.getByText('progres')).toBeTruthy();
  });

  it('🔴 un paramètre `section` est lu UNE fois, puis effacé', async () => {
    mockParams.mockReturnValue({ section: 'history' });
    await afficher();

    expect(screen.getByText('historique:lunch')).toBeTruthy();
    expect(useNutritionSection.getState().section).toBe('history');
    // Laissé en place, il s'appliquerait à chaque retour sur l'onglet.
    expect(setParams).toHaveBeenCalledWith({ section: undefined });
  });

  it('un retour à Aujourd’hui depuis Historique rouvre la journée', async () => {
    await afficher({ entries: [entree()] });
    await taper(screen.getByTestId('nutrition-tab-history'));

    await taper(screen.getByText('historique:lunch'));

    expect(screen.getByText('Banane')).toBeTruthy();
  });

  it('D2 — un nouvel appui sur l’onglet Alim ramène en haut', async () => {
    await afficher();

    // La référence passée à `useScrollToTop` doit être celle du défilement RÉEL de la page : une
    // référence jamais branchée ferait passer un simple « a été appelé ».
    const ref = mockScrollToTop.mock.calls[0]![0] as { current: unknown };
    expect(ref.current).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// L'en-tête (D8)
// ---------------------------------------------------------------------------

describe('l’en-tête', () => {
  it('s’appelle « Alimentation » (Q7)', async () => {
    await afficher();

    expect(screen.getByText('nutritionHub.title')).toBeTruthy();
  });

  it.each([
    ['nutritionHub.icons.planning', '/meal-plan'],
    ['nutritionHub.icons.settings', '/nutrition-profile'],
  ])('%s ouvre %s', async (label, route) => {
    await afficher();

    await taper(screen.getByLabelText(label));
    expect(push).toHaveBeenCalledWith(route);
  });

  it('🔴 l’icône Statistiques quitte l’en-tête — le lien vit en bas de Progrès', async () => {
    await afficher();

    expect(screen.queryByLabelText('stats.title')).toBeNull();
  });

  it('Scanner est à côté de « Chercher un aliment », sur le repas de l’heure', async () => {
    await afficher();

    await taper(screen.getByLabelText('scan.title'));
    expect(push).toHaveBeenCalledWith({ pathname: '/food-scan', params: { date: AUJOURDHUI, meal: 'lunch' } });
  });

  it.each([
    ['journal.tabs.recipes', { pathname: '/food-picker', params: { tab: 'recipes' } }],
    ['journal.tabs.templates', { pathname: '/food-picker', params: { tab: 'templates' } }],
    ['journal.tabs.favorites', { pathname: '/food-picker', params: { tab: 'favorites' } }],
    ['meals.manage', '/nutrition-meals'],
  ])('la Bibliothèque ouvre %s', async (label, route) => {
    await afficher();

    await taper(screen.getByLabelText('nutritionHub.icons.library'));
    await taper(screen.getByLabelText(label));

    expect(push).toHaveBeenCalledWith(route);
  });

  it('🔴 la carte Planning du bas a disparu (D7)', async () => {
    await afficher({ entries: [entree()] });

    expect(screen.queryByLabelText('mealPlan.title')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Reprendre un repas (R3)
// ---------------------------------------------------------------------------

describe('Reprendre un repas (R3)', () => {
  const historique = [
    passe('2026-08-11', 'lunch', 'Poulet', 0),
    passe('2026-08-11', 'lunch', 'Riz', 1),
    passe('2026-08-10', 'lunch', 'Lentilles', 0),
    passe('2026-08-09', 'lunch', 'Poulet', 0),
    passe('2026-08-09', 'lunch', 'Riz', 1),
    passe('2026-08-11', 'breakfast', 'Skyr', 0),
  ];

  it('à midi, les derniers déjeuners différents', async () => {
    mockBetween.mockReturnValue({ rows: historique, isLoading: false });
    await afficher();

    expect(screen.getByText('nutritionHub.repeat.title.lunch')).toBeTruthy();
    expect(screen.getByText('Poulet, Riz')).toBeTruthy();
    expect(screen.getByText('Lentilles')).toBeTruthy();
    // Deux fois le même déjeuner : une ligne, et le compte le dit.
    expect(screen.getByText(/"count":2/)).toBeTruthy();
    expect(screen.queryByText('Skyr')).toBeNull();
  });

  it('🔴 la fenêtre est de 60 jours, aujourd’hui exclu', async () => {
    await afficher();

    expect(mockBetween).toHaveBeenCalledWith('2026-06-13', HIER);
  });

  it('Reprendre copie CETTE occurrence dans le repas de l’heure, aujourd’hui', async () => {
    mockBetween.mockReturnValue({ rows: historique, isLoading: false });
    await afficher();

    await taper(screen.getAllByText('nutritionHub.repeat.action')[1]!);

    expect(mockCopyMeal).toHaveBeenCalledWith('2026-08-10', 'lunch', AUJOURDHUI);
  });

  it('🔴 un double appui n’écrit qu’une fois', async () => {
    let finir: () => void = () => undefined;
    mockCopyMeal.mockImplementation(() => new Promise<number>((r) => (finir = () => r(2))));
    mockBetween.mockReturnValue({ rows: historique, isLoading: false });
    await afficher();

    const bouton = screen.getAllByText('nutritionHub.repeat.action')[0]!;
    await taper(bouton);
    await taper(bouton);
    await act(async () => finir());

    expect(mockCopyMeal).toHaveBeenCalledTimes(1);
  });

  it('🔴 masqué dès que le repas de l’heure a une entrée', async () => {
    mockBetween.mockReturnValue({ rows: historique, isLoading: false });
    await afficher({ entries: [entree({ mealType: 'lunch' })] });

    expect(screen.queryByText('nutritionHub.repeat.title.lunch')).toBeNull();
  });

  it('masqué quand le repas de l’heure n’est pas dans la configuration', async () => {
    mockNutritionProfile.mockReturnValue({
      nutritionProfile: { meals: [{ key: 'breakfast' }, { key: 'dinner' }] },
    });
    mockBetween.mockReturnValue({ rows: historique, isLoading: false });
    await afficher();

    expect(screen.queryByText('nutritionHub.repeat.title.lunch')).toBeNull();
  });

  it('« Tous tes repas habituels » ouvre Historique sur ce repas', async () => {
    mockBetween.mockReturnValue({ rows: historique, isLoading: false });
    await afficher();

    await taper(screen.getByText('nutritionHub.repeat.allHabits'));

    expect(useNutritionSection.getState()).toMatchObject({
      section: 'history',
      historyTab: 'habits',
      habitsMeal: 'lunch',
    });
  });

  it('une ligne ouvre la page de ce jour', async () => {
    mockBetween.mockReturnValue({ rows: historique, isLoading: false });
    await afficher();

    await taper(screen.getByText('Lentilles'));

    expect(push).toHaveBeenCalledWith({ pathname: '/nutrition-day', params: { date: '2026-08-10' } });
  });
});

// ---------------------------------------------------------------------------
// Journée vide, Comme hier (R4), repas prévus (R6)
// ---------------------------------------------------------------------------

describe('journée vide', () => {
  it('🔴 rien à proposer (ni hier, ni planning) : l’état vide, avec l’eau', async () => {
    await afficher();

    expect(screen.getByTestId('nutrition-empty-day')).toBeTruthy();
    expect(screen.getByText('nutritionHub.emptyDay.body')).toBeTruthy();
    // On boit avant de manger : la ligne d'eau reste dans l'état vide (§4.2-4).
    expect(screen.getByTestId('hydration-compact')).toBeTruthy();
    // Son ancien bouton « Copier toute la journée d'hier » n'avait rien à copier.
    expect(screen.queryByText('journal.copyDayYesterday')).toBeNull();
    expect(screen.queryByText('journal.meals.breakfast')).toBeNull();
  });

  it('🔴 la veille remplie : les repas s’affichent, avec « Comme hier » et la copie de la journée', async () => {
    await afficher({ hier: [entree({ id: 'h-1', mealType: 'breakfast', kcal: 450 })] });

    expect(screen.queryByTestId('nutrition-empty-day')).toBeNull();
    expect(screen.getByText('journal.meals.breakfast')).toBeTruthy();
    expect(
      screen.getByLabelText('nutritionHub.likeYesterdayA11y:{"meal":"journal.meals.breakfast","kcal":"450"}'),
    ).toBeTruthy();
    expect(screen.getByText('journal.copyDayYesterday')).toBeTruthy();
  });

  it('copier la journée d’hier copie la VEILLE vers aujourd’hui', async () => {
    await afficher({ hier: [entree({ id: 'h-1' })] });

    await taper(screen.getByText('journal.copyDayYesterday'));

    expect(mockDuplicateDay).toHaveBeenCalledWith(HIER, AUJOURDHUI);
  });

  it('🔴 aucune suggestion de macro sur une journée vide', async () => {
    await afficher();

    expect(screen.queryByText('suggestion')).toBeNull();
  });

  it('la suggestion apparaît dès qu’il y a des entrées', async () => {
    await afficher({ entries: [entree()] });

    expect(screen.getByText('suggestion')).toBeTruthy();
  });
});

describe('Comme hier (R4)', () => {
  it('reprend le MÊME repas de la veille, sur aujourd’hui', async () => {
    await afficher({
      entries: [entree({ mealType: 'breakfast' })],
      hier: [entree({ id: 'h-1', mealType: 'lunch', kcal: 635 })],
    });

    await taper(screen.getByText('nutritionHub.likeYesterday'));

    expect(mockCopyMeal).toHaveBeenCalledWith(HIER, 'lunch', AUJOURDHUI);
  });

  it('🔴 un double appui sur « Comme hier » ne copie qu’une fois', async () => {
    let finir: () => void = () => undefined;
    mockCopyMeal.mockImplementation(() => new Promise<number>((r) => (finir = () => r(1))));
    await afficher({
      entries: [entree({ mealType: 'breakfast' })],
      hier: [entree({ id: 'h-1', mealType: 'lunch' })],
    });

    const bouton = screen.getByText('nutritionHub.likeYesterday');
    await taper(bouton);
    await taper(bouton);
    await act(async () => finir());

    expect(mockCopyMeal).toHaveBeenCalledTimes(1);
  });

  it('🔴 jamais sur un repas déjà rempli : il le doublerait', async () => {
    await afficher({
      entries: [entree({ mealType: 'breakfast' })],
      hier: [entree({ id: 'h-1', mealType: 'breakfast' })],
    });

    expect(screen.queryByText('nutritionHub.likeYesterday')).toBeNull();
  });

  it('absent quand la veille n’a pas ce repas', async () => {
    await afficher({ entries: [entree()], hier: [entree({ id: 'h-1', mealType: 'dinner' })] });

    expect(screen.getAllByText('nutritionHub.likeYesterday')).toHaveLength(1);
    expect(
      screen.getByLabelText(/nutritionHub\.likeYesterdayA11y:\{"meal":"journal\.meals\.dinner"/),
    ).toBeTruthy();
  });
});

describe('repas prévus (R6)', () => {
  it('un repas prévu s’affiche sous son repas, même sur une journée vide', async () => {
    mockPlan.mockReturnValue({ entries: [prevu()], isLoading: false });
    await afficher();

    expect(screen.queryByTestId('nutrition-empty-day')).toBeNull();
    expect(screen.getByText('nutritionHub.planned.eyebrow')).toBeTruthy();
    expect(screen.getByText('Poulet basquaise')).toBeTruthy();
  });

  it('« J’ai mangé ça » le porte au journal', async () => {
    mockPlan.mockReturnValue({ entries: [prevu()], isLoading: false });
    await afficher();

    await taper(
      screen.getByLabelText('nutritionHub.planned.eatA11y:{"name":"Poulet basquaise","meal":"journal.meals.dinner"}'),
    );

    expect(mockConsume).toHaveBeenCalledWith('p-1');
  });

  it('🔴 un double appui sur « J’ai mangé ça » ne porte qu’une fois', async () => {
    let finir: () => void = () => undefined;
    mockConsume.mockImplementation(() => new Promise<number>((r) => (finir = () => r(1))));
    mockPlan.mockReturnValue({ entries: [prevu()], isLoading: false });
    await afficher();

    const bouton = screen.getByText('nutritionHub.planned.eat');
    await taper(bouton);
    await taper(bouton);
    await act(async () => finir());

    expect(mockConsume).toHaveBeenCalledTimes(1);
  });

  it('🔴 l’ajout manuel reste disponible à côté (Q3)', async () => {
    mockPlan.mockReturnValue({ entries: [prevu()], isLoading: false });
    await afficher();

    expect(screen.getByLabelText('journal.meals.dinner · journal.addFood')).toBeTruthy();
  });

  it('un repas déjà porté, ou d’un repas supprimé de la configuration, n’est pas montré', async () => {
    mockPlan.mockReturnValue({
      entries: [
        prevu({ id: 'p-1', consumedAt: '2026-08-12T19:00:00.000Z' }),
        prevu({ id: 'p-2', mealKey: 'custom-supprime', label: 'Brunch' }),
      ],
      isLoading: false,
    });
    await afficher({ entries: [entree()] });

    expect(screen.queryByText('Poulet basquaise')).toBeNull();
    expect(screen.queryByText('Brunch')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Repas et entrées
// ---------------------------------------------------------------------------

describe('repas', () => {
  it('un repas vide propose l’ajout, sans total', async () => {
    await afficher({ entries: [entree({ mealType: 'lunch', kcal: 430 })] });

    expect(screen.getByLabelText('journal.meals.breakfast · journal.addFood')).toBeTruthy();
    // 430 s'affiche deux fois — le total du déjeuner et sa ligne — et aucun « 0 » : le petit-déjeuner
    // vide ne porte pas de total.
    expect(screen.getAllByText(/^430/)).toHaveLength(2);
    expect(screen.queryByText(/^0( |$)/)).toBeNull();
  });

  it('chaque entrée affiche ses propres calories', async () => {
    await afficher({
      entries: [
        entree({ id: 'a', name: 'Banane', kcal: 90 }),
        entree({ id: 'b', name: 'Pain', kcal: 210 }),
      ],
    });

    expect(screen.getByText('90 nutrition.kcal')).toBeTruthy();
    expect(screen.getByText('210 nutrition.kcal')).toBeTruthy();
  });

  it('ajouter depuis un repas ouvre la feuille SUR ce repas', async () => {
    await afficher({ entries: [entree({ mealType: 'lunch' })] });

    await taper(screen.getByLabelText('journal.meals.breakfast · journal.addFood'));

    expect(screen.getByText('journal.addSheet.title:{"meal":"journal.meals.breakfast"}')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it('« Chercher un aliment » ouvre la feuille sur le repas de l’heure', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getByLabelText('stage.nutrition.search'));

    expect(screen.getByText('journal.addSheet.title:{"meal":"journal.meals.lunch"}')).toBeTruthy();
  });

  it('🔴 les entrées ORPHELINES remontent dans « Autres »', async () => {
    await afficher({
      entries: [entree({ id: 'orp', mealType: 'custom-supprime', name: 'Reste de pizza' })],
    });

    expect(screen.getByText('journal.meals.other')).toBeTruthy();
    expect(screen.getByText('Reste de pizza')).toBeTruthy();
  });

  it('🔴 la section « Autres » ne propose PAS d’ajout', async () => {
    await afficher({ entries: [entree({ mealType: 'custom-supprime' })] });

    expect(screen.queryByLabelText('journal.meals.other · journal.addFood')).toBeNull();
  });

  it('le menu du repas est replié par défaut', async () => {
    await afficher({ entries: [entree()] });

    expect(screen.queryByText('journal.saveMeal')).toBeNull();
    expect(
      screen.getByLabelText('journal.mealMenu:{"meal":"journal.meals.breakfast"}').props.accessibilityState.expanded,
    ).toBe(false);
  });

  it('🔴 le ⋯ ne propose plus « Copier d’hier » : il doublait un repas déjà rempli', async () => {
    await afficher({ entries: [entree()], hier: [entree({ id: 'h-1' })] });

    await taper(screen.getByLabelText('journal.mealMenu:{"meal":"journal.meals.breakfast"}'));

    expect(screen.getByText('journal.saveMeal')).toBeTruthy();
    expect(screen.queryByText(/copyYesterday/)).toBeNull();
  });
});

describe('repas type (R5, décision Q6)', () => {
  const ouvrirFeuille = async () => {
    await afficher({ entries: [entree({ name: 'Banane', quantityG: 120, kcal: 108 })] });
    await taper(screen.getByLabelText('journal.mealMenu:{"meal":"journal.meals.breakfast"}'));
    await taper(screen.getByText('journal.saveMeal'));
  };

  it('🔴 le nom est OBLIGATOIRE : rien n’est enregistré sans lui', async () => {
    await ouvrirFeuille();

    expect(screen.getByTestId('save-template-sheet')).toBeTruthy();
    const enregistrer = screen.getByLabelText('nutritionHub.template.save');
    expect(enregistrer.props.accessibilityState.disabled).toBe(true);
    await taper(enregistrer);
    expect(mockSaveTemplate).not.toHaveBeenCalled();
  });

  it('🔴 des espaces ne font pas un nom', async () => {
    await ouvrirFeuille();

    await saisir('nutritionHub.template.label', '   ');

    expect(screen.getByLabelText('nutritionHub.template.save').props.accessibilityState.disabled).toBe(true);
  });

  it('enregistre sous le nom saisi, rogné, avec les entrées du repas', async () => {
    await ouvrirFeuille();

    await saisir('nutritionHub.template.label', '  Petit-déj du matin ');
    await taper(screen.getByLabelText('nutritionHub.template.save'));

    // Avant : le repas type s'appelait « Déjeuner », comme tous les autres déjeuners enregistrés.
    expect(mockSaveTemplate).toHaveBeenCalledWith('Petit-déj du matin', [
      expect.objectContaining({ name: 'Banane', quantityG: 120, kcal: 108 }),
    ]);
  });

  it('annuler n’enregistre rien', async () => {
    await ouvrirFeuille();

    await taper(screen.getByLabelText('common.cancel'));

    expect(screen.queryByTestId('save-template-sheet')).toBeNull();
    expect(mockSaveTemplate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------

describe('suppression', () => {
  it('🔴 demande confirmation en NOMMANT l’aliment', async () => {
    await afficher({ entries: [entree({ name: 'Banane' })] });

    await taper(screen.getAllByLabelText('journal.delete')[0]!);

    // Le nom est le seul repère quand cinq lignes se ressemblent dans un même repas.
    expect(titreAlerte).toBe('Banane');
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('confirmer supprime', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getAllByLabelText('journal.delete')[0]!);
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'journal.delete')?.onPress?.();
    });

    expect(mockRemove).toHaveBeenCalledWith('e-1');
  });

  it('annuler ne supprime rien', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getAllByLabelText('journal.delete')[0]!);
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'common.cancel')?.onPress?.();
    });

    expect(mockRemove).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Détail d'une entrée
// ---------------------------------------------------------------------------

describe('détail d’une entrée', () => {
  it('un appui ouvre le détail en CONSULTATION', async () => {
    await afficher({ entries: [entree()] });

    await ouvrirDetail('Banane');

    // Consultation par défaut : ouvrir en édition ferait surgir un clavier à chaque coup d'œil.
    expect(screen.getByLabelText('journal.detail.edit')).toBeTruthy();
    expect(screen.queryByLabelText('journal.grams')).toBeNull();
  });

  it('le balayage « modifier » ouvre DIRECTEMENT en édition', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);

    // C'est tout l'intérêt du geste : deux appuis de moins pour corriger une quantité.
    expect(screen.getByLabelText('journal.grams')).toBeTruthy();
  });

  it('🔴 modifier la quantité RECALCULE le snapshot par règle de trois', async () => {
    await afficher({
      entries: [entree({ quantityG: 100, kcal: 90, proteinG: 1, carbsG: 23, fatG: 0 })],
    });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);
    await saisir('journal.grams', '150');
    await taper(screen.getByLabelText('journal.detail.save'));

    // Les macros sont FIGÉES à la saisie : les recalculer à l'affichage ferait bouger l'historique
    // à chaque mise à jour de la base CIQUAL.
    expect(mockUpdate).toHaveBeenCalledWith(
      'e-1',
      expect.objectContaining({ quantityG: 150, kcal: 135, carbsG: 35 }),
    );
  });

  it('🔴 une quantité à zéro ne peut pas être enregistrée', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);
    await saisir('journal.grams', '0');

    // Enregistrer 0 g créerait une entrée à 0 kcal que rien ne distingue d'un bug de saisie ; la
    // suppression est le geste prévu pour ça.
    expect(screen.getByLabelText('journal.detail.save').props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('🔴 une entrée SANS quantité s’édite en kcal et macros, pas en grammes', async () => {
    await afficher({
      entries: [entree({ quantityG: null, name: 'Resto', kcal: 700 })],
    });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);

    // Un ajout rapide n'a pas de densité : proposer des grammes demanderait une information
    // qui n'a jamais été saisie.
    expect(screen.queryByLabelText('journal.grams')).toBeNull();
    expect(screen.getByLabelText('journal.detail.calories')).toBeTruthy();
    expect(screen.getByLabelText('journal.name')).toBeTruthy();
  });

  it('l’édition libre enregistre le nom et les macros saisis', async () => {
    await afficher({ entries: [entree({ quantityG: null, name: 'Resto', kcal: 700 })] });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);
    await saisir('journal.detail.calories', '850');
    await saisir('journal.name', 'Resto italien');
    await taper(screen.getByLabelText('journal.detail.save'));

    expect(mockUpdate).toHaveBeenCalledWith(
      'e-1',
      expect.objectContaining({ quantityG: null, name: 'Resto italien', kcal: 850 }),
    );
  });

  it('🔴 un nom vidé retombe sur l’ancien', async () => {
    await afficher({ entries: [entree({ quantityG: null, name: 'Resto' })] });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);
    await saisir('journal.name', '   ');
    await taper(screen.getByLabelText('journal.detail.save'));

    // Une ligne sans nom dans le journal est inidentifiable : mieux vaut l'ancien que rien.
    expect(mockUpdate).toHaveBeenCalledWith('e-1', expect.objectContaining({ name: 'Resto' }));
  });

  it('🔴 les macros négatives ou illisibles sont ramenées à zéro', async () => {
    await afficher({ entries: [entree({ quantityG: null })] });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);
    await saisir('journal.detail.calories', '500');
    await saisir(`nutrition.macros.protein (g)`, '-12');
    await taper(screen.getByLabelText('journal.detail.save'));

    // `Math.max(0, …)` : une macro négative fausserait tous les totaux du jour en silence.
    expect(mockUpdate).toHaveBeenCalledWith('e-1', expect.objectContaining({ proteinG: 0 }));
  });

  it('la virgule décimale est acceptée', async () => {
    await afficher({ entries: [entree({ quantityG: 100, kcal: 100 })] });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);
    await saisir('journal.grams', '12,6');
    await taper(screen.getByLabelText('journal.detail.save'));

    // Le pavé décimal FR produit une virgule : la refuser rendrait la saisie impossible.
    expect(mockUpdate).toHaveBeenCalledWith('e-1', expect.objectContaining({ quantityG: 13 }));
  });

  it('annuler l’édition ne modifie rien', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);
    await saisir('journal.grams', '999');
    await taper(screen.getByLabelText('common.cancel'));

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('journal.grams')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Réaffectation et réordonnancement
// ---------------------------------------------------------------------------

describe('réaffectation', () => {
  it('🔴 le repas COURANT n’est pas proposé comme cible', async () => {
    await afficher({ entries: [entree({ mealType: 'breakfast' })] });

    await ouvrirDetail('Banane');

    // « Déplacer vers le petit-déjeuner » depuis le petit-déjeuner est une action sans effet.
    expect(
      screen.queryByLabelText('journal.detail.moveToMeal:{"meal":"journal.meals.breakfast"}'),
    ).toBeNull();
    expect(
      screen.getByLabelText('journal.detail.moveToMeal:{"meal":"journal.meals.lunch"}'),
    ).toBeTruthy();
  });

  it('réaffecter écrit et ferme le détail', async () => {
    await afficher({ entries: [entree()] });

    await ouvrirDetail('Banane');
    await taper(
      screen.getByLabelText('journal.detail.moveToMeal:{"meal":"journal.meals.lunch"}'),
    );

    expect(mockReassign).toHaveBeenCalledWith('e-1', 'lunch');
    expect(screen.queryByLabelText('journal.detail.close')).toBeNull();
  });

  it('🔴 une entrée ORPHELINE peut être récupérée vers un vrai repas', async () => {
    await afficher({ entries: [entree({ mealType: 'custom-supprime' })] });

    await ouvrirDetail('Banane');

    // C'est la seule sortie pour une entrée dont le repas a disparu.
    expect(
      screen.getByLabelText('journal.detail.moveToMeal:{"meal":"journal.meals.breakfast"}'),
    ).toBeTruthy();
  });

  it('🔴 la PREMIÈRE entrée d’un repas ne peut pas monter', async () => {
    await afficher({
      entries: [entree({ id: 'a', name: 'Banane' }), entree({ id: 'b', name: 'Pomme' })],
    });

    await ouvrirDetail('Banane');

    // Le bouton reste affiché mais inerte : le retirer ferait sauter la mise en page selon la
    // position de l'entrée dans son repas.
    expect(screen.getByLabelText('journal.detail.moveUp').props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('la seconde entrée peut monter', async () => {
    await afficher({
      entries: [entree({ id: 'a', name: 'Banane' }), entree({ id: 'b', name: 'Pomme' })],
    });

    await ouvrirDetail('Pomme');
    await taper(screen.getByLabelText('journal.detail.moveUp'));

    expect(mockMove).toHaveBeenCalledWith('b', 'up');
  });

  it('🔴 une entrée SEULE dans son repas n’offre aucun réordonnancement', async () => {
    await afficher({ entries: [entree()] });

    await ouvrirDetail('Banane');

    expect(screen.queryByLabelText('journal.detail.moveUp')).toBeNull();
  });

  it('🔴 le voisinage se calcule DANS le repas, pas dans la journée', async () => {
    await afficher({
      entries: [
        entree({ id: 'a', mealType: 'breakfast', name: 'Banane' }),
        entree({ id: 'b', mealType: 'lunch', name: 'Poulet' }),
      ],
    });

    await ouvrirDetail('Poulet');

    // Sinon « Poulet » se croirait deuxième et proposerait de monter — au-dessus d'une entrée
    // d'un autre repas, ce qui ne veut rien dire.
    expect(screen.queryByLabelText('journal.detail.moveUp')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Objectifs et macros cibles
// ---------------------------------------------------------------------------

describe('objectif du jour', () => {
  it('🔴 les macros MANUELLES priment sur les calculées', async () => {
    mockNutritionProfile.mockReturnValue({
      nutritionProfile: {
        objective: 'maintain',
        manualProteinG: 180,
        manualCarbsG: 200,
        manualFatG: 60,
      },
    });
    await afficher({ entries: [entree()] });

    expect(
      screen.getByLabelText(
        'stage.nutrition.macroA11y:{"macro":"nutrition.macros.protein","value":1,"goal":180}',
      ),
    ).toBeTruthy();
  });

  it('sans profil complet, aucune cible macro n’est inventée', async () => {
    mockTarget.mockReturnValue({
      effectiveTarget: null,
      trainingBonus: 0,
      bonusSource: 'none',
      isTrainingDay: false,
      isLoading: false,
    });
    await afficher({ entries: [entree()] });

    expect(screen.queryByLabelText(/stage\.nutrition\.macroA11y/)).toBeNull();
    expect(screen.getByText('stage.nutrition.noTarget')).toBeTruthy();
  });

  it('🔴 US NUTRI-UX02 — le grand chiffre dit ce qu’il RESTE, et la sous-ligne porte le détail', async () => {
    await afficher({
      entries: [entree({ id: 'a', kcal: 90 }), entree({ id: 'b', kcal: 410 })],
    });

    expect(kcalAffichees()).toBe('1 500');
    expect(screen.getByText('stage.nutrition.stillAvailable')).toBeTruthy();
    expect(screen.getByText('stage.nutrition.detail:{"consumed":500,"target":2000}')).toBeTruthy();
  });

  it('🔴 cible dépassée : le chiffre repasse au consommé, jamais un restant négatif', async () => {
    await afficher({ entries: [entree({ kcal: 2600 })] });

    expect(kcalAffichees()).toBe('2 600');
    expect(screen.getByText('stage.nutrition.over:{"kcal":600}')).toBeTruthy();
  });

  it('🔴 le bonus « jour de séance » ne s’affiche pas pendant le CHARGEMENT', async () => {
    mockTarget.mockReturnValue({
      effectiveTarget: 2300,
      trainingBonus: 300,
      bonusSource: 'forfait',
      isTrainingDay: true,
      isLoading: true,
    });
    await afficher({ entries: [entree()] });

    // Un bonus transitoire qui apparaît puis disparaît fait douter de la valeur affichée à côté.
    expect(kcalAffichees()).toBe('2 210');
    expect(screen.queryByText(/detailWithBonus/)).toBeNull();
    expect(screen.getByText('stage.nutrition.detail:{"consumed":90,"target":2300}')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Micronutriments suivis
// ---------------------------------------------------------------------------

describe('micronutriments suivis', () => {
  it('🔴 R3.3 — six micros sont suivis PAR DÉFAUT', async () => {
    // ⚠️ L'entrée porte de VRAIES valeurs depuis NUTRI-UX02. Le fixture d'origine avait
    // `micronutrients: {}`, et ce test validait donc, sans le dire, l'affichage de six pastilles à
    // « 0,0 mg » — le défaut que cette US corrige. Il faut au moins un micro renseigné pour que la
    // grille ait quelque chose à montrer.
    await afficher({ entries: [entree({ micronutrients: { iron_mg: 2.7 } })] });

    // Le défaut était `[]`, et c'est ce qui rendait invisible le seul vrai différenciateur du
    // pilier : 33 micros CIQUAL avec leurs VNR, que personne ne voyait faute de savoir qu'il
    // fallait aller les cocher au fond d'un écran de réglages.
    const grille = screen.getByText(/^micros:/).children.join('');
    expect(grille).toContain('iron_mg');
    expect(grille).toContain('calcium_mg');
    expect(grille).toContain('vitamin_d_ug');
  });

  it('🔴 US NUTRI-UX02 — aucun micro renseigné : on explique, on n’affiche PAS six zéros', async () => {
    // Le cas de la capture du 17/09/2026 : quatre repas saisis en texte libre, 1957 kcal, et six
    // pastilles à « 0,0 mg ». Ce zéro n'est pas une mesure, c'est l'absence de mesure — et il coûte
    // la confiance dans tous les autres chiffres de l'écran.
    await afficher({ entries: [entree({ micronutrients: {} })] });

    expect(screen.getByTestId('micros-unknown')).toBeTruthy();
    expect(screen.queryByText(/^micros:/)).toBeNull();
  });

  it('un seul micro connu suffit à garder la grille — les autres zéros sont alors VRAIS', async () => {
    // « Tu n'as pas eu de vitamine D aujourd'hui » est une information juste. Le seuil est
    // « aucun », pas « peu » : seul le cas où rien n'est connu ment.
    await afficher({ entries: [entree({ micronutrients: { calcium_mg: 120 } })] });

    expect(screen.getByText(/^micros:/)).toBeTruthy();
    expect(screen.queryByTestId('micros-unknown')).toBeNull();
  });

  it('tout décocher masque la grille — le suivi reste refusable', async () => {
    // Pas d'`act()` ici : le store est modifié **avant** tout rendu, donc aucun composant monté
    // n'y est encore abonné. Un `act()` sans arbre monté laisse l'environnement de test dans un
    // état que les tests suivants paient — c'est ce qui faisait échouer les trois derniers.
    useTrackedMicros.setState({ tracked: [], hydrated: true });
    await afficher({ entries: [entree()] });

    // Ouvrir la porte par défaut ne doit pas la condamner : une liste **vidée** reste vide.
    expect(screen.queryByText(/^micros:/)).toBeNull();
  });
});


describe('carte « Ta journée »', () => {
  it('🔴 UNE carte porte tous les repas, au lieu d’une carte par repas', async () => {
    await afficher({
      entries: [
        entree({ id: 'a', mealType: 'breakfast', name: 'Flocons', kcal: 430 }),
        entree({ id: 'b', mealType: 'dinner', name: 'Saumon', kcal: 646 }),
      ],
    });

    // Cinq cartes de ~150 px pour quatre lignes d'aliments : l'essentiel du défilement était du
    // contenant, et le même bouton s'y répétait cinq fois.
    expect(screen.getByText('journal.dayCard.title')).toBeTruthy();
    expect(screen.getByText('Flocons')).toBeTruthy();
    expect(screen.getByText('Saumon')).toBeTruthy();
  });

  it('🔴 passe 2 — AUCUN bouton d’ajout en toutes lettres : quatre portes pour le même écran', async () => {
    await afficher({
      entries: [
        entree({ id: 'a', mealType: 'breakfast' }),
        entree({ id: 'b', mealType: 'lunch' }),
        entree({ id: 'c', mealType: 'dinner' }),
      ],
    });

    // Il en restait un au pied de la carte, à moins de 200 px du « + » de chaque repas, alors que
    // le bouton blanc de la scène est toujours visible et fait exactement la même chose.
    // Le raccourci par repas, lui, survit en icône — verrouillé par « ajouter depuis un repas
    // ouvre la feuille SUR ce repas », qui presse ce `+` par son libellé d'accessibilité.
    expect(screen.queryAllByText('journal.addFood')).toHaveLength(0);
    expect(screen.getByLabelText('journal.meals.breakfast · journal.addFood')).toBeTruthy();
  });

  it('chaque repas affiche la PART du jour qu’il pèse', async () => {
    await afficher({
      entries: [
        entree({ id: 'a', mealType: 'breakfast', kcal: 300 }),
        entree({ id: 'b', mealType: 'dinner', kcal: 700 }),
      ],
    });

    // NUTR-16 (« répartition par repas ») était livrée mais rangée dans l'écran Stats. Ici elle se
    // lit là où la décision se prend, sans ouvrir quoi que ce soit.
    expect(screen.getByLabelText('journal.mealShareA11y:{"meal":"journal.meals.dinner","pct":70}')).toBeTruthy();
  });
});

/**
 * La page d'un jour passé (`app/nutrition-day.tsx`) — US NUTRI-UX03, §4.5 et R10.
 *
 * Ce que l'écran décide :
 *  1. **Il écrit sur CE jour** : le + d'un repas ouvre la feuille d'ajout sur la date de la page, sans
 *     bandeau « il te reste » (qui ne vaut que pour aujourd'hui).
 *  2. **Reprendre sur aujourd'hui** : un repas (« Aujourd'hui »), ou toute la journée — avec une alerte
 *     si aujourd'hui n'est pas vide, et jamais la section « Autres », qui deviendrait orpheline.
 *  3. **Une date d'aujourd'hui ou à venir** (lien forgé) renvoie sur l'onglet Aujourd'hui.
 *  4. **Rien ne se perd** : l'énergie, les micros et la qualité de ce jour sont là (D15).
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import NutritionDayScreen from '../nutrition-day';
import { useDailyCalorieTargets } from '@/data/repositories/dashboard-repository';
import { copyMeal, useDayEntries } from '@/data/repositories/journal-repository';
import { useTodayKey } from '@/hooks/useTodayKey';
import { useLocalSearchParams, useRouter } from 'expo-router';

jest.mock('@/data/repositories/journal-repository', () => ({
  useDayEntries: jest.fn(),
  copyMeal: jest.fn(),
  removeEntry: jest.fn(),
  moveEntry: jest.fn(),
  reassignEntryMeal: jest.fn(),
  updateEntry: jest.fn(),
}));
jest.mock('@/data/repositories/dashboard-repository', () => ({ useDailyCalorieTargets: jest.fn() }));
jest.mock('@/data/repositories/nutrition-repository', () => ({
  useNutritionProfile: jest.fn(() => ({ nutritionProfile: null })),
}));
jest.mock('@/data/repositories/meal-template-repository', () => ({ saveMealAsTemplate: jest.fn() }));
jest.mock('@/data/repositories/water-repository', () => ({
  useDayWater: jest.fn(() => ({ totalMl: 0, isLoading: false })),
  addWater: jest.fn(),
  removeLastWater: jest.fn(),
}));
jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: jest.fn() }));
jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));
jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/energy/DayEnergyCard', () => ({
  DayEnergyCard: ({ dayKey }: { dayKey: string }) => {
    const { Text } = require('react-native');
    return <Text>{`energie:${dayKey}`}</Text>;
  },
}));
jest.mock('@/components/nutrition/journal/TrackedMicrosRecap', () => {
  const { Text } = require('react-native');
  return {
    TrackedMicrosRecap: () => <Text>micros-du-jour</Text>,
    DayQualitySection: ({ day }: { day: string }) => <Text>{`qualite:${day}`}</Text>,
  };
});
jest.mock('@/components/nutrition/AddFoodSheet', () => ({
  AddFoodSheet: ({ date, mealKey, kcalRemaining }: { date: string; mealKey: string; kcalRemaining: number | null }) => {
    const { Text } = require('react-native');
    return <Text>{`feuille:${date}:${mealKey}:${String(kcalRemaining)}`}</Text>;
  },
}));
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
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
      border: '#e3d3ba',
      borderStrong: '#90897d',
      track: '#efe3cf',
      accent: '#3f6b1c',
      accentText: '#ffffff',
      danger: '#b23b2e',
    },
  }),
}));

const mockEntries = useDayEntries as jest.Mock;
const mockCopy = copyMeal as jest.Mock;
const mockTargets = useDailyCalorieTargets as jest.Mock;
const mockToday = useTodayKey as jest.Mock;
const mockParams = useLocalSearchParams as jest.Mock;
const mockRouter = useRouter as jest.Mock;

const AUJOURDHUI = '2026-09-25';
const JOUR = '2026-09-24';
const router = { back: jest.fn(), dismissTo: jest.fn(), setParams: jest.fn(), push: jest.fn() };

const entree = (overrides: Record<string, unknown> = {}) => ({
  id: 'e-1',
  mealType: 'breakfast',
  foodId: 'f-1',
  name: 'Skyr',
  quantityG: 150,
  kcal: 95,
  proteinG: 16,
  carbsG: 6,
  fatG: 0,
  micronutrients: {},
  createdAt: '2026-09-24T07:30:00.000Z',
  ...overrides,
});

const afficher = async ({
  date = JOUR as string | null,
  entries = [] as unknown[],
  aujourdhui = [] as unknown[],
  target = 2400 as number | null,
} = {}) => {
  // `null` : aucun paramètre de date.
  mockParams.mockReturnValue(date === null ? {} : { date });
  mockEntries.mockImplementation((day: string) => ({ entries: day === AUJOURDHUI ? aujourdhui : entries }));
  mockTargets.mockReturnValue({
    days: entries.length ? [{ dayKey: JOUR, kcal: 0, effectiveTarget: target, isTrainingDay: false }] : [],
    marginPct: 10,
    hasTarget: target != null,
    weightKg: null,
    isLoading: false,
  });
  await render(<NutritionDayScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

let boutonsAlerte: { text?: string; onPress?: () => void }[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  mockToday.mockReturnValue(AUJOURDHUI);
  mockRouter.mockReturnValue(router);
  mockCopy.mockResolvedValue(1);
  boutonsAlerte = [];
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, boutons) => {
    boutonsAlerte = (boutons ?? []) as typeof boutonsAlerte;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('le jour affiché', () => {
  it('son titre en toutes lettres, son total et son statut face à SA cible', async () => {
    await afficher({ entries: [entree({ kcal: 2218 })] });

    expect(screen.getByTestId('nutrition-day-title').props.children).toBe('Jeudi 24 septembre');
    expect(screen.getByText(/nutritionHub\.day\.status\.in/)).toBeTruthy();
    // Une seule source de cible pour Historique et la page d'un jour (D9).
    expect(mockTargets).toHaveBeenCalledWith(JOUR, JOUR);
  });

  it('au-dessus de la cible : l’écart est dit', async () => {
    await afficher({ entries: [entree({ kcal: 3000 })] });

    expect(screen.getByText(/nutritionHub\.day\.status\.over:\{"kcal":"3\s000","delta":"600"\}/)).toBeTruthy();
  });

  it('un jour vide invite à compléter', async () => {
    await afficher({ entries: [] });

    expect(screen.getByText('nutritionHub.day.status.none')).toBeTruthy();
    expect(screen.getByText('nutritionHub.day.empty')).toBeTruthy();
    expect(screen.queryByTestId('nutrition-day-redo-all')).toBeNull();
  });

  it('🔴 rien ne se perd : l’énergie, les micros et la qualité de CE jour', async () => {
    await afficher({ entries: [entree()] });

    expect(screen.getByText(`energie:${JOUR}`)).toBeTruthy();
    expect(screen.getByText('micros-du-jour')).toBeTruthy();
    expect(screen.getByText(`qualite:${JOUR}`)).toBeTruthy();
  });
});

describe('compléter un oubli', () => {
  it('🔴 le + d’un repas ouvre la feuille sur CE jour, sans « il te reste »', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getByLabelText('journal.meals.lunch · journal.addFood'));

    expect(screen.getByText(`feuille:${JOUR}:lunch:null`)).toBeTruthy();
  });
});

describe('reprendre sur aujourd’hui (R10)', () => {
  it('« Aujourd’hui » reprend CE repas sur aujourd’hui, puis dit « Ajouté »', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getByText('nutritionHub.day.redoMeal'));

    expect(mockCopy).toHaveBeenCalledWith(JOUR, 'breakfast', AUJOURDHUI);
    expect(screen.getByText('nutritionHub.repeat.done')).toBeTruthy();
    // TalkBack annonce ce qui vient de se passer, pas seulement un bouton désactivé.
    expect(
      screen.getByLabelText('nutritionHub.day.redoneA11y:{"meal":"journal.meals.breakfast","date":"jeudi 24 septembre"}'),
    ).toBeTruthy();
  });

  it('🔴 un double appui sur « Aujourd’hui » ne reprend qu’une fois', async () => {
    let finir: () => void = () => undefined;
    mockCopy.mockImplementation(() => new Promise<number>((r) => (finir = () => r(1))));
    await afficher({ entries: [entree()] });

    const bouton = screen.getByText('nutritionHub.day.redoMeal');
    await taper(bouton);
    await taper(bouton);
    await act(async () => finir());

    expect(mockCopy).toHaveBeenCalledTimes(1);
  });

  it('🔴 jamais sur « Autres » : la copie irait dans un repas qui n’existe plus', async () => {
    await afficher({ entries: [entree({ mealType: 'custom-supprime', name: 'Pizza' })] });

    expect(screen.getByText('Pizza')).toBeTruthy();
    expect(screen.queryByText('nutritionHub.day.redoMeal')).toBeNull();
    expect(screen.queryByTestId('nutrition-day-redo-all')).toBeNull();
  });

  it('toute la journée, sur un aujourd’hui vide : sans alerte, repas par repas, puis Aujourd’hui', async () => {
    await afficher({
      entries: [
        entree({ id: 'a', mealType: 'breakfast' }),
        entree({ id: 'b', mealType: 'lunch', name: 'Poulet' }),
        entree({ id: 'c', mealType: 'custom-supprime', name: 'Pizza' }),
      ],
    });

    await taper(screen.getByTestId('nutrition-day-redo-all'));

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockCopy.mock.calls).toEqual([
      [JOUR, 'breakfast', AUJOURDHUI],
      [JOUR, 'lunch', AUJOURDHUI],
    ]);
    // `dismissTo` revient au hub déjà dans la pile : `navigate` y empilait un second arbre d'onglets.
    expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/(tabs)/nutrition', params: { section: 'today' } });
  });

  it('🔴 sur un aujourd’hui entamé : l’alerte d’abord, et Annuler n’écrit rien', async () => {
    await afficher({ entries: [entree()], aujourdhui: [entree({ id: 't-1' })] });

    await taper(screen.getByTestId('nutrition-day-redo-all'));
    expect(mockCopy).not.toHaveBeenCalled();

    await act(async () => boutonsAlerte.find((b) => b.text === 'common.cancel')?.onPress?.());
    expect(mockCopy).not.toHaveBeenCalled();
  });

  it('… et Ajouter ajoute EN PLUS', async () => {
    await afficher({ entries: [entree()], aujourdhui: [entree({ id: 't-1' })] });

    await taper(screen.getByTestId('nutrition-day-redo-all'));
    await act(async () => boutonsAlerte.find((b) => b.text === 'nutritionHub.day.confirmAdd')?.onPress?.());

    expect(mockCopy).toHaveBeenCalledWith(JOUR, 'breakfast', AUJOURDHUI);
  });
});

describe('naviguer', () => {
  it('le jour précédent et le suivant, sans dépasser la veille', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getByLabelText('journal.prevDay'));
    expect(router.setParams).toHaveBeenCalledWith({ date: '2026-09-23' });

    // Le 24 est la veille : le jour suivant serait aujourd'hui, qui vit dans l'onglet Aujourd'hui.
    expect(screen.getByLabelText('journal.nextDay').props.accessibilityState.disabled).toBe(true);
  });

  it.each([[AUJOURDHUI], ['2026-10-02'], ['n-importe-quoi'], [null]])(
    '🔴 une date %s renvoie sur l’onglet Aujourd’hui',
    async (date) => {
      await afficher({ date });

      expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/(tabs)/nutrition', params: { section: 'today' } });
      expect(screen.queryByTestId('nutrition-day-title')).toBeNull();
    },
  );
});

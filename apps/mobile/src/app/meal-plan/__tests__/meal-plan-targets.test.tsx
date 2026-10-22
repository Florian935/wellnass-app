/**
 * US CIBLE-01 — le **filet** de la cible du jour dans le planning repas, sur le jeu de la recette
 * (spec §14.1), dans les trois modes.
 *
 * Écrit et vert **avant** que le planning ne passe par la composition de NORYN-02 : il figeait ce que
 * l'écran affichait (la colonne « Avant » du §14.2). Les tests étiquetés `CIBLE-01 C<n>` portaient un cas
 * que la spec annonce comme changé : seul leur attendu a bougé, à l'étape 4 (le planning).
 *
 * Les sources sont celles du harnais (`day-target-sources.ts`) : un scénario décrit une fois nourrit
 * aussi bien la lecture d'aujourd'hui (`useWeekPlan`) que celles de demain (séances, courses,
 * activités, dépenses, séances planifiées par plage).
 *
 * Le jeu tient sur trois semaines du planning : aujourd'hui (jeudi 08/10/2026) est au milieu de la
 * semaine du lundi 05/10 ; J−6 → J−4 sont dans la précédente, J+4 et J+5 dans la suivante.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import MealPlanScreen from '../index';
import { FROZEN_CLOCK, setSources, type Sources } from '@/test-utils/day-target-sources';
import { J, MODES, cible01Sources, type Mode } from '@/test-utils/cible01-dataset';

// ── Les sources de la cible (harnais) ───────────────────────────────────────────────────────────
jest.mock('@/data/repositories/nutrition-repository', () => ({ useNutritionProfile: jest.fn() }));
jest.mock('@/data/repositories/profile-repository', () => ({ useProfile: jest.fn() }));
jest.mock('@/data/repositories/bodyweight-repository', () => ({ useLatestWeight: jest.fn(), useWeightEntries: jest.fn() }));
jest.mock('@/data/repositories/settings-repository', () => ({ useSettings: jest.fn() }));
jest.mock('@/data/repositories/workout-repository', () => ({ useWorkoutHistory: jest.fn() }));
jest.mock('@/data/repositories/run-repository', () => ({ useRunHistory: jest.fn() }));
jest.mock('@/data/repositories/activity-repository', () => ({ useActivities: jest.fn(), useActivitiesOnDay: jest.fn() }));
jest.mock('@/data/repositories/planned-session-repository', () => ({
  useHasPlannedSession: jest.fn(),
  useWeekPlan: jest.fn(),
  usePlannedDayKeys: jest.fn(),
}));
jest.mock('@/data/repositories/real-life-repository', () => ({ useRealLifePeriods: jest.fn() }));
jest.mock('@/data/repositories/energy-repository', () => ({ useDayEnergy: jest.fn(), useEnergyTargetByDay: jest.fn() }));
jest.mock('@/data/repositories/journal-repository', () => ({ useDailyTotals: jest.fn() }));
jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({ useWellbeingRows: jest.fn() }));

// ── Le reste de l'écran, neutralisé ─────────────────────────────────────────────────────────────
jest.mock('@/data/repositories/meal-plan-repository', () => ({
  useWeekMealPlan: jest.fn(() => ({ entries: [] })),
  useWeekMealPlanCount: jest.fn(() => ({ count: 0 })),
  planFood: jest.fn(),
  planQuickAdd: jest.fn(),
  planRecipe: jest.fn(),
  planTemplate: jest.fn(),
  consumePlannedEntry: jest.fn(),
  undoConsumedEntry: jest.fn(),
  removePlannedEntry: jest.fn(),
  duplicateWeek: jest.fn(),
}));
jest.mock('@/data/repositories/recipe-repository', () => ({ useRecipes: jest.fn(() => ({ recipes: [] })) }));
jest.mock('@/data/repositories/meal-template-repository', () => ({ useMealTemplates: jest.fn(() => ({ templates: [] })) }));
jest.mock('@/data/repositories/food-repository', () => ({ useFoods: jest.fn(() => ({ foods: [], isLoading: false })) }));

/** Sonde : la cible du jour, le bonus et son origine, tels que l'écran les passe à la carte. */
jest.mock('@/components/nutrition/MealPlanDayCard', () => {
  const { Text } = require('react-native');
  return {
    MealPlanDayCard: ({
      dayKey,
      targetKcal,
      trainingBonusKcal,
      bonusKind,
    }: {
      dayKey: string;
      targetKcal: number | null;
      trainingBonusKcal: number;
      bonusKind?: string | null;
    }) => (
      <Text>
        jour:{dayKey}:{String(targetKcal)}:{trainingBonusKcal}:{String(bonusKind ?? null)}
      </Text>
    ),
  };
});
jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/ScreenHeader', () => {
  const { View } = require('react-native');
  return { ScreenHeader: ({ action }: { action?: React.ReactNode }) => <View>{action}</View> };
});
jest.mock('@/components/Button', () => {
  const { Text } = require('react-native');
  return { Button: ({ label }: { label: string }) => <Text>{label}</Text> };
});
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});
jest.mock('expo-router', () => ({ useRouter: jest.fn(() => ({ push: jest.fn() })) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#000',
      textMuted: '#111',
      background: '#fff',
      surface: '#fff',
      surfaceAlt: '#eee',
      border: '#ddd',
      borderStrong: '#ccc',
      accent: '#c0562f',
      accentText: '#fff',
    },
  }),
}));

type Card = { cible: number | null; bonus: number; kind: string };

/** Monte l'écran (vue liste), puis lit les cartes des trois semaines du jeu. */
async function cards(sources: Sources): Promise<Map<string, Card>> {
  setSources(sources);
  await render(<MealPlanScreen />);
  await act(async () => {
    fireEvent.press(screen.getByLabelText('mealPlan.grid.showList'));
  });
  const out = new Map<string, Card>();
  const read = () => {
    for (const node of screen.getAllByText(/^jour:/)) {
      const [, day, cible, bonus, kind] = (node.children as string[]).join('').split(':');
      out.set(day!, { cible: cible === 'null' ? null : Number(cible), bonus: Number(bonus), kind: kind! });
    }
  };
  read();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('mealPlan.week.previousA11y'));
  });
  read();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('mealPlan.week.nextA11y'));
  });
  await act(async () => {
    fireEvent.press(screen.getByLabelText('mealPlan.week.nextA11y'));
  });
  read();
  return out;
}

const DAYS = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5] as const;

/**
 * Ce que le planning affiche, jour par jour, dans chaque mode : [cible, bonus, origine du bonus].
 *
 * CIBLE-01 C7 à C12 (spec §6, §14.2) — **après** : la cible d'Aujourd'hui pour chaque jour. Avant, les trois
 * modes donnaient la même colonne (socle `tdee`, forfait de toute séance planifiée du jour, sautée ou
 * manquée comprise, rien pour ce qui avait été fait) : 2 359, 2 359, 2 359, 2 659, 2 659, 2 359, 2 659,
 * 2 659, 2 659, 2 359, 3 059, 2 759.
 */
type Row = [number, number, string];
const FIXED: Row[] = [
  [2659, 300, 'done'], // J−6 : séance de muscu faite, sans séance planifiée (C11)
  [2659, 300, 'done'], // J−5 : autre activité seule (C11)
  [2359, 0, 'null'], // J−4 : rien
  [2359, 0, 'null'], // J−3 : séance sautée (C9)
  [2359, 0, 'null'], // J−2 : séance manquée (C10)
  [2659, 300, 'done'], // J−1 : course faite (C11)
  [2659, 300, 'planned'], // J   : séance prévue, pas faite
  [2659, 300, 'planned'], // J+1 : séance prévue
  [2359, 0, 'null'], // J+2 : séance sautée (C9)
  [2359, 0, 'null'], // J+3 : rien
  [3059, 300, 'planned'], // J+4 : vie réelle, séance prévue
  [2759, 0, 'null'], // J+5 : vie réelle
];
const AUTO: Row[] = FIXED.map((row, i) => (i === 5 ? [3016, 657, 'run'] : row)); // J−1 : la course (C12)
const ACTIVITIES: Row[] = [
  [2218, 170, 'energy'], // J−6 (C7, C8)
  [2548, 500, 'energy'], // J−5
  [2048, 0, 'null'], // J−4
  [2048, 0, 'null'], // J−3
  [2048, 0, 'null'], // J−2
  [2608, 560, 'energy'], // J−1
  [2048, 0, 'energyLater'], // J   : séance prévue, rien de dépensé (D3)
  [2048, 0, 'energyLater'], // J+1
  [2048, 0, 'null'], // J+2 : sautée
  [2048, 0, 'null'], // J+3
  [2448, 0, 'energyLater'], // J+4 : vie réelle (socle hors sport au maintien), séance prévue
  [2448, 0, 'null'], // J+5
];
const EXPECTED: Record<Mode, Row[]> = { fixed: FIXED, auto: AUTO, activities: ACTIVITIES };

beforeEach(() => jest.useFakeTimers(FROZEN_CLOCK));
afterEach(() => jest.useRealTimers());

describe.each(MODES)('mode `%s`', (mode) => {
  it('CIBLE-01 C7 à C12 — la cible et le bonus de chaque jour du jeu', async () => {
    const read = await cards(cible01Sources(mode));
    const got = DAYS.map((n) => {
      const card = read.get(J(n))!;
      return [card.cible, card.bonus, card.kind];
    });
    expect(got).toEqual(EXPECTED[mode]);
  });
});

describe('les piliers', () => {
  it('ni muscu ni course actif : aucun bonus, la cible de base (REPAS-01 R5, CIBLE-01 D7-B)', async () => {
    const read = await cards(cible01Sources('fixed', { activePillars: ['nutrition'] }));
    expect(read.get(J(0))).toMatchObject({ cible: 2359, bonus: 0 });
    expect(read.get(J(1))).toMatchObject({ cible: 2359, bonus: 0 });
  });

  it('CIBLE-01 C13 — aucune ligne de réglages : les piliers par défaut (tous), donc le forfait (DD12)', async () => {
    const read = await cards(cible01Sources('fixed', { activePillars: null }));
    expect(read.get(J(1))).toMatchObject({ cible: 2659, bonus: 300 });
  });
});

describe('les témoins', () => {
  it('sans profil calculable, aucune cible', async () => {
    const read = await cards(cible01Sources('fixed', { profile: { weightKg: null as unknown as number } }));
    expect(read.get(J(3))!.cible).toBeNull();
  });

  it('surcharge manuelle : la surcharge, et le forfait d’une séance prévue', async () => {
    const read = await cards(cible01Sources('fixed', { nutrition: { manualCalories: 2000, trainingDayBonus: 300 } }));
    expect(read.get(J(3))).toMatchObject({ cible: 2000, bonus: 0 });
    expect(read.get(J(1))).toMatchObject({ cible: 2300, bonus: 300 });
  });
});

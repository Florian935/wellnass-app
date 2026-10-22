/**
 * US CIBLE-01 — le **filet** du seuil « complète » de la carte de régularité (spec C6, D9).
 *
 * Une journée est « complète » au-delà d'un tiers de la cible (`dayFill`). Avant CIBLE-01, la cible est
 * celle que l'appelant passe : **aucune** dans Statistiques (repli 600 kcal), **celle d'aujourd'hui**
 * dans Progrès, appliquée aux 30 jours. Le jeu de la recette pose 700 kcal à J−10 : « complète » sans
 * cible, « partielle » face à la cible d'aujourd'hui (2 659, seuil 886).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { RegularityCard } from '../RegularityCard';
import { useJournalCompletion } from '@/data/repositories/journal-repository';
import { FROZEN_CLOCK, setSources } from '@/test-utils/day-target-sources';
import { J, cible01Sources } from '@/test-utils/cible01-dataset';

jest.mock('@/data/repositories/nutrition-repository', () => ({ useNutritionProfile: jest.fn() }));
jest.mock('@/data/repositories/profile-repository', () => ({ useProfile: jest.fn() }));
jest.mock('@/data/repositories/bodyweight-repository', () => ({ useLatestWeight: jest.fn(), useWeightEntries: jest.fn() }));
jest.mock('@/data/repositories/settings-repository', () => ({ useSettings: jest.fn() }));
jest.mock('@/data/repositories/workout-repository', () => ({ useWorkoutHistory: jest.fn() }));
jest.mock('@/data/repositories/run-repository', () => ({ useRunHistory: jest.fn() }));
jest.mock('@/data/repositories/activity-repository', () => ({ useActivities: jest.fn(), useActivitiesOnDay: jest.fn() }));
jest.mock('@/data/repositories/planned-session-repository', () => ({
  useHasPlannedSession: jest.fn(),
  usePlannedDayKeys: jest.fn(),
}));
jest.mock('@/data/repositories/real-life-repository', () => ({ useRealLifePeriods: jest.fn() }));
jest.mock('@/data/repositories/energy-repository', () => ({ useDayEnergy: jest.fn(), useEnergyTargetByDay: jest.fn() }));
jest.mock('@/data/repositories/journal-repository', () => ({ useDailyTotals: jest.fn(), useJournalCompletion: jest.fn() }));
jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({ useWellbeingRows: jest.fn() }));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({ t: (k: string) => k }),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#000',
      textMuted: '#111',
      surface: '#fff',
      border: '#ddd',
      success: 'complete',
      amber: 'partial',
      track: 'empty',
    },
  }),
}));

const fillOf = (dayKey: string) =>
  StyleSheet.flatten(screen.getByTestId(`regularity-cell-${dayKey}`).props.style).backgroundColor as string;

beforeEach(() => {
  jest.useFakeTimers(FROZEN_CLOCK);
  (useJournalCompletion as jest.Mock).mockReturnValue({ effectiveWindow: 30, isLoading: false });
});
afterEach(() => jest.useRealTimers());

describe('la case de J−10 (700 kcal), mode `fixed`', () => {
  it('CIBLE-01 C6 — Statistiques (aucune cible, seuil 600) : complète', async () => {
    setSources(cible01Sources('fixed'));
    await render(<RegularityCard targetKcal={null} windowDays={30} />);
    expect(fillOf(J(-10))).toBe('complete');
  });

  it('CIBLE-01 C6 — Progrès (la cible d’aujourd’hui, 2 659, seuil 886) : partielle', async () => {
    setSources(cible01Sources('fixed'));
    await render(<RegularityCard targetKcal={2659} windowDays={30} />);
    expect(fillOf(J(-10))).toBe('partial');
  });
});

it('un jour sans rien de noté est vide, quelle que soit la cible', async () => {
  setSources(cible01Sources('fixed'));
  await render(<RegularityCard targetKcal={null} windowDays={30} />);
  expect(fillOf(J(-9))).toBe('empty');
  expect(fillOf(J(-6))).toBe('complete');
});

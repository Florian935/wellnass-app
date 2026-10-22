/**
 * US CIBLE-01 — **une cible par jour** (spec R2, R3) : la cible effective d'un jour noté est la même
 * dans `useDayCalorieTarget` (Aujourd'hui, « Ta journée en énergie », Noryn) et dans
 * `useDailyCalorieTargets` (calendrier, page d'un jour passé, adhérence, bilans, APPORT-01).
 *
 * Sur le jeu de la recette (spec §14.1), dans les trois modes. Avant CIBLE-01, deux jours divergent en
 * Forfait et en Auto — l'autre activité seule (C1) et aujourd'hui à séance prévue (C2) : le filet
 * affirme cet écart tel qu'il est ; l'étape qui aligne l'historique le fait disparaître.
 */

import { renderHook } from '@testing-library/react-native';

import { useDailyCalorieTargets, useDayCalorieTarget } from '../dashboard-repository';
import { FROZEN_CLOCK, setSources } from '@/test-utils/day-target-sources';
import { CIBLE01_MEALS, J, MODES, cible01Sources, type Mode } from '@/test-utils/cible01-dataset';

jest.mock('@/data/repositories/nutrition-repository', () => ({ useNutritionProfile: jest.fn() }));
jest.mock('@/data/repositories/profile-repository', () => ({ useProfile: jest.fn() }));
jest.mock('@/data/repositories/bodyweight-repository', () => ({ useLatestWeight: jest.fn(), useWeightEntries: jest.fn() }));
jest.mock('@/data/repositories/settings-repository', () => ({ useSettings: jest.fn() }));
jest.mock('@/data/repositories/workout-repository', () => ({
  useWorkoutHistory: jest.fn(),
  useActiveWorkout: jest.fn(() => ({ workout: null, isLoading: false })),
}));
jest.mock('@/data/repositories/run-repository', () => ({
  useRunHistory: jest.fn(),
  useRunStats: jest.fn(() => ({ stats: null, isLoading: false })),
}));
jest.mock('@/data/repositories/activity-repository', () => ({ useActivities: jest.fn(), useActivitiesOnDay: jest.fn() }));
jest.mock('@/data/repositories/planned-session-repository', () => ({
  useHasPlannedSession: jest.fn(),
  usePlannedDayKeys: jest.fn(),
}));
jest.mock('@/data/repositories/real-life-repository', () => ({
  useRealLifePeriods: jest.fn(),
  useRealLifeState: jest.fn(() => ({ inRealLifePeriod: false, isLoading: false })),
  SELECT_WEEK_STRENGTH_SESSIONS: 'select-week-strength-sessions',
}));
jest.mock('@/data/repositories/energy-repository', () => ({ useDayEnergy: jest.fn(), useEnergyTargetByDay: jest.fn() }));
jest.mock('@/data/repositories/journal-repository', () => ({ useDailyTotals: jest.fn() }));
jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({ useWellbeingRows: jest.fn() }));

beforeEach(() => jest.useFakeTimers(FROZEN_CLOCK));
afterEach(() => jest.useRealTimers());

/** La cible de chaque jour noté, des deux côtés. */
async function bothSides(mode: Mode): Promise<Map<string, { today: number | null; history: number | null }>> {
  setSources(cible01Sources(mode));
  const { result: history } = await renderHook(() => useDailyCalorieTargets(J(-30), null));
  const out = new Map<string, { today: number | null; history: number | null }>();
  for (const { logDate } of CIBLE01_MEALS) {
    const { result } = await renderHook(() => useDayCalorieTarget(logDate));
    out.set(logDate, {
      today: result.current.effectiveTarget,
      history: history.current.days.find((d) => d.dayKey === logDate)?.effectiveTarget ?? null,
    });
  }
  return out;
}

/**
 * Les jours où l'historique diverge encore d'Aujourd'hui, et de combien (le forfait).
 * CIBLE-01 C1 (J−5, autre activité seule) et C2 (J, séance prévue) — en Forfait et en Auto.
 */
const DIVERGING: Record<Mode, readonly string[]> = {
  fixed: [J(-5), J(0)],
  auto: [J(-5), J(0)],
  activities: [],
};

describe.each(MODES)('mode `%s`', (mode) => {
  it('les jours témoins : la même cible des deux côtés', async () => {
    const sides = await bothSides(mode);
    for (const [day, { today, history }] of sides) {
      if (DIVERGING[mode].includes(day)) continue;
      expect({ day, history }).toEqual({ day, history: today });
    }
  });

  it('CIBLE-01 C1 et C2 — l’historique compte encore ces jours sans forfait', async () => {
    const sides = await bothSides(mode);
    for (const day of DIVERGING[mode]) {
      const { today, history } = sides.get(day)!;
      expect({ day, history }).toEqual({ day, history: (today ?? 0) - 300 });
    }
  });
});

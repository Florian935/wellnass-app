/**
 * US CIBLE-01 — `useCalorieTargetsForDays` : les lectures de la cible sur une plage, puis la composition.
 *
 * Ce que ce hook ajoute à la brique pure (couverte par `day-target-range.test.ts`) : **une** lecture des
 * séances planifiées par plage, bornée à partir d'aujourd'hui (spec D6), et les lectures passées telles
 * quelles. L'égalité avec `useDayCalorieTarget` est figée par `day-target-parity.test.tsx`.
 */

import { renderHook } from '@testing-library/react-native';

import { useCalorieTargetsForDays } from '../day-targets-repository';
import { usePlannedDayKeys } from '../planned-session-repository';
import { FROZEN_CLOCK, TODAY, setSources } from '@/test-utils/day-target-sources';
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
jest.mock('@/data/repositories/journal-repository', () => ({ useDailyTotals: jest.fn() }));
jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({ useWellbeingRows: jest.fn() }));

const mockPlanned = usePlannedDayKeys as jest.Mock;
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => J(from + i));

beforeEach(() => jest.useFakeTimers(FROZEN_CLOCK));
afterEach(() => jest.useRealTimers());

describe('une lecture des séances planifiées par plage (D6)', () => {
  it('366 jours : la plage commence aujourd’hui, finit au dernier jour — jamais une lecture par jour', async () => {
    setSources(cible01Sources('fixed'));
    await renderHook(() => useCalorieTargetsForDays(range(-355, 10)));
    expect(new Set(mockPlanned.mock.calls.map((c) => c.join('→')))).toEqual(new Set([`${TODAY}→${J(10)}`]));
  });

  it('une plage passée : une plage vide (début après la fin)', async () => {
    setSources(cible01Sources('fixed'));
    await renderHook(() => useCalorieTargetsForDays(range(-30, -1)));
    expect(mockPlanned).toHaveBeenLastCalledWith(TODAY, J(-1));
  });

  it('une plage future : elle commence à son premier jour', async () => {
    setSources(cible01Sources('fixed'));
    await renderHook(() => useCalorieTargetsForDays(range(3, 9)));
    expect(mockPlanned).toHaveBeenLastCalledWith(J(3), J(9));
  });

  it('aucun jour demandé : rien à lire, rien à rendre', async () => {
    setSources(cible01Sources('fixed'));
    const { result } = await renderHook(() => useCalorieTargetsForDays([]));
    expect(result.current.byDay.size).toBe(0);
    expect(mockPlanned).toHaveBeenLastCalledWith(TODAY, '');
  });
});

describe('ce que le hook rend', () => {
  it('la cible de chaque jour du jeu (Forfait) — autres activités et séance prévue d’aujourd’hui comprises', async () => {
    setSources(cible01Sources('fixed'));
    const { result } = await renderHook(() => useCalorieTargetsForDays(range(-6, 5)));
    const got = range(-6, 5).map((d) => result.current.byDay.get(d)!.effectiveTarget);
    expect(got).toEqual([2659, 2659, 2359, 2359, 2359, 2659, 2659, 2659, 2359, 2359, 3059, 2759]);
    expect(result.current.byDay.get(J(-5))!.trainedBy).toBe('done');
    expect(result.current.byDay.get(J(0))!.trainedBy).toBe('planned');
  });

  it('`hasTarget` et `weightKg` (dernière pesée, sinon profil)', async () => {
    setSources(cible01Sources('fixed', { latestWeightKg: 77 }));
    const { result } = await renderHook(() => useCalorieTargetsForDays([J(0)]));
    expect(result.current.hasTarget).toBe(true);
    expect(result.current.weightKg).toBe(77);

    setSources(cible01Sources('fixed', { profile: { heightCm: null as unknown as number } }));
    const { result: incomplete } = await renderHook(() => useCalorieTargetsForDays([J(0)]));
    expect(incomplete.current.hasTarget).toBe(false);
    expect(incomplete.current.byDay.get(J(0))!.effectiveTarget).toBeNull();
    expect(incomplete.current.weightKg).toBe(80);
  });

  it('en chargement tant qu’une lecture charge (la dépense comprise)', async () => {
    setSources(cible01Sources('activities'));
    const { useEnergyTargetByDay } = jest.requireMock('@/data/repositories/energy-repository');
    (useEnergyTargetByDay as jest.Mock).mockReturnValue({ byDay: new Map(), isLoading: true });
    const { result } = await renderHook(() => useCalorieTargetsForDays([J(0)]));
    expect(result.current.isLoading).toBe(true);
  });
});

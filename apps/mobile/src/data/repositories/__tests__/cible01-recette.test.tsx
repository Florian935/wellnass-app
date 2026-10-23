/**
 * US CIBLE-01 — **les chiffres de la recette** (spec §14.2), figés sur le jeu de
 * `supabase/scripts/cible01-recette-donnees.sql`, décrit pour les tests par `cible01-dataset.ts`.
 *
 * Les chiffres attendus à l'écran sont ceux de ce fichier : ils ne peuvent pas dériver du code. Chaque bloc correspond
 * à un écran — l'historique (calendrier, liste, page d'un jour passé), Statistiques 7 et 30 jours, le Labo
 * (APPORT-01), le planning repas, la carte de régularité — dans les trois modes. Le widget, lui, a ses
 * chiffres dans `home-widget-data.test.ts` (harnais SQLite).
 *
 * Profil A : homme, 80 kg, 180 cm, 30 ans ; sèche, « modéré », forfait 300, socle « debout », marge 10 %.
 */

import { renderHook } from '@testing-library/react-native';
import {
  buildHeatmap,
  dayEnergyTotals,
  dayTargetStatus,
  energyItemsByDay,
  estimateRunCalories,
  localDayKeyOf,
  mealPlanDayTarget,
} from '@wellness/shared';

import { useDailyCalorieTargets, useGoalAdherenceForRange, useTrainingNutritionCross } from '../dashboard-repository';
import { useCalorieTargetsForDays } from '../day-targets-repository';
import { FROZEN_CLOCK, NOW, PROFILE_A, TODAY, atLocal, setSources } from '@/test-utils/day-target-sources';
import { CIBLE01_MEALS, J, cible01Sources, type Mode } from '@/test-utils/cible01-dataset';

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

const kcalOf = (day: string) => CIBLE01_MEALS.find((m) => m.logDate === day)!.kcal;
const STATUS = { in: '✓', over: '+', under: '−' } as const;

describe('le jeu : les dépenses que le harnais pose sont celles des fonctions pures', () => {
  it('séance 170, vélo 500, course 560 (bas des fourchettes) ; course du mode `auto` 657', () => {
    const byDay = energyItemsByDay({
      profile: PROFILE_A,
      weightEntries: [],
      workouts: [
        { id: 'w', startedAt: atLocal(J(-6), 18), finishedAt: atLocal(J(-6), 19), durationSeconds: 3600, rpe: 7, totalSets: 12 },
      ],
      finishedRuns: [
        { id: 'r', finishedAt: atLocal(J(-1), 7, 45), distanceM: 8000, durationSeconds: 2700, elevationGainM: null, rpe: 5 },
      ],
      activities: [
        { id: 'a', activityType: 'bike', startedAt: atLocal(J(-5), 10), durationSeconds: 3600, intensity: 'moderate', rpe: 6, distanceM: 25000, deviceKcal: null },
      ],
      dayKeyOf: localDayKeyOf,
      at: NOW,
    });
    expect([J(-6), J(-5), J(-1)].map((d) => dayEnergyTotals(byDay.get(d) ?? []).targetKcal)).toEqual([170, 500, 560]);
    expect(estimateRunCalories({ distanceM: 8000, durationSeconds: 2700, weightKg: 80 })).toBe(657);
  });
});

describe('Historique — calendrier, liste des jours, page d’un jour passé', () => {
  const HISTORY: Record<Mode, Record<string, string>> = {
    fixed: { '-10': '2359 −', '-6': '2659 ✓', '-5': '2659 ✓', '-4': '2359 ✓', '-3': '2359 ✓', '-2': '2359 ✓', '-1': '2659 ✓', '0': '2659' },
    auto: { '-10': '2359 −', '-6': '2659 ✓', '-5': '2659 ✓', '-4': '2359 ✓', '-3': '2359 ✓', '-2': '2359 ✓', '-1': '3016 −', '0': '2659' },
    activities: { '-10': '2048 −', '-6': '2218 +', '-5': '2548 ✓', '-4': '2048 +', '-3': '2048 +', '-2': '2048 +', '-1': '2608 ✓', '0': '2048' },
  };

  it.each(['fixed', 'auto', 'activities'] as const)('mode `%s` : la cible et le statut de chaque jour noté', async (mode) => {
    setSources(cible01Sources(mode));
    const { result } = await renderHook(() => useDailyCalorieTargets(J(-30), null));
    const got: Record<string, string> = {};
    for (const d of result.current.days) {
      const n = Math.round((Date.parse(`${d.dayKey}T12:00:00Z`) - Date.parse(`${TODAY}T12:00:00Z`)) / 86_400_000);
      // Aujourd'hui : la case est remplie, sans statut (le jour n'est pas fini).
      const status = d.dayKey === TODAY ? '' : ` ${STATUS[dayTargetStatus(d.kcal, d.effectiveTarget, 10)!]}`;
      got[String(n)] = `${d.effectiveTarget}${status}`;
    }
    expect(got).toEqual(HISTORY[mode]);
  });
});

describe('Statistiques › Régularité — jours dans la cible et bilan', () => {
  const STATS: Record<Mode, { d7: [number, number, number, number]; d30: [number, number, number, number] }> = {
    fixed: { d7: [7, 7, 100, -243], d30: [7, 8, 88, -1902] },
    auto: { d7: [6, 7, 86, -600], d30: [6, 8, 75, -2259] },
    activities: { d7: [2, 7, 29, 1904], d30: [2, 8, 25, 556] },
  };

  it.each(['fixed', 'auto', 'activities'] as const)('mode `%s` : 7 jours (J−7 → J) et 30 jours (J−30 → J)', async (mode) => {
    setSources(cible01Sources(mode));
    const { result: d7 } = await renderHook(() => useGoalAdherenceForRange(J(-7), null));
    const { result: d30 } = await renderHook(() => useGoalAdherenceForRange(J(-30), null));
    const row = (a: typeof d7.current) => [a.daysInTarget, a.loggedDays, a.pct, a.balanceKcal];
    expect({ d7: row(d7.current), d30: row(d30.current) }).toEqual(STATS[mode]);
  });
});

describe('Carte de régularité — la case de J−10 (700 kcal)', () => {
  it.each([
    ['fixed', 'partial'],
    ['auto', 'partial'],
    ['activities', 'complete'],
  ] as const)('mode `%s` : %s', async (mode, fill) => {
    setSources(cible01Sources(mode));
    const { result } = await renderHook(() => useDailyCalorieTargets(J(-29), null));
    const targetOf = new Map(result.current.days.map((d) => [d.dayKey, d.effectiveTarget]));
    const [cell] = buildHeatmap([J(-10)], [{ logDate: J(-10), kcal: kcalOf(J(-10)) }], (d) => targetOf.get(d));
    expect(cell!.fill).toBe(fill);
  });
});

describe('Labo › « Manges-tu assez pour ta muscu ? » (APPORT-01, J−27 → J)', () => {
  const APPORT: Record<Mode, [number, number]> = { fixed: [100, 75], auto: [75, 75], activities: [50, 0] };

  it.each(['fixed', 'auto', 'activities'] as const)('mode `%s` : 4 jours de séance, 4 de repos, +743 kcal', async (mode) => {
    setSources(cible01Sources(mode));
    const { result } = await renderHook(() => useTrainingNutritionCross());
    expect(result.current.energy).toEqual({
      trainingAvgKcal: 2643,
      restAvgKcal: 1900,
      deltaKcal: 743,
      trainingDays: 4,
      restDays: 4,
    });
    expect([result.current.adherence?.trainingPct, result.current.adherence?.restPct]).toEqual(APPORT[mode]);
  });
});

describe('Planning repas — la cible et la pastille de chaque jour, J−6 → J+5', () => {
  const PLAN: Record<Mode, string[]> = {
    fixed: [
      '2659 done +300', '2659 done +300', '2359', '2359', '2359', '2659 done +300',
      '2659 planned +300', '2659 planned +300', '2359', '2359', '3059 planned +300', '2759',
    ],
    auto: [
      '2659 done +300', '2659 done +300', '2359', '2359', '2359', '3016 run +657',
      '2659 planned +300', '2659 planned +300', '2359', '2359', '3059 planned +300', '2759',
    ],
    activities: [
      '2218 energy +170', '2548 energy +500', '2048', '2048', '2048', '2608 energy +560',
      '2048 energyLater', '2048 energyLater', '2048', '2048', '2448 energyLater', '2448',
    ],
  };

  it.each(['fixed', 'auto', 'activities'] as const)('mode `%s`', async (mode) => {
    setSources(cible01Sources(mode));
    const days = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map(J);
    const { result } = await renderHook(() => useCalorieTargetsForDays(days));
    const got = days.map((dayKey) => {
      const { targetKcal, badge } = mealPlanDayTarget({
        dayKey,
        todayKey: TODAY,
        day: result.current.byDay.get(dayKey),
        trainingPillarsActive: true,
      });
      if (!badge) return `${targetKcal}`;
      return badge.kind === 'energyLater' ? `${targetKcal} energyLater` : `${targetKcal} ${badge.kind} +${badge.kcal}`;
    });
    expect(got).toEqual(PLAN[mode]);
  });

  it('ni muscu ni course actif (D7-B) : la cible de base, aucune pastille — Aujourd’hui garde 2 659', async () => {
    setSources(cible01Sources('fixed', { activePillars: ['nutrition'] }));
    const { result } = await renderHook(() => useCalorieTargetsForDays([J(0)]));
    const day = result.current.byDay.get(J(0));
    expect(day!.effectiveTarget).toBe(2659);
    expect(mealPlanDayTarget({ dayKey: J(0), todayKey: TODAY, day, trainingPillarsActive: false })).toEqual({
      targetKcal: 2359,
      badge: null,
    });
  });
});

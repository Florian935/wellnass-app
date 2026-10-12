/**
 * US NORYN-02 — le **filet** de l'assemblage de la cible calorique du jour (`useIsTrainingDay`,
 * `useDayCalorieTarget`).
 *
 * Écrit et vert **avant** que la composition ne sorte vers `@wellness/shared` (la fonction
 * `noryn-context` l'appellera aussi) : il doit rester vert **sans une ligne modifiée** après.
 *
 * Profil A (homme, 80 kg, 180 cm, 30 ans) : `tdee` « modéré » 2 759, socle hors sport « debout »
 * 2 448, « assis » 2 136 ; sèche = −400.
 */

import { renderHook } from '@testing-library/react-native';
import { estimateRunCalories, objectiveFromGoal, targetCalories, tdee } from '@wellness/shared';

import { useDayCalorieTarget, useIsTrainingDay } from '../dashboard-repository';
import { FROZEN_CLOCK, TODAY, atLocal, setSources, shiftKey, type Sources } from '@/test-utils/day-target-sources';

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
jest.mock('@/data/repositories/planned-session-repository', () => ({ useHasPlannedSession: jest.fn() }));
jest.mock('@/data/repositories/real-life-repository', () => ({
  useRealLifePeriods: jest.fn(),
  useRealLifeState: jest.fn(() => ({ inRealLifePeriod: false, isLoading: false })),
  SELECT_WEEK_STRENGTH_SESSIONS: 'select-week-strength-sessions',
}));
jest.mock('@/data/repositories/energy-repository', () => ({ useDayEnergy: jest.fn(), useEnergyTargetByDay: jest.fn() }));
jest.mock('@/data/repositories/journal-repository', () => ({ useDailyTotals: jest.fn() }));
jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({ useWellbeingRows: jest.fn() }));

const YESTERDAY = shiftKey(TODAY, -1);
const TOMORROW = shiftKey(TODAY, 1);

const targetOn = async (dayKey: string, sources: Sources = {}) => {
  setSources(sources);
  const { result } = await renderHook(() => useDayCalorieTarget(dayKey));
  // Étape 4 (D1-A) : le hook rend aussi le socle (`socle`, `socleKind`) — une forme, pas un calcul ; ses
  // valeurs sont figées par le `describe` « socle » en fin de fichier.
  const { isLoading: _ignored, socle: _socle, socleKind: _socleKind, ...rest } = result.current;
  return rest;
};

const trainedOn = async (dayKey: string, sources: Sources = {}) => {
  setSources(sources);
  const { result } = await renderHook(() => useIsTrainingDay(dayKey));
  return result.current.isTrainingDay;
};

const run8k = (dayKey: string) => ({ finishedAt: atLocal(dayKey, 7, 30), distanceM: 8000, durationSeconds: 2700 });

beforeEach(() => jest.useFakeTimers(FROZEN_CLOCK));
afterEach(() => jest.useRealTimers());

describe('useIsTrainingDay — le jour d’entraînement', () => {
  it('séance de muscu terminée ce jour (jour local de la fin, 23 h 30 comprise)', async () => {
    const sources = { workouts: [{ finishedAt: atLocal(YESTERDAY, 23, 30) }] };
    expect(await trainedOn(YESTERDAY, sources)).toBe(true);
    expect(await trainedOn(TODAY, sources)).toBe(false);
  });

  it('course terminée ce jour', async () => {
    expect(await trainedOn(TODAY, { runs: [run8k(TODAY)] })).toBe(true);
  });

  it('une autre activité seule fait un jour d’entraînement (AUTRE-01), au jour local de son début', async () => {
    const sources = { activities: [{ startedAt: atLocal(YESTERDAY, 23, 50) }] };
    expect(await trainedOn(YESTERDAY, sources)).toBe(true);
    expect(await trainedOn(TODAY, sources)).toBe(false);
  });

  it('séance planifiée : anticipée aujourd’hui et après, jamais avant', async () => {
    const sources = { plannedDays: [YESTERDAY, TODAY, TOMORROW] };
    expect(await trainedOn(YESTERDAY, sources)).toBe(false);
    expect(await trainedOn(TODAY, sources)).toBe(true);
    expect(await trainedOn(TOMORROW, sources)).toBe(true);
  });

  it('une séance sans fin ne compte pas', async () => {
    expect(await trainedOn(TODAY, { workouts: [{ finishedAt: null }] })).toBe(false);
  });
});

describe('useDayCalorieTarget — mode `fixed`', () => {
  it('jour de repos : socle `tdee` + objectif, pas de bonus', async () => {
    expect(await targetOn(TODAY)).toEqual({
      target: 2359,
      effectiveTarget: 2359,
      trainingBonus: 0,
      bonusSource: 'none',
      isTrainingDay: false,
    });
  });

  it('séance faite : forfait', async () => {
    expect(await targetOn(TODAY, { workouts: [{ finishedAt: atLocal(TODAY, 18) }] })).toEqual({
      target: 2359,
      effectiveTarget: 2659,
      trainingBonus: 300,
      bonusSource: 'forfait',
      isTrainingDay: true,
    });
  });

  it('autre activité seule : forfait aussi', async () => {
    expect((await targetOn(TODAY, { activities: [{ startedAt: atLocal(TODAY, 10) }] })).effectiveTarget).toBe(2659);
  });

  it('séance planifiée demain : forfait anticipé demain ; hier, rien', async () => {
    expect((await targetOn(TOMORROW, { plannedDays: [TOMORROW] })).effectiveTarget).toBe(2659);
    expect((await targetOn(YESTERDAY, { plannedDays: [YESTERDAY] })).effectiveTarget).toBe(2359);
  });

  it('forfait à 0 : aucun bonus, et pas un « jour d’entraînement » pour la cible', async () => {
    expect(
      await targetOn(TODAY, { nutrition: { trainingDayBonus: 0 }, workouts: [{ finishedAt: atLocal(TODAY, 18) }] }),
    ).toMatchObject({ effectiveTarget: 2359, trainingBonus: 0, bonusSource: 'none', isTrainingDay: false });
  });

  it('« vie réelle » le jour même : objectif au maintien (le `tdee` seul) ; le lendemain seulement : rien', async () => {
    expect((await targetOn(TODAY, { periods: [{ startedOn: TODAY, endsOn: TODAY }] })).target).toBe(2759);
    expect((await targetOn(TODAY, { periods: [{ startedOn: TOMORROW, endsOn: TOMORROW }] })).target).toBe(2359);
  });

  it('surcharge manuelle : prime sur l’objectif et la vie réelle, le forfait s’ajoute', async () => {
    expect(
      await targetOn(TODAY, {
        nutrition: { manualCalories: 2000 },
        periods: [{ startedOn: TODAY, endsOn: TODAY }],
        workouts: [{ finishedAt: atLocal(TODAY, 18) }],
      }),
    ).toMatchObject({ target: 2000, effectiveTarget: 2300 });
  });

  it('sans profil nutritionnel : objectif du but principal, mode forfait, forfait 0', async () => {
    const expected = targetCalories(
      tdee({ sex: 'male', weightKg: 80, heightCm: 180, age: 30, activityLevel: 'moderate' }) as number,
      objectiveFromGoal('muscle'),
    );
    expect(await targetOn(TODAY, { nutrition: null, workouts: [{ finishedAt: atLocal(TODAY, 18) }] })).toEqual({
      target: expected,
      effectiveTarget: expected,
      trainingBonus: 0,
      bonusSource: 'none',
      isTrainingDay: false,
    });
  });

  it('profil incomplet (pas de date de naissance) : aucune cible', async () => {
    expect(
      await targetOn(TODAY, { profile: { birthDate: null as unknown as string }, workouts: [{ finishedAt: atLocal(TODAY, 18) }] }),
    ).toEqual({ target: null, effectiveTarget: null, trainingBonus: 300, bonusSource: 'forfait', isTrainingDay: false });
  });
});

describe('useDayCalorieTarget — mode `auto`', () => {
  const auto = { trainingBonusMode: 'auto' as const };

  it('course du jour : sa dépense, à la **dernière pesée** — le socle, lui, garde le poids du profil', async () => {
    const result = await targetOn(TODAY, { nutrition: auto, latestWeightKg: 75, runs: [run8k(TODAY)] });
    const runKcal = estimateRunCalories({ distanceM: 8000, durationSeconds: 2700, weightKg: 75 });
    expect(runKcal).not.toBe(estimateRunCalories({ distanceM: 8000, durationSeconds: 2700, weightKg: 80 }));
    expect(result).toEqual({
      target: 2359,
      effectiveTarget: 2359 + runKcal,
      trainingBonus: runKcal,
      bonusSource: 'run',
      isTrainingDay: true,
    });
  });

  it('sans pesée : poids du profil', async () => {
    const runKcal = estimateRunCalories({ distanceM: 8000, durationSeconds: 2700, weightKg: 80 });
    expect((await targetOn(TODAY, { nutrition: auto, runs: [run8k(TODAY)] })).trainingBonus).toBe(runKcal);
  });

  it('deux courses le même jour : dépenses additionnées', async () => {
    const runKcal = estimateRunCalories({ distanceM: 8000, durationSeconds: 2700, weightKg: 80 });
    const runs = [run8k(TODAY), { ...run8k(TODAY), finishedAt: atLocal(TODAY, 19) }];
    expect((await targetOn(TODAY, { nutrition: auto, runs })).trainingBonus).toBe(2 * runKcal);
  });

  it('pilier course éteint : la course ne donne que le forfait', async () => {
    expect(
      await targetOn(TODAY, { nutrition: auto, activePillars: ['strength', 'nutrition'], runs: [run8k(TODAY)] }),
    ).toMatchObject({ trainingBonus: 300, bonusSource: 'forfait', effectiveTarget: 2659 });
  });

  it('séance de muscu sans course : forfait', async () => {
    expect(
      await targetOn(TODAY, { nutrition: auto, workouts: [{ finishedAt: atLocal(TODAY, 18) }] }),
    ).toMatchObject({ trainingBonus: 300, bonusSource: 'forfait' });
  });
});

describe('useDayCalorieTarget — mode `activities`', () => {
  const activities = { trainingBonusMode: 'activities' as const };

  it('socle hors sport + objectif + dépense réelle du jour', async () => {
    expect(await targetOn(TODAY, { nutrition: activities, energyByDay: { [TODAY]: 600 } })).toEqual({
      target: 2048,
      effectiveTarget: 2648,
      trainingBonus: 600,
      bonusSource: 'activities',
      isTrainingDay: true,
    });
  });

  it('séance faite mais aucune dépense retenue : ni bonus, ni « jour d’entraînement », aucun repli forfait', async () => {
    expect(
      await targetOn(TODAY, { nutrition: activities, workouts: [{ finishedAt: atLocal(TODAY, 18) }] }),
    ).toEqual({ target: 2048, effectiveTarget: 2048, trainingBonus: 0, bonusSource: 'none', isTrainingDay: false });
  });

  it('palier « assis » : socle 2 136', async () => {
    expect((await targetOn(TODAY, { nutrition: { ...activities, sportFreeLevel: 'seated' } })).target).toBe(1736);
  });

  it('jour futur : pas de dépense, pas d’anticipation', async () => {
    expect(await targetOn(TOMORROW, { nutrition: activities, plannedDays: [TOMORROW] })).toMatchObject({
      target: 2048,
      effectiveTarget: 2048,
      bonusSource: 'none',
    });
  });
});

describe('useDayCalorieTarget — le socle rendu (US NORYN-02, D1-A)', () => {
  it('`tdee` hors mode `activities`, socle hors sport sinon', async () => {
    setSources();
    const fixed = await renderHook(() => useDayCalorieTarget(TODAY));
    expect(fixed.result.current).toMatchObject({ socle: 2759, socleKind: 'tdee' });

    setSources({ nutrition: { trainingBonusMode: 'activities' } });
    const activities = await renderHook(() => useDayCalorieTarget(TODAY));
    expect(activities.result.current).toMatchObject({ socle: 2448, socleKind: 'sportFree' });
  });
});

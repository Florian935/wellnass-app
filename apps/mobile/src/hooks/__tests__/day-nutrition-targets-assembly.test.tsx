/**
 * US NORYN-02 — le **filet** des cibles de macros : `useDayNutritionTargets` (onglet Nutrition) et
 * `useProteinTarget` (brief du matin, « Que manger ? », Prisme).
 *
 * Écrit et vert **avant** l'extraction : il fige le comportement **actuel, défaut E4 compris**
 * (spec NORYN-02 §1.2). L'extraction (étape 3 du plan) ne doit rien y changer ; la réparation D1
 * (étape 4) n'y change que les lignes du tableau §1.2, chacune commentée.
 *
 * Profil A, sèche (40 / 35 / 25) : `tdee` 2 759 → base 2 359 ; socle hors sport 2 448 → base 2 048.
 */

import { renderHook } from '@testing-library/react-native';
import { objectiveFromGoal, trainingDayMacroGrams } from '@wellness/shared';

import { useDayNutritionTargets } from '../useDayNutritionTargets';
import { useProteinTarget } from '@/data/repositories/dashboard-repository';
import { FROZEN_CLOCK, TODAY, atLocal, setSources, type Sources } from '@/test-utils/day-target-sources';

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

const nutritionTargets = async (sources: Sources = {}) => {
  setSources(sources);
  const { result } = await renderHook(() => useDayNutritionTargets(TODAY));
  return result.current;
};

const proteinTarget = async (sources: Sources = {}) => {
  setSources(sources);
  const { result } = await renderHook(() => useProteinTarget());
  return result.current;
};

const activitiesMode = { trainingBonusMode: 'activities' as const };
const trainedToday = { workouts: [{ finishedAt: atLocal(TODAY, 18) }] };

beforeEach(() => jest.useFakeTimers(FROZEN_CLOCK));
afterEach(() => jest.useRealTimers());

describe('useDayNutritionTargets — l’onglet Nutrition', () => {
  it('`fixed`, repos : base 2 359, macros 236 / 206 / 66', async () => {
    expect(await nutritionTargets()).toMatchObject({
      tdeeValue: 2759,
      target: 2359,
      effectiveTarget: 2359,
      trainingBonus: 0,
      trainingApplies: false,
      targetMacros: { protein: 236, carbs: 206, fat: 66 },
      profileComplete: true,
    });
  });

  it('`fixed`, séance (forfait 300) : le bonus va aux glucides (MN-04)', async () => {
    expect(await nutritionTargets(trainedToday)).toMatchObject({
      effectiveTarget: 2659,
      trainingBonus: 300,
      trainingApplies: true,
      targetMacros: { protein: 236, carbs: 281, fat: 66 },
    });
  });

  // ── Défaut E4, figé tel quel avant l'extraction ──────────────────────────────────────────────
  it('`activities`, repos : base `tdee` (2 359) sous une cible de 2 048 — macros 2 362 kcal', async () => {
    expect(await nutritionTargets({ nutrition: activitiesMode })).toMatchObject({
      tdeeValue: 2759,
      target: 2359,
      effectiveTarget: 2048,
      targetMacros: { protein: 236, carbs: 206, fat: 66 },
    });
  });

  it('`activities`, 600 kcal dépensées : protéines 236', async () => {
    expect(await nutritionTargets({ nutrition: activitiesMode, energyByDay: { [TODAY]: 600 } })).toMatchObject({
      effectiveTarget: 2648,
      trainingBonus: 600,
      targetMacros: { protein: 236, carbs: 278, fat: 66 },
    });
  });

  it('macros manuelles complètes : telles quelles', async () => {
    expect(
      (await nutritionTargets({ nutrition: { manualProteinG: 150, manualCarbsG: 250, manualFatG: 70 } })).targetMacros,
    ).toEqual({ protein: 150, carbs: 250, fat: 70 });
  });

  it('une seule macro manuelle : les autres à 0', async () => {
    expect((await nutritionTargets({ nutrition: { manualCarbsG: 200 } })).targetMacros).toEqual({
      protein: 0,
      carbs: 200,
      fat: 0,
    });
  });

  it('objectif jamais posé : celui du but principal', async () => {
    const result = await nutritionTargets({ nutrition: { objective: null as unknown as 'cut' } });
    expect(result.targetMacros).toEqual(
      trainingDayMacroGrams({ targetBase: result.target as number, effectiveTarget: result.target as number, objective: objectiveFromGoal('muscle') }),
    );
  });

  it('profil incomplet : pas de cible, mais les macros manuelles restent', async () => {
    expect(
      await nutritionTargets({ profile: { birthDate: null as unknown as string }, nutrition: { manualProteinG: 150 } }),
    ).toMatchObject({
      tdeeValue: null,
      target: null,
      effectiveTarget: null,
      targetMacros: { protein: 150, carbs: 0, fat: 0 },
      profileComplete: false,
    });
  });

  it('profil incomplet, sans macros manuelles : aucune macro', async () => {
    expect((await nutritionTargets({ profile: { heightCm: null as unknown as number } })).targetMacros).toBeNull();
  });
});

describe('useProteinTarget — le brief du matin, « Que manger ? », Prisme', () => {
  it('`fixed`, repos : 236', async () => {
    expect(await proteinTarget()).toBe(236);
  });

  // ── Défaut : le bonus gonfle les protéines (contre MN-04 D1), figé tel quel ──────────────────
  it('`fixed`, séance : 266 (cible effective)', async () => {
    expect(await proteinTarget(trainedToday)).toBe(266);
  });

  it('`activities`, repos : 205', async () => {
    expect(await proteinTarget({ nutrition: activitiesMode })).toBe(205);
  });

  it('`activities`, 600 kcal : 265', async () => {
    expect(await proteinTarget({ nutrition: activitiesMode, energyByDay: { [TODAY]: 600 } })).toBe(265);
  });

  it('protéines manuelles : la saisie', async () => {
    expect(await proteinTarget({ nutrition: { manualProteinG: 150 } })).toBe(150);
  });

  it('glucides manuels seuls : le calcul', async () => {
    expect(await proteinTarget({ nutrition: { manualCarbsG: 200 } })).toBe(236);
  });

  it('objectif nutritionnel jamais posé : null', async () => {
    expect(await proteinTarget({ nutrition: { objective: null as unknown as 'cut' } })).toBeNull();
  });

  it('profil incomplet : null', async () => {
    expect(await proteinTarget({ profile: { weightKg: null as unknown as number } })).toBeNull();
  });
});

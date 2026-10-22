/**
 * US CIBLE-01 — le **filet** de `useDailyCalorieTargets`, et de ce qui en dépend (adhérence NUTR-10,
 * bilan NUTR-18, groupes d'APPORT-01).
 *
 * Écrit et vert **avant** que le hook ne passe par la composition de NORYN-02 : chaque test qui ne
 * porte pas d'étiquette `CIBLE-01 C<n>` est resté vert **sans une ligne modifiée** après. Les tests
 * étiquetés figeaient la valeur d'avant d'un cas que la spec (§6) annonce comme changé : seul leur
 * attendu a bougé, à l'étape 3, avec la référence au cas.
 *
 * Profil A (homme, 80 kg, 180 cm, 30 ans) : `tdee` « modéré » 2 759, socle hors sport « debout »
 * 2 448 ; sèche = −400 ; forfait 300.
 */

import { renderHook } from '@testing-library/react-native';
import { estimateRunCalories, objectiveFromGoal, targetCalories, tdee } from '@wellness/shared';

import {
  useDailyCalorieTargets,
  useGoalAdherenceForRange,
  useTrainingNutritionCross,
} from '../dashboard-repository';
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
// `usePlannedDayKeys` est déclaré dès maintenant : la lecture par plage (étape 2) le lira, et ce fichier
// ne doit pas changer pour autant.
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

const J = (n: number) => shiftKey(TODAY, n);
const run8k = (dayKey: string) => ({ finishedAt: atLocal(dayKey, 7, 45), distanceM: 8000, durationSeconds: 2700 });
const meal = (dayKey: string, kcal = 2000) => ({ logDate: dayKey, kcal });

/** Les jours de `useDailyCalorieTargets(from, to)`, réduits à ce qui se lit à l'écran. */
const daysOf = async (from: string, to: string | null, sources: Sources) => {
  setSources(sources);
  const { result } = await renderHook(() => useDailyCalorieTargets(from, to));
  return result.current;
};

const dayOf = async (dayKey: string, sources: Sources) => {
  const { days } = await daysOf(J(-30), null, sources);
  const day = days.find((d) => d.dayKey === dayKey);
  return day ? { effectiveTarget: day.effectiveTarget, isTrainingDay: day.isTrainingDay } : undefined;
};

beforeEach(() => jest.useFakeTimers(FROZEN_CLOCK));
afterEach(() => jest.useRealTimers());

describe('les jours rendus', () => {
  it('seulement les jours notés, bornés à `toKey` ; `toKey` nul = sans borne haute (un repas daté de demain compris)', async () => {
    const sources = { dailyKcal: [meal(J(-3)), meal(J(-1)), meal(J(1))] };
    expect((await daysOf(J(-5), J(-2), sources)).days.map((d) => d.dayKey)).toEqual([J(-3)]);
    expect((await daysOf(J(-5), J(-1), sources)).days.map((d) => d.dayKey)).toEqual([J(-3), J(-1)]);
    expect((await daysOf(J(-5), null, sources)).days.map((d) => d.dayKey)).toEqual([J(-3), J(-1), J(1)]);
  });

  it('les kcal du jour sont celles des totaux', async () => {
    expect((await daysOf(J(-5), null, { dailyKcal: [meal(J(-2), 1234)] })).days[0]!.kcal).toBe(1234);
  });

  it('marge de l’utilisateur, sinon 10 % ; `hasTarget` ; `weightKg` = dernière pesée, sinon profil', async () => {
    const reglee = await daysOf(J(-5), null, { nutrition: { adherenceMarginPct: 5 }, latestWeightKg: 76 });
    expect(reglee.marginPct).toBe(5);
    expect(reglee.hasTarget).toBe(true);
    expect(reglee.weightKg).toBe(76);
    const defaut = await daysOf(J(-5), null, { nutrition: { adherenceMarginPct: null as unknown as number } });
    expect(defaut.marginPct).toBe(10);
    expect(defaut.weightKg).toBe(80);
  });

  it('profil incomplet : aucune cible, `hasTarget` faux', async () => {
    const out = await daysOf(J(-5), null, { profile: { weightKg: null as unknown as number }, dailyKcal: [meal(J(-1))] });
    expect(out.hasTarget).toBe(false);
    expect(out.days[0]!.effectiveTarget).toBeNull();
  });
});

describe('mode `fixed`', () => {
  it('jour de repos : socle `tdee` + objectif', async () => {
    expect(await dayOf(J(-1), { dailyKcal: [meal(J(-1))] })).toEqual({ effectiveTarget: 2359, isTrainingDay: false });
  });

  it('séance de muscu terminée : forfait', async () => {
    const sources = { dailyKcal: [meal(J(-1))], workouts: [{ finishedAt: atLocal(J(-1), 19) }] };
    expect(await dayOf(J(-1), sources)).toEqual({ effectiveTarget: 2659, isTrainingDay: true });
  });

  it('séance terminée à 23 h 50 : le jour local de la fin', async () => {
    const sources = { dailyKcal: [meal(J(-2)), meal(J(-1))], workouts: [{ finishedAt: atLocal(J(-2), 23, 50) }] };
    expect((await dayOf(J(-2), sources))!.effectiveTarget).toBe(2659);
    expect((await dayOf(J(-1), sources))!.effectiveTarget).toBe(2359);
  });

  it('course terminée : forfait', async () => {
    expect(await dayOf(J(-1), { dailyKcal: [meal(J(-1))], runs: [run8k(J(-1))] })).toEqual({
      effectiveTarget: 2659,
      isTrainingDay: true,
    });
  });

  it('une séance sans fin ne compte pas', async () => {
    expect((await dayOf(J(-1), { dailyKcal: [meal(J(-1))], workouts: [{ finishedAt: null }] }))!.effectiveTarget).toBe(2359);
  });

  it('séance planifiée hier, pas faite : jamais anticipée', async () => {
    const sources = { dailyKcal: [meal(J(-1))], plannedSessions: [{ date: J(-1) }] };
    expect(await dayOf(J(-1), sources)).toEqual({ effectiveTarget: 2359, isTrainingDay: false });
  });

  it('CIBLE-01 C1 — autre activité seule : le forfait, comme Aujourd’hui (spec §6 C1)', async () => {
    const sources = { dailyKcal: [meal(J(-1))], activities: [{ startedAt: atLocal(J(-1), 10) }] };
    expect(await dayOf(J(-1), sources)).toEqual({ effectiveTarget: 2659, isTrainingDay: true });
  });

  it('CIBLE-01 C2 — séance planifiée aujourd’hui, pas encore faite : le forfait anticipé (spec §6 C2, D1)', async () => {
    const sources = { dailyKcal: [meal(TODAY)], plannedSessions: [{ date: TODAY }] };
    expect(await dayOf(TODAY, sources)).toEqual({ effectiveTarget: 2659, isTrainingDay: true });
  });

  it('CIBLE-01 C2 — séance `done` sans séance enregistrée, aujourd’hui : le forfait (spec §6 C2, C5)', async () => {
    const sources = { dailyKcal: [meal(TODAY)], plannedSessions: [{ date: TODAY, status: 'done' as const }] };
    expect((await dayOf(TODAY, sources))!.effectiveTarget).toBe(2659);
  });

  it('CIBLE-01 C3 — repas daté de demain, séance planifiée demain : le forfait anticipé (spec §6 C3)', async () => {
    const sources = { dailyKcal: [meal(J(1))], plannedSessions: [{ date: J(1) }] };
    expect(await dayOf(J(1), sources)).toEqual({ effectiveTarget: 2659, isTrainingDay: true });
  });

  it('séance sautée aujourd’hui : jamais de forfait', async () => {
    const sources = { dailyKcal: [meal(TODAY)], plannedSessions: [{ date: TODAY, status: 'skipped' as const }] };
    expect((await dayOf(TODAY, sources))!.effectiveTarget).toBe(2359);
  });

  it('période « vie réelle » sur le seul jour : maintien ce jour-là, sèche ailleurs', async () => {
    const sources = { dailyKcal: [meal(J(-2)), meal(J(-1))], periods: [{ startedOn: J(-1), endsOn: J(-1) }] };
    expect((await dayOf(J(-1), sources))!.effectiveTarget).toBe(2759);
    expect((await dayOf(J(-2), sources))!.effectiveTarget).toBe(2359);
  });

  it('surcharge manuelle : base = surcharge, même en vie réelle ; forfait ajouté', async () => {
    const sources = {
      nutrition: { manualCalories: 2000 },
      dailyKcal: [meal(J(-2)), meal(J(-1))],
      workouts: [{ finishedAt: atLocal(J(-1), 19) }],
      periods: [{ startedOn: J(-2), endsOn: J(-2) }],
    };
    expect((await dayOf(J(-2), sources))!.effectiveTarget).toBe(2000);
    expect((await dayOf(J(-1), sources))!.effectiveTarget).toBe(2300);
  });

  it('forfait à 0 : un jour de séance garde la base', async () => {
    const sources = { nutrition: { trainingDayBonus: 0 }, dailyKcal: [meal(J(-1))], workouts: [{ finishedAt: atLocal(J(-1), 19) }] };
    expect(await dayOf(J(-1), sources)).toEqual({ effectiveTarget: 2359, isTrainingDay: true });
  });

  it('aucun profil nutritionnel : objectif du but principal, aucun bonus', async () => {
    const base = targetCalories(
      tdee({ sex: 'male', weightKg: 80, heightCm: 180, age: 30, activityLevel: 'moderate' })!,
      objectiveFromGoal('muscle'),
    );
    const sources = { nutrition: null, dailyKcal: [meal(J(-1))], workouts: [{ finishedAt: atLocal(J(-1), 19) }] };
    expect((await dayOf(J(-1), sources))!.effectiveTarget).toBe(base);
  });
});

describe('mode `auto`', () => {
  const auto = { trainingBonusMode: 'auto' as const };

  it('course du jour, pilier course actif : sa dépense, au poids de la dernière pesée', async () => {
    const sources = { nutrition: auto, latestWeightKg: 70, dailyKcal: [meal(J(-1))], runs: [run8k(J(-1))] };
    const kcal = estimateRunCalories({ distanceM: 8000, durationSeconds: 2700, weightKg: 70 });
    expect(await dayOf(J(-1), sources)).toEqual({ effectiveTarget: 2359 + kcal, isTrainingDay: true });
  });

  it('deux courses le même jour : dépenses additionnées', async () => {
    const sources = { nutrition: auto, dailyKcal: [meal(J(-1))], runs: [run8k(J(-1)), run8k(J(-1))] };
    const kcal = estimateRunCalories({ distanceM: 8000, durationSeconds: 2700, weightKg: 80 });
    expect((await dayOf(J(-1), sources))!.effectiveTarget).toBe(2359 + 2 * kcal);
  });

  it('pilier course éteint : le forfait, jamais la dépense de la course', async () => {
    const sources = {
      nutrition: auto,
      activePillars: ['strength', 'nutrition'],
      dailyKcal: [meal(J(-1))],
      runs: [run8k(J(-1))],
    };
    expect((await dayOf(J(-1), sources))!.effectiveTarget).toBe(2659);
  });

  it('séance de muscu sans course : le forfait', async () => {
    const sources = { nutrition: auto, dailyKcal: [meal(J(-1))], workouts: [{ finishedAt: atLocal(J(-1), 19) }] };
    expect((await dayOf(J(-1), sources))!.effectiveTarget).toBe(2659);
  });

  it('CIBLE-01 C1 — autre activité seule : le forfait (spec §6 C1)', async () => {
    const sources = { nutrition: auto, dailyKcal: [meal(J(-1))], activities: [{ startedAt: atLocal(J(-1), 10) }] };
    expect((await dayOf(J(-1), sources))!.effectiveTarget).toBe(2659);
  });

  it('CIBLE-01 C2 — séance planifiée aujourd’hui : le forfait anticipé (spec §6 C2)', async () => {
    const sources = { nutrition: auto, dailyKcal: [meal(TODAY)], plannedSessions: [{ date: TODAY }] };
    expect((await dayOf(TODAY, sources))!.effectiveTarget).toBe(2659);
  });
});

describe('mode `activities`', () => {
  const activities = { trainingBonusMode: 'activities' as const };

  it('socle hors sport + objectif ; la dépense du jour s’ajoute', async () => {
    const sources = { nutrition: activities, dailyKcal: [meal(J(-2)), meal(J(-1))], energyByDay: { [J(-1)]: 500 } };
    expect((await dayOf(J(-2), sources))!.effectiveTarget).toBe(2048);
    expect((await dayOf(J(-1), sources))!.effectiveTarget).toBe(2548);
  });

  it('séance faite : sa dépense, et jour d’entraînement', async () => {
    const sources = {
      nutrition: activities,
      dailyKcal: [meal(J(-1))],
      workouts: [{ finishedAt: atLocal(J(-1), 19) }],
      energyByDay: { [J(-1)]: 170 },
    };
    expect(await dayOf(J(-1), sources)).toEqual({ effectiveTarget: 2218, isTrainingDay: true });
  });

  it('CIBLE-01 C4 — autre activité seule : la cible prend sa dépense, et c’est un jour d’entraînement (spec §6 C4)', async () => {
    const sources = {
      nutrition: activities,
      dailyKcal: [meal(J(-1))],
      activities: [{ startedAt: atLocal(J(-1), 10) }],
      energyByDay: { [J(-1)]: 500 },
    };
    expect(await dayOf(J(-1), sources)).toEqual({ effectiveTarget: 2548, isTrainingDay: true });
  });

  it('CIBLE-01 C4 — séance planifiée aujourd’hui : cible de base, mais un jour d’entraînement (spec §6 C4, D5)', async () => {
    const sources = { nutrition: activities, dailyKcal: [meal(TODAY)], plannedSessions: [{ date: TODAY }] };
    expect(await dayOf(TODAY, sources)).toEqual({ effectiveTarget: 2048, isTrainingDay: true });
  });
});

describe('adhérence et bilan (`useGoalAdherenceForRange`)', () => {
  const adherenceOf = async (from: string, sources: Sources) => {
    setSources(sources);
    const { result } = await renderHook(() => useGoalAdherenceForRange(from, null));
    const { isLoading: _ignored, ...rest } = result.current;
    return rest;
  };

  it('CIBLE-01 C1 et C2 — un jour à autre activité seule et aujourd’hui à séance prévue, jugés avec le forfait (spec §6)', async () => {
    // 2 650 kcal : au-dessus de 2 359 (+ 10 % = 2 595), dans la marge de 2 659.
    const sources = {
      dailyKcal: [meal(J(-1), 2650), meal(TODAY, 2650)],
      activities: [{ startedAt: atLocal(J(-1), 10) }],
      plannedSessions: [{ date: TODAY }],
    };
    expect(await adherenceOf(J(-7), sources)).toEqual({
      loggedDays: 2,
      daysInTarget: 2,
      pct: 100,
      marginPct: 10,
      hasTarget: true,
      balanceKcal: -18,
      daysAbove: 0,
      daysBelow: 2,
    });
  });

  it('jours de séance faits : jugés avec le forfait', async () => {
    const sources = {
      dailyKcal: [meal(J(-2), 2650), meal(J(-1), 2650)],
      workouts: [{ finishedAt: atLocal(J(-2), 19) }],
      runs: [run8k(J(-1))],
    };
    const out = await adherenceOf(J(-7), sources);
    expect(out.daysInTarget).toBe(2);
    expect(out.balanceKcal).toBe(-18);
  });
});

describe('APPORT-01 — les groupes (`useTrainingNutritionCross`)', () => {
  const crossOf = async (sources: Sources) => {
    setSources(sources);
    const { result } = await renderHook(() => useTrainingNutritionCross());
    return result.current;
  };

  // Trois séances faites, trois repos ; plus un jour à autre activité seule et aujourd'hui à séance prévue.
  const base: Sources = {
    dailyKcal: [
      meal(J(-9), 2600),
      meal(J(-8), 2600),
      meal(J(-7), 2600),
      meal(J(-6), 2000),
      meal(J(-5), 2000),
      meal(J(-4), 2000),
      meal(J(-3), 3000),
      meal(TODAY, 3000),
    ],
    workouts: [{ finishedAt: atLocal(J(-9), 19) }, { finishedAt: atLocal(J(-8), 19) }],
    runs: [run8k(J(-7))],
    activities: [{ startedAt: atLocal(J(-3), 10) }],
    plannedSessions: [{ date: TODAY }],
  };

  it('CIBLE-01 C4 — l’autre activité et la séance prévue d’aujourd’hui comptent en « séance » (spec §6 C4, D5)', async () => {
    const { energy } = await crossOf(base);
    expect(energy).toEqual({
      trainingAvgKcal: 2760,
      restAvgKcal: 2000,
      deltaKcal: 760,
      trainingDays: 5,
      restDays: 3,
    });
  });

  it('CIBLE-01 C4 — mêmes groupes en mode `activities`', async () => {
    const { energy } = await crossOf({ ...base, nutrition: { trainingBonusMode: 'activities' } });
    expect(energy?.trainingDays).toBe(5);
    expect(energy?.restDays).toBe(3);
  });
});

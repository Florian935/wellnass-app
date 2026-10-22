import { describe, expect, it } from 'vitest';
import { composeCalorieTargetsForDays } from './day-target-range';
import { composeDayCalorieTarget, trainedOnDay, type TargetNutritionProfile } from './day-target';
import type { Pillar } from './pillar';

/** Rattachement **non local** : le jour UTC de l'instant (la brique ne lit aucun fuseau). */
const utcDay = (iso: string) => iso.slice(0, 10);
const AT = new Date(Date.UTC(2026, 9, 8, 12));

const dayKeyAt = (start: string, n: number) => {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** 400 jours, du 06/09/2025 au 09/10/2026 ; « aujourd'hui » au milieu. */
const START = '2025-09-06';
const DAYS = Array.from({ length: 400 }, (_, n) => dayKeyAt(START, n));
const TODAY = DAYS[200]!;

const PROFILE = { sex: 'male' as const, weightKg: 80, heightCm: 180, birthDate: '1996-01-15', mainGoal: 'muscle' as const };
const nutrition = (overrides: Partial<TargetNutritionProfile> = {}): TargetNutritionProfile => ({
  objective: 'cut',
  activityLevel: 'moderate',
  manualCalories: null,
  trainingDayBonus: 300,
  trainingBonusMode: 'fixed',
  sportFreeLevel: 'standing',
  ...overrides,
});

/**
 * Un jeu qui contient chaque cas de la spec §6 : séances, courses, autres activités seules, séances
 * planifiées passées et futures, une séance sans fin, des instants à 23 h 50, deux courses le même jour,
 * des périodes « vie réelle », des dépenses.
 */
const workouts = [
  ...DAYS.filter((_, i) => i % 3 === 0).map((d) => ({ finishedAt: `${d}T18:00:00.000Z` })),
  { finishedAt: null },
  { finishedAt: `${DAYS[50]}T23:50:00.000Z` },
];
const completedRuns = [
  ...DAYS.filter((_, i) => i % 5 === 1).map((d) => ({ finishedAt: `${d}T07:00:00.000Z`, distanceM: 8000, durationSeconds: 2700 })),
  { finishedAt: `${DAYS[201]}T19:00:00.000Z`, distanceM: 5000, durationSeconds: 1800 },
  { finishedAt: `${DAYS[201]}T07:00:00.000Z`, distanceM: 10000, durationSeconds: 3300 },
  { finishedAt: null, distanceM: 3000, durationSeconds: 900 },
];
const activities = [
  ...DAYS.filter((_, i) => i % 7 === 2).map((d) => ({ startedAt: `${d}T10:00:00.000Z` })),
  { startedAt: `${DAYS[120]}T23:50:00.000Z` },
];
const plannedDayKeys = new Set(DAYS.filter((_, i) => i % 4 === 3));
const energyKcalByDay = new Map(DAYS.filter((_, i) => i % 2 === 0).map((d, i) => [d, 100 + (i % 9) * 60]));
const realLifePeriods = [
  { startedOn: DAYS[30]!, endsOn: DAYS[36]! },
  { startedOn: DAYS[203]!, endsOn: DAYS[204]! },
];

const common = {
  todayKey: TODAY,
  profile: PROFILE,
  latestWeightKg: 76,
  realLifePeriods,
  workouts,
  completedRuns,
  activities,
  plannedDayKeys,
  energyKcalByDay,
  dayKeyOf: utcDay,
  at: AT,
};

const SCENARIOS: { name: string; nutritionProfile: TargetNutritionProfile | null; activePillars: Pillar[] | null }[] = [
  { name: '`fixed`', nutritionProfile: nutrition(), activePillars: ['strength', 'running', 'nutrition'] },
  { name: '`auto`', nutritionProfile: nutrition({ trainingBonusMode: 'auto' }), activePillars: ['strength', 'running', 'nutrition'] },
  { name: '`auto`, pilier course éteint', nutritionProfile: nutrition({ trainingBonusMode: 'auto' }), activePillars: ['strength', 'nutrition'] },
  { name: '`activities`', nutritionProfile: nutrition({ trainingBonusMode: 'activities' }), activePillars: null },
  { name: 'surcharge manuelle', nutritionProfile: nutrition({ manualCalories: 2000 }), activePillars: null },
  { name: 'aucun profil nutritionnel', nutritionProfile: null, activePillars: null },
];

describe('composeCalorieTargetsForDays — l’équivalence (spec R3)', () => {
  it.each(SCENARIOS)('$name : chaque jour vaut les compositions appelées sur les tableaux entiers', ({ nutritionProfile, activePillars }) => {
    const out = composeCalorieTargetsForDays({ ...common, dayKeys: DAYS, nutritionProfile, activePillars });
    expect(out.size).toBe(DAYS.length);
    for (const dayKey of DAYS) {
      const whole = { dayKey, todayKey: TODAY, workouts, completedRuns, activities, dayKeyOf: utcDay };
      const trainedThatDay = trainedOnDay({ ...whole, hasPlanned: plannedDayKeys.has(dayKey) });
      const expected = composeDayCalorieTarget({
        dayKey,
        profile: PROFILE,
        nutritionProfile,
        latestWeightKg: 76,
        activePillars,
        realLifePeriods,
        trainedThatDay,
        completedRuns,
        energyKcal: energyKcalByDay.get(dayKey) ?? 0,
        dayKeyOf: utcDay,
        at: AT,
      });
      const done = trainedOnDay({ ...whole, hasPlanned: false });
      expect({ dayKey, ...out.get(dayKey) }).toEqual({
        dayKey,
        ...expected,
        trainedThatDay,
        trainedBy: done ? 'done' : trainedThatDay ? 'planned' : null,
      });
    }
  });

  it('le jeu couvre bien les cas de la spec : chaque branche est empruntée', () => {
    const out = composeCalorieTargetsForDays({ ...common, dayKeys: DAYS, nutritionProfile: nutrition({ trainingBonusMode: 'auto' }), activePillars: null });
    const sources = new Set([...out.values()].map((d) => d.bonusSource));
    expect(sources).toEqual(new Set(['run', 'forfait', 'none']));
    const by = new Set([...out.values()].map((d) => d.trainedBy));
    expect(by).toEqual(new Set(['done', 'planned', null]));
  });
});

describe('composeCalorieTargetsForDays — les jours rendus', () => {
  const nutritionProfile = nutrition();
  const run = (dayKeys: string[], over: Partial<typeof common> = {}) =>
    composeCalorieTargetsForDays({ ...common, ...over, dayKeys, nutritionProfile, activePillars: null });

  it('seulement les jours demandés, une fois chacun', () => {
    const out = run([DAYS[10]!, DAYS[3]!, DAYS[10]!]);
    expect([...out.keys()]).toEqual([DAYS[10], DAYS[3]]);
  });

  it('aucune journée demandée : rien', () => {
    expect(run([]).size).toBe(0);
  });

  it('un jour sans aucune ligne : la base, ni entraînement ni bonus', () => {
    const empty = { workouts: [], completedRuns: [], activities: [], plannedDayKeys: new Set<string>(), energyKcalByDay: new Map() };
    expect(run([TODAY], empty).get(TODAY)).toMatchObject({
      target: 2359,
      effectiveTarget: 2359,
      trainingBonus: 0,
      bonusSource: 'none',
      isTrainingDay: false,
      trainedThatDay: false,
      trainedBy: null,
    });
  });

  it('`trainedBy` : fait, seulement prévu, ou rien', () => {
    const lines = {
      workouts: [{ finishedAt: `${TODAY}T18:00:00.000Z` }],
      completedRuns: [],
      activities: [{ startedAt: `${DAYS[202]}T10:00:00.000Z` }],
      plannedDayKeys: new Set([TODAY, DAYS[201]!, DAYS[199]!]),
      energyKcalByDay: new Map(),
    };
    const out = run([DAYS[199]!, TODAY, DAYS[201]!, DAYS[202]!, DAYS[203]!], lines);
    expect(out.get(DAYS[199]!)!.trainedBy).toBeNull(); // planifiée hier : jamais anticipée
    expect(out.get(TODAY)!.trainedBy).toBe('done'); // faite (et planifiée)
    expect(out.get(DAYS[201]!)!.trainedBy).toBe('planned'); // demain, prévue
    expect(out.get(DAYS[202]!)!.trainedBy).toBe('done'); // une autre activité
    expect(out.get(DAYS[203]!)!.trainedBy).toBeNull();
  });

  it('le rattachement au jour est celui de `dayKeyOf` : une séance finie à 23 h 30 UTC passe au lendemain à UTC+2', () => {
    const plus2h = (iso: string) => new Date(new Date(iso).getTime() + 2 * 3_600_000).toISOString().slice(0, 10);
    const lines = {
      workouts: [{ finishedAt: `${DAYS[100]}T23:30:00.000Z` }],
      completedRuns: [],
      activities: [],
      plannedDayKeys: new Set<string>(),
      energyKcalByDay: new Map(),
    };
    const utc = run([DAYS[100]!, DAYS[101]!], lines);
    const paris = run([DAYS[100]!, DAYS[101]!], { ...lines, dayKeyOf: plus2h });
    expect([utc.get(DAYS[100]!)!.trainedThatDay, utc.get(DAYS[101]!)!.trainedThatDay]).toEqual([true, false]);
    expect([paris.get(DAYS[100]!)!.trainedThatDay, paris.get(DAYS[101]!)!.trainedThatDay]).toEqual([false, true]);
  });
});

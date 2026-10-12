import { describe, expect, it } from 'vitest';
import {
  appliedObjective,
  composeDayCalorieTarget,
  composeDayNutritionTargets,
  hasManualMacros,
  trainedOnDay,
  type TargetNutritionProfile,
} from './day-target';
import { objectiveFromGoal } from './nutrition';
import { estimateRunCalories } from './running';

/** Rattachement **non local** : le jour UTC de l'instant (la brique ne lit aucun fuseau). */
const utcDay = (iso: string) => iso.slice(0, 10);
const AT = new Date(Date.UTC(2026, 9, 8, 12));
const TODAY = '2026-10-08';

/** Profil A : BMR 1 780, `tdee` modéré 2 759, socle « debout » 2 448, « assis » 2 136 ; sèche −400. */
const PROFILE = { sex: 'male' as const, weightKg: 80, heightCm: 180, birthDate: '1996-01-15', mainGoal: 'muscle' as const };
const NUTRITION: TargetNutritionProfile = {
  objective: 'cut',
  activityLevel: 'moderate',
  manualCalories: null,
  trainingDayBonus: 300,
  trainingBonusMode: 'fixed',
  sportFreeLevel: null,
};

const base = {
  dayKey: TODAY,
  profile: PROFILE,
  nutritionProfile: NUTRITION,
  latestWeightKg: null,
  activePillars: ['strength', 'running', 'nutrition'] as const,
  realLifePeriods: [],
  trainedThatDay: false,
  completedRuns: [],
  energyKcal: 0,
  dayKeyOf: utcDay,
  at: AT,
};

describe('trainedOnDay (US NORYN-02)', () => {
  const none = { dayKey: TODAY, todayKey: TODAY, workouts: [], completedRuns: [], activities: [], hasPlanned: false, dayKeyOf: utcDay };

  it('rien → non', () => {
    expect(trainedOnDay(none)).toBe(false);
  });

  it('séance terminée ce jour (jour de la fin) ; sans fin, non', () => {
    expect(trainedOnDay({ ...none, workouts: [{ finishedAt: '2026-10-08T23:30:00.000Z' }] })).toBe(true);
    expect(trainedOnDay({ ...none, workouts: [{ finishedAt: null }] })).toBe(false);
    expect(trainedOnDay({ ...none, workouts: [{ finishedAt: '2026-10-07T23:30:00.000Z' }] })).toBe(false);
  });

  it('course terminée ce jour', () => {
    expect(trainedOnDay({ ...none, completedRuns: [{ finishedAt: '2026-10-08T06:00:00.000Z' }] })).toBe(true);
  });

  it('autre activité ce jour (jour du début), même filtrée d’avance', () => {
    expect(trainedOnDay({ ...none, activities: [{ startedAt: '2026-10-08T09:00:00.000Z' }] })).toBe(true);
    expect(trainedOnDay({ ...none, activities: [{ startedAt: '2026-10-07T09:00:00.000Z' }] })).toBe(false);
  });

  it('séance planifiée : anticipée aujourd’hui et après, jamais avant', () => {
    expect(trainedOnDay({ ...none, hasPlanned: true })).toBe(true);
    expect(trainedOnDay({ ...none, dayKey: '2026-10-09', hasPlanned: true })).toBe(true);
    expect(trainedOnDay({ ...none, dayKey: '2026-10-07', hasPlanned: true })).toBe(false);
  });
});

describe('composeDayCalorieTarget — socle, base, bonus (US NORYN-02)', () => {
  it('`fixed`, repos : socle `tdee`', () => {
    expect(composeDayCalorieTarget(base)).toEqual({
      socle: 2759,
      socleKind: 'tdee',
      target: 2359,
      effectiveTarget: 2359,
      trainingBonus: 0,
      bonusSource: 'none',
      isTrainingDay: false,
    });
  });

  it('`fixed`, jour d’entraînement : forfait', () => {
    expect(composeDayCalorieTarget({ ...base, trainedThatDay: true })).toMatchObject({
      effectiveTarget: 2659,
      trainingBonus: 300,
      bonusSource: 'forfait',
      isTrainingDay: true,
    });
  });

  it('`fixed`, forfait absent : 0, pas un jour d’entraînement pour la cible', () => {
    expect(
      composeDayCalorieTarget({ ...base, nutritionProfile: { ...NUTRITION, trainingDayBonus: null }, trainedThatDay: true }),
    ).toMatchObject({ trainingBonus: 0, bonusSource: 'none', isTrainingDay: false });
  });

  it('« vie réelle » ce jour : maintien ; un autre jour : rien', () => {
    expect(composeDayCalorieTarget({ ...base, realLifePeriods: [{ startedOn: TODAY, endsOn: TODAY }] }).target).toBe(2759);
    expect(composeDayCalorieTarget({ ...base, realLifePeriods: [{ startedOn: '2026-10-09', endsOn: '2026-10-10' }] }).target).toBe(2359);
  });

  it('surcharge manuelle : prime, bonus ajouté', () => {
    expect(
      composeDayCalorieTarget({
        ...base,
        nutritionProfile: { ...NUTRITION, manualCalories: 2000 },
        realLifePeriods: [{ startedOn: TODAY, endsOn: TODAY }],
        trainedThatDay: true,
      }),
    ).toMatchObject({ target: 2000, effectiveTarget: 2300 });
  });

  it('sans profil nutritionnel : objectif du but principal, `fixed`, forfait 0', () => {
    const result = composeDayCalorieTarget({ ...base, nutritionProfile: null, trainedThatDay: true });
    expect(result).toMatchObject({ socleKind: 'tdee', trainingBonus: 0, bonusSource: 'none' });
    expect(result.target).toBe(composeDayCalorieTarget({ ...base, nutritionProfile: { objective: objectiveFromGoal('muscle') } }).target);
  });

  it('profil incomplet ou absent : aucune cible', () => {
    expect(composeDayCalorieTarget({ ...base, profile: { ...PROFILE, birthDate: null } })).toMatchObject({
      socle: null,
      target: null,
      effectiveTarget: null,
      isTrainingDay: false,
    });
    expect(composeDayCalorieTarget({ ...base, profile: null }).target).toBeNull();
  });

  it('l’âge se prend à `at`', () => {
    const born = { ...PROFILE, birthDate: '1996-10-09' };
    const eve = composeDayCalorieTarget({ ...base, profile: born, at: new Date(Date.UTC(2026, 9, 8, 12)) });
    const day = composeDayCalorieTarget({ ...base, profile: born, at: new Date(Date.UTC(2026, 9, 9, 12)) });
    // 29 ans la veille (BMR 1 785 → 2 767), 30 ans le jour même (BMR 1 780 → 2 759).
    expect([eve.socle, day.socle]).toEqual([2767, 2759]);
  });
});

describe('composeDayCalorieTarget — mode `auto`', () => {
  const auto = { ...NUTRITION, trainingBonusMode: 'auto' as const };
  const run = { finishedAt: '2026-10-08T06:00:00.000Z', distanceM: 8000, durationSeconds: 2700 };

  it('course du jour : dépense au poids de la dernière pesée, socle au poids du profil', () => {
    const result = composeDayCalorieTarget({ ...base, nutritionProfile: auto, latestWeightKg: 75, completedRuns: [run], trainedThatDay: true });
    const kcal = estimateRunCalories({ distanceM: 8000, durationSeconds: 2700, weightKg: 75 });
    expect(result).toMatchObject({ target: 2359, trainingBonus: kcal, effectiveTarget: 2359 + kcal, bonusSource: 'run', isTrainingDay: true });
  });

  it('sans pesée : profil ; courses d’un autre jour ou sans fin : ignorées', () => {
    const result = composeDayCalorieTarget({
      ...base,
      nutritionProfile: auto,
      completedRuns: [run, { ...run, finishedAt: '2026-10-07T06:00:00.000Z' }, { ...run, finishedAt: null }],
      trainedThatDay: true,
    });
    expect(result.trainingBonus).toBe(estimateRunCalories({ distanceM: 8000, durationSeconds: 2700, weightKg: 80 }));
  });

  it('pilier course éteint : forfait ; piliers absents : tous actifs', () => {
    expect(
      composeDayCalorieTarget({ ...base, nutritionProfile: auto, activePillars: ['strength'], completedRuns: [run], trainedThatDay: true }),
    ).toMatchObject({ trainingBonus: 300, bonusSource: 'forfait' });
    expect(
      composeDayCalorieTarget({ ...base, nutritionProfile: auto, activePillars: null, completedRuns: [run], trainedThatDay: true }).bonusSource,
    ).toBe('run');
  });

  it('sans poids du tout : la course ne coûte rien, forfait', () => {
    expect(
      composeDayCalorieTarget({ ...base, profile: { ...PROFILE, weightKg: null }, nutritionProfile: auto, completedRuns: [run], trainedThatDay: true }),
    ).toMatchObject({ target: null, trainingBonus: 300, bonusSource: 'forfait' });
  });
});

describe('composeDayCalorieTarget — mode `activities`', () => {
  const activities = { ...NUTRITION, trainingBonusMode: 'activities' as const };

  it('socle hors sport (« debout » par défaut) + dépense réelle', () => {
    expect(composeDayCalorieTarget({ ...base, nutritionProfile: activities, energyKcal: 600 })).toEqual({
      socle: 2448,
      socleKind: 'sportFree',
      target: 2048,
      effectiveTarget: 2648,
      trainingBonus: 600,
      bonusSource: 'activities',
      isTrainingDay: true,
    });
  });

  it('jour d’entraînement sans dépense : rien, aucun repli', () => {
    expect(composeDayCalorieTarget({ ...base, nutritionProfile: activities, trainedThatDay: true })).toMatchObject({
      effectiveTarget: 2048,
      trainingBonus: 0,
      bonusSource: 'none',
      isTrainingDay: false,
    });
  });

  it('profil absent : pas de socle ; sexe non précisé : la moyenne des deux constantes', () => {
    expect(composeDayCalorieTarget({ ...base, profile: null, nutritionProfile: activities }).socle).toBeNull();
    // BMR « non précisé » = 1 780 − 5 − 78 = 1 697 → × 1,375 = 2 333,4 → 2 333.
    expect(composeDayCalorieTarget({ ...base, profile: { ...PROFILE, sex: null }, nutritionProfile: activities }).socle).toBe(2333);
  });

  it('palier « assis »', () => {
    expect(composeDayCalorieTarget({ ...base, nutritionProfile: { ...activities, sportFreeLevel: 'seated' } })).toMatchObject({
      socle: 2136,
      target: 1736,
    });
  });
});

describe('appliedObjective / hasManualMacros', () => {
  it('l’objectif choisi, sinon celui du but principal', () => {
    expect(appliedObjective({ objective: 'bulk' }, PROFILE)).toBe('bulk');
    expect(appliedObjective(null, PROFILE)).toBe(objectiveFromGoal('muscle'));
    expect(appliedObjective(null, null)).toBe(objectiveFromGoal(null));
  });

  it('une macro manuelle suffit', () => {
    expect(hasManualMacros(null)).toBe(false);
    expect(hasManualMacros({ manualFatG: 70 })).toBe(true);
    expect(hasManualMacros({ manualCarbsG: 0 })).toBe(true);
    expect(hasManualMacros({ manualProteinG: 150 })).toBe(true);
  });
});

describe('composeDayNutritionTargets — l’onglet Nutrition (comportement figé, E4 compris)', () => {
  const nutritionInput = {
    dayKey: TODAY,
    profile: PROFILE,
    nutritionProfile: NUTRITION,
    realLifePeriods: [],
    dayTarget: { effectiveTarget: 2359 },
    at: AT,
  };

  it('`fixed`, repos : base 2 359, macros 236 / 206 / 66', () => {
    expect(composeDayNutritionTargets(nutritionInput)).toEqual({
      tdeeValue: 2759,
      target: 2359,
      targetMacros: { protein: 236, carbs: 206, fat: 66 },
      profileComplete: true,
    });
  });

  it('le bonus du jour va aux glucides', () => {
    expect(composeDayNutritionTargets({ ...nutritionInput, dayTarget: { effectiveTarget: 2659 } }).targetMacros).toEqual({
      protein: 236,
      carbs: 281,
      fat: 66,
    });
  });

  it('« vie réelle » ce jour : base au maintien', () => {
    expect(
      composeDayNutritionTargets({ ...nutritionInput, realLifePeriods: [{ startedOn: TODAY, endsOn: TODAY }] }).target,
    ).toBe(2759);
  });

  it('macros manuelles, partielles comprises', () => {
    expect(
      composeDayNutritionTargets({ ...nutritionInput, nutritionProfile: { ...NUTRITION, manualCarbsG: 200 } }).targetMacros,
    ).toEqual({ protein: 0, carbs: 200, fat: 0 });
    expect(
      composeDayNutritionTargets({
        ...nutritionInput,
        nutritionProfile: { ...NUTRITION, manualProteinG: 150, manualFatG: 70 },
      }).targetMacros,
    ).toEqual({ protein: 150, carbs: 0, fat: 70 });
  });

  it('profil incomplet : ni base, ni macros calculées ; sans cible effective non plus', () => {
    expect(composeDayNutritionTargets({ ...nutritionInput, profile: { ...PROFILE, heightCm: null } })).toEqual({
      tdeeValue: null,
      target: null,
      targetMacros: null,
      profileComplete: false,
    });
    expect(composeDayNutritionTargets({ ...nutritionInput, dayTarget: { effectiveTarget: null } }).targetMacros).toBeNull();
    expect(composeDayNutritionTargets({ ...nutritionInput, profile: null, nutritionProfile: null }).profileComplete).toBe(false);
  });
});

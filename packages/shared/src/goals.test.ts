import { describe, expect, it } from 'vitest';

import {
  GOAL_KINDS,
  MAX_ACTIVE_GOALS,
  canCreateGoal,
  computeGoalProgress,
  goalWindowEnd,
  isGoalActive,
  validateGoalTarget,
  type Goal,
} from './goals';

const runGoal: Goal = {
  id: 'g1',
  kind: 'run_distance',
  targetValue: 50_000, // 50 km
  startValue: null,
  exerciseId: null,
  startDate: '2026-07-01',
  deadline: '2026-07-31',
};

const liftGoal: Goal = {
  id: 'g2',
  kind: 'exercise_1rm',
  targetValue: 105, // +5 kg sur un départ à 100
  startValue: 100,
  exerciseId: 'ex-bench',
  startDate: '2026-07-01',
  deadline: '2026-08-26',
};

describe('fenêtre de mesure', () => {
  it('s’arrête à aujourd’hui quand l’objectif court encore', () => {
    expect(goalWindowEnd(runGoal, '2026-07-15')).toBe('2026-07-15');
    expect(isGoalActive(runGoal, '2026-07-15')).toBe(true);
  });

  it('inclut le jour de l’échéance — l’objectif se clôt le lendemain', () => {
    expect(isGoalActive(runGoal, '2026-07-31')).toBe(true);
    expect(isGoalActive(runGoal, '2026-08-01')).toBe(false);
  });

  it('se FIGE à l’échéance, ce qui rend le verdict stable', () => {
    // C'est le mécanisme qui empêche une activité ultérieure de réussir un objectif passé.
    expect(goalWindowEnd(runGoal, '2026-09-30')).toBe('2026-07-31');
  });
});

describe('objectif de distance de course', () => {
  const runs = [
    { dayKey: '2026-06-28', distanceM: 10_000 }, // AVANT la fenêtre
    { dayKey: '2026-07-05', distanceM: 12_000 },
    { dayKey: '2026-07-12', distanceM: 8_000 },
    { dayKey: '2026-08-05', distanceM: 20_000 }, // APRÈS la fenêtre
  ];

  it('ne cumule que les courses de la fenêtre', () => {
    const p = computeGoalProgress({ goal: runGoal, runs, todayKey: '2026-07-15' });
    expect(p.currentValue).toBe(20_000);
    expect(p.ratio).toBeCloseTo(0.4, 5);
    expect(p.status).toBe('active');
  });

  it('rend 0 quand rien n’a été couru dans la fenêtre — c’est exact, pas une erreur', () => {
    const p = computeGoalProgress({ goal: runGoal, runs: [], todayKey: '2026-07-15' });
    expect(p.currentValue).toBe(0);
    expect(p.ratio).toBe(0);
    expect(p.unavailable).toBe(false);
  });

  it('reste « en cours » même à 100 % avant l’échéance', () => {
    // Atteindre sa cible en avance n'interdit pas de continuer à accumuler.
    const p = computeGoalProgress({
      goal: runGoal,
      runs: [{ dayKey: '2026-07-10', distanceM: 60_000 }],
      todayKey: '2026-07-15',
    });
    expect(p.status).toBe('active');
    expect(p.ratio).toBe(1);
    // Le ratio BRUT dépasse 1 : dépasser sa cible est une information, pas un débordement.
    expect(p.rawRatio).toBeCloseTo(1.2, 5);
  });

  it('conclut « atteint » après l’échéance si la cible est faite', () => {
    const p = computeGoalProgress({
      goal: runGoal,
      runs: [{ dayKey: '2026-07-20', distanceM: 50_000 }],
      todayKey: '2026-08-02',
    });
    expect(p.status).toBe('achieved');
  });

  it('conclut « non atteint » après l’échéance sinon', () => {
    const p = computeGoalProgress({ goal: runGoal, runs, todayKey: '2026-08-02' });
    expect(p.status).toBe('missed');
    // La course du 5 août ne compte PAS : hors fenêtre.
    expect(p.currentValue).toBe(20_000);
  });

  it('un verdict passé ne change pas quand on court davantage ensuite', () => {
    const avant = computeGoalProgress({ goal: runGoal, runs, todayKey: '2026-08-02' });
    const apres = computeGoalProgress({
      goal: runGoal,
      runs: [...runs, { dayKey: '2026-09-01', distanceM: 100_000 }],
      todayKey: '2026-09-15',
    });
    expect(avant.status).toBe('missed');
    expect(apres.status).toBe('missed');
    expect(apres.currentValue).toBe(avant.currentValue);
  });
});

describe('objectif de force sur un exercice', () => {
  const lifts = [
    { dayKey: '2026-06-20', exerciseId: 'ex-bench', estimated1RM: 108 }, // hors fenêtre
    { dayKey: '2026-07-10', exerciseId: 'ex-bench', estimated1RM: 102 },
    { dayKey: '2026-07-20', exerciseId: 'ex-bench', estimated1RM: 101 },
    { dayKey: '2026-07-22', exerciseId: 'ex-squat', estimated1RM: 150 }, // autre exercice
  ];

  it('mesure l’écart au départ figé, sur le MEILLEUR 1RM de la fenêtre', () => {
    const p = computeGoalProgress({ goal: liftGoal, lifts, todayKey: '2026-07-25' });
    expect(p.currentValue).toBe(102);
    // (102 − 100) / (105 − 100) = 0,4
    expect(p.ratio).toBeCloseTo(0.4, 5);
  });

  it('ignore les autres exercices et les séances hors fenêtre', () => {
    // Le 108 du 20 juin ne compte pas, sinon l'objectif serait déjà atteint à la création.
    const p = computeGoalProgress({ goal: liftGoal, lifts, todayKey: '2026-07-25' });
    expect(p.currentValue).not.toBe(108);
    expect(p.currentValue).not.toBe(150);
  });

  it('ne régresse jamais sous la valeur de départ', () => {
    // Une mauvaise séance ne doit pas faire reculer l'objectif.
    const p = computeGoalProgress({
      goal: liftGoal,
      lifts: [{ dayKey: '2026-07-10', exerciseId: 'ex-bench', estimated1RM: 90 }],
      todayKey: '2026-07-25',
    });
    expect(p.currentValue).toBe(100);
    expect(p.ratio).toBe(0);
  });

  it('part du départ quand aucune séance n’a eu lieu dans la fenêtre', () => {
    const p = computeGoalProgress({ goal: liftGoal, lifts: [], todayKey: '2026-07-25' });
    expect(p.currentValue).toBe(100);
    expect(p.ratio).toBe(0);
  });

  it('rend la progression NON CALCULABLE si l’exercice a été supprimé', () => {
    // `exercise_id` passe à NULL (on delete set null) : afficher 0 % se lirait comme un échec.
    const orphan: Goal = { ...liftGoal, exerciseId: null };
    const p = computeGoalProgress({ goal: orphan, lifts, todayKey: '2026-07-25' });
    expect(p.unavailable).toBe(true);
    expect(p.ratio).toBeNull();
  });

  it('refuse de diviser par un écart nul ou négatif', () => {
    const absurde: Goal = { ...liftGoal, targetValue: 100 }; // cible = départ
    const p = computeGoalProgress({ goal: absurde, lifts, todayKey: '2026-07-25' });
    expect(p.unavailable).toBe(true);
  });
});

describe('garde-fous de création', () => {
  it('plafonne à 3 objectifs actifs', () => {
    expect(MAX_ACTIVE_GOALS).toBe(3);
    expect(canCreateGoal(0)).toBe(true);
    expect(canCreateGoal(2)).toBe(true);
    expect(canCreateGoal(3)).toBe(false);
    expect(canCreateGoal(9)).toBe(false);
  });

  it('accepte une cible valide', () => {
    expect(
      validateGoalTarget({
        kind: 'exercise_1rm',
        targetValue: 105,
        startValue: 100,
        startDate: '2026-07-01',
        deadline: '2026-08-26',
      }),
    ).toBeNull();
  });

  it('REFUSE une cible de force déjà atteinte le jour de la création', () => {
    // Un objectif qui ne demande aucun effort n'est pas un objectif : l'anneau afficherait 100 %
    // immédiatement.
    for (const targetValue of [100, 95]) {
      expect(
        validateGoalTarget({
          kind: 'exercise_1rm',
          targetValue,
          startValue: 100,
          startDate: '2026-07-01',
          deadline: '2026-08-26',
        }),
      ).toBe('target_below_start');
    }
  });

  it('refuse une cible nulle ou négative, quel que soit le type', () => {
    for (const kind of GOAL_KINDS) {
      expect(
        validateGoalTarget({
          kind,
          targetValue: 0,
          startValue: null,
          startDate: '2026-07-01',
          deadline: '2026-07-31',
        }),
      ).toBe('invalid_target');
    }
  });

  it('refuse une échéance antérieure au début', () => {
    expect(
      validateGoalTarget({
        kind: 'run_distance',
        targetValue: 50_000,
        startValue: null,
        startDate: '2026-07-31',
        deadline: '2026-07-01',
      }),
    ).toBe('deadline_before_start');
  });

  it('n’impose pas de plancher à un objectif de cumul', () => {
    // Un cumul part de zéro : la règle « cible > départ » ne s'applique pas.
    expect(
      validateGoalTarget({
        kind: 'run_distance',
        targetValue: 1,
        startValue: null,
        startDate: '2026-07-01',
        deadline: '2026-07-31',
      }),
    ).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import {
  buildInsightCandidates,
  candidateFromDeficitVolume,
  candidateFromGoalAchieved,
  candidateFromMuscleBalance,
  candidateFromOvertrainingGuard,
  candidateFromRecentRecord,
  candidateFromTrainingLoad,
  candidateFromWeeklyDecision,
  candidatesFromWeeklyChanges,
  type GoalCandidateInput,
  type InsightSources,
  type RecordCandidateInput,
} from './insight-adapters';
import type { MuscleBalance, MuscleGroupBalance } from './muscle-balance';
import type { MuscleGroup } from './exercise';
import type { PillarWeek, WeeklyReview } from './weekly-review';

// ---------------------------------------------------------------------------
// Fabriques
// ---------------------------------------------------------------------------

const EMPTY_WEEK: PillarWeek = {
  workouts: 0,
  tonnageKg: 0,
  runs: 0,
  distanceM: 0,
  loggedDays: 0,
  daysInTarget: null,
  activeDays: 0,
};

function review(overrides: Partial<WeeklyReview> = {}): WeeklyReview {
  return {
    period: { start: '2026-07-27', end: '2026-08-02' },
    current: { ...EMPTY_WEEK, workouts: 3, tonnageKg: 11_240, activeDays: 4 },
    previous: null,
    recordsBeaten: 0,
    changes: { tonnage: null, distance: null, activeDays: null, loggedDays: null },
    isEmpty: false,
    decision: null,
    ...overrides,
  };
}

function group(muscle: MuscleGroup, sets: number, share: number): MuscleGroupBalance {
  return { muscle, sets, share, status: share < 1 / 12 ? 'neglected' : 'balanced' };
}

function balance(overrides: Partial<MuscleBalance> = {}): MuscleBalance {
  return {
    groups: [group('chest', 20, 0.3), group('back', 4, 0.07), group('legs', 18, 0.28)],
    neglected: ['back'],
    totalSets: 42,
    hasEnoughData: true,
    ...overrides,
  };
}

function goal(overrides: Partial<GoalCandidateInput> = {}): GoalCandidateInput {
  return {
    label: 'Développé couché',
    kind: 'exercise_1rm',
    targetValue: 100,
    currentValue: 102,
    deadline: '2026-08-01',
    status: 'achieved',
    ...overrides,
  };
}

function record(overrides: Partial<RecordCandidateInput> = {}): RecordCandidateInput {
  return {
    type: 'max_weight',
    value: 82.5,
    exerciseName: 'Développé couché',
    achievedOn: '2026-08-03',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Alertes
// ---------------------------------------------------------------------------

describe('candidateFromOvertrainingGuard', () => {
  it('rend null quand l’alerte ne se déclenche pas', () => {
    expect(
      candidateFromOvertrainingGuard({ show: false, severity: null, streakDays: 2 }),
    ).toBeNull();
  });

  it('rend null si show est vrai mais la gravité absente', () => {
    expect(
      candidateFromOvertrainingGuard({ show: true, severity: null, streakDays: 9 }),
    ).toBeNull();
  });

  it('transporte le niveau de gravité en variant et les jours en metrics', () => {
    const c = candidateFromOvertrainingGuard({ show: true, severity: 'streak', streakDays: 9 });
    expect(c).toEqual({
      id: 'overtraining_guard',
      family: 'alert',
      variant: 'streak',
      metrics: { streakDays: 9 },
      occurredOn: null,
      pillars: ['strength', 'running'],
    });
  });

  it('distingue le niveau aggravé', () => {
    const c = candidateFromOvertrainingGuard({
      show: true,
      severity: 'streakAndDeficit',
      streakDays: 11,
    });
    expect(c!.variant).toBe('streakAndDeficit');
  });
});

describe('candidateFromTrainingLoad', () => {
  it('rend null hors alerte', () => {
    expect(candidateFromTrainingLoad({ show: false, ratio: 1.5 })).toBeNull();
  });

  it('rend null si le ratio manque — pas d’affirmation sans chiffre', () => {
    expect(candidateFromTrainingLoad({ show: true, ratio: null })).toBeNull();
  });

  it('arrondit le ratio à 2 décimales', () => {
    const c = candidateFromTrainingLoad({ show: true, ratio: 1.4238095 });
    expect(c!.metrics).toEqual({ ratio: 1.42 });
    expect(c!.occurredOn).toBeNull();
    expect(c!.pillars).toEqual(['strength', 'running']);
  });
});

describe('candidateFromDeficitVolume', () => {
  it('rend null hors alerte', () => {
    expect(candidateFromDeficitVolume({ show: false, deficitPct: 0, loggedDays: 2 })).toBeNull();
  });

  it('transporte les deux chiffres de l’alerte', () => {
    const c = candidateFromDeficitVolume({ show: true, deficitPct: 18, loggedDays: 6 });
    expect(c!.metrics).toEqual({ deficitPct: 18, loggedDays: 6 });
    expect(c!.pillars).toEqual(['strength', 'nutrition']);
  });
});

// ---------------------------------------------------------------------------
// Célébrations
// ---------------------------------------------------------------------------

describe('candidateFromRecentRecord', () => {
  it('rend null sans record', () => {
    expect(candidateFromRecentRecord([])).toBeNull();
  });

  it('retient le record le plus récent, quel que soit l’ordre d’entrée', () => {
    const c = candidateFromRecentRecord([
      record({ achievedOn: '2026-07-20', exerciseName: 'Squat' }),
      record({ achievedOn: '2026-08-03', exerciseName: 'Développé couché' }),
      record({ achievedOn: '2026-07-28', exerciseName: 'Soulevé de terre' }),
    ]);
    expect(c!.subject).toBe('Développé couché');
    expect(c!.occurredOn).toBe('2026-08-03');
  });

  it('transporte le type en variant — un volume ne se formate pas comme une charge', () => {
    const c = candidateFromRecentRecord([record({ type: 'best_volume', value: 4200 })]);
    expect(c!.variant).toBe('best_volume');
    expect(c!.metrics).toEqual({ value: 4200 });
    expect(c!.family).toBe('celebration');
    expect(c!.pillars).toEqual(['strength']);
  });

  it('ne modifie pas le tableau reçu', () => {
    const records = [record({ achievedOn: '2026-07-20' }), record({ achievedOn: '2026-08-03' })];
    candidateFromRecentRecord(records);
    expect(records[0]!.achievedOn).toBe('2026-07-20');
  });
});

describe('candidateFromGoalAchieved', () => {
  it('rend null sans objectif', () => {
    expect(candidateFromGoalAchieved([])).toBeNull();
  });

  it('ignore les objectifs encore actifs ou manqués', () => {
    expect(
      candidateFromGoalAchieved([goal({ status: 'active' }), goal({ status: 'missed' })]),
    ).toBeNull();
  });

  it('écarte un objectif atteint dont la valeur n’est plus calculable', () => {
    expect(candidateFromGoalAchieved([goal({ currentValue: null })])).toBeNull();
  });

  it('retient l’objectif atteint le plus récemment clos', () => {
    const c = candidateFromGoalAchieved([
      goal({ label: 'Ancien', deadline: '2026-06-01' }),
      goal({ label: 'Récent', deadline: '2026-08-01' }),
    ]);
    expect(c!.subject).toBe('Récent');
    expect(c!.occurredOn).toBe('2026-08-01');
  });

  it('porte la valeur atteinte et la cible', () => {
    const c = candidateFromGoalAchieved([goal({ currentValue: 102, targetValue: 100 })]);
    expect(c!.metrics).toEqual({ achievedValue: 102, targetValue: 100 });
  });

  it('rattache un objectif de distance au pilier course', () => {
    const c = candidateFromGoalAchieved([goal({ kind: 'run_distance' })]);
    expect(c!.pillars).toEqual(['running']);
    expect(c!.variant).toBe('run_distance');
  });

  it('rattache un objectif de 1RM au pilier musculation', () => {
    const c = candidateFromGoalAchieved([goal({ kind: 'exercise_1rm' })]);
    expect(c!.pillars).toEqual(['strength']);
  });
});

// ---------------------------------------------------------------------------
// Changements
// ---------------------------------------------------------------------------

describe('candidateFromWeeklyDecision', () => {
  it('rend null sur une semaine vide', () => {
    expect(candidateFromWeeklyDecision(review({ isEmpty: true }))).toBeNull();
  });

  it('rend null sans décision', () => {
    expect(candidateFromWeeklyDecision(review({ decision: null }))).toBeNull();
  });

  it('écarte all_good — l’état vide de l’écran le dit mieux', () => {
    expect(
      candidateFromWeeklyDecision(
        review({ decision: { kind: 'all_good', metrics: { activeDays: 5 } } }),
      ),
    ).toBeNull();
  });

  it('reprend kind, metrics et subject sans retouche', () => {
    const c = candidateFromWeeklyDecision(
      review({
        decision: {
          kind: 'goal_behind',
          subject: 'Semi-marathon',
          metrics: { progressPct: 30, elapsedPct: 70 },
        },
      }),
    );
    expect(c).toEqual({
      id: 'weekly_decision',
      family: 'change',
      variant: 'goal_behind',
      metrics: { progressPct: 30, elapsedPct: 70 },
      subject: 'Semi-marathon',
      occurredOn: '2026-08-02',
      pillars: [],
    });
  });

  it('n’ajoute pas de subject quand la décision n’en porte pas', () => {
    const c = candidateFromWeeklyDecision(
      review({ decision: { kind: 'consistency_drop', metrics: { activeDays: 1 } } }),
    );
    expect('subject' in c!).toBe(false);
  });
});

describe('candidateFromMuscleBalance', () => {
  it('rend null sans historique suffisant', () => {
    expect(candidateFromMuscleBalance(balance({ hasEnoughData: false }))).toBeNull();
  });

  it('rend null si aucun groupe n’est délaissé', () => {
    expect(candidateFromMuscleBalance(balance({ neglected: [] }))).toBeNull();
  });

  it('rend null si le groupe délaissé n’est pas dans la liste des groupes', () => {
    expect(candidateFromMuscleBalance(balance({ neglected: ['shoulders'] }))).toBeNull();
  });

  it('retient un seul groupe — le plus délaissé', () => {
    const c = candidateFromMuscleBalance(
      balance({
        groups: [group('chest', 20, 0.3), group('back', 4, 0.07), group('core', 2, 0.03)],
        neglected: ['back', 'core'],
      }),
    );
    expect(c!.subject).toBe('core');
    expect(c!.metrics).toEqual({ sharePct: 3, evenSharePct: 17, sets: 2 });
  });

  it('conserve le pire groupe même quand il est rencontré en premier', () => {
    const c = candidateFromMuscleBalance(
      balance({
        groups: [group('core', 2, 0.03), group('back', 4, 0.07), group('chest', 20, 0.3)],
        neglected: ['core', 'back'],
      }),
    );
    expect(c!.subject).toBe('core');
  });

  it('rattache la carte à la musculation, sans date', () => {
    const c = candidateFromMuscleBalance(balance());
    expect(c!.pillars).toEqual(['strength']);
    expect(c!.occurredOn).toBeNull();
    expect(c!.family).toBe('change');
  });
});

describe('candidatesFromWeeklyChanges', () => {
  it('rend [] sur une semaine vide', () => {
    expect(candidatesFromWeeklyChanges(review({ isEmpty: true }))).toEqual([]);
  });

  it('rend [] quand aucune variation n’est calculable', () => {
    expect(candidatesFromWeeklyChanges(review())).toEqual([]);
  });

  it('ignore une variation sous le seuil de 15 %', () => {
    const out = candidatesFromWeeklyChanges(
      review({
        changes: {
          tonnage: { pct: 4, direction: 'up' },
          distance: { pct: -14, direction: 'down' },
          activeDays: null,
          loggedDays: null,
        },
      }),
    );
    expect(out).toEqual([]);
  });

  it('retient une variation à 15 % pile — la borne est inclusive', () => {
    const out = candidatesFromWeeklyChanges(
      review({
        changes: {
          tonnage: { pct: -15, direction: 'down' },
          distance: null,
          activeDays: null,
          loggedDays: null,
        },
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.metrics).toEqual({ pct: 15 });
    expect(out[0]!.variant).toBe('down');
  });

  it('ignore un pct null — pas de « +100 % » depuis zéro', () => {
    const out = candidatesFromWeeklyChanges(
      review({
        changes: {
          tonnage: { pct: null, direction: 'up' },
          distance: null,
          activeDays: null,
          loggedDays: null,
        },
      }),
    );
    expect(out).toEqual([]);
  });

  it('produit les deux variations quand les deux sont notables, chacune sur son pilier', () => {
    const out = candidatesFromWeeklyChanges(
      review({
        changes: {
          tonnage: { pct: -22, direction: 'down' },
          distance: { pct: 31, direction: 'up' },
          activeDays: null,
          loggedDays: null,
        },
      }),
    );
    expect(out.map((c) => c.id)).toEqual(['tonnage_change', 'distance_change']);
    expect(out[0]!.pillars).toEqual(['strength']);
    expect(out[1]!.pillars).toEqual(['running']);
    expect(out[1]!.metrics).toEqual({ pct: 31 });
    expect(out[0]!.occurredOn).toBe('2026-08-02');
  });
});

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

function sources(overrides: Partial<InsightSources> = {}): InsightSources {
  return {
    overtrainingGuard: { show: false, severity: null, streakDays: 0 },
    trainingLoad: { show: false, ratio: null },
    deficitVolume: { show: false, deficitPct: 0, loggedDays: 0 },
    records: [],
    goals: [],
    weeklyReview: null,
    muscleBalance: null,
    ...overrides,
  };
}

describe('buildInsightCandidates', () => {
  it('rend [] quand aucune source n’a rien à dire', () => {
    expect(buildInsightCandidates(sources())).toEqual([]);
  });

  it('tolère un bilan hebdo et un équilibre musculaire absents', () => {
    const out = buildInsightCandidates(
      sources({ trainingLoad: { show: true, ratio: 1.42 } }),
    );
    expect(out.map((c) => c.id)).toEqual(['training_load']);
  });

  it('rassemble les candidats de toutes les familles, variations comprises', () => {
    const out = buildInsightCandidates(
      sources({
        overtrainingGuard: { show: true, severity: 'streak', streakDays: 9 },
        trainingLoad: { show: true, ratio: 1.42 },
        deficitVolume: { show: true, deficitPct: 18, loggedDays: 6 },
        records: [record()],
        goals: [goal()],
        muscleBalance: balance(),
        weeklyReview: review({
          decision: { kind: 'consistency_drop', metrics: { activeDays: 1 } },
          changes: {
            tonnage: { pct: -22, direction: 'down' },
            distance: { pct: 31, direction: 'up' },
            activeDays: null,
            loggedDays: null,
          },
        }),
      }),
    );
    expect(out.map((c) => c.id)).toEqual([
      'overtraining_guard',
      'training_load',
      'deficit_volume',
      'record_recent',
      'goal_achieved',
      'weekly_decision',
      'muscle_neglected',
      'tonnage_change',
      'distance_change',
    ]);
  });

  it('écarte silencieusement les sources muettes sans trouer la liste', () => {
    const out = buildInsightCandidates(
      sources({
        records: [record()],
        weeklyReview: review({ isEmpty: true }),
        muscleBalance: balance({ neglected: [] }),
      }),
    );
    expect(out.map((c) => c.id)).toEqual(['record_recent']);
  });
});

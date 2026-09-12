import { describe, expect, it } from 'vitest';

import type { MuscleGroup } from './exercise';
import {
  computeSessionCompliance,
  computeSessionVerdict,
  computeWorkoutReport,
  workoutReportVisibility,
  type ReportRecord,
  type ReportSet,
  type WorkoutReportInput,
} from './workout-report';

// ---------------------------------------------------------------------------
// Fabriques
// ---------------------------------------------------------------------------

let seq = 0;
function set(over: Partial<ReportSet> = {}): ReportSet {
  seq += 1;
  return {
    id: `s${seq}`,
    exerciseId: 'bench',
    setType: 'normal',
    reps: 8,
    weightKg: 80,
    durationSeconds: null,
    rpe: null,
    plannedWeightKg: null,
    targetReps: null,
    done: true,
    orderIndex: seq,
    ...over,
  };
}

function input(over: Partial<WorkoutReportInput> = {}): WorkoutReportInput {
  return {
    workoutId: 'w1',
    title: 'Haut du corps',
    startedAt: '2026-09-11T16:42:00.000Z',
    durationSeconds: 3480,
    feelingRpe: 8,
    notes: null,
    sets: [set()],
    exerciseNames: new Map([['bench', 'Développé couché']]),
    exerciseMuscle: new Map<string, MuscleGroup>([['bench', 'chest']]),
    oneRmRecords: [],
    records: [],
    previousSetsByExercise: new Map(),
    referenceSessions: [],
    bestPreviousVolumeSameTitle: null,
    weekSessionCount: 1,
    weekVolumeKg: 0,
    lifetimeVolumeKg: 0,
    ...over,
  };
}

function record(over: Partial<ReportRecord> = {}): ReportRecord {
  return {
    exerciseId: 'bench',
    exerciseName: 'Développé couché',
    type: 'max_weight',
    value: 82.5,
    previousValue: 80,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Visibilité
// ---------------------------------------------------------------------------

describe('workoutReportVisibility', () => {
  it('ne montre aucun bloc secondaire en Simple', () => {
    const v = workoutReportVisibility('simplified');
    expect(v.secondaryStats).toBe(false);
    expect(v.habitComparison).toBe(false);
    expect(v.muscleSplit).toBe(false);
    expect(v.setDetail).toBe('hidden');
  });

  it('ouvre la mise en perspective en Intermédiaire, détail replié (D6)', () => {
    const v = workoutReportVisibility('normal');
    expect(v.habitComparison).toBe(true);
    expect(v.muscleSplit).toBe(true);
    expect(v.programCompliance).toBe(true);
    expect(v.setDetail).toBe('collapsed');
    // …mais pas encore l'analyse.
    expect(v.relativeIntensity).toBe(false);
    expect(v.repRanges).toBe(false);
  });

  it('ouvre tout en Avancé, détail déplié', () => {
    const v = workoutReportVisibility('detailed');
    expect(v.relativeIntensity).toBe(true);
    expect(v.repRanges).toBe(true);
    expect(v.setTypes).toBe(true);
    expect(v.sessionWeight).toBe(true);
    expect(v.hardSets).toBe(true);
    expect(v.setDetail).toBe('expanded');
  });

  it('n’enlève jamais un bloc en montant de niveau', () => {
    const simple = workoutReportVisibility('simplified');
    const normal = workoutReportVisibility('normal');
    const detailed = workoutReportVisibility('detailed');
    for (const key of Object.keys(simple) as Array<keyof typeof simple>) {
      if (key === 'setDetail') continue;
      expect(!simple[key] || normal[key]).toBe(true);
      expect(!normal[key] || detailed[key]).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

describe('computeSessionVerdict', () => {
  const base = {
    title: 'Haut du corps',
    durationMin: 58,
    records: [] as ReportRecord[],
    exercises: [],
    volumeKg: 5000,
    bestPreviousVolumeSameTitle: null,
    weekSessionCount: 1,
  };

  it('1. un record prime sur tout', () => {
    const out = computeSessionVerdict({
      ...base,
      records: [record(), record({ type: 'estimated_1rm' })],
      volumeKg: 9999,
      bestPreviousVolumeSameTitle: 1,
      weekSessionCount: 5,
    });
    expect(out).toEqual({ kind: 'record', exerciseName: 'Développé couché', recordCount: 2 });
  });

  it('1b. nomme l’exercice le plus représenté parmi les records', () => {
    const out = computeSessionVerdict({
      ...base,
      records: [
        record({ exerciseId: 'row', exerciseName: 'Tirage' }),
        record(),
        record({ type: 'estimated_1rm' }),
      ],
    });
    expect(out).toMatchObject({ kind: 'record', exerciseName: 'Développé couché' });
  });

  it('2. plus gros tonnage sur ce type de séance', () => {
    const out = computeSessionVerdict({ ...base, volumeKg: 6000, bestPreviousVolumeSameTitle: 5000 });
    expect(out).toEqual({ kind: 'best_volume', sessionTitle: 'Haut du corps' });
  });

  it('2b. ne se déclenche pas à égalité stricte', () => {
    const out = computeSessionVerdict({ ...base, volumeKg: 5000, bestPreviousVolumeSameTitle: 5000 });
    expect(out.kind).not.toBe('best_volume');
  });

  it('3. progression en charge sur l’exercice le plus lourd, pas le premier', () => {
    const out = computeSessionVerdict({
      ...base,
      exercises: [
        {
          exerciseId: 'curl',
          exerciseName: 'Curl',
          sets: [],
          workingSets: [],
          volumeKg: 500,
          delta: { kind: 'weight', deltaKg: 1 },
          bestEstimated1RM: null,
          relativeIntensityPercent: null,
        },
        {
          exerciseId: 'bench',
          exerciseName: 'Développé couché',
          sets: [],
          workingSets: [],
          volumeKg: 4000,
          delta: { kind: 'weight', deltaKg: 2.5 },
          bestEstimated1RM: null,
          relativeIntensityPercent: null,
        },
      ],
    });
    expect(out).toEqual({ kind: 'progress', exerciseName: 'Développé couché', deltaKg: 2.5 });
  });

  it('3b. ignore une régression de charge', () => {
    const out = computeSessionVerdict({
      ...base,
      exercises: [
        {
          exerciseId: 'bench',
          exerciseName: 'Développé couché',
          sets: [],
          workingSets: [],
          volumeKg: 4000,
          delta: { kind: 'weight', deltaKg: -2.5 },
          bestEstimated1RM: null,
          relativeIntensityPercent: null,
        },
      ],
    });
    expect(out.kind).not.toBe('progress');
  });

  it('4. régularité à partir de 3 séances dans la semaine', () => {
    expect(computeSessionVerdict({ ...base, weekSessionCount: 3 })).toEqual({
      kind: 'weekly',
      sessionCount: 3,
    });
  });

  it('5. repli : un bilan dit toujours quelque chose', () => {
    expect(computeSessionVerdict(base)).toEqual({ kind: 'done', durationMin: 58 });
  });
});

// ---------------------------------------------------------------------------
// Conformité au plan
// ---------------------------------------------------------------------------

describe('computeSessionCompliance', () => {
  const names = new Map([['bench', 'Développé couché']]);
  const compute = (sets: ReportSet[]) => computeSessionCompliance({ sets, exerciseNames: names });

  it('rend null hors programme — une séance libre n’a rien à quoi se conformer', () => {
    expect(compute([set()])).toBeNull();
  });

  it('compte conforme une série qui atteint la charge prescrite', () => {
    const out = compute([set({ plannedWeightKg: 80, weightKg: 80 })]);
    expect(out).toMatchObject({ plannedSets: 1, compliantSets: 1, percent: 100 });
  });

  it('compte conforme une série qui DÉPASSE le plan — la surcharge n’est pas un écart', () => {
    const out = compute([set({ plannedWeightKg: 80, weightKg: 82.5 })]);
    expect(out).toMatchObject({ compliantSets: 1, percent: 100, deviations: [] });
  });

  it('relève un écart sous la charge prescrite, avec le nom de l’exercice', () => {
    const out = compute([set({ plannedWeightKg: 13, weightKg: 12 })]);
    expect(out).toMatchObject({ compliantSets: 0, percent: 0 });
    expect(out?.deviations).toEqual([
      { exerciseName: 'Développé couché', plannedWeightKg: 13, weightKg: 12 },
    ]);
  });

  it('exige aussi le bas de la fourchette de répétitions', () => {
    const out = compute([set({ plannedWeightKg: 80, weightKg: 80, reps: 6, targetReps: '8-12' })]);
    expect(out?.compliantSets).toBe(0);
  });

  it('ne juge que la charge quand la cible de reps est illisible (AMRAP, max…)', () => {
    const out = compute([set({ plannedWeightKg: 80, weightKg: 80, reps: 3, targetReps: 'AMRAP' })]);
    expect(out?.compliantSets).toBe(1);
  });

  it('ignore les échauffements et les séries non validées', () => {
    const out = compute([
      set({ plannedWeightKg: 80, weightKg: 60, setType: 'warmup' }),
      set({ plannedWeightKg: 80, weightKg: 10, done: false }),
      set({ plannedWeightKg: 80, weightKg: 80 }),
    ]);
    expect(out).toMatchObject({ plannedSets: 1, compliantSets: 1, percent: 100 });
  });
});

// ---------------------------------------------------------------------------
// Assemblage
// ---------------------------------------------------------------------------

describe('computeWorkoutReport', () => {
  it('exclut les échauffements du tonnage et du décompte de séries (R4)', () => {
    const out = computeWorkoutReport(
      input({
        sets: [
          set({ setType: 'warmup', reps: 10, weightKg: 60 }),
          set({ reps: 8, weightKg: 80 }),
        ],
      }),
    );
    expect(out.totals.volumeKg).toBe(640);
    expect(out.totals.workingSets).toBe(1);
    expect(out.totals.warmupSets).toBe(1);
  });

  it('ne compte pas un exercice qui n’a QUE des échauffements', () => {
    const out = computeWorkoutReport(
      input({
        sets: [set({ exerciseId: 'row', setType: 'warmup' }), set({ exerciseId: 'bench' })],
        exerciseNames: new Map([
          ['bench', 'Développé couché'],
          ['row', 'Tirage'],
        ]),
      }),
    );
    expect(out.totals.exercises).toBe(1);
    expect(out.exercises.map((e) => e.exerciseId)).toEqual(['bench']);
  });

  it('ignore les séries non validées', () => {
    const out = computeWorkoutReport(
      input({ sets: [set({ done: false }), set({ reps: 8, weightKg: 80 })] }),
    );
    expect(out.totals.workingSets).toBe(1);
  });

  it('plafonne la durée à 1 minute minimum — aucune division par zéro', () => {
    const out = computeWorkoutReport(input({ durationSeconds: null }));
    expect(out.totals.durationMin).toBe(1);
    expect(Number.isFinite(out.totals.densityKgPerMin)).toBe(true);
  });

  it('calcule la charge sRPE, et la tait sans ressenti (R7)', () => {
    expect(computeWorkoutReport(input({ durationSeconds: 3600, feelingRpe: 8 })).totals.sessionLoad).toBe(480);
    expect(computeWorkoutReport(input({ feelingRpe: null })).totals.sessionLoad).toBeNull();
  });

  it('compte les séries dures sans les confondre avec les séries non notées (R6)', () => {
    const out = computeWorkoutReport(
      input({ sets: [set({ rpe: 9 }), set({ rpe: 5 }), set({ rpe: null })] }),
    );
    expect(out.totals.hardSets).toBe(1);
    expect(out.totals.ratedSets).toBe(2);
  });

  it('rend une intensité relative nulle sans 1RM de référence, jamais 0 % (R2)', () => {
    const out = computeWorkoutReport(input({ oneRmRecords: [] }));
    expect(out.totals.relativeIntensityPercent).toBeNull();
    expect(out.exercises[0]!.relativeIntensityPercent).toBeNull();
  });

  it('calcule l’intensité relative contre le meilleur 1RM connu', () => {
    const out = computeWorkoutReport(
      input({
        sets: [set({ reps: 1, weightKg: 80 })],
        oneRmRecords: [{ exerciseId: 'bench', type: 'estimated_1rm', value: 100 }],
      }),
    );
    expect(out.exercises[0]!.relativeIntensityPercent).toBeCloseTo(80);
  });

  it('rend un delta nul au premier passage — « = » serait un contresens', () => {
    const out = computeWorkoutReport(input({ previousSetsByExercise: new Map() }));
    expect(out.exercises[0]!.delta).toBeNull();
  });

  it('garde l’ordre de réalisation des exercices', () => {
    const out = computeWorkoutReport(
      input({
        sets: [
          set({ exerciseId: 'row', orderIndex: 5 }),
          set({ exerciseId: 'bench', orderIndex: 1 }),
        ],
        exerciseNames: new Map([
          ['bench', 'Développé couché'],
          ['row', 'Tirage'],
        ]),
      }),
    );
    expect(out.exercises.map((e) => e.exerciseId)).toEqual(['bench', 'row']);
  });

  it('tait la comparaison à l’habitude quand il n’y a pas de référence (R2)', () => {
    expect(computeWorkoutReport(input({ referenceSessions: [] })).comparison).toBeNull();
  });

  it('produit un verdict même sur une séance sans rien de remarquable', () => {
    expect(computeWorkoutReport(input()).verdict.kind).toBe('done');
  });

  // ── Reprises de `workout-summary-build.test.ts` (US MUSCU-UX02) ─────────────────────────────
  // `buildSummary` a disparu avec l'ancien écran ; ses règles, elles, n'ont pas changé de nature —
  // seulement de maison. Elles sont réinstallées ici, au niveau pur, plutôt que perdues.

  it('un échauffement NON validé ne compte nulle part', () => {
    const out = computeWorkoutReport(
      input({
        sets: [set({ setType: 'warmup', done: false }), set({ reps: 5, weightKg: 100 })],
      }),
    );
    expect(out.totals.warmupSets).toBe(0);
    expect(out.totals.workingSets).toBe(1);
  });

  it('arrondit la durée à la minute', () => {
    expect(computeWorkoutReport(input({ durationSeconds: 3630 })).totals.durationMin).toBe(61);
  });

  it('rapporte le tonnage à la durée', () => {
    // 2 000 kg sur 20 min = 100 kg/min.
    const out = computeWorkoutReport(
      input({
        durationSeconds: 1200,
        sets: [set({ reps: 10, weightKg: 100 }), set({ reps: 10, weightKg: 100 })],
      }),
    );
    expect(out.totals.volumeKg).toBe(2000);
    expect(out.totals.densityKgPerMin).toBe(100);
  });

  it('rend des totaux nuls sur une séance sans aucune série, sans planter', () => {
    const out = computeWorkoutReport(input({ sets: [] }));
    expect(out.totals).toMatchObject({
      exercises: 0,
      workingSets: 0,
      warmupSets: 0,
      volumeKg: 0,
    });
    expect(out.exercises).toEqual([]);
  });
});

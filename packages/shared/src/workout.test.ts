import { describe, expect, it } from 'vitest';
import {
  SET_TYPES,
  setTypeSchema,
  WORKOUT_STATUSES,
  WORKOUT_AUTO_CLOSE_SECONDS,
  isWorkoutStale,
  workoutStatusSchema,
  workoutRowSchema,
  workoutSetRowSchema,
  computeVolume,
  computeReorderedExerciseOrder,
  computeProgressionSuggestion,
  computeWeekCompletionRate,
  deriveTemplateTargetsFromWorkoutSets,
  sessionStruggled,
} from './workout';

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const UUID2 = '4a3604e0-5f90-42d4-ab1d-1416f93d4412';
const NOW = '2026-07-06T00:00:00.000Z';

const BASE_SYNC = {
  id: UUID,
  userId: UUID,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};

// ---------------------------------------------------------------------------
// SET_TYPES
// ---------------------------------------------------------------------------
describe('SET_TYPES', () => {
  it('contient les 7 types de série canoniques', () => {
    expect(SET_TYPES).toEqual([
      'normal',
      'warmup',
      'superset',
      'duration',
      'bodyweight',
      'dropset',
      'failure',
    ]);
  });

  it('setTypeSchema accepte une valeur valide', () => {
    expect(setTypeSchema.parse('normal')).toBe('normal');
    expect(setTypeSchema.parse('warmup')).toBe('warmup');
    expect(setTypeSchema.parse('dropset')).toBe('dropset');
    expect(setTypeSchema.parse('failure')).toBe('failure');
  });

  it('setTypeSchema rejette une valeur inconnue', () => {
    expect(setTypeSchema.safeParse('drop_set').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// WORKOUT_STATUSES
// ---------------------------------------------------------------------------
describe('WORKOUT_STATUSES', () => {
  it('contient les 3 statuts canoniques', () => {
    expect(WORKOUT_STATUSES).toEqual(['active', 'completed', 'cancelled']);
  });

  it('workoutStatusSchema accepte une valeur valide', () => {
    expect(workoutStatusSchema.parse('active')).toBe('active');
    expect(workoutStatusSchema.parse('completed')).toBe('completed');
  });

  it('workoutStatusSchema rejette une valeur inconnue', () => {
    expect(workoutStatusSchema.safeParse('paused').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// workoutRowSchema
// ---------------------------------------------------------------------------
describe('workoutRowSchema', () => {
  const validRow = {
    ...BASE_SYNC,
    sessionId: null,
    programId: null,
    status: 'active',
    startedAt: NOW,
    finishedAt: null,
    durationSeconds: null,
    rpe: null,
    notes: null,
  };

  it('valide une ligne séance minimale', () => {
    const result = workoutRowSchema.parse(validRow);
    expect(result.status).toBe('active');
    expect(result.sessionId).toBeNull();
  });

  it('valide une ligne séance complète', () => {
    const fullRow = {
      ...validRow,
      sessionId: UUID2,
      programId: UUID2,
      status: 'completed',
      finishedAt: NOW,
      durationSeconds: 3600,
      rpe: 8,
      notes: 'Bonne séance',
    };
    const result = workoutRowSchema.parse(fullRow);
    expect(result.status).toBe('completed');
    expect(result.rpe).toBe(8);
    expect(result.durationSeconds).toBe(3600);
  });

  it('accepte un rpe à 1 (minimum)', () => {
    const row = { ...validRow, rpe: 1 };
    expect(workoutRowSchema.safeParse(row).success).toBe(true);
  });

  it('accepte un rpe à 10 (maximum)', () => {
    const row = { ...validRow, rpe: 10 };
    expect(workoutRowSchema.safeParse(row).success).toBe(true);
  });

  it('rejette un rpe hors plage (0)', () => {
    const row = { ...validRow, rpe: 0 };
    expect(workoutRowSchema.safeParse(row).success).toBe(false);
  });

  it('rejette un rpe hors plage (11)', () => {
    const row = { ...validRow, rpe: 11 };
    expect(workoutRowSchema.safeParse(row).success).toBe(false);
  });

  it('rejette un durationSeconds négatif', () => {
    const row = { ...validRow, durationSeconds: -1 };
    expect(workoutRowSchema.safeParse(row).success).toBe(false);
  });

  it('accepte durationSeconds à 0', () => {
    const row = { ...validRow, durationSeconds: 0 };
    expect(workoutRowSchema.safeParse(row).success).toBe(true);
  });

  it('rejette un status inconnu', () => {
    const row = { ...validRow, status: 'paused' };
    expect(workoutRowSchema.safeParse(row).success).toBe(false);
  });

  it('exige userId (champ syncFields)', () => {
    const { userId: _userId, ...withoutUser } = validRow;
    expect(workoutRowSchema.safeParse(withoutUser).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// workoutSetRowSchema
// ---------------------------------------------------------------------------
describe('workoutSetRowSchema', () => {
  const validSet = {
    ...BASE_SYNC,
    workoutId: UUID2,
    exerciseId: UUID2,
    orderIndex: 0,
    setType: 'normal',
    reps: 8,
    weightKg: 50,
    durationSeconds: null,
    done: false,
    rpe: null,
    plannedWeightKg: null,
  };

  it('valide une série complète', () => {
    const result = workoutSetRowSchema.parse(validSet);
    expect(result.setType).toBe('normal');
    expect(result.reps).toBe(8);
    expect(result.weightKg).toBe(50);
  });

  it('accepte reps, weightKg et durationSeconds à null', () => {
    const row = { ...validSet, reps: null, weightKg: null, durationSeconds: null };
    expect(workoutSetRowSchema.safeParse(row).success).toBe(true);
  });

  it('rejette un orderIndex négatif', () => {
    const row = { ...validSet, orderIndex: -1 };
    expect(workoutSetRowSchema.safeParse(row).success).toBe(false);
  });

  it('accepte orderIndex à 0', () => {
    const row = { ...validSet, orderIndex: 0 };
    expect(workoutSetRowSchema.safeParse(row).success).toBe(true);
  });

  it('rejette un setType inconnu', () => {
    const row = { ...validSet, setType: 'drop_set' };
    expect(workoutSetRowSchema.safeParse(row).success).toBe(false);
  });

  it('exige workoutId', () => {
    const { workoutId: _wId, ...withoutWorkout } = validSet;
    expect(workoutSetRowSchema.safeParse(withoutWorkout).success).toBe(false);
  });

  it('exige done (booléen)', () => {
    const { done: _done, ...withoutDone } = validSet;
    expect(workoutSetRowSchema.safeParse(withoutDone).success).toBe(false);
  });

  it('accepte un setType dropset', () => {
    const row = { ...validSet, setType: 'dropset' };
    expect(workoutSetRowSchema.safeParse(row).success).toBe(true);
  });

  it('accepte un setType failure', () => {
    const row = { ...validSet, setType: 'failure' };
    expect(workoutSetRowSchema.safeParse(row).success).toBe(true);
  });

  it('rpe accepte 1 (minimum)', () => {
    const row = { ...validSet, rpe: 1 };
    expect(workoutSetRowSchema.safeParse(row).success).toBe(true);
  });

  it('rpe accepte 10 (maximum)', () => {
    const row = { ...validSet, rpe: 10 };
    expect(workoutSetRowSchema.safeParse(row).success).toBe(true);
  });

  it('rpe accepte null', () => {
    const row = { ...validSet, rpe: null };
    expect(workoutSetRowSchema.safeParse(row).success).toBe(true);
  });

  it('rpe rejette 0 (hors plage)', () => {
    const row = { ...validSet, rpe: 0 };
    expect(workoutSetRowSchema.safeParse(row).success).toBe(false);
  });

  it('rpe rejette 11 (hors plage)', () => {
    const row = { ...validSet, rpe: 11 };
    expect(workoutSetRowSchema.safeParse(row).success).toBe(false);
  });

  it('plannedWeightKg accepte 0', () => {
    const row = { ...validSet, plannedWeightKg: 0 };
    expect(workoutSetRowSchema.safeParse(row).success).toBe(true);
  });

  it('plannedWeightKg accepte une valeur positive', () => {
    const row = { ...validSet, plannedWeightKg: 60 };
    expect(workoutSetRowSchema.safeParse(row).success).toBe(true);
  });

  it('plannedWeightKg accepte null', () => {
    const row = { ...validSet, plannedWeightKg: null };
    expect(workoutSetRowSchema.safeParse(row).success).toBe(true);
  });

  it('plannedWeightKg rejette une valeur négative', () => {
    const row = { ...validSet, plannedWeightKg: -1 };
    expect(workoutSetRowSchema.safeParse(row).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeVolume
// ---------------------------------------------------------------------------
describe('computeVolume', () => {
  // Cas du plan : somme reps×charge des séries validées, hors échauffement
  it('somme reps×charge des séries validées, hors échauffement', () => {
    const sets = [
      { setType: 'warmup', reps: 10, weightKg: 20, done: true },
      { setType: 'normal', reps: 8, weightKg: 50, done: true },
      { setType: 'normal', reps: 8, weightKg: 50, done: false },
    ];
    expect(computeVolume(sets)).toBe(400);
  });

  it('retourne 0 si toutes les séries sont des échauffements', () => {
    const sets = [
      { setType: 'warmup', reps: 10, weightKg: 20, done: true },
      { setType: 'warmup', reps: 12, weightKg: 15, done: true },
    ];
    expect(computeVolume(sets)).toBe(0);
  });

  it("retourne 0 si aucune série n'est done", () => {
    const sets = [
      { setType: 'normal', reps: 8, weightKg: 50, done: false },
      { setType: 'superset', reps: 10, weightKg: 30, done: false },
    ];
    expect(computeVolume(sets)).toBe(0);
  });

  it('traite reps null comme 0 (contribution nulle)', () => {
    const sets = [
      { setType: 'normal', reps: null, weightKg: 50, done: true },
      { setType: 'normal', reps: 8, weightKg: 50, done: true },
    ];
    expect(computeVolume(sets)).toBe(400);
  });

  it('traite weightKg null comme 0 (contribution nulle)', () => {
    const sets = [
      { setType: 'bodyweight', reps: 15, weightKg: null, done: true },
      { setType: 'normal', reps: 8, weightKg: 50, done: true },
    ];
    expect(computeVolume(sets)).toBe(400);
  });

  it('traite reps et weightKg tous deux null comme 0', () => {
    const sets = [{ setType: 'duration', reps: null, weightKg: null, done: true }];
    expect(computeVolume(sets)).toBe(0);
  });

  it('retourne 0 pour un tableau vide', () => {
    expect(computeVolume([])).toBe(0);
  });

  it('accumule correctement plusieurs séries valides', () => {
    const sets = [
      { setType: 'normal', reps: 5, weightKg: 100, done: true },   // 500
      { setType: 'normal', reps: 5, weightKg: 100, done: true },   // 500
      { setType: 'superset', reps: 12, weightKg: 30, done: true }, // 360
      { setType: 'warmup', reps: 10, weightKg: 40, done: true },   // exclu
    ];
    expect(computeVolume(sets)).toBe(1360);
  });

  it('compte une série dropset (reps × charge)', () => {
    const sets = [{ setType: 'dropset', reps: 10, weightKg: 30, done: true }];
    expect(computeVolume(sets)).toBe(300);
  });

  it('compte une série failure (reps × charge)', () => {
    const sets = [{ setType: 'failure', reps: 6, weightKg: 80, done: true }];
    expect(computeVolume(sets)).toBe(480);
  });

  it('compte 0 pour une série duration (reps null)', () => {
    const sets = [{ setType: 'duration', reps: null, weightKg: 20, done: true }];
    expect(computeVolume(sets)).toBe(0);
  });

  it('compte 0 pour une série bodyweight sans charge', () => {
    const sets = [{ setType: 'bodyweight', reps: 12, weightKg: null, done: true }];
    expect(computeVolume(sets)).toBe(0);
  });

  it('compte reps × lest pour une série bodyweight lestée', () => {
    const sets = [{ setType: 'bodyweight', reps: 8, weightKg: 15, done: true }];
    expect(computeVolume(sets)).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// computeReorderedExerciseOrder
// ---------------------------------------------------------------------------
describe('computeReorderedExerciseOrder', () => {
  it("swap 'up' : l'exercice restant remonte d'un cran parmi les restants", () => {
    const exercises = [
      { exerciseId: 'A', done: true },
      { exerciseId: 'B', done: false },
      { exerciseId: 'C', done: false },
    ];
    const result = computeReorderedExerciseOrder(exercises, {
      type: 'swap',
      exerciseId: 'C',
      direction: 'up',
    });
    expect(result).toEqual(['A', 'C', 'B']);
  });

  it("swap 'down' sur le dernier restant : no-op (ordre inchangé)", () => {
    const exercises = [
      { exerciseId: 'A', done: true },
      { exerciseId: 'B', done: false },
      { exerciseId: 'C', done: false },
    ];
    const result = computeReorderedExerciseOrder(exercises, {
      type: 'swap',
      exerciseId: 'C',
      direction: 'down',
    });
    expect(result).toEqual(['A', 'B', 'C']);
  });

  it('cas piégeux — exercice terminé intercalé : swap down garde la position absolue du terminé', () => {
    const exercises = [
      { exerciseId: 'A', done: false },
      { exerciseId: 'B', done: true },
      { exerciseId: 'C', done: false },
    ];
    const result = computeReorderedExerciseOrder(exercises, {
      type: 'swap',
      exerciseId: 'A',
      direction: 'down',
    });
    expect(result).toEqual(['C', 'B', 'A']);
  });

  it("toEnd avec exercice terminé intercalé", () => {
    const exercises = [
      { exerciseId: 'A', done: false },
      { exerciseId: 'B', done: true },
      { exerciseId: 'C', done: false },
      { exerciseId: 'D', done: false },
    ];
    const result = computeReorderedExerciseOrder(exercises, {
      type: 'toEnd',
      exerciseId: 'C',
    });
    expect(result).toEqual(['A', 'B', 'D', 'C']);
  });

  it('idempotence : toEnd sur l\'exercice déjà en dernière position des restants → inchangé', () => {
    const exercises = [
      { exerciseId: 'A', done: false },
      { exerciseId: 'B', done: true },
      { exerciseId: 'C', done: false },
      { exerciseId: 'D', done: false },
    ];
    const result = computeReorderedExerciseOrder(exercises, {
      type: 'toEnd',
      exerciseId: 'D',
    });
    expect(result).toEqual(['A', 'B', 'C', 'D']);
  });
});

// ---------------------------------------------------------------------------
// sessionStruggled (US MUSC-F7 — exportée pour usePreviousStruggled côté mobile)
// ---------------------------------------------------------------------------
describe('sessionStruggled', () => {
  it('une série en échec → difficile, même sans RPE', () => {
    expect(sessionStruggled([{ setType: 'failure', rpe: null }])).toBe(true);
  });

  it('RPE 8 ou plus → difficile', () => {
    expect(sessionStruggled([{ setType: 'normal', rpe: 8 }])).toBe(true);
    expect(sessionStruggled([{ setType: 'normal', rpe: 9 }])).toBe(true);
  });

  it('RPE 7, aucun échec → pas difficile', () => {
    expect(sessionStruggled([{ setType: 'normal', rpe: 7 }])).toBe(false);
  });

  it('aucune série qualifiante → pas difficile', () => {
    expect(sessionStruggled([])).toBe(false);
  });

  it('retient le RPE le plus élevé parmi plusieurs séries', () => {
    expect(sessionStruggled([{ setType: 'normal', rpe: 5 }, { setType: 'normal', rpe: 8 }])).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// computeProgressionSuggestion
// ---------------------------------------------------------------------------
describe('computeProgressionSuggestion', () => {
  const OPTS = { weightIncrementKg: 2.5, durationIncrementSeconds: 10 };

  it('lastSets vide → null', () => {
    const referenceSet = { setType: 'normal', reps: 8, weightKg: 80, durationSeconds: null };
    expect(computeProgressionSuggestion([], referenceSet, OPTS)).toBeNull();
  });

  it('une série qualifiante failure → null (même si referenceSet normal)', () => {
    const lastSets = [{ setType: 'failure', rpe: null, done: true }];
    const referenceSet = { setType: 'normal', reps: 8, weightKg: 80, durationSeconds: null };
    expect(computeProgressionSuggestion(lastSets, referenceSet, OPTS)).toBeNull();
  });

  it('RPE max des lastSets = 9 (≥ 8) → null', () => {
    const lastSets = [
      { setType: 'normal', rpe: 6, done: true },
      { setType: 'normal', rpe: 9, done: true },
    ];
    const referenceSet = { setType: 'normal', reps: 8, weightKg: 80, durationSeconds: null };
    expect(computeProgressionSuggestion(lastSets, referenceSet, OPTS)).toBeNull();
  });

  it('RPE max = 7 → suggestion weightOrReps', () => {
    const lastSets = [
      { setType: 'normal', rpe: 7, done: true },
      { setType: 'normal', rpe: 6, done: true },
    ];
    const referenceSet = { setType: 'normal', reps: 8, weightKg: 80, durationSeconds: null };
    expect(computeProgressionSuggestion(lastSets, referenceSet, OPTS)).toEqual({
      kind: 'weightOrReps',
      weightKg: 82.5,
      reps: 9,
    });
  });

  it('toutes les lastSets ont rpe null, aucune failure → suggestion normale', () => {
    const lastSets = [
      { setType: 'normal', rpe: null, done: true },
      { setType: 'normal', rpe: null, done: true },
    ];
    const referenceSet = { setType: 'normal', reps: 8, weightKg: 80, durationSeconds: null };
    expect(computeProgressionSuggestion(lastSets, referenceSet, OPTS)).toEqual({
      kind: 'weightOrReps',
      weightKg: 82.5,
      reps: 9,
    });
  });

  it("referenceSet.setType === 'bodyweight' et weightKg null → suggestion reps seule", () => {
    const lastSets = [{ setType: 'bodyweight', rpe: 6, done: true }];
    const referenceSet = { setType: 'bodyweight', reps: 12, weightKg: null, durationSeconds: null };
    expect(computeProgressionSuggestion(lastSets, referenceSet, OPTS)).toEqual({
      kind: 'reps',
      reps: 13,
    });
  });

  it("referenceSet.setType === 'duration' → suggestion duration seule", () => {
    const lastSets = [{ setType: 'duration', rpe: 6, done: true }];
    const referenceSet = { setType: 'duration', reps: null, weightKg: null, durationSeconds: 60 };
    expect(computeProgressionSuggestion(lastSets, referenceSet, OPTS)).toEqual({
      kind: 'duration',
      durationSeconds: 70,
    });
  });

  it('referenceSet absent (undefined) → null', () => {
    const lastSets = [{ setType: 'normal', rpe: 6, done: true }];
    expect(computeProgressionSuggestion(lastSets, undefined, OPTS)).toBeNull();
  });

  // Deload (spec 3.8) : 2 séances difficiles d'affilée → baisse suggérée.
  const refWeight = { setType: 'normal', reps: 8, weightKg: 80, durationSeconds: null };

  it('difficile (failure) + précédente difficile → deload −10 % (80 → 72)', () => {
    const lastSets = [{ setType: 'failure', rpe: null, done: true }];
    expect(
      computeProgressionSuggestion(lastSets, refWeight, { ...OPTS, previousStruggled: true }),
    ).toEqual({ kind: 'deload', weightKg: 72 });
  });

  it('difficile (RPE 9) + précédente difficile → deload', () => {
    const lastSets = [{ setType: 'normal', rpe: 9, done: true }];
    expect(
      computeProgressionSuggestion(lastSets, refWeight, { ...OPTS, previousStruggled: true }),
    ).toEqual({ kind: 'deload', weightKg: 72 });
  });

  it('difficile MAIS précédente OK → pas de deload (null)', () => {
    const lastSets = [{ setType: 'failure', rpe: null, done: true }];
    expect(
      computeProgressionSuggestion(lastSets, refWeight, { ...OPTS, previousStruggled: false }),
    ).toBeNull();
  });

  it('2 séances difficiles mais exercice au poids du corps (weightKg null) → pas de deload', () => {
    const lastSets = [{ setType: 'bodyweight', rpe: 9, done: true }];
    const refBw = { setType: 'bodyweight', reps: 12, weightKg: null, durationSeconds: null };
    expect(
      computeProgressionSuggestion(lastSets, refBw, { ...OPTS, previousStruggled: true }),
    ).toBeNull();
  });

  it('deloadFactor personnalisé (−20 %) respecté (80 → 64)', () => {
    const lastSets = [{ setType: 'failure', rpe: null, done: true }];
    expect(
      computeProgressionSuggestion(lastSets, refWeight, {
        ...OPTS,
        previousStruggled: true,
        deloadFactor: 0.2,
      }),
    ).toEqual({ kind: 'deload', weightKg: 64 });
  });

  // Poids gelé (US MUSC-F15, roadmap 3.7) : adhérence insuffisante au programme la semaine
  // précédente → weightOrReps se dégrade en weightHold (poids inchangé, reps toujours proposées).
  it('priorWeekAdherenceOk omis → comportement identique à avant cette US (non-régression)', () => {
    const lastSets = [{ setType: 'normal', rpe: 6, done: true }];
    expect(computeProgressionSuggestion(lastSets, refWeight, OPTS)).toEqual({
      kind: 'weightOrReps',
      weightKg: 82.5,
      reps: 9,
    });
  });

  it('priorWeekAdherenceOk: true → weightOrReps inchangé', () => {
    const lastSets = [{ setType: 'normal', rpe: 6, done: true }];
    expect(
      computeProgressionSuggestion(lastSets, refWeight, { ...OPTS, priorWeekAdherenceOk: true }),
    ).toEqual({ kind: 'weightOrReps', weightKg: 82.5, reps: 9 });
  });

  it('priorWeekAdherenceOk: false → weightHold (poids inchangé, reps +1)', () => {
    const lastSets = [{ setType: 'normal', rpe: 6, done: true }];
    expect(
      computeProgressionSuggestion(lastSets, refWeight, { ...OPTS, priorWeekAdherenceOk: false }),
    ).toEqual({ kind: 'weightHold', weightKg: 80, reps: 9 });
  });

  it('previousStruggled ET priorWeekAdherenceOk: false en même temps → le deload gagne (R4)', () => {
    const lastSets = [{ setType: 'failure', rpe: null, done: true }];
    expect(
      computeProgressionSuggestion(lastSets, refWeight, {
        ...OPTS,
        previousStruggled: true,
        priorWeekAdherenceOk: false,
      }),
    ).toEqual({ kind: 'deload', weightKg: 72 });
  });
});

// ---------------------------------------------------------------------------
// computeWeekCompletionRate (US MUSC-F15)
// ---------------------------------------------------------------------------
describe('computeWeekCompletionRate', () => {
  it('4 séances dont 3 done → 0.75', () => {
    const sessions = [
      { status: 'done' as const },
      { status: 'done' as const },
      { status: 'done' as const },
      { status: 'skipped' as const },
    ];
    expect(computeWeekCompletionRate(sessions)).toBe(0.75);
  });

  it('liste vide → null (pas de semaine à évaluer, spec R2)', () => {
    expect(computeWeekCompletionRate([])).toBeNull();
  });

  it('1 séance done sur 1 → 1', () => {
    expect(computeWeekCompletionRate([{ status: 'done' }])).toBe(1);
  });

  it('mélange done/skipped/planned → compté tel quel, jamais deviné', () => {
    const sessions = [
      { status: 'done' as const },
      { status: 'skipped' as const },
      { status: 'planned' as const },
      { status: 'planned' as const },
    ];
    expect(computeWeekCompletionRate(sessions)).toBe(0.25);
  });
});

// ---------------------------------------------------------------------------
// deriveTemplateTargetsFromWorkoutSets
// ---------------------------------------------------------------------------
describe('deriveTemplateTargetsFromWorkoutSets', () => {
  it('séance vide → []', () => {
    expect(deriveTemplateTargetsFromWorkoutSets([])).toEqual([]);
  });

  it('un seul exercice, 3 séries toutes validées → cibles dérivées de la dernière série validée', () => {
    const sets = [
      { exerciseId: 'A', setType: 'normal', reps: 10, weightKg: 80, done: true },
      { exerciseId: 'A', setType: 'normal', reps: 8, weightKg: 82.5, done: true },
      { exerciseId: 'A', setType: 'normal', reps: 6, weightKg: 85, done: true },
    ];
    expect(deriveTemplateTargetsFromWorkoutSets(sets)).toEqual([
      { exerciseId: 'A', setType: 'normal', targetSets: 3, targetReps: '6', targetWeightKg: 85 },
    ]);
  });

  it('série non-validée en dernière position : ignorée des cibles mais comptée hors targetSets', () => {
    const sets = [
      { exerciseId: 'A', setType: 'normal', reps: 10, weightKg: 80, done: true },
      { exerciseId: 'A', setType: 'normal', reps: 8, weightKg: 82.5, done: true },
      { exerciseId: 'A', setType: 'normal', reps: 6, weightKg: 85, done: false },
    ];
    expect(deriveTemplateTargetsFromWorkoutSets(sets)).toEqual([
      { exerciseId: 'A', setType: 'normal', targetSets: 2, targetReps: '8', targetWeightKg: 82.5 },
    ]);
  });

  it("exercice sans aucune série validée → exclu du résultat (pas d'entrée null/undefined)", () => {
    const sets = [
      { exerciseId: 'A', setType: 'normal', reps: 10, weightKg: 80, done: false },
      { exerciseId: 'A', setType: 'normal', reps: 8, weightKg: 82.5, done: false },
    ];
    expect(deriveTemplateTargetsFromWorkoutSets(sets)).toEqual([]);
  });

  it('deux exercices entrelacés (A,B,A,B) → ordre de première apparition préservé, pas order_index brut', () => {
    const sets = [
      { exerciseId: 'A', setType: 'normal', reps: 10, weightKg: 80, done: true },
      { exerciseId: 'B', setType: 'normal', reps: 12, weightKg: 40, done: true },
      { exerciseId: 'A', setType: 'normal', reps: 8, weightKg: 82.5, done: true },
      { exerciseId: 'B', setType: 'normal', reps: 10, weightKg: 42.5, done: true },
    ];
    const result = deriveTemplateTargetsFromWorkoutSets(sets);
    expect(result.map((r) => r.exerciseId)).toEqual(['A', 'B']);
  });

  it("set_type du résultat = celui de la première série validée, pas la dernière (ex. warmup puis normal)", () => {
    const sets = [
      { exerciseId: 'A', setType: 'warmup', reps: 12, weightKg: 40, done: true },
      { exerciseId: 'A', setType: 'normal', reps: 8, weightKg: 80, done: true },
    ];
    expect(deriveTemplateTargetsFromWorkoutSets(sets)).toEqual([
      { exerciseId: 'A', setType: 'warmup', targetSets: 2, targetReps: '8', targetWeightKg: 80 },
    ]);
  });
});

describe('isWorkoutStale', () => {
  const start = '2026-07-25T10:00:00.000Z';
  const startMs = new Date(start).getTime();

  it('faux avant le seuil (3 h)', () => {
    expect(isWorkoutStale(start, startMs + (WORKOUT_AUTO_CLOSE_SECONDS - 1) * 1000)).toBe(false);
  });
  it('faux pile au seuil (strictement supérieur)', () => {
    expect(isWorkoutStale(start, startMs + WORKOUT_AUTO_CLOSE_SECONDS * 1000)).toBe(false);
  });
  it('vrai après le seuil', () => {
    expect(isWorkoutStale(start, startMs + (WORKOUT_AUTO_CLOSE_SECONDS + 1) * 1000)).toBe(true);
  });
  it('seuil personnalisé respecté', () => {
    expect(isWorkoutStale(start, startMs + 61_000, 60)).toBe(true);
    expect(isWorkoutStale(start, startMs + 59_000, 60)).toBe(false);
  });
  it('date invalide → faux (jamais de clôture à l\'aveugle)', () => {
    expect(isWorkoutStale('pas-une-date', Date.now())).toBe(false);
  });
  it('WORKOUT_AUTO_CLOSE_SECONDS vaut 3 h', () => {
    expect(WORKOUT_AUTO_CLOSE_SECONDS).toBe(10_800);
  });
});

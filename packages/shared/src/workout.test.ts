import { describe, expect, it } from 'vitest';
import {
  SET_TYPES,
  setTypeSchema,
  WORKOUT_STATUSES,
  workoutStatusSchema,
  workoutRowSchema,
  workoutSetRowSchema,
  computeVolume,
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
  it('contient les 5 types de série canoniques', () => {
    expect(SET_TYPES).toEqual(['normal', 'warmup', 'superset', 'duration', 'bodyweight']);
  });

  it('setTypeSchema accepte une valeur valide', () => {
    expect(setTypeSchema.parse('normal')).toBe('normal');
    expect(setTypeSchema.parse('warmup')).toBe('warmup');
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
});

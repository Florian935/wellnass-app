import { describe, expect, it } from 'vitest';
import {
  RECORD_TYPES,
  recordTypeSchema,
  personalRecordRowSchema,
  estimate1RM,
  computeWorkoutRecords,
  sessionBestEstimated1RM,
  pickOneRepMax,
  REP_BUCKETS,
  resolveRepBucketRecords,
} from './records';

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const UUID2 = '4a3604e0-5f90-42d4-ab1d-1416f93d4412';
const UUID3 = '5b4704e0-6a91-43e5-bc2e-2527fa4e5523';
const NOW = '2026-07-06T00:00:00.000Z';

const BASE_SYNC = {
  id: UUID,
  userId: UUID,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};

// ---------------------------------------------------------------------------
// RECORD_TYPES
// ---------------------------------------------------------------------------
describe('RECORD_TYPES', () => {
  it('contient les 3 types de records canoniques', () => {
    expect(RECORD_TYPES).toEqual(['max_weight', 'estimated_1rm', 'best_volume']);
  });

  it('recordTypeSchema accepte une valeur valide', () => {
    expect(recordTypeSchema.parse('max_weight')).toBe('max_weight');
    expect(recordTypeSchema.parse('estimated_1rm')).toBe('estimated_1rm');
    expect(recordTypeSchema.parse('best_volume')).toBe('best_volume');
  });

  it('recordTypeSchema rejette une valeur inconnue', () => {
    expect(recordTypeSchema.safeParse('max_reps').success).toBe(false);
    expect(recordTypeSchema.safeParse('').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// estimate1RM
// ---------------------------------------------------------------------------
describe('estimate1RM', () => {
  it('formule Epley : 100 kg × 5 reps ≈ 116.67', () => {
    expect(estimate1RM(100, 5)).toBeCloseTo(116.67, 2);
  });

  it('retourne le poids lui-même pour 1 répétition', () => {
    expect(estimate1RM(80, 1)).toBe(80);
  });

  it('retourne le poids lui-même pour 0 répétition (garde-fou)', () => {
    expect(estimate1RM(60, 0)).toBe(60);
  });

  it('retourne le poids lui-même pour des reps négatifs (garde-fou)', () => {
    expect(estimate1RM(70, -3)).toBe(70);
  });

  it('formule Epley : 80 kg × 10 reps ≈ 106.67', () => {
    expect(estimate1RM(80, 10)).toBeCloseTo(106.67, 2);
  });

  it('retourne un nombre arrondi à 2 décimales', () => {
    const result = estimate1RM(100, 5);
    // 100 * (1 + 5/30) = 116.666... → arrondi à 116.67
    expect(result).toBe(116.67);
  });

  it('fonctionne avec un poids décimal (0.5 kg)', () => {
    // 60.5 * (1 + 3/30) = 60.5 * 1.1 = 66.55
    expect(estimate1RM(60.5, 3)).toBeCloseTo(66.55, 2);
  });

  it('retourne le poids lui-même pour exactement 1 rep', () => {
    expect(estimate1RM(100, 1)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// personalRecordRowSchema
// ---------------------------------------------------------------------------
describe('personalRecordRowSchema', () => {
  const validRow = {
    ...BASE_SYNC,
    exerciseId: UUID2,
    type: 'max_weight',
    value: 120,
    reps: 5,
    weightKg: 120,
    workoutId: UUID3,
    achievedAt: NOW,
  };

  it('valide une ligne record complète', () => {
    const result = personalRecordRowSchema.parse(validRow);
    expect(result.type).toBe('max_weight');
    expect(result.value).toBe(120);
    expect(result.reps).toBe(5);
    expect(result.weightKg).toBe(120);
    expect(result.workoutId).toBe(UUID3);
  });

  it('accepte workoutId null', () => {
    const row = { ...validRow, workoutId: null };
    const result = personalRecordRowSchema.parse(row);
    expect(result.workoutId).toBeNull();
  });

  it('accepte reps null', () => {
    const row = { ...validRow, reps: null };
    const result = personalRecordRowSchema.parse(row);
    expect(result.reps).toBeNull();
  });

  it('accepte weightKg null', () => {
    const row = { ...validRow, weightKg: null };
    const result = personalRecordRowSchema.parse(row);
    expect(result.weightKg).toBeNull();
  });

  it('accepte workoutId, reps et weightKg tous à null', () => {
    const row = { ...validRow, workoutId: null, reps: null, weightKg: null };
    expect(personalRecordRowSchema.safeParse(row).success).toBe(true);
  });

  it('rejette un type inconnu', () => {
    const row = { ...validRow, type: 'max_reps' };
    expect(personalRecordRowSchema.safeParse(row).success).toBe(false);
  });

  it('rejette un exerciseId invalide (non-UUID)', () => {
    const row = { ...validRow, exerciseId: 'not-a-uuid' };
    expect(personalRecordRowSchema.safeParse(row).success).toBe(false);
  });

  it('rejette un workoutId invalide (non-UUID, non-null)', () => {
    const row = { ...validRow, workoutId: 'not-a-uuid' };
    expect(personalRecordRowSchema.safeParse(row).success).toBe(false);
  });

  it('exige userId (champ syncFields)', () => {
    const { userId: _userId, ...withoutUser } = validRow;
    expect(personalRecordRowSchema.safeParse(withoutUser).success).toBe(false);
  });

  it('exige achievedAt', () => {
    const { achievedAt: _achievedAt, ...withoutAchieved } = validRow;
    expect(personalRecordRowSchema.safeParse(withoutAchieved).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeWorkoutRecords
// ---------------------------------------------------------------------------
describe('computeWorkoutRecords', () => {
  const EX1 = '11111111-1111-1111-1111-111111111111';
  const EX2 = '22222222-2222-2222-2222-222222222222';

  it('retourne un tableau vide pour une entrée vide', () => {
    expect(computeWorkoutRecords([])).toEqual([]);
  });

  it("retourne un tableau vide si aucune série n'est done", () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [
          { reps: 8, weightKg: 100, setType: 'normal', done: false },
          { reps: 5, weightKg: 120, setType: 'normal', done: false },
        ],
      },
    ];
    expect(computeWorkoutRecords(exercises)).toEqual([]);
  });

  it('exclut les séries de type warmup', () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [
          { reps: 10, weightKg: 60, setType: 'warmup', done: true },
          // Aucune série valide
        ],
      },
    ];
    expect(computeWorkoutRecords(exercises)).toEqual([]);
  });

  it('exclut les séries non-done même si non-warmup', () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [
          { reps: 10, weightKg: 100, setType: 'normal', done: false },
        ],
      },
    ];
    expect(computeWorkoutRecords(exercises)).toEqual([]);
  });

  it("n'émet aucun candidat pour un exercice sans série valide", () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [
          { reps: 5, weightKg: 100, setType: 'warmup', done: true },
          { reps: 8, weightKg: 80, setType: 'normal', done: false },
        ],
      },
    ];
    expect(computeWorkoutRecords(exercises)).toEqual([]);
  });

  it('calcule max_weight correctement (série avec le plus grand poids)', () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [
          { reps: 8, weightKg: 80, setType: 'normal', done: true },
          { reps: 5, weightKg: 120, setType: 'normal', done: true },
          { reps: 3, weightKg: 100, setType: 'normal', done: true },
        ],
      },
    ];
    const records = computeWorkoutRecords(exercises);
    const maxWeight = records.find((r) => r.exerciseId === EX1 && r.type === 'max_weight');
    expect(maxWeight).toBeDefined();
    expect(maxWeight?.value).toBe(120);
    expect(maxWeight?.weightKg).toBe(120);
    expect(maxWeight?.reps).toBe(5);
  });

  it('calcule estimated_1rm correctement (formule Epley, max sur les séries)', () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [
          { reps: 5, weightKg: 100, setType: 'normal', done: true }, // 116.67
          { reps: 8, weightKg: 80, setType: 'normal', done: true },  // 101.33
        ],
      },
    ];
    const records = computeWorkoutRecords(exercises);
    const est1rm = records.find((r) => r.exerciseId === EX1 && r.type === 'estimated_1rm');
    expect(est1rm).toBeDefined();
    expect(est1rm?.value).toBeCloseTo(116.67, 2);
    expect(est1rm?.weightKg).toBe(100);
    expect(est1rm?.reps).toBe(5);
  });

  it('calcule best_volume correctement (max reps×poids sur une seule série)', () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [
          { reps: 10, weightKg: 50, setType: 'normal', done: true },  // 500
          { reps: 5, weightKg: 120, setType: 'normal', done: true },  // 600 ← max
          { reps: 8, weightKg: 70, setType: 'normal', done: true },   // 560
        ],
      },
    ];
    const records = computeWorkoutRecords(exercises);
    const bestVol = records.find((r) => r.exerciseId === EX1 && r.type === 'best_volume');
    expect(bestVol).toBeDefined();
    expect(bestVol?.value).toBe(600);
    expect(bestVol?.weightKg).toBe(120);
    expect(bestVol?.reps).toBe(5);
  });

  it('produit les 3 types de records pour un exercice multi-séries', () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [
          { reps: 5, weightKg: 100, setType: 'normal', done: true },
          { reps: 8, weightKg: 80, setType: 'normal', done: true },
          { reps: 12, weightKg: 60, setType: 'normal', done: true },
        ],
      },
    ];
    const records = computeWorkoutRecords(exercises);
    const types = records.filter((r) => r.exerciseId === EX1).map((r) => r.type);
    expect(types).toContain('max_weight');
    expect(types).toContain('estimated_1rm');
    expect(types).toContain('best_volume');
  });

  it('gère plusieurs exercices indépendamment', () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [{ reps: 5, weightKg: 100, setType: 'normal', done: true }],
      },
      {
        exerciseId: EX2,
        sets: [{ reps: 8, weightKg: 70, setType: 'normal', done: true }],
      },
    ];
    const records = computeWorkoutRecords(exercises);
    const ex1Records = records.filter((r) => r.exerciseId === EX1);
    const ex2Records = records.filter((r) => r.exerciseId === EX2);
    expect(ex1Records.length).toBeGreaterThan(0);
    expect(ex2Records.length).toBeGreaterThan(0);
  });

  it('ignore les séries avec weightKg null pour max_weight', () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [
          { reps: 15, weightKg: null, setType: 'bodyweight', done: true },
        ],
      },
    ];
    const records = computeWorkoutRecords(exercises);
    const maxWeight = records.find((r) => r.exerciseId === EX1 && r.type === 'max_weight');
    expect(maxWeight).toBeUndefined();
  });

  it('ignore les séries avec reps null pour estimated_1rm', () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [
          { reps: null, weightKg: 100, setType: 'duration', done: true },
        ],
      },
    ];
    const records = computeWorkoutRecords(exercises);
    const est1rm = records.find((r) => r.exerciseId === EX1 && r.type === 'estimated_1rm');
    expect(est1rm).toBeUndefined();
  });

  it('ignore les séries avec reps ou weightKg null pour best_volume', () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [
          { reps: null, weightKg: 100, setType: 'normal', done: true },
          { reps: 10, weightKg: null, setType: 'bodyweight', done: true },
        ],
      },
    ];
    const records = computeWorkoutRecords(exercises);
    const bestVol = records.find((r) => r.exerciseId === EX1 && r.type === 'best_volume');
    expect(bestVol).toBeUndefined();
  });

  it("max_weight utilise les reps de la série qui produit le record (contexte)", () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [
          { reps: 3, weightKg: 140, setType: 'normal', done: true }, // max weight
          { reps: 8, weightKg: 100, setType: 'normal', done: true },
        ],
      },
    ];
    const records = computeWorkoutRecords(exercises);
    const maxWeight = records.find((r) => r.exerciseId === EX1 && r.type === 'max_weight');
    expect(maxWeight?.reps).toBe(3);
    expect(maxWeight?.weightKg).toBe(140);
  });

  it('exclut les séries warmup même si done=true', () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [
          { reps: 5, weightKg: 150, setType: 'warmup', done: true }, // exclu
          { reps: 5, weightKg: 100, setType: 'normal', done: true }, // valide
        ],
      },
    ];
    const records = computeWorkoutRecords(exercises);
    const maxWeight = records.find((r) => r.exerciseId === EX1 && r.type === 'max_weight');
    // Le warmup (150 kg) doit être exclu → max = 100
    expect(maxWeight?.value).toBe(100);
  });

  it('retourne des candidats avec les bons champs structurels', () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [{ reps: 5, weightKg: 100, setType: 'normal', done: true }],
      },
    ];
    const records = computeWorkoutRecords(exercises);
    for (const r of records) {
      expect(r).toHaveProperty('exerciseId');
      expect(r).toHaveProperty('type');
      expect(r).toHaveProperty('value');
      expect(r).toHaveProperty('reps');
      expect(r).toHaveProperty('weightKg');
    }
  });

  it('garde le premier max en cas d\'égalité stricte (deux séries même poids)', () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [
          { reps: 5, weightKg: 100, setType: 'normal', done: true },
          { reps: 8, weightKg: 100, setType: 'normal', done: true },
        ],
      },
    ];
    const records = computeWorkoutRecords(exercises);
    const maxWeight = records.find((r) => r.exerciseId === EX1 && r.type === 'max_weight');
    expect(maxWeight).toBeDefined();
    // En égalité, le premier candidat (reps=5) est retenu car la condition est >
    expect(maxWeight?.value).toBe(100);
    expect(maxWeight?.reps).toBe(5);
  });

  it('ignore les séries de type duration (poids null) pour max_weight et estimated_1rm', () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [
          // Série durée : pas de reps ni de poids → aucun record possible
          { reps: null, weightKg: null, setType: 'duration', done: true },
        ],
      },
    ];
    const records = computeWorkoutRecords(exercises);
    expect(records).toHaveLength(0);
  });

  it("n'émet aucun max_weight pour une série duration lestée (gainage lesté)", () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [{ reps: null, weightKg: 20, setType: 'duration', done: true }],
      },
    ];
    const records = computeWorkoutRecords(exercises);
    const maxWeight = records.find((r) => r.exerciseId === EX1 && r.type === 'max_weight');
    expect(maxWeight).toBeUndefined();
  });

  it('émet un max_weight pour une série bodyweight lestée', () => {
    const exercises = [
      {
        exerciseId: EX1,
        sets: [{ reps: 5, weightKg: 40, setType: 'bodyweight', done: true }],
      },
    ];
    const records = computeWorkoutRecords(exercises);
    const maxWeight = records.find((r) => r.exerciseId === EX1 && r.type === 'max_weight');
    expect(maxWeight).toBeDefined();
    expect(maxWeight?.value).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// sessionBestEstimated1RM
// ---------------------------------------------------------------------------
describe('sessionBestEstimated1RM', () => {
  it('max des 1RM estimés des séries valides d’une séance', () => {
    // estimate1RM(90,10)=90×(1+10/30)=120 ; estimate1RM(100,5)≈116.67 → max 120
    expect(
      sessionBestEstimated1RM([
        { reps: 5, weightKg: 100 },
        { reps: 10, weightKg: 90 },
      ]),
    ).toBe(estimate1RM(90, 10));
  });
  it('ignore les séries à reps/poids manquant', () => {
    expect(
      sessionBestEstimated1RM([
        { reps: null, weightKg: 100 },
        { reps: 8, weightKg: 80 },
        { reps: 5, weightKg: null },
      ]),
    ).toBe(estimate1RM(80, 8));
  });
  it('0 si aucune série qualifiante', () => {
    expect(sessionBestEstimated1RM([])).toBe(0);
    expect(sessionBestEstimated1RM([{ reps: null, weightKg: null }])).toBe(0);
  });
  it('reps ≤ 1 → renvoie le poids (pas de bonus Epley)', () => {
    expect(sessionBestEstimated1RM([{ reps: 1, weightKg: 120 }])).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// pickOneRepMax
// ---------------------------------------------------------------------------
describe('pickOneRepMax', () => {
  it('réel prioritaire quand présent', () => {
    expect(
      pickOneRepMax({ value: 100, date: '2026-07-12T10:00:00Z' }, { value: 98, date: '2026-07-05T10:00:00Z' }),
    ).toEqual({ value: 100, date: '2026-07-12T10:00:00Z', real: true });
  });
  it('repli sur estimé si pas de réel', () => {
    expect(pickOneRepMax(null, { value: 98, date: '2026-07-05T10:00:00Z' })).toEqual({
      value: 98,
      date: '2026-07-05T10:00:00Z',
      real: false,
    });
  });
  it('null si ni réel ni estimé', () => {
    expect(pickOneRepMax(null, null)).toBeNull();
  });
});

describe('resolveRepBucketRecords (US MUSC-09)', () => {
  it('séries à 1/5/10 reps, charges différentes → 3 entrées, dans l’ordre 1/5/10', () => {
    const sets = [
      { reps: 10, weightKg: 40, achievedAt: '2026-07-10T10:00:00Z' },
      { reps: 1, weightKg: 90, achievedAt: '2026-07-15T10:00:00Z' },
      { reps: 5, weightKg: 65, achievedAt: '2026-07-20T10:00:00Z' },
    ];
    const result = resolveRepBucketRecords(sets);
    expect(result.map((r) => r.bucketKey)).toEqual(['1', '5', '10']);
    expect(result.map((r) => r.weightKg)).toEqual([90, 65, 40]);
  });

  it('reps=3 et reps=4 (même plage) → une seule entrée, la charge la plus haute', () => {
    const sets = [
      { reps: 3, weightKg: 60, achievedAt: '2026-07-10T10:00:00Z' },
      { reps: 4, weightKg: 70, achievedAt: '2026-07-12T10:00:00Z' },
    ];
    const result = resolveRepBucketRecords(sets);
    expect(result).toEqual([{ bucketKey: '3', weightKg: 70, achievedAt: '2026-07-12T10:00:00Z' }]);
  });

  it('égalité de charge dans la même plage → la plus récente est retenue (R5)', () => {
    const sets = [
      { reps: 5, weightKg: 60, achievedAt: '2026-07-01T10:00:00Z' },
      { reps: 6, weightKg: 60, achievedAt: '2026-07-20T10:00:00Z' },
    ];
    const result = resolveRepBucketRecords(sets);
    expect(result).toEqual([{ bucketKey: '5', weightKg: 60, achievedAt: '2026-07-20T10:00:00Z' }]);
  });

  it('aucune série → []', () => {
    expect(resolveRepBucketRecords([])).toEqual([]);
  });

  it('reps=12/15/30 tombent tous dans 12plus (borne haute ouverte)', () => {
    const sets = [
      { reps: 12, weightKg: 20, achievedAt: '2026-07-01T10:00:00Z' },
      { reps: 15, weightKg: 25, achievedAt: '2026-07-05T10:00:00Z' },
      { reps: 30, weightKg: 10, achievedAt: '2026-07-08T10:00:00Z' },
    ];
    const result = resolveRepBucketRecords(sets);
    expect(result).toEqual([{ bucketKey: '12plus', weightKg: 25, achievedAt: '2026-07-05T10:00:00Z' }]);
  });

  it('une plage sans série qualifiante est absente du résultat (R4)', () => {
    const sets = [{ reps: 1, weightKg: 90, achievedAt: '2026-07-15T10:00:00Z' }];
    const result = resolveRepBucketRecords(sets);
    expect(result).toHaveLength(1);
    expect(result.some((r) => r.bucketKey === '10')).toBe(false);
  });

  it('REP_BUCKETS couvre le spectre 1..12+ sans trou ni chevauchement', () => {
    for (let reps = 1; reps <= 30; reps++) {
      const matches = REP_BUCKETS.filter((b) => reps >= b.minReps && reps <= b.maxReps);
      expect(matches).toHaveLength(1);
    }
  });
});

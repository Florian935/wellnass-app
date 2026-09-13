import { describe, expect, it } from 'vitest';
import { nearRecords, type NearRecordInput } from './near-record';

const input = (over: Partial<NearRecordInput> & Pick<NearRecordInput, 'exerciseId'>): NearRecordInput => ({
  recent: { weightKg: 82.5, reps: 3 },
  record: { weightKg: 85, reps: 3 },
  ...over,
});

describe('nearRecords (US DASH-01, record à portée — MUSC-09)', () => {
  it('même nombre de répétitions, charge inférieure → écart en kg', () => {
    expect(nearRecords([input({ exerciseId: 'bench' })])).toEqual([
      { exerciseId: 'bench', gapKind: 'kg', gap: 2.5, ratio: 82.5 / 85 },
    ]);
  });

  it('même charge, moins de répétitions → écart en répétitions', () => {
    expect(
      nearRecords([
        input({ exerciseId: 'squat', recent: { weightKg: 110, reps: 4 }, record: { weightKg: 110, reps: 5 } }),
      ]),
    ).toEqual([{ exerciseId: 'squat', gapKind: 'reps', gap: 1, ratio: 4 / 5 }]);
  });

  it('record égalé ou dépassé → « beaten », en tête de liste', () => {
    const result = nearRecords([
      input({ exerciseId: 'bench' }),
      input({ exerciseId: 'row', recent: { weightKg: 70, reps: 6 }, record: { weightKg: 70, reps: 6 } }),
    ]);
    expect(result[0]).toEqual({ exerciseId: 'row', gapKind: 'beaten', gap: 0, ratio: 1 });
  });

  it('un écart trop grand (plus de 15 %) n’est pas « à portée »', () => {
    expect(
      nearRecords([input({ exerciseId: 'dl', recent: { weightKg: 100, reps: 3 }, record: { weightKg: 130, reps: 3 } })]),
    ).toEqual([]);
  });

  it('sans record ou sans performance récente → ignoré', () => {
    expect(nearRecords([input({ exerciseId: 'a', record: null }), input({ exerciseId: 'b', recent: null })])).toEqual(
      [],
    );
  });

  it('tri du plus proche au plus lointain, limité à 3', () => {
    const result = nearRecords([
      input({ exerciseId: 'far', recent: { weightKg: 90, reps: 5 }, record: { weightKg: 100, reps: 5 } }),
      input({ exerciseId: 'close', recent: { weightKg: 99, reps: 5 }, record: { weightKg: 100, reps: 5 } }),
      input({ exerciseId: 'mid', recent: { weightKg: 95, reps: 5 }, record: { weightKg: 100, reps: 5 } }),
      input({ exerciseId: 'mid2', recent: { weightKg: 94, reps: 5 }, record: { weightKg: 100, reps: 5 } }),
    ]);
    expect(result.map((r) => r.exerciseId)).toEqual(['close', 'mid', 'mid2']);
  });

  it('l’écart en kg est arrondi au quart de kilo (pas de 2,4999)', () => {
    expect(
      nearRecords([input({ exerciseId: 'x', recent: { weightKg: 57.3, reps: 8 }, record: { weightKg: 60.1, reps: 8 } })])[0]
        ?.gap,
    ).toBe(2.75);
  });
});

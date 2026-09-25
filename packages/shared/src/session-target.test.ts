import { describe, expect, it } from 'vitest';
import { resolveSessionTarget } from './session-target';

describe('resolveSessionTarget — §4.5', () => {
  it('séries × répétitions telles qu’écrites dans le plan', () => {
    expect(resolveSessionTarget({ targetSets: 4, targetReps: '8-12', targetWeightKg: null })).toEqual({
      sets: 4,
      reps: '8-12',
      plannedWeightKg: null,
    });
  });

  it('un texte libre (AMRAP) est gardé tel quel', () => {
    expect(resolveSessionTarget({ targetSets: 3, targetReps: 'AMRAP', targetWeightKg: null }).reps).toBe(
      'AMRAP',
    );
  });

  it('sans répétitions cibles : les séries seules', () => {
    expect(resolveSessionTarget({ targetSets: 3, targetReps: '  ', targetWeightKg: null }).reps).toBeNull();
    expect(resolveSessionTarget({ targetSets: 3, targetReps: null, targetWeightKg: null }).reps).toBeNull();
  });

  it('sans séries cibles : une série, comme le démarrage de la séance', () => {
    expect(resolveSessionTarget({ targetSets: null, targetReps: '10', targetWeightKg: null }).sets).toBe(1);
    expect(resolveSessionTarget({ targetSets: 0, targetReps: '10', targetWeightKg: null }).sets).toBe(1);
  });

  it('la charge prévue par le programme', () => {
    expect(resolveSessionTarget({ targetSets: 3, targetReps: '6-8', targetWeightKg: 50 }).plannedWeightKg).toBe(50);
  });
});

import { describe, expect, it } from 'vitest';

import { applyLiveSet, evaluateLiveRecord, type ExerciseBests, type LiveSet } from './live-records';

const bests = (over: Partial<ExerciseBests> = {}): ExerciseBests => ({
  maxWeightKg: 80,
  estimated1rm: 105,
  ...over,
});

const liveSet = (over: Partial<LiveSet> = {}): LiveSet => ({
  setType: 'normal',
  reps: 8,
  weightKg: 80,
  done: true,
  ...over,
});

describe('records en direct', () => {
  it('annonce la charge max battue, avec la valeur précédente', () => {
    const record = evaluateLiveRecord(liveSet({ weightKg: 82.5, reps: 6 }), bests());
    expect(record).toEqual({ type: 'max_weight', value: 82.5, previous: 80 });
  });

  it('donne la priorité à la charge max sur le 1RM estimé', () => {
    // 82,5 × 8 bat les deux : une seule annonce, la plus parlante.
    expect(evaluateLiveRecord(liveSet({ weightKg: 82.5 }), bests())?.type).toBe('max_weight');
  });

  it('annonce le 1RM estimé quand la charge ne bouge pas', () => {
    const record = evaluateLiveRecord(liveSet({ weightKg: 80, reps: 10 }), bests());
    expect(record?.type).toBe('estimated_1rm');
    expect(record?.value).toBeCloseTo(106.67, 2);
  });

  it('ne célèbre RIEN sans passé — une première séance ne vaut pas quinze records', () => {
    const vierge = bests({ maxWeightKg: null, estimated1rm: null });
    expect(evaluateLiveRecord(liveSet({ weightKg: 100, reps: 10 }), vierge)).toBeNull();
  });

  it('ignore les séries non éligibles, comme la clôture', () => {
    expect(evaluateLiveRecord(liveSet({ setType: 'warmup', weightKg: 200 }), bests())).toBeNull();
    expect(evaluateLiveRecord(liveSet({ setType: 'duration', weightKg: 200 }), bests())).toBeNull();
    expect(evaluateLiveRecord(liveSet({ done: false, weightKg: 200 }), bests())).toBeNull();
    expect(evaluateLiveRecord(liveSet({ weightKg: null }), bests())).toBeNull();
  });

  it('ne rejoue pas le même record deux fois dans la séance', () => {
    let courant = bests();
    const serie = liveSet({ weightKg: 82.5, reps: 6 });
    expect(evaluateLiveRecord(serie, courant)).not.toBeNull();
    courant = applyLiveSet(courant, serie);
    expect(evaluateLiveRecord(serie, courant)).toBeNull();
  });

  it('pose la référence même sans annonce, pour l\'exercice sans passé', () => {
    const apres = applyLiveSet({ maxWeightKg: null, estimated1rm: null }, liveSet({ weightKg: 60, reps: 10 }));
    expect(apres.maxWeightKg).toBe(60);
    expect(apres.estimated1rm).toBeCloseTo(80, 5);
  });

  it('ne redescend jamais les meilleures valeurs', () => {
    const apres = applyLiveSet(bests(), liveSet({ weightKg: 60, reps: 5 }));
    expect(apres.maxWeightKg).toBe(80);
    expect(apres.estimated1rm).toBe(105);
  });
});

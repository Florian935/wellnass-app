import { describe, expect, it } from 'vitest';

import { computeRepRangeSplit } from './rep-ranges';

type Set = { setType: string; reps: number | null; weightKg: number | null; done: boolean };

function set(over: Partial<Set> = {}): Set {
  return { setType: 'normal', reps: 10, weightKg: 50, done: true, ...over };
}

const compute = (sets: Set[]) => computeRepRangeSplit({ sets });

describe('computeRepRangeSplit', () => {
  it('rend null sans aucune série', () => {
    expect(compute([])).toBeNull();
  });

  it('rend null quand aucune série n’est validée', () => {
    expect(compute([set({ done: false })])).toBeNull();
  });

  it('rend null sur une séance 100 % poids du corps — limite connue, assumée', () => {
    expect(compute([set({ weightKg: null }), set({ weightKg: 0 })])).toBeNull();
  });

  it('rend null quand il n’y a que des séries à la durée', () => {
    expect(compute([set({ setType: 'duration', reps: null })])).toBeNull();
  });

  it('classe selon les bornes 1-5 / 6-12 / 13+', () => {
    const out = compute([
      set({ reps: 5, weightKg: 100 }), // force : 500
      set({ reps: 6, weightKg: 100 }), // hypertrophie : 600
      set({ reps: 13, weightKg: 100 }), // endurance : 1300
    ]);
    expect(out?.map((r) => r.range)).toEqual(['strength', 'hypertrophy', 'endurance']);
    expect(out?.map((r) => r.volumeKg)).toEqual([500, 600, 1300]);
  });

  it('pondère par le VOLUME et non par le nombre de séries (R8)', () => {
    // Autant de séries de chaque côté, mais la force pèse six fois plus lourd.
    const out = compute([
      set({ reps: 5, weightKg: 100 }), // 500
      set({ reps: 15, weightKg: 6 }), // 90
    ]);
    const strength = out?.find((r) => r.range === 'strength');
    expect(strength?.percent).toBeGreaterThan(80);
  });

  it('somme toujours exactement à 100', () => {
    const out = compute([
      set({ reps: 3, weightKg: 100 }),
      set({ reps: 10, weightKg: 100 }),
      set({ reps: 20, weightKg: 100 }),
    ]);
    expect(out!.reduce((sum, r) => sum + r.percent, 0)).toBe(100);
  });

  it('rend les plages dans l’ordre canonique, pas par taille décroissante', () => {
    // L'endurance domine largement : elle doit malgré tout rester en dernier.
    const out = compute([
      set({ reps: 3, weightKg: 10 }),
      set({ reps: 20, weightKg: 200 }),
    ]);
    expect(out?.map((r) => r.range)).toEqual(['strength', 'endurance']);
  });

  it('omet une plage non travaillée plutôt que de l’afficher à 0 %', () => {
    const out = compute([set({ reps: 10, weightKg: 50 })]);
    expect(out).toEqual([{ range: 'hypertrophy', volumeKg: 500, percent: 100 }]);
  });

  it('exclut les échauffements, qui tireraient le tonnage vers l’endurance (R4)', () => {
    const out = compute([
      set({ setType: 'warmup', reps: 20, weightKg: 20 }),
      set({ reps: 8, weightKg: 80 }),
    ]);
    expect(out).toEqual([{ range: 'hypertrophy', volumeKg: 640, percent: 100 }]);
  });
});

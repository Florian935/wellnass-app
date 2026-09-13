import { describe, expect, it } from 'vitest';

import { computeFinalChallenge, computeGhost, setTonnage, type GhostDoneSet } from './ghost';

const fait = (rank: number, weightKg: number, reps: number, over: Partial<GhostDoneSet> = {}): GhostDoneSet => ({
  exerciseId: 'couche',
  rank,
  setType: 'normal',
  reps,
  weightKg,
  ...over,
});

const REFERENCES = {
  couche: {
    finishedAt: '2026-09-08T18:00:00.000Z',
    sets: [
      { setType: 'normal' as const, reps: 8, weightKg: 77.5 },
      { setType: 'normal' as const, reps: 8, weightKg: 77.5 },
      { setType: 'normal' as const, reps: 7, weightKg: 77.5 },
    ],
  },
};

describe('tonnage d\'une série', () => {
  it('ignore échauffement, durée et valeurs manquantes', () => {
    expect(setTonnage({ setType: 'normal', reps: 8, weightKg: 80 })).toBe(640);
    expect(setTonnage({ setType: 'warmup', reps: 8, weightKg: 80 })).toBe(0);
    expect(setTonnage({ setType: 'duration', reps: null, weightKg: 20 })).toBe(0);
    expect(setTonnage({ setType: 'bodyweight', reps: 10, weightKg: null })).toBe(0);
  });
});

describe('fantôme', () => {
  it('compare au même rang, série après série', () => {
    const state = computeGhost({ done: [fait(0, 80, 8), fait(1, 82.5, 7)], references: REFERENCES });
    expect(state.you).toBe(640 + 577.5);
    expect(state.ghost).toBe(620 + 620);
    expect(state.delta).toBeCloseTo(-22.5, 5);
    expect(state.points).toHaveLength(3);
  });

  it('donne le total de la référence, cible du défi de fin', () => {
    expect(computeGhost({ done: [], references: REFERENCES }).ghostTotal).toBeCloseTo(1782.5, 5);
  });

  it('n\'avance pas le fantôme sur une série ajoutée sans référence', () => {
    const state = computeGhost({ done: [fait(9, 80, 8)], references: REFERENCES });
    expect(state.you).toBe(640);
    expect(state.ghost).toBe(0);
  });

  it('se déclare absent quand aucun exercice n\'a d\'historique', () => {
    expect(computeGhost({ done: [], references: {} }).hasGhost).toBe(false);
    expect(computeGhost({ done: [], references: { couche: { sets: [], finishedAt: null } } }).hasGhost).toBe(false);
  });
});

describe('défi de dernière série', () => {
  const base = { you: 2177.5, ghostTotal: 2382.5, weightKg: 42.5, plannedReps: 7 };

  it('chiffre ce qu\'il reste à faire', () => {
    expect(computeFinalChallenge(base)).toEqual({ kind: 'challenge', reps: 5 });
  });

  it('dit simplement qu\'on est devant, sans rien demander', () => {
    expect(computeFinalChallenge({ ...base, you: 2500 })).toEqual({ kind: 'ahead', aheadKg: 118 });
  });

  it('se tait quand l\'objectif dépasse le prévu de plus de 2 reps', () => {
    expect(computeFinalChallenge({ ...base, you: 1500 })).toEqual({ kind: 'none' });
  });

  it('se tait après un ressenti « limite » — on ne pousse pas quelqu\'un à bout', () => {
    expect(computeFinalChallenge({ ...base, lastFeel: 'limite' })).toEqual({ kind: 'none' });
  });

  it('se tait sans charge exploitable ou sans fantôme', () => {
    expect(computeFinalChallenge({ ...base, weightKg: null })).toEqual({ kind: 'none' });
    expect(computeFinalChallenge({ ...base, ghostTotal: 0 })).toEqual({ kind: 'none' });
  });
});

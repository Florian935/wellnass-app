import { describe, expect, it } from 'vitest';

import type { MuscleGroup } from './exercise';
import { computeSessionMuscleSplit, type MuscleSplitSet } from './session-muscle-split';

const MUSCLES = new Map<string, MuscleGroup>([
  ['bench', 'chest'],
  ['row', 'back'],
  ['press', 'shoulders'],
  ['raise', 'shoulders'],
  ['curl', 'arms'],
]);

function set(over: Partial<MuscleSplitSet> & { exerciseId: string }): MuscleSplitSet {
  return {
    setType: 'normal',
    reps: 10,
    weightKg: 50,
    rpe: null,
    done: true,
    ...over,
  };
}

const compute = (sets: MuscleSplitSet[], muscles = MUSCLES) =>
  computeSessionMuscleSplit({ sets, exerciseMuscle: muscles });

describe('computeSessionMuscleSplit', () => {
  it('rend null sans aucune série', () => {
    expect(compute([])).toBeNull();
  });

  it('rend null quand aucune série n’est validée — jamais un bloc vide', () => {
    expect(compute([set({ exerciseId: 'bench', done: false })])).toBeNull();
  });

  it('rend null quand la séance n’a que des échauffements', () => {
    expect(compute([set({ exerciseId: 'bench', setType: 'warmup' })])).toBeNull();
  });

  it('regroupe par muscle primaire et cumule séries et tonnage', () => {
    const out = compute([
      set({ exerciseId: 'press', reps: 8, weightKg: 45 }),
      set({ exerciseId: 'raise', reps: 15, weightKg: 12 }),
      set({ exerciseId: 'bench', reps: 8, weightKg: 80 }),
    ]);
    expect(out).toEqual([
      { group: 'shoulders', sets: 2, hardSets: 0, volumeKg: 8 * 45 + 15 * 12 },
      { group: 'chest', sets: 1, hardSets: 0, volumeKg: 640 },
    ]);
  });

  it('exclut les échauffements du décompte et du tonnage (R4)', () => {
    const out = compute([
      set({ exerciseId: 'bench', setType: 'warmup', reps: 10, weightKg: 60 }),
      set({ exerciseId: 'bench', reps: 8, weightKg: 80 }),
    ]);
    expect(out).toEqual([{ group: 'chest', sets: 1, hardSets: 0, volumeKg: 640 }]);
  });

  it('compte une série dure à partir de RPE 8 (R6)', () => {
    const out = compute([
      set({ exerciseId: 'bench', rpe: 7 }),
      set({ exerciseId: 'bench', rpe: 8 }),
      set({ exerciseId: 'bench', rpe: 10 }),
    ]);
    expect(out?.[0]).toMatchObject({ group: 'chest', sets: 3, hardSets: 2 });
  });

  it('ne compte PAS une série sans RPE comme dure — inconnue n’est pas facile (R6)', () => {
    const out = compute([set({ exerciseId: 'bench', rpe: null })]);
    expect(out?.[0]).toMatchObject({ sets: 1, hardSets: 0 });
  });

  it('ignore un exercice absent du référentiel plutôt que d’inventer un groupe', () => {
    const out = compute([set({ exerciseId: 'bench' }), set({ exerciseId: 'inconnu' })]);
    expect(out).toEqual([{ group: 'chest', sets: 1, hardSets: 0, volumeKg: 500 }]);
  });

  it('départage alphabétiquement à nombre de séries égal — pas de scintillement', () => {
    const out = compute([set({ exerciseId: 'curl' }), set({ exerciseId: 'bench' })]);
    expect(out?.map((g) => g.group)).toEqual(['arms', 'chest']);
  });

  it('traite une charge ou des reps absentes comme une contribution nulle', () => {
    const out = compute([set({ exerciseId: 'bench', weightKg: null, reps: 12 })]);
    expect(out?.[0]).toMatchObject({ sets: 1, volumeKg: 0 });
  });
});

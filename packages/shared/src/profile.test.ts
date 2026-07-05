import { describe, expect, it } from 'vitest';
import { GOALS, SEXES, goalSchema, sexSchema } from './profile';

describe('sexSchema', () => {
  it('expose les valeurs attendues', () => {
    expect(SEXES).toEqual(['female', 'male', 'unspecified']);
  });

  it('rejette une valeur inconnue', () => {
    expect(sexSchema.safeParse('other').success).toBe(false);
  });
});

describe('goalSchema', () => {
  it('expose les objectifs attendus', () => {
    expect(GOALS).toEqual(['muscle', 'weightloss', 'performance', 'health']);
  });

  it('rejette un objectif inconnu', () => {
    expect(goalSchema.safeParse('bulk').success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { GOALS, SEXES, goalSchema, profileRowSchema, sexSchema } from './profile';

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

// ─── profileRowSchema ──────────────────────────────────────────────────────────

/** Ligne sync minimale valide. */
const syncBase = {
  id: '00000000-0000-0000-0000-000000000010',
  userId: '00000000-0000-0000-0000-000000000011',
  createdAt: '2026-07-05T08:00:00Z',
  updatedAt: '2026-07-05T08:00:00Z',
  deletedAt: null,
};

describe('profileRowSchema — ligne complète valide', () => {
  it('accepte une ligne avec tous les champs renseignés', () => {
    const row = profileRowSchema.parse({
      ...syncBase,
      firstName: 'Florian',
      birthDate: '1995-03-15',
      sex: 'male',
      heightCm: 180,
      weightKg: 75.5,
      mainGoal: 'muscle',
      onboardingCompletedAt: '2026-07-05T09:00:00Z',
    });
    expect(row.firstName).toBe('Florian');
    expect(row.sex).toBe('male');
    expect(row.heightCm).toBe(180);
    expect(row.weightKg).toBe(75.5);
    expect(row.mainGoal).toBe('muscle');
    expect(row.onboardingCompletedAt).toBe('2026-07-05T09:00:00Z');
  });
});

describe('profileRowSchema — nullables', () => {
  it('accepte une ligne avec tous les champs optionnels à null', () => {
    const row = profileRowSchema.parse({
      ...syncBase,
      firstName: null,
      birthDate: null,
      sex: null,
      heightCm: null,
      weightKg: null,
      mainGoal: null,
      onboardingCompletedAt: null,
    });
    expect(row.firstName).toBeNull();
    expect(row.sex).toBeNull();
    expect(row.heightCm).toBeNull();
    expect(row.mainGoal).toBeNull();
  });

  it('les champs nullable sont absents → null par défaut', () => {
    const row = profileRowSchema.parse({ ...syncBase });
    expect(row.firstName).toBeNull();
    expect(row.birthDate).toBeNull();
    expect(row.sex).toBeNull();
    expect(row.heightCm).toBeNull();
    expect(row.weightKg).toBeNull();
    expect(row.mainGoal).toBeNull();
    expect(row.onboardingCompletedAt).toBeNull();
  });
});

describe('profileRowSchema — rejets', () => {
  it('rejette heightCm négatif', () => {
    expect(() =>
      profileRowSchema.parse({ ...syncBase, heightCm: -5 }),
    ).toThrow();
  });

  it('rejette weightKg à zéro', () => {
    expect(() =>
      profileRowSchema.parse({ ...syncBase, weightKg: 0 }),
    ).toThrow();
  });

  it('rejette un sexe invalide', () => {
    expect(() =>
      profileRowSchema.parse({ ...syncBase, sex: 'robot' }),
    ).toThrow();
  });

  it('rejette un objectif invalide', () => {
    expect(() =>
      profileRowSchema.parse({ ...syncBase, mainGoal: 'unknown' }),
    ).toThrow();
  });

  it('rejette un onboardingCompletedAt non-ISO', () => {
    expect(() =>
      profileRowSchema.parse({ ...syncBase, onboardingCompletedAt: '05/07/2026' }),
    ).toThrow();
  });
});

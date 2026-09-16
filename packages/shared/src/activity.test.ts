import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_INTENSITIES,
  ACTIVITY_INTENSITY_RPE,
  ACTIVITY_TYPES,
  FREQUENT_ACTIVITY_TYPES,
  OTHER_ACTIVITY_TYPE,
  activityHabits,
  activityRowSchema,
  activityTypeDef,
  isKnownActivityType,
} from './activity';

describe('catalogue', () => {
  it('a des identifiants uniques', () => {
    const ids = ACTIVITY_TYPES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ordonne les MET par intensité croissante', () => {
    for (const type of ACTIVITY_TYPES) {
      expect(type.met.light).toBeLessThanOrEqual(type.met.moderate);
      expect(type.met.moderate).toBeLessThanOrEqual(type.met.vigorous);
      expect(type.met.light).toBeGreaterThan(1); // 1 MET = repos : rien à ajouter à la cible
    }
  });

  it('porte un ExerciseType Health Connect entier et positif', () => {
    for (const type of ACTIVITY_TYPES) {
      expect(Number.isInteger(type.exerciseType)).toBe(true);
      expect(type.exerciseType).toBeGreaterThanOrEqual(0);
    }
  });

  it('propose 8 types fréquents, tous présents au catalogue', () => {
    expect(FREQUENT_ACTIVITY_TYPES).toHaveLength(8);
    for (const id of FREQUENT_ACTIVITY_TYPES) expect(isKnownActivityType(id)).toBe(true);
  });

  it('ne propose ni ménage ni jardinage — ils sont dans le socle hors sport', () => {
    const ids = ACTIVITY_TYPES.map((a) => a.id);
    expect(ids).not.toContain('housework');
    expect(ids).not.toContain('gardening');
  });

  it('ne propose ni course ni musculation — elles ont leur pilier (décision D5)', () => {
    const ids = ACTIVITY_TYPES.map((a) => a.id);
    expect(ids).not.toContain('running');
    expect(ids).not.toContain('strength');
  });
});

describe('activityTypeDef', () => {
  it('résout un type connu', () => {
    expect(activityTypeDef('bike').met.moderate).toBe(8);
  });

  it('retombe sur « Autre » plutôt que de faire disparaître une activité', () => {
    expect(activityTypeDef('kitesurf-2030').id).toBe(OTHER_ACTIVITY_TYPE);
    expect(activityTypeDef(null).id).toBe(OTHER_ACTIVITY_TYPE);
    expect(activityTypeDef(undefined).id).toBe(OTHER_ACTIVITY_TYPE);
  });

  it('distingue un repli d’un vrai « Autre »', () => {
    expect(isKnownActivityType('kitesurf-2030')).toBe(false);
    expect(isKnownActivityType(OTHER_ACTIVITY_TYPE)).toBe(true);
    expect(isKnownActivityType(null)).toBe(false);
    expect(isKnownActivityType(undefined)).toBe(false);
  });
});

describe('intensité', () => {
  it('préremplit un ressenti pour chaque intensité — sinon la charge vaudrait zéro', () => {
    for (const intensity of ACTIVITY_INTENSITIES) {
      const rpe = ACTIVITY_INTENSITY_RPE[intensity];
      expect(rpe).toBeGreaterThanOrEqual(1);
      expect(rpe).toBeLessThanOrEqual(10);
    }
    expect(ACTIVITY_INTENSITY_RPE.light).toBeLessThan(ACTIVITY_INTENSITY_RPE.vigorous);
  });
});

describe('activityRowSchema', () => {
  const base = {
    id: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    createdAt: '2026-09-15T10:00:00.000Z',
    updatedAt: '2026-09-15T10:00:00.000Z',
    deletedAt: null,
    activityType: 'bike',
    startedAt: '2026-09-15T09:00:00.000Z',
    durationSeconds: 5400,
    intensity: 'moderate',
  };

  it('accepte une saisie minimale et pose les valeurs par défaut', () => {
    const row = activityRowSchema.parse(base);
    expect(row).toMatchObject({ rpe: null, distanceM: null, deviceKcal: null, notes: null });
  });

  it('refuse une durée nulle ou négative', () => {
    expect(activityRowSchema.safeParse({ ...base, durationSeconds: 0 }).success).toBe(false);
    expect(activityRowSchema.safeParse({ ...base, durationSeconds: -60 }).success).toBe(false);
  });

  it('refuse une intensité inconnue mais accepte un type hors catalogue', () => {
    expect(activityRowSchema.safeParse({ ...base, intensity: 'extreme' }).success).toBe(false);
    expect(activityRowSchema.safeParse({ ...base, activityType: 'kitesurf-2030' }).success).toBe(true);
  });

  it('borne le ressenti à 1-10', () => {
    expect(activityRowSchema.safeParse({ ...base, rpe: 11 }).success).toBe(false);
    expect(activityRowSchema.safeParse({ ...base, rpe: 0 }).success).toBe(false);
    expect(activityRowSchema.safeParse({ ...base, rpe: 5 }).success).toBe(true);
  });
});

describe('activityHabits', () => {
  const at = (day: number) => `2026-09-${String(day).padStart(2, '0')}T08:00:00.000Z`;

  it('ne retient qu’une combinaison répétée — une saisie unique n’est pas une habitude', () => {
    const habits = activityHabits([
      { activityType: 'bike', durationSeconds: 1500, intensity: 'moderate', startedAt: at(1) },
      { activityType: 'swim', durationSeconds: 2700, intensity: 'moderate', startedAt: at(2) },
    ]);
    expect(habits).toEqual([]);
  });

  it('classe par fréquence, puis par récence', () => {
    const habits = activityHabits([
      { activityType: 'bike', durationSeconds: 1500, intensity: 'moderate', startedAt: at(1) },
      { activityType: 'bike', durationSeconds: 1500, intensity: 'moderate', startedAt: at(3) },
      { activityType: 'bike', durationSeconds: 1500, intensity: 'moderate', startedAt: at(5) },
      { activityType: 'swim', durationSeconds: 2700, intensity: 'moderate', startedAt: at(2) },
      { activityType: 'swim', durationSeconds: 2700, intensity: 'moderate', startedAt: at(6) },
      { activityType: 'walk', durationSeconds: 1800, intensity: 'light', startedAt: at(4) },
      { activityType: 'walk', durationSeconds: 1800, intensity: 'light', startedAt: at(7) },
    ]);
    expect(habits.map((h) => h.activityType)).toEqual(['bike', 'walk', 'swim']);
    expect(habits[0]).toMatchObject({ durationSeconds: 1500, intensity: 'moderate', count: 3 });
    expect(habits[0]).not.toHaveProperty('lastAt');
  });

  it('distingue deux durées du même sport, et respecte la limite', () => {
    const habits = activityHabits(
      [
        { activityType: 'bike', durationSeconds: 1500, intensity: 'moderate', startedAt: at(1) },
        { activityType: 'bike', durationSeconds: 1500, intensity: 'moderate', startedAt: at(2) },
        { activityType: 'bike', durationSeconds: 5400, intensity: 'vigorous', startedAt: at(3) },
        { activityType: 'bike', durationSeconds: 5400, intensity: 'vigorous', startedAt: at(4) },
      ],
      1,
    );
    expect(habits).toHaveLength(1);
  });

  it('accepte une liste vide', () => {
    expect(activityHabits([])).toEqual([]);
  });
});

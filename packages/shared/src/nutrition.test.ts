import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_LEVELS,
  DIET_RESTRICTIONS,
  NUTRITION_OBJECTIVES,
  activityFactor,
  activityLevelSchema,
  basalMetabolicRate,
  caloriesFromMacros,
  defaultMacroRatios,
  macroGramsFromCalories,
  macroRatiosFromGrams,
  nutritionObjectiveSchema,
  nutritionProfileRowSchema,
  objectiveCalorieDelta,
  objectiveFromGoal,
  targetCalories,
  tdee,
  trainingDayCalories,
} from './nutrition';

describe('enums', () => {
  it('expose les objectifs, niveaux et restrictions attendus', () => {
    expect(NUTRITION_OBJECTIVES).toEqual(['bulk', 'cut', 'maintain', 'weightloss']);
    expect(ACTIVITY_LEVELS).toEqual(['sedentary', 'light', 'moderate', 'active', 'very_active']);
    expect(DIET_RESTRICTIONS).toContain('vegan');
  });

  it('rejette les valeurs inconnues', () => {
    expect(nutritionObjectiveSchema.safeParse('recomp').success).toBe(false);
    expect(activityLevelSchema.safeParse('lazy').success).toBe(false);
  });
});

describe('objectiveFromGoal', () => {
  it('dérive l’objectif nutritionnel de l’objectif d’entraînement', () => {
    expect(objectiveFromGoal('muscle')).toBe('bulk');
    expect(objectiveFromGoal('weightloss')).toBe('weightloss');
    expect(objectiveFromGoal('performance')).toBe('maintain');
    expect(objectiveFromGoal('health')).toBe('maintain');
    expect(objectiveFromGoal(null)).toBe('maintain');
  });
});

describe('objectiveCalorieDelta', () => {
  it('applique les deltas de chaque objectif', () => {
    expect(objectiveCalorieDelta('bulk')).toBe(300);
    expect(objectiveCalorieDelta('cut')).toBe(-400);
    expect(objectiveCalorieDelta('weightloss')).toBe(-250);
    expect(objectiveCalorieDelta('maintain')).toBe(0);
  });
});

describe('activityFactor', () => {
  it('mappe chaque niveau à son multiplicateur', () => {
    expect(activityFactor('sedentary')).toBe(1.2);
    expect(activityFactor('light')).toBe(1.375);
    expect(activityFactor('moderate')).toBe(1.55);
    expect(activityFactor('active')).toBe(1.725);
    expect(activityFactor('very_active')).toBe(1.9);
  });
});

describe('basalMetabolicRate (Mifflin-St Jeor)', () => {
  it('calcule le BMR homme', () => {
    expect(basalMetabolicRate({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 })).toBe(1780);
  });

  it('calcule le BMR femme', () => {
    expect(basalMetabolicRate({ sex: 'female', weightKg: 60, heightCm: 165, age: 30 })).toBe(
      1320.25,
    );
  });

  it('utilise la moyenne des deux formules si sexe non précisé', () => {
    const input = { weightKg: 80, heightCm: 180, age: 30 } as const;
    const male = basalMetabolicRate({ ...input, sex: 'male' });
    const female = basalMetabolicRate({ ...input, sex: 'female' });
    expect(basalMetabolicRate({ ...input, sex: 'unspecified' })).toBe((male + female) / 2);
  });
});

describe('tdee', () => {
  it('multiplie le BMR par le facteur d’activité (arrondi)', () => {
    expect(
      tdee({ sex: 'male', weightKg: 80, heightCm: 180, age: 30, activityLevel: 'moderate' }),
    ).toBe(2759);
  });

  it.each([
    ['poids manquant', { heightCm: 180, age: 30 }],
    ['taille manquante', { weightKg: 80, age: 30 }],
    ['âge manquant', { weightKg: 80, heightCm: 180 }],
    ['poids nul', { weightKg: 0, heightCm: 180, age: 30 }],
    ['valeur négative', { weightKg: -5, heightCm: 180, age: 30 }],
  ])('renvoie null quand %s', (_label, partial) => {
    expect(tdee({ ...partial, activityLevel: 'moderate' })).toBeNull();
  });
});

describe('targetCalories', () => {
  it('applique le delta de l’objectif au TDEE', () => {
    expect(targetCalories(2500, 'bulk')).toBe(2800);
    expect(targetCalories(2500, 'cut')).toBe(2100);
    expect(targetCalories(2500, 'maintain')).toBe(2500);
  });

  it('laisse primer la surcharge manuelle', () => {
    expect(targetCalories(2500, 'cut', 3000)).toBe(3000);
  });

  it('ignore une surcharge nulle ou négative', () => {
    expect(targetCalories(2500, 'maintain', 0)).toBe(2500);
    expect(targetCalories(2500, 'maintain', -100)).toBe(2500);
  });

  it('ne descend jamais sous zéro', () => {
    expect(targetCalories(100, 'cut')).toBe(0);
  });
});

describe('trainingDayCalories', () => {
  it('ajoute le bonus les jours de séance', () => {
    expect(trainingDayCalories(2500, 200)).toBe(2700);
  });

  it('ignore un bonus négatif', () => {
    expect(trainingDayCalories(2500, -50)).toBe(2500);
  });
});

describe('macros', () => {
  it('fournit les ratios par défaut par objectif (somme 100)', () => {
    for (const objective of NUTRITION_OBJECTIVES) {
      const r = defaultMacroRatios(objective);
      expect(r.protein + r.carbs + r.fat).toBe(100);
    }
    expect(defaultMacroRatios('bulk')).toEqual({ protein: 30, carbs: 45, fat: 25 });
    expect(defaultMacroRatios('cut')).toEqual({ protein: 40, carbs: 35, fat: 25 });
    expect(defaultMacroRatios('weightloss')).toEqual({ protein: 40, carbs: 35, fat: 25 });
    expect(defaultMacroRatios('maintain')).toEqual({ protein: 25, carbs: 50, fat: 25 });
  });

  it('convertit calories + ratios en grammes', () => {
    expect(macroGramsFromCalories(2000, { protein: 25, carbs: 50, fat: 25 })).toEqual({
      protein: 125,
      carbs: 250,
      fat: 56,
    });
  });

  it('calcule les calories d’une répartition en grammes', () => {
    expect(caloriesFromMacros({ protein: 125, carbs: 250, fat: 56 })).toBe(2004);
  });

  it('dérive les ratios depuis les grammes (les grammes priment)', () => {
    const ratios = macroRatiosFromGrams({ protein: 150, carbs: 200, fat: 60 });
    expect(ratios.protein + ratios.carbs + ratios.fat).toBeGreaterThanOrEqual(99);
    expect(ratios.protein + ratios.carbs + ratios.fat).toBeLessThanOrEqual(101);
  });

  it('renvoie 0/0/0 pour des grammes nuls (pas de division par zéro)', () => {
    expect(macroRatiosFromGrams({ protein: 0, carbs: 0, fat: 0 })).toEqual({
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });
});

describe('nutritionProfileRowSchema', () => {
  const base = {
    id: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    createdAt: '2026-07-06T10:00:00Z',
    updatedAt: '2026-07-06T10:00:00Z',
    deletedAt: null,
  };

  it('valide une ligne minimale et applique les valeurs par défaut', () => {
    const parsed = nutritionProfileRowSchema.parse(base);
    expect(parsed.objective).toBeNull();
    expect(parsed.activityLevel).toBe('moderate');
    expect(parsed.restrictions).toEqual([]);
    expect(parsed.trainingDayBonus).toBe(0);
  });

  it('rejette un objectif invalide', () => {
    expect(nutritionProfileRowSchema.safeParse({ ...base, objective: 'recomp' }).success).toBe(
      false,
    );
  });

  it('accepte restrictions et macros manuelles', () => {
    const parsed = nutritionProfileRowSchema.parse({
      ...base,
      objective: 'cut',
      restrictions: ['vegan', 'gluten_free'],
      manualProteinG: 180,
      manualCarbsG: 150,
      manualFatG: 60,
    });
    expect(parsed.restrictions).toEqual(['vegan', 'gluten_free']);
    expect(parsed.manualProteinG).toBe(180);
  });
});

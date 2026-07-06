import { describe, expect, it } from 'vitest';
import {
  FOOD_CATEGORIES,
  FOOD_SOURCES,
  MEAL_TYPES,
  foodEntryRowSchema,
  foodRowSchema,
  foodSourceSchema,
  mealTypeSchema,
  resolveFoodName,
  scaleNutrition,
  sumNutrients,
} from './food';

describe('enums', () => {
  it('expose catégories, sources et repas attendus', () => {
    expect(FOOD_CATEGORIES).toContain('vegetables');
    expect(FOOD_SOURCES).toEqual(['library', 'openfoodfacts', 'custom']);
    expect(MEAL_TYPES).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
  });

  it('rejette les valeurs inconnues', () => {
    expect(foodSourceSchema.safeParse('ciqual').success).toBe(false);
    expect(mealTypeSchema.safeParse('brunch').success).toBe(false);
  });
});

describe('resolveFoodName', () => {
  const tr = [
    { lang: 'fr', name: 'Banane' },
    { lang: 'en', name: 'Banana' },
  ];
  it('prend la langue demandée', () => {
    expect(resolveFoodName(tr, 'en')).toBe('Banana');
    expect(resolveFoodName(tr, 'fr')).toBe('Banane');
  });
  it('replie sur fr puis premier', () => {
    expect(resolveFoodName(tr, 'de')).toBe('Banane');
    expect(resolveFoodName([{ lang: 'es', name: 'Plátano' }], 'de')).toBe('Plátano');
  });
  it('renvoie undefined si vide', () => {
    expect(resolveFoodName([], 'fr')).toBeUndefined();
  });
});

describe('scaleNutrition', () => {
  it('met à l’échelle pour la quantité (arrondi)', () => {
    // 100 kcal/100g, 20 g protéines → pour 150 g : 150 kcal, 30 g
    expect(scaleNutrition({ kcalPer100g: 100, proteinPer100g: 20 }, 150)).toEqual({
      kcal: 150,
      proteinG: 30,
      carbsG: 0,
      fatG: 0,
    });
  });
  it('compte les macros nulles pour 0', () => {
    expect(scaleNutrition({ kcalPer100g: 89 }, 120)).toEqual({
      kcal: 107,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    });
  });
});

describe('sumNutrients', () => {
  it('additionne les entrées', () => {
    expect(
      sumNutrients([
        { kcal: 100, proteinG: 10, carbsG: 5, fatG: 2 },
        { kcal: 250, proteinG: 3, carbsG: 40, fatG: 8 },
      ]),
    ).toEqual({ kcal: 350, proteinG: 13, carbsG: 45, fatG: 10 });
  });
  it('renvoie zéro pour une liste vide', () => {
    expect(sumNutrients([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe('schemas', () => {
  const sync = {
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-07-06T10:00:00Z',
    updatedAt: '2026-07-06T10:00:00Z',
    deletedAt: null,
  };

  it('valide un aliment de bibliothèque avec portions', () => {
    const parsed = foodRowSchema.parse({
      ...sync,
      ownerId: null,
      source: 'library',
      category: 'fruits',
      kcalPer100g: 89,
      proteinPer100g: 1.1,
      portions: [{ labelFr: '1 banane', labelEn: '1 banana', grams: 120 }],
    });
    expect(parsed.barcode).toBeNull();
    expect(parsed.portions[0]?.grams).toBe(120);
    expect(parsed.carbsPer100g).toBeNull();
  });

  it('valide une entrée de journal (quick add sans foodId)', () => {
    const parsed = foodEntryRowSchema.parse({
      ...sync,
      userId: '22222222-2222-4222-8222-222222222222',
      logDate: '2026-07-06',
      mealType: 'lunch',
      name: 'Restaurant',
      kcal: 700,
    });
    expect(parsed.foodId).toBeNull();
    expect(parsed.quantityG).toBeNull();
    expect(parsed.proteinG).toBe(0);
  });

  it('rejette une catégorie invalide', () => {
    expect(
      foodRowSchema.safeParse({ ...sync, ownerId: null, source: 'library', category: 'candy', kcalPer100g: 1 })
        .success,
    ).toBe(false);
  });
});

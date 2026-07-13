import { describe, expect, it } from 'vitest';
import { validateFoodInput, type FoodFormInput } from './food-form';

/** Entrée de base valide (macros/micros vides) — surchargée par test. */
function baseInput(overrides: Partial<FoodFormInput> = {}): FoodFormInput {
  return {
    nameFr: 'Pomme',
    nameEn: 'Apple',
    category: 'fruits',
    kcalPer100g: '52',
    proteinPer100g: '',
    carbsPer100g: '',
    sugarsPer100g: '',
    fatPer100g: '',
    saturatedFatPer100g: '',
    fiberPer100g: '',
    cholesterol_mg: '',
    sodium_mg: '',
    magnesium_mg: '',
    potassium_mg: '',
    calcium_mg: '',
    iron_mg: '',
    vitamin_c_mg: '',
    vitamin_d_ug: '',
    vitamin_b9_ug: '',
    vitamin_b12_ug: '',
    ...overrides,
  };
}

describe('validateFoodInput', () => {
  it('accepte une entrée valide minimale (macros null, micros {})', () => {
    const { values, errors } = validateFoodInput(baseInput());
    expect(errors).toEqual([]);
    expect(values).not.toBeNull();
    expect(values).toMatchObject({
      nameFr: 'Pomme',
      nameEn: 'Apple',
      category: 'fruits',
      kcalPer100g: 52,
      proteinPer100g: null,
      micronutrients: {},
    });
  });

  it('exige nameFr et nameEn non vides', () => {
    const { values, errors } = validateFoodInput(baseInput({ nameFr: '  ', nameEn: '' }));
    expect(values).toBeNull();
    expect(errors.map((e) => e.field)).toEqual(expect.arrayContaining(['nameFr', 'nameEn']));
  });

  it('rejette une catégorie hors enum', () => {
    const { values, errors } = validateFoodInput(baseInput({ category: 'boissons' }));
    expect(values).toBeNull();
    expect(errors.some((e) => e.field === 'category')).toBe(true);
  });

  it('exige kcal (requis, ≥ 0)', () => {
    expect(validateFoodInput(baseInput({ kcalPer100g: '' })).errors.some((e) => e.field === 'kcalPer100g')).toBe(true);
    expect(validateFoodInput(baseInput({ kcalPer100g: '-3' })).errors.some((e) => e.field === 'kcalPer100g')).toBe(true);
    expect(validateFoodInput(baseInput({ kcalPer100g: 'abc' })).errors.some((e) => e.field === 'kcalPer100g')).toBe(true);
  });

  it('rejette une macro négative ou non numérique', () => {
    expect(validateFoodInput(baseInput({ proteinPer100g: '-1' })).errors.some((e) => e.field === 'proteinPer100g')).toBe(true);
    expect(validateFoodInput(baseInput({ fatPer100g: 'x' })).errors.some((e) => e.field === 'fatPer100g')).toBe(true);
  });

  it('rejette un micro non numérique', () => {
    const { errors } = validateFoodInput(baseInput({ iron_mg: 'oops' }));
    expect(errors.some((e) => e.field === 'iron_mg')).toBe(true);
  });

  it('tolère la virgule décimale', () => {
    const { values } = validateFoodInput(baseInput({ proteinPer100g: '0,3' }));
    expect(values?.proteinPer100g).toBe(0.3);
  });

  it('ne conserve que les micros renseignés', () => {
    const { values } = validateFoodInput(baseInput({ sodium_mg: '1', vitamin_c_mg: '4.6' }));
    expect(values?.micronutrients).toEqual({ sodium_mg: 1, vitamin_c_mg: 4.6 });
  });

  it('mappe les 6 macros quand renseignées', () => {
    const { values } = validateFoodInput(
      baseInput({
        proteinPer100g: '1',
        carbsPer100g: '2',
        sugarsPer100g: '3',
        fatPer100g: '4',
        saturatedFatPer100g: '5',
        fiberPer100g: '6',
      }),
    );
    expect(values).toMatchObject({
      proteinPer100g: 1,
      carbsPer100g: 2,
      sugarsPer100g: 3,
      fatPer100g: 4,
      saturatedFatPer100g: 5,
      fiberPer100g: 6,
    });
  });
});

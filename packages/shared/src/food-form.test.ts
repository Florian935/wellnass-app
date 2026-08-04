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
    monounsaturated_fat_g: '',
    polyunsaturated_fat_g: '',
    trans_fat_g: '',
    omega_3_g: '',
    omega_6_g: '',
    omega_9_g: '',
    zinc_mg: '',
    phosphorus_mg: '',
    copper_mg: '',
    manganese_mg: '',
    selenium_ug: '',
    iodine_ug: '',
    vitamin_a_ug: '',
    vitamin_e_mg: '',
    vitamin_k_ug: '',
    vitamin_b1_mg: '',
    vitamin_b2_mg: '',
    vitamin_b3_mg: '',
    vitamin_b5_mg: '',
    vitamin_b6_mg: '',
    vitamin_b7_ug: '',
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

  // Champs **absents** (`undefined`) et non simplement vides : c'est l'état réel d'un formulaire
  // dont un champ n'a jamais été touché, ou d'un appel programmatique partiel. Sans repli,
  // `.trim()` sur `undefined` lèverait — l'écran planterait au lieu d'afficher les erreurs.
  it('champs absents → mêmes erreurs qu’un formulaire vide, sans exception', () => {
    const r = validateFoodInput({} as FoodFormInput);
    expect(r.values).toBeNull();
    expect(r.errors.map((e) => e.field).sort()).toEqual([
      'category',
      'kcalPer100g',
      'nameEn',
      'nameFr',
    ]);
  });

  it('macro absente → null, pas une erreur (les macros sont optionnelles)', () => {
    const r = validateFoodInput({
      nameFr: 'Pomme',
      nameEn: 'Apple',
      category: 'fruits',
      kcalPer100g: '52',
    } as FoodFormInput);
    expect(r.errors).toEqual([]);
    expect(r.values).toMatchObject({ proteinPer100g: null, fatPer100g: null });
  });
});

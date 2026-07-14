import { describe, expect, it } from 'vitest';
import {
  FOOD_CATEGORIES,
  FOOD_SOURCES,
  MEAL_TYPES,
  MICRONUTRIENT_KEYS,
  foodEntryRowSchema,
  foodRowSchema,
  foodSourceSchema,
  mealTypeSchema,
  micronutrientsSchema,
  parseMicronutrients,
  rescaleEntryNutrition,
  resolveFoodName,
  saltFromSodiumMg,
  scaleMicronutrients,
  scaleNutrition,
  sumMicronutrients,
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

describe('rescaleEntryNutrition', () => {
  const snapshot = {
    kcal: 107,
    proteinG: 1,
    carbsG: 28,
    fatG: 0,
    micronutrients: { magnesium_mg: 32, potassium_mg: 430 },
  };

  it('double la quantité (120 → 240 g)', () => {
    expect(rescaleEntryNutrition(snapshot, 120, 240)).toEqual({
      kcal: 214,
      proteinG: 2,
      carbsG: 56,
      fatG: 0,
      micronutrients: { magnesium_mg: 64, potassium_mg: 860 },
    });
  });

  it('réduit la quantité (120 → 60 g)', () => {
    const r = rescaleEntryNutrition(snapshot, 120, 60);
    expect(r.kcal).toBe(54); // round(107/2) = 54 (arrondi unique)
    expect(r.carbsG).toBe(14);
    expect(r.micronutrients).toEqual({ magnesium_mg: 16, potassium_mg: 215 });
  });

  it('renvoie le snapshot inchangé si fromGrams <= 0 (quick add)', () => {
    expect(rescaleEntryNutrition(snapshot, 0, 240)).toBe(snapshot);
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

describe('micronutriments (4.33)', () => {
  describe('parseMicronutrients', () => {
    it('lit un objet et un JSON string', () => {
      expect(parseMicronutrients({ magnesium_mg: 79, iron_mg: 2.7 })).toEqual({
        magnesium_mg: 79,
        iron_mg: 2.7,
      });
      expect(parseMicronutrients('{"sodium_mg":120}')).toEqual({ sodium_mg: 120 });
    });
    it('tolère le double encodage (colonnes texte-JSON écrites par le client via PowerSync)', () => {
      // Valeur telle que stockée par op-sqlite : une string JSON dans une string JSON.
      const doubleEncoded = JSON.stringify(JSON.stringify({ magnesium_mg: 32.4, potassium_mg: 430 }));
      expect(parseMicronutrients(doubleEncoded)).toEqual({ magnesium_mg: 32.4, potassium_mg: 430 });
      // Ne reparse pas à l'infini : une string JSON dont le contenu reste une string → {}.
      expect(parseMicronutrients(JSON.stringify(JSON.stringify('pas un objet')))).toEqual({});
    });
    it('ignore clés inconnues, valeurs négatives/non-finies, et JSON invalide', () => {
      expect(
        parseMicronutrients({ magnesium_mg: 10, unknown_x: 5, iron_mg: -3, calcium_mg: 'x' }),
      ).toEqual({ magnesium_mg: 10 });
      expect(parseMicronutrients('pas du json')).toEqual({});
      expect(parseMicronutrients(null)).toEqual({});
      expect(parseMicronutrients(42)).toEqual({});
    });
    it('couvre exactement le panel de 31 clés', () => {
      expect(MICRONUTRIENT_KEYS).toHaveLength(31);
      expect(MICRONUTRIENT_KEYS).toContain('cholesterol_mg');
      expect(MICRONUTRIENT_KEYS).toContain('omega_3_g');
      expect(MICRONUTRIENT_KEYS).toContain('vitamin_b7_ug');
    });
  });

  describe('scaleMicronutrients', () => {
    it('met à l’échelle uniquement les clés présentes (arrondi 1 déc.)', () => {
      // épinards /100 g → 180 g : magnésium 79 → 142,2 ; fer 2,7 → 4,9
      expect(scaleMicronutrients({ magnesium_mg: 79, iron_mg: 2.7 }, 180)).toEqual({
        magnesium_mg: 142.2,
        iron_mg: 4.9,
      });
    });
    it('n’invente jamais une clé absente', () => {
      expect(scaleMicronutrients({ sodium_mg: 100 }, 50)).toEqual({ sodium_mg: 50 });
      expect(scaleMicronutrients({}, 200)).toEqual({});
    });
    it('0 g → toutes les clés présentes à 0', () => {
      expect(scaleMicronutrients({ iron_mg: 5 }, 0)).toEqual({ iron_mg: 0 });
    });
    it('met à l’échelle et somme les nouvelles clés (oméga-3 en g, zinc en mg)', () => {
      expect(scaleMicronutrients({ omega_3_g: 2, zinc_mg: 5 }, 50)).toEqual({ omega_3_g: 1, zinc_mg: 2.5 });
      expect(sumMicronutrients([{ omega_3_g: 1 }, { omega_3_g: 0.5, zinc_mg: 2 }])).toEqual({ omega_3_g: 1.5, zinc_mg: 2 });
    });
  });

  describe('sumMicronutrients', () => {
    it('additionne clé à clé, clés disjointes conservées', () => {
      expect(
        sumMicronutrients([{ magnesium_mg: 10, iron_mg: 2 }, { magnesium_mg: 5, calcium_mg: 30 }]),
      ).toEqual({ magnesium_mg: 15, iron_mg: 2, calcium_mg: 30 });
    });
    it('liste vide → {}', () => {
      expect(sumMicronutrients([])).toEqual({});
    });
  });

  describe('saltFromSodiumMg', () => {
    it('sodium × 2,5 / 1000 arrondi 2 déc.', () => {
      expect(saltFromSodiumMg(142)).toBe(0.36);
      expect(saltFromSodiumMg(79)).toBe(0.2);
      expect(saltFromSodiumMg(300)).toBe(0.75);
      expect(saltFromSodiumMg(0)).toBe(0);
    });
  });

  describe('micronutrientsSchema', () => {
    it('rejette une clé hors panel (écriture stricte)', () => {
      expect(micronutrientsSchema.safeParse({ magnesium_mg: 10 }).success).toBe(true);
      expect(micronutrientsSchema.safeParse({ foo_mg: 10 }).success).toBe(false);
      expect(micronutrientsSchema.safeParse({ iron_mg: -1 }).success).toBe(false);
    });
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
    expect(parsed.micronutrients).toEqual({});
  });

  it('accepte les micronutriments sur un aliment', () => {
    const parsed = foodRowSchema.parse({
      ...sync,
      ownerId: null,
      source: 'library',
      category: 'vegetables',
      kcalPer100g: 24,
      micronutrients: { magnesium_mg: 79, iron_mg: 2.7 },
    });
    expect(parsed.micronutrients.magnesium_mg).toBe(79);
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

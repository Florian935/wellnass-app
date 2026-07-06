import { describe, expect, it } from 'vitest';
import { DEFAULT_UNIT_GRAMS, bestMatchIndex, normalizeName, parseMealText } from './meal-parser';

describe('parseMealText', () => {
  it('parse l’exemple de la spec (FR)', () => {
    const items = parseMealText('une banane, 3 tranches de pain de mie, et beurre de cacahuète');
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ quantity: 1, unit: null, foodName: 'banane' });
    expect(items[1]).toMatchObject({ quantity: 3, unit: 'slice', foodName: 'pain de mie' });
    expect(items[2]).toMatchObject({ quantity: 1, unit: null, foodName: 'beurre de cacahuète' });
  });

  it('segmente sur virgules, « et », « avec », retours ligne, +', () => {
    expect(parseMealText('pomme et poire').map((i) => i.foodName)).toEqual(['pomme', 'poire']);
    expect(parseMealText('riz avec poulet').map((i) => i.foodName)).toEqual(['riz', 'poulet']);
    expect(parseMealText('pain\nbeurre').map((i) => i.foodName)).toEqual(['pain', 'beurre']);
    expect(parseMealText('oeuf + jambon').map((i) => i.foodName)).toEqual(['oeuf', 'jambon']);
  });

  it('lit les quantités en chiffres et en lettres', () => {
    expect(parseMealText('2 pommes')[0]).toMatchObject({ quantity: 2, foodName: 'pommes' });
    expect(parseMealText('deux pommes')[0]).toMatchObject({ quantity: 2, foodName: 'pommes' });
    expect(parseMealText('2,5 g de sel')[0]).toMatchObject({ quantity: 2.5, unit: 'gram', foodName: 'sel' });
    expect(parseMealText('demi avocat')[0]).toMatchObject({ quantity: 0.5, foodName: 'avocat' });
  });

  it('reconnaît les unités (FR + EN)', () => {
    expect(parseMealText('1 c. à soupe de miel')[0]).toMatchObject({ unit: 'tbsp', foodName: 'miel' });
    expect(parseMealText('2 tbsp peanut butter')[0]).toMatchObject({ unit: 'tbsp', foodName: 'peanut butter' });
    expect(parseMealText('3 slices of bread')[0]).toMatchObject({ quantity: 3, unit: 'slice', foodName: 'bread' });
    expect(parseMealText('1 verre de lait')[0]).toMatchObject({ unit: 'glass', foodName: 'lait' });
    expect(parseMealText('100 g poulet')[0]).toMatchObject({ quantity: 100, unit: 'gram', foodName: 'poulet' });
  });

  it('traite les articles vagues comme quantité 1', () => {
    expect(parseMealText('du beurre')[0]).toMatchObject({ quantity: 1, foodName: 'beurre' });
    expect(parseMealText('des pâtes')[0]).toMatchObject({ quantity: 1, foodName: 'pâtes' });
    expect(parseMealText("de l'huile d'olive")[0]).toMatchObject({ foodName: "huile d'olive" });
  });

  it('ignore les segments vides / sans aliment', () => {
    expect(parseMealText('')).toEqual([]);
    expect(parseMealText('  ,  , et ')).toEqual([]);
    expect(parseMealText('banane, , et pomme').map((i) => i.foodName)).toEqual(['banane', 'pomme']);
  });

  it('expose des grammes par défaut par unité', () => {
    expect(DEFAULT_UNIT_GRAMS.slice).toBeGreaterThan(0);
    expect(DEFAULT_UNIT_GRAMS.gram).toBe(1);
  });
});

describe('normalizeName', () => {
  it('minuscule, sans accents, espaces compactés', () => {
    expect(normalizeName('  Beurre de   Cacahuète ')).toBe('beurre de cacahuete');
    expect(normalizeName('Pâtes')).toBe('pates');
  });
});

describe('bestMatchIndex', () => {
  const foods = ['Banane', 'Pain de mie', 'Pain complet', 'Beurre de cacahuète', 'Pomme'];
  it('trouve la correspondance exacte (accents/casse ignorés)', () => {
    expect(foods[bestMatchIndex('banane', foods)]).toBe('Banane');
    expect(foods[bestMatchIndex('cacahuete', foods)]).toBe('Beurre de cacahuète');
  });
  it('gère le pluriel', () => {
    expect(foods[bestMatchIndex('pommes', foods)]).toBe('Pomme');
  });
  it('préfère « pain de mie » à « pain complet » pour « pain de mie »', () => {
    expect(foods[bestMatchIndex('pain de mie', foods)]).toBe('Pain de mie');
  });
  it('renvoie -1 si aucune correspondance', () => {
    expect(bestMatchIndex('xyzzy', foods)).toBe(-1);
    expect(bestMatchIndex('', foods)).toBe(-1);
  });
});

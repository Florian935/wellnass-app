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

  // Recette PRISME-01 du 12/10/2026 : « poke bowl saumon avocat » était « reconnu »… comme Avocat,
  // 150 g, 305 kcal. Le saumon et le riz disparaissaient, et Prisme n'était jamais proposé.
  const ciqual = ['Avocat', 'Avocat, pulpe, crue', 'Saumon, cru', 'Riz blanc, cuit', 'Salade verte', 'Tomate, crue', 'Pâte de fruits'];

  it('🔴 un plat composé n’est pas reconnu par un seul de ses ingrédients', () => {
    expect(bestMatchIndex('poke bowl saumon avocat', ciqual)).toBe(-1);
  });

  it('🔴 une liste sans virgule n’est pas reconnue par un seul de ses mots', () => {
    expect(bestMatchIndex('salade tomate concombre maïs thon', ciqual)).toBe(-1);
  });

  it('🔴 un mot sur deux ne suffit pas : « algue nori » n’est pas de l’agar', () => {
    expect(bestMatchIndex('algue nori', ['Agar (algue), frais, cru'])).toBe(-1);
  });

  it('🔴 un mot de liaison commun ne suffit pas', () => {
    expect(bestMatchIndex('beurre de cacahuète', ['Pâte de fruits'])).toBe(-1);
  });

  // Contrôle sur le vrai catalogue CIQUAL, même jour : le texte était cherché À L'INTÉRIEUR des mots.
  const vrais = ['Chorizo', 'Riz blanc cuit', 'Pomme', 'Pomme de terre cuite', 'Compote de pomme, préemballée'];

  it('🔴 « riz » donne du riz, pas du chorizo', () => {
    expect(vrais[bestMatchIndex('riz', vrais)]).toBe('Riz blanc cuit');
  });

  it('🔴 « pommes de terre » et « compote de pommes » ne sont pas des pommes', () => {
    expect(vrais[bestMatchIndex('pommes de terre', vrais)]).toBe('Pomme de terre cuite');
    expect(vrais[bestMatchIndex('compote de pommes', vrais)]).toBe('Compote de pomme, préemballée');
  });

  it('garde une correspondance qui couvre l’essentiel du texte, ponctuation du catalogue comprise', () => {
    expect(ciqual[bestMatchIndex('avocat', ciqual)]).toBe('Avocat');
    expect(ciqual[bestMatchIndex('saumon cru', ciqual)]).toBe('Saumon, cru');
    expect(ciqual[bestMatchIndex('filet de saumon cru', ciqual)]).toBe('Saumon, cru');
    expect(['Yaourt nature', 'Yaourt aux fruits'][bestMatchIndex('yaourt nature bio', ['Yaourt nature', 'Yaourt aux fruits'])]).toBe('Yaourt nature');
  });
});

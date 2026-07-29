import { describe, expect, it } from 'vitest';

import {
  MACRO_GAP_MIN_RATIO,
  SUGGESTION_MAX_COUNT,
  macroGaps,
  pickMacroToFill,
  suggestFoodsForMacro,
  type SuggestionCandidate,
} from './macro-suggestion';

const targets = { protein: 150, carbs: 250, fat: 70 };

describe('macroGaps', () => {
  it('calcule l’écart absolu et relatif, du plus en retard au moins en retard', () => {
    const gaps = macroGaps({ protein: 100, carbs: 230, fat: 60 }, targets);

    expect(gaps[0]).toEqual({ macro: 'protein', gapG: 50, ratio: 50 / 150 });
    expect(gaps.map((g) => g.macro)).toEqual(['protein', 'fat', 'carbs']);
  });

  it('ramène un macro dépassé à 0 plutôt qu’à un écart négatif', () => {
    const gaps = macroGaps({ protein: 200, carbs: 250, fat: 70 }, targets);
    for (const gap of gaps) expect(gap.gapG).toBe(0);
  });

  it('ne divise pas par une cible nulle', () => {
    const gaps = macroGaps({ protein: 0, carbs: 0, fat: 0 }, { protein: 0, carbs: 0, fat: 0 });
    for (const gap of gaps) expect(gap.ratio).toBe(0);
  });
});

describe('pickMacroToFill', () => {
  it('choisit l’écart RELATIF le plus grand, pas l’absolu', () => {
    // 20 g manquants sur 150 g de protéines (13 %) contre 20 g sur 250 g de glucides (8 %) :
    // en absolu c'est à égalité, en relatif c'est la protéine qui est en retard.
    const gaps = macroGaps({ protein: 130, carbs: 230, fat: 70 }, targets);
    expect(pickMacroToFill(gaps)).toBe('protein');
  });

  it('ne propose rien sous le seuil de 10 %', () => {
    // 9 g sur 150 = 6 % ; 12 g sur 250 = 4,8 % ; 3 g sur 70 = 4,3 %.
    const gaps = macroGaps({ protein: 141, carbs: 238, fat: 67 }, targets);
    expect(pickMacroToFill(gaps)).toBeNull();
    expect(MACRO_GAP_MIN_RATIO).toBe(0.1);
  });

  it('ne propose rien quand tout est atteint', () => {
    expect(pickMacroToFill(macroGaps({ protein: 150, carbs: 250, fat: 70 }, targets))).toBeNull();
  });
});

const food = (
  id: string,
  name: string,
  kcal: number,
  protein: number | null,
): SuggestionCandidate => ({
  id,
  name,
  kcalPer100g: kcal,
  proteinPer100g: protein,
  carbsPer100g: 0,
  fatPer100g: 0,
});

describe('suggestFoodsForMacro', () => {
  const poulet = food('poulet', 'Blanc de poulet', 165, 31);
  const fromageBlanc = food('fb', 'Fromage blanc 0 %', 47, 8);
  const amandes = food('amandes', 'Amandes', 600, 21);

  it('classe sur la densité du macro POUR 100 KCAL, pas pour 100 g', () => {
    // Le cas qui discrimine les deux règles : les **amandes** sont les plus riches en protéines pour
    // 100 g (21 g, contre 8 g au fromage blanc), donc un tri sur les g/100 g les mettrait en tête.
    // Rapportées aux calories elles sont les **pires** des trois (3,5 g/100 kcal contre 17,0) : elles
    // doivent finir dernières. Le poulet, lui, est le plus efficace (18,8 g/100 kcal).
    const out = suggestFoodsForMacro({
      macro: 'protein',
      gapG: 20,
      kcalBudget: 2000,
      candidates: [amandes, poulet, fromageBlanc],
    });

    expect(out.map((s) => s.foodId)).toEqual(['poulet', 'fb', 'amandes']);
    // L'aliment le plus riche pour 100 g est bien le dernier : c'est toute la règle.
    expect(out[out.length - 1]!.foodId).toBe('amandes');
  });

  it('propose une quantité qui comble l’écart, arrondie à 5 g, avec son coût calorique', () => {
    const out = suggestFoodsForMacro({
      macro: 'protein',
      gapG: 31,
      kcalBudget: 2000,
      candidates: [poulet],
    });

    // 31 g de protéines / 31 g pour 100 g → 100 g de poulet, soit 165 kcal.
    expect(out[0]).toEqual({
      foodId: 'poulet',
      name: 'Blanc de poulet',
      quantityG: 100,
      kcal: 165,
      macroG: 31,
    });
    expect(out[0]!.quantityG % 5).toBe(0);
  });

  it('ÉCARTE un aliment trop pauvre — pas de « 900 g de brocoli »', () => {
    const brocoli = food('brocoli', 'Brocoli', 34, 2.8);
    // 30 g de protéines demanderaient plus de 1 kg de brocoli.
    expect(
      suggestFoodsForMacro({
        macro: 'protein',
        gapG: 30,
        kcalBudget: 2000,
        candidates: [brocoli],
      }),
    ).toEqual([]);
  });

  it('ÉCARTE un aliment trop riche — pas de « 5 g »', () => {
    const whey = food('whey', 'Protéine en poudre', 380, 80);
    // 3 g de protéines demanderaient moins de 5 g de poudre : la suggestion n'a pas de sens.
    expect(
      suggestFoodsForMacro({ macro: 'protein', gapG: 3, kcalBudget: 2000, candidates: [whey] }),
    ).toEqual([]);
  });

  it('ÉCARTE un aliment qui ferait exploser le budget calorique', () => {
    // 100 g de poulet = 165 kcal, or il ne reste que 80 kcal.
    expect(
      suggestFoodsForMacro({ macro: 'protein', gapG: 31, kcalBudget: 80, candidates: [poulet] }),
    ).toEqual([]);
  });

  it('ne suggère rien si le budget calorique est déjà épuisé ou négatif', () => {
    for (const kcalBudget of [0, -300]) {
      expect(
        suggestFoodsForMacro({ macro: 'protein', gapG: 30, kcalBudget, candidates: [poulet] }),
      ).toEqual([]);
    }
  });

  it('ne suggère rien s’il n’y a pas d’écart', () => {
    expect(
      suggestFoodsForMacro({ macro: 'protein', gapG: 0, kcalBudget: 2000, candidates: [poulet] }),
    ).toEqual([]);
  });

  it('écarte un aliment dont la valeur du macro visé est absente', () => {
    const inconnu = food('x', 'Aliment sans données', 200, null);
    expect(
      suggestFoodsForMacro({
        macro: 'protein',
        gapG: 30,
        kcalBudget: 2000,
        candidates: [inconnu],
      }),
    ).toEqual([]);
  });

  it('privilégie un aliment récemment consommé à densité comparable', () => {
    // a = 16,7 g/100 kcal · b = 15,8 → 5 % d'écart, sous le seuil de départage de 10 %.
    const a = food('a', 'Skyr nature', 60, 10);
    const b = food('b', 'Fromage blanc', 60, 9.5);
    const sansRecence = suggestFoodsForMacro({
      macro: 'protein',
      gapG: 20,
      kcalBudget: 2000,
      candidates: [a, b],
    });
    const avecRecence = suggestFoodsForMacro({
      macro: 'protein',
      gapG: 20,
      kcalBudget: 2000,
      candidates: [a, b],
      recentIds: ['b'],
    });

    expect(sansRecence[0]!.foodId).toBe('a');
    expect(avecRecence[0]!.foodId).toBe('b');
  });

  it('ne laisse PAS la récence renverser un écart de densité net', () => {
    // Le fromage blanc reste largement plus efficace que les amandes : la récence ne doit pas
    // suffire à recommander les amandes.
    const out = suggestFoodsForMacro({
      macro: 'protein',
      gapG: 20,
      kcalBudget: 2000,
      candidates: [fromageBlanc, amandes],
      recentIds: ['amandes'],
    });
    expect(out[0]!.foodId).toBe('fb');
  });

  it('plafonne à 3 suggestions', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      food(`f${i}`, `Aliment ${i}`, 100 + i, 15 - i * 0.5),
    );
    const out = suggestFoodsForMacro({
      macro: 'protein',
      gapG: 20,
      kcalBudget: 3000,
      candidates: many,
    });
    expect(out).toHaveLength(SUGGESTION_MAX_COUNT);
  });

  it('rend une liste vide sur un vivier vide', () => {
    expect(
      suggestFoodsForMacro({ macro: 'protein', gapG: 30, kcalBudget: 2000, candidates: [] }),
    ).toEqual([]);
  });
});

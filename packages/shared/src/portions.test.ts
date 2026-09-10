import { describe, expect, it } from 'vitest';
import { nudgeGrams, portionMultiples, stepGrams } from './portions';

describe('portionMultiples', () => {
  it('décline ½ · 1 · 2 autour de la portion de référence', () => {
    expect(portionMultiples(120)).toEqual([
      { factor: 0.5, grams: 60, isBase: false },
      { factor: 1, grams: 120, isBase: true },
      { factor: 2, grams: 240, isBase: false },
    ]);
  });

  it('arrondit à l’entier', () => {
    expect(portionMultiples(65).map((p) => p.grams)).toEqual([33, 65, 130]);
  });

  it('omet la demi-portion sous 2 g — elle serait confondue avec la portion entière', () => {
    expect(portionMultiples(1).map((p) => p.factor)).toEqual([1, 2]);
  });

  it('ne propose rien sans portion de référence exploitable', () => {
    expect(portionMultiples(null)).toEqual([]);
    expect(portionMultiples(undefined)).toEqual([]);
    expect(portionMultiples(0)).toEqual([]);
    expect(portionMultiples(-10)).toEqual([]);
    expect(portionMultiples(Number.NaN)).toEqual([]);
  });

  it('ne descend jamais sous 1 g', () => {
    expect(portionMultiples(2).every((p) => p.grams >= 1)).toBe(true);
  });
});

describe('stepGrams', () => {
  it('adapte le pas à l’ordre de grandeur', () => {
    expect(stepGrams(0)).toBe(1);
    expect(stepGrams(12)).toBe(1);
    expect(stepGrams(20)).toBe(5);
    expect(stepGrams(99)).toBe(5);
    expect(stepGrams(100)).toBe(10);
    expect(stepGrams(350)).toBe(10);
  });

  it('reste défini sur une entrée absurde', () => {
    expect(stepGrams(Number.NaN)).toBe(1);
    expect(stepGrams(-50)).toBe(5);
  });
});

describe('nudgeGrams', () => {
  it('monte en s’alignant sur le pas', () => {
    expect(nudgeGrams(10, 1)).toBe(11);
    expect(nudgeGrams(65, 1)).toBe(70);
    expect(nudgeGrams(105, 1)).toBe(110);
  });

  it('descend en s’alignant sur le pas', () => {
    expect(nudgeGrams(105, -1)).toBe(100);
    expect(nudgeGrams(70, -1)).toBe(65);
    expect(nudgeGrams(11, -1)).toBe(10);
  });

  it('descend d’un cran plein quand la valeur est déjà alignée', () => {
    expect(nudgeGrams(100, -1)).toBe(90);
    expect(nudgeGrams(20, -1)).toBe(15);
  });

  it('ne descend jamais sous 1 g', () => {
    expect(nudgeGrams(1, -1)).toBe(1);
    expect(nudgeGrams(0, -1)).toBe(1);
  });

  it('rend une quantité utilisable depuis 0', () => {
    expect(nudgeGrams(0, 1)).toBe(1);
  });
});

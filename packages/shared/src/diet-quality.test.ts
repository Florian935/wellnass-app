import { describe, expect, it } from 'vitest';
import {
  FIBER_MIN_G,
  FIBER_TARGET_G,
  qualityRatio,
  qualityStatus,
  qualityTargets,
} from './diet-quality';

const byKey = (kcal: number | null) => {
  const map = new Map(qualityTargets(kcal).map((t) => [t.key, t]));
  return {
    fiber: map.get('fiber')!,
    sugars: map.get('sugars')!,
    saturatedFat: map.get('saturatedFat')!,
  };
};

describe('qualityTargets', () => {
  it('garde les fibres en valeur absolue (référence ANSES)', () => {
    const { fiber } = byKey(2000);
    expect(fiber.minG).toBe(FIBER_MIN_G);
    expect(fiber.maxG).toBe(FIBER_TARGET_G);
    expect(fiber.kind).toBe('range');
    // Elles ne bougent pas avec l'objectif calorique.
    expect(byKey(3000).fiber.maxG).toBe(FIBER_TARGET_G);
  });

  it('dérive sucres et AGS de l’objectif — 10 % de l’énergie (OMS)', () => {
    const { sugars, saturatedFat } = byKey(2000);
    expect(sugars.maxG).toBe(50); // 2000 × 10 % / 4 kcal·g⁻¹
    expect(saturatedFat.maxG).toBe(22); // 2000 × 10 % / 9 kcal·g⁻¹
    expect(sugars.kind).toBe('cap');
    expect(saturatedFat.kind).toBe('cap');
  });

  it('suit l’objectif : un plafond n’est pas le même à 1 600 et à 2 800 kcal', () => {
    expect(byKey(1600).sugars.maxG).toBe(40);
    expect(byKey(2800).sugars.maxG).toBe(70);
    expect(byKey(1600).saturatedFat.maxG).toBe(18);
    expect(byKey(2800).saturatedFat.maxG).toBe(31);
  });

  it('retombe sur une base de 2 000 kcal sans objectif défini', () => {
    for (const kcal of [null, 0, -100, Number.NaN]) {
      expect(byKey(kcal as number).sugars.maxG).toBe(50);
    }
  });

  it('produit exactement les trois repères', () => {
    expect(qualityTargets(2000).map((t) => t.key)).toEqual(['fiber', 'sugars', 'saturatedFat']);
  });
});

describe('qualityStatus', () => {
  const { fiber, sugars } = byKey(2000);

  it('signale un manque de fibres sous la borne basse', () => {
    expect(qualityStatus(fiber, 21)).toBe('under');
    expect(qualityStatus(fiber, 0)).toBe('under');
  });

  it('accepte les fibres dans la plage et au-delà — en manger plus n’est pas une faute', () => {
    expect(qualityStatus(fiber, 25)).toBe('ok');
    expect(qualityStatus(fiber, 30)).toBe('ok');
    expect(qualityStatus(fiber, 42)).toBe('ok');
  });

  it('ne signale un plafond qu’au-delà, jamais en dessous', () => {
    expect(qualityStatus(sugars, 0)).toBe('ok');
    expect(qualityStatus(sugars, 50)).toBe('ok');
    expect(qualityStatus(sugars, 51)).toBe('over');
  });

  it('traite une valeur absurde comme zéro', () => {
    expect(qualityStatus(sugars, Number.NaN)).toBe('ok');
    expect(qualityStatus(fiber, -5)).toBe('under');
  });
});

describe('qualityRatio', () => {
  const { fiber, saturatedFat } = byKey(2000);

  it('rapporte à la cible haute', () => {
    expect(qualityRatio(fiber, 15)).toBeCloseTo(0.5);
    expect(qualityRatio(saturatedFat, 11)).toBeCloseTo(0.5);
  });

  it('borne à 1', () => {
    expect(qualityRatio(saturatedFat, 40)).toBe(1);
  });

  it('reste à 0 sur une cible nulle', () => {
    expect(qualityRatio({ key: 'sugars', minG: null, maxG: 0, kind: 'cap' }, 10)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import {
  UNIT_SYSTEMS,
  displayDistance,
  displayWeight,
  kgToLb,
  kmToMi,
  lbToKg,
  miToKm,
  unitSystemSchema,
} from './units';

describe('unitSystemSchema', () => {
  it('expose métrique et impérial', () => {
    expect(UNIT_SYSTEMS).toEqual(['metric', 'imperial']);
  });

  it('rejette un système inconnu', () => {
    expect(unitSystemSchema.safeParse('nautical').success).toBe(false);
  });
});

describe('conversions poids', () => {
  it('kg → lb', () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 3);
  });

  it('lb → kg', () => {
    expect(lbToKg(220.462)).toBeCloseTo(100, 3);
  });

  it('aller-retour stable', () => {
    expect(lbToKg(kgToLb(80))).toBeCloseTo(80, 6);
  });
});

describe('conversions distance', () => {
  it('km → mi', () => {
    expect(kmToMi(10)).toBeCloseTo(6.2137, 4);
  });

  it('mi → km', () => {
    expect(miToKm(6.2137)).toBeCloseTo(10, 3);
  });

  it('aller-retour stable', () => {
    expect(miToKm(kmToMi(42.195))).toBeCloseTo(42.195, 6);
  });
});

describe('displayWeight', () => {
  it('métrique : renvoie les kg tels quels avec le symbole kg', () => {
    expect(displayWeight(72.4, 'metric')).toEqual({ value: 72.4, unit: 'kg' });
  });

  it('impérial : convertit en lb et arrondit', () => {
    expect(displayWeight(72.4, 'imperial')).toEqual({ value: 159.6, unit: 'lb' });
  });

  it('respecte fractionDigits', () => {
    expect(displayWeight(72.456, 'metric', 0)).toEqual({ value: 72, unit: 'kg' });
  });
});

describe('displayDistance', () => {
  it('métrique : km + symbole km', () => {
    expect(displayDistance(10, 'metric')).toEqual({ value: 10, unit: 'km' });
  });

  it('impérial : convertit en mi', () => {
    expect(displayDistance(10, 'imperial')).toEqual({ value: 6.21, unit: 'mi' });
  });
});

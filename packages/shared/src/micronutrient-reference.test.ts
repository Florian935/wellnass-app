import { describe, expect, it } from 'vitest';
import { MICRONUTRIENT_KEYS } from './food';
import {
  MICRONUTRIENT_NRV,
  coverageLevel,
  micronutrientCoverage,
} from './micronutrient-reference';

describe('MICRONUTRIENT_NRV', () => {
  it('ne référence que des clés du panel', () => {
    for (const key of Object.keys(MICRONUTRIENT_NRV)) {
      expect(MICRONUTRIENT_KEYS).toContain(key);
    }
  });

  it('couvre les 23 vitamines et minéraux à VNR réglementaire', () => {
    expect(Object.keys(MICRONUTRIENT_NRV)).toHaveLength(23);
  });

  it('laisse sans VNR le sodium et les lipides détaillés (plafonds, pas des cibles)', () => {
    for (const key of [
      'sodium_mg',
      'cholesterol_mg',
      'trans_fat_g',
      'omega_3_g',
      'omega_6_g',
      'omega_9_g',
      'monounsaturated_fat_g',
      'polyunsaturated_fat_g',
    ] as const) {
      expect(MICRONUTRIENT_NRV[key]).toBeUndefined();
    }
  });

  it('n’a que des valeurs strictement positives', () => {
    for (const v of Object.values(MICRONUTRIENT_NRV)) expect(v).toBeGreaterThan(0);
  });
});

describe('micronutrientCoverage', () => {
  it('rapporte l’apport à la VNR, en pourcentage entier', () => {
    // VNR calcium = 800 mg
    expect(micronutrientCoverage('calcium_mg', 800)).toBe(100);
    expect(micronutrientCoverage('calcium_mg', 400)).toBe(50);
    expect(micronutrientCoverage('calcium_mg', 0)).toBe(0);
  });

  it('arrondit à l’entier le plus proche', () => {
    // VNR fer = 14 mg → 8,4 / 14 = 60 %
    expect(micronutrientCoverage('iron_mg', 8.4)).toBe(60);
    // 1,0 / 14 = 7,14 % → 7
    expect(micronutrientCoverage('iron_mg', 1)).toBe(7);
  });

  it('ne plafonne pas au-delà de 100 %', () => {
    expect(micronutrientCoverage('vitamin_c_mg', 240)).toBe(300);
  });

  it('renvoie null pour une clé sans VNR', () => {
    expect(micronutrientCoverage('sodium_mg', 1500)).toBeNull();
    expect(micronutrientCoverage('omega_3_g', 2)).toBeNull();
  });

  it('renvoie null sur un apport négatif ou non fini', () => {
    expect(micronutrientCoverage('calcium_mg', -1)).toBeNull();
    expect(micronutrientCoverage('calcium_mg', Number.NaN)).toBeNull();
  });
});

describe('coverageLevel', () => {
  it('applique les seuils de la maquette (70 / 45)', () => {
    expect(coverageLevel(100)).toBe('high');
    expect(coverageLevel(70)).toBe('high');
    expect(coverageLevel(69)).toBe('mid');
    expect(coverageLevel(45)).toBe('mid');
    expect(coverageLevel(44)).toBe('low');
    expect(coverageLevel(0)).toBe('low');
  });
});

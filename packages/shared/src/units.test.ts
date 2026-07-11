import { describe, expect, it } from 'vitest';
import {
  UNIT_SYSTEMS,
  CM_PER_IN,
  MI_PER_KM,
  cmToFtIn,
  displayDistance,
  displayWeight,
  formatPaceMMSS,
  formatPaceValue,
  ftInToCm,
  heightPartsToCm,
  kgToLb,
  kmToMi,
  lbToKg,
  miToKm,
  paceToSystem,
  parseDistanceToKm,
  parsePaceToSPerKm,
  parseWeightToKg,
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

describe('taille cm <-> ft/in', () => {
  it('cmToFtIn arrondit au pouce le plus proche', () => {
    expect(cmToFtIn(178)).toEqual({ feet: 5, inches: 10 });
    expect(cmToFtIn(152.4)).toEqual({ feet: 5, inches: 0 });
  });
  it('gère le report à 12 pouces (retenue sur le pied)', () => {
    expect(cmToFtIn(182)).toEqual({ feet: 6, inches: 0 }); // 71.65 -> 72 in -> 6 ft 0 in
  });
  it("ftInToCm est l'inverse (aux arrondis près)", () => {
    expect(ftInToCm(5, 10)).toBeCloseTo(177.8, 1);
    expect(ftInToCm(6, 0)).toBeCloseTo(182.88, 1);
  });
  it('round-trip cm -> ft/in -> cm tolère l\'arrondi au pouce (<= ~1.3 cm)', () => {
    for (const cm of [150, 165, 172, 178, 190]) {
      const { feet, inches } = cmToFtIn(cm);
      expect(Math.abs(ftInToCm(feet, inches) - cm)).toBeLessThanOrEqual(1.3);
    }
  });
});

describe('allure', () => {
  it('metric : s/km inchangé', () => {
    expect(paceToSystem(300, 'metric')).toBe(300);
  });
  it('imperial : s/mi = s/km / MI_PER_KM', () => {
    expect(paceToSystem(300, 'imperial')).toBeCloseTo(300 / MI_PER_KM, 1);
  });
  it('formatPaceMMSS formate M:SS, pad des secondes', () => {
    expect(formatPaceMMSS(300, '—')).toBe('5:00');
    expect(formatPaceMMSS(483, '—')).toBe('8:03');
  });
  it('formatPaceMMSS renvoie le placeholder si null/<=0/NaN', () => {
    expect(formatPaceMMSS(null, '—')).toBe('—');
    expect(formatPaceMMSS(0, '—')).toBe('—');
    expect(formatPaceMMSS(Number.NaN, '—')).toBe('—');
  });
});

describe('parseurs de saisie -> SI', () => {
  it('poids metric : virgule et point -> kg', () => {
    expect(parseWeightToKg('72,5', 'metric')).toBeCloseTo(72.5, 5);
    expect(parseWeightToKg('72.5', 'metric')).toBeCloseTo(72.5, 5);
  });
  it('poids imperial : lb -> kg', () => {
    expect(parseWeightToKg('160', 'imperial')).toBeCloseTo(160 / 2.2046226218, 4);
  });
  it('distance imperial : mi -> km', () => {
    expect(parseDistanceToKm('3,1', 'imperial')).toBeCloseTo(3.1 / 0.6213711922, 4);
  });
  it('vide / invalide -> null', () => {
    expect(parseWeightToKg('', 'metric')).toBeNull();
    expect(parseWeightToKg('   ', 'metric')).toBeNull();
    expect(parseWeightToKg('abc', 'metric')).toBeNull();
    expect(parseDistanceToKm('', 'imperial')).toBeNull();
  });
  it('heightPartsToCm : ft/in -> cm ; metric = 1er arg ; vide -> null', () => {
    expect(heightPartsToCm('5', '10', 'imperial')).toBeCloseTo(177.8, 1);
    expect(heightPartsToCm('178', '', 'metric')).toBeCloseTo(178, 5);
    expect(heightPartsToCm('', '', 'imperial')).toBeNull();
    expect(heightPartsToCm('', '', 'metric')).toBeNull();
  });
  it('round-trip kg -> lb affiché (1 déc) -> kg, dérive <= 0.1 kg', () => {
    const kg = 72.5;
    const lbRounded = Number((kg * 2.2046226218).toFixed(1));
    expect(Math.abs(parseWeightToKg(String(lbRounded), 'imperial')! - kg)).toBeLessThanOrEqual(0.1);
  });
  it('rejette la notation scientifique et les caractères parasites -> null', () => {
    expect(parseWeightToKg('1e2', 'metric')).toBeNull();
    expect(parseWeightToKg('1.2.3', 'metric')).toBeNull();
    expect(parseDistanceToKm('Infinity', 'metric')).toBeNull();
  });
  it('rejette les valeurs négatives ou nulles (poids/distance impossibles) -> null', () => {
    expect(parseWeightToKg('-5', 'metric')).toBeNull();
    expect(parseWeightToKg('0', 'metric')).toBeNull();
    expect(parseDistanceToKm('-3', 'imperial')).toBeNull();
    expect(parseDistanceToKm('0', 'metric')).toBeNull();
  });
  it('distance metric : point décimal -> km (chemin métrique)', () => {
    expect(parseDistanceToKm('10.5', 'metric')).toBeCloseTo(10.5, 5);
  });
  it('heightPartsToCm : pouces seuls (pieds vides) valides -> cm', () => {
    expect(heightPartsToCm('', '11', 'imperial')).toBeCloseTo(27.94, 1);
  });
});

describe('parsePaceToSPerKm', () => {
  it('"5:00" metric -> 300 s/km', () => {
    expect(parsePaceToSPerKm('5:00', 'metric')).toBe(300);
  });

  it('"8:03" imperial -> ~300 s/km (+-1)', () => {
    // 8*60+3 = 483 s/mi ; 483 * MI_PER_KM = ~300.12 s/km
    const result = parsePaceToSPerKm('8:03', 'imperial');
    expect(result).not.toBeNull();
    expect(Math.abs(result! - 300)).toBeLessThanOrEqual(1);
  });

  it('chaine vide -> null', () => {
    expect(parsePaceToSPerKm('', 'metric')).toBeNull();
  });

  it('"abc" -> null', () => {
    expect(parsePaceToSPerKm('abc', 'metric')).toBeNull();
  });

  it('"5:99" (secondes >= 60) -> null', () => {
    expect(parsePaceToSPerKm('5:99', 'metric')).toBeNull();
  });

  it('"5" (format invalide sans ":SS") -> null', () => {
    expect(parsePaceToSPerKm('5', 'metric')).toBeNull();
  });

  it('"1:00" (60 s/km, trop rapide) -> null', () => {
    expect(parsePaceToSPerKm('1:00', 'metric')).toBeNull();
  });

  it('"15:00" (900 s/km, trop lent) -> null', () => {
    expect(parsePaceToSPerKm('15:00', 'metric')).toBeNull();
  });

  it('accepte des espaces en debut/fin (trim)', () => {
    expect(parsePaceToSPerKm('  5:00  ', 'metric')).toBe(300);
  });
});

describe('formatPaceValue', () => {
  it('metric 300 s/km -> "5:00"', () => {
    expect(formatPaceValue(300, 'metric')).toBe('5:00');
  });

  it('imperial 300 s/km -> "8:03" (300 / MI_PER_KM ~= 483 s/mi)', () => {
    // Valeur calculee : paceToSystem(300, 'imperial') = 300/0.6213711922 ~= 482.803
    // Math.round(482.803) = 483 -> "8:03"
    expect(formatPaceValue(300, 'imperial')).toBe('8:03');
  });

  it('round-trip metric : formatPaceValue(300, "metric") parse -> ~300', () => {
    const str = formatPaceValue(300, 'metric');
    const back = parsePaceToSPerKm(str, 'metric');
    expect(back).not.toBeNull();
    expect(Math.abs(back! - 300)).toBeLessThanOrEqual(1);
  });

  it('round-trip imperial : formatPaceValue(300, "imperial") parse -> ~300 (+-1)', () => {
    const str = formatPaceValue(300, 'imperial');
    const back = parsePaceToSPerKm(str, 'imperial');
    expect(back).not.toBeNull();
    expect(Math.abs(back! - 300)).toBeLessThanOrEqual(1);
  });
});

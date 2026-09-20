import { describe, expect, it } from 'vitest';
import { formatDecimal, isFrenchLocale } from './decimal';

describe('formatDecimal', () => {
  it('🔴 le cas qui a motivé la brique : une fourchette de protéines en français', () => {
    // Recette du 20/09/2026 : la carte de verdict écrivait « 1.5 g/kg, de 1.8 à 2.2 » juste
    // au-dessus d'une carte qui écrivait « 1,5 g/kg ».
    expect(formatDecimal(1.5, 'fr')).toBe('1,5');
    expect(formatDecimal(1.8, 'fr')).toBe('1,8');
    expect(formatDecimal(2.2, 'fr')).toBe('2,2');
  });

  it('garde le point en anglais', () => {
    expect(formatDecimal(1.5, 'en')).toBe('1.5');
  });

  it('sans locale, c’est le français — la langue par défaut du projet', () => {
    expect(formatDecimal(1.5, undefined)).toBe('1,5');
  });

  it('supprime la décimale nulle quand on ne force pas le format', () => {
    expect(formatDecimal(82, 'fr')).toBe('82');
    expect(formatDecimal(82.0, 'fr')).toBe('82');
    expect(formatDecimal(2.0, 'en')).toBe('2');
  });

  it('force le nombre de décimales quand on le demande — pour aligner plusieurs valeurs', () => {
    expect(formatDecimal(82, 'fr', 1)).toBe('82,0');
    expect(formatDecimal(0.456, 'fr', 2)).toBe('0,46');
  });

  it('arrondit à une décimale par défaut', () => {
    expect(formatDecimal(1.94, 'fr')).toBe('1,9');
    expect(formatDecimal(1.96, 'fr')).toBe('2');
  });

  it('gère le zéro et les négatifs', () => {
    expect(formatDecimal(0, 'fr')).toBe('0');
    expect(formatDecimal(-1.5, 'fr')).toBe('-1,5');
  });

  it('🔴 rend une chaîne VIDE sur une valeur non finie, jamais « NaN » à l’écran', () => {
    expect(formatDecimal(Number.NaN, 'fr')).toBe('');
    expect(formatDecimal(Number.POSITIVE_INFINITY, 'fr')).toBe('');
  });

  it('accepte les variantes régionales', () => {
    expect(formatDecimal(1.5, 'fr-CA')).toBe('1,5');
    expect(formatDecimal(1.5, 'FR')).toBe('1,5');
    expect(formatDecimal(1.5, 'en-GB')).toBe('1.5');
  });
});

describe('isFrenchLocale', () => {
  it('reconnaît le français, ses variantes, et le défaut', () => {
    expect(isFrenchLocale('fr')).toBe(true);
    expect(isFrenchLocale('fr-CA')).toBe(true);
    expect(isFrenchLocale(undefined)).toBe(true);
    expect(isFrenchLocale('en')).toBe(false);
  });
});

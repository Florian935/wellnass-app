import { describe, it, expect } from 'vitest';
import { formatTooltipValue } from './chart-tooltip';

describe('formatTooltipValue', () => {
  it('formateur fourni → prioritaire, unité accolée', () => {
    expect(formatTooltipValue(412, { formatValue: () => '6:52', unit: '/km' })).toBe('6:52 /km');
  });

  it('le formateur reçoit bien la valeur brute', () => {
    const seen: number[] = [];
    formatTooltipValue(412, {
      formatValue: (v) => {
        seen.push(v);
        return 'x';
      },
    });
    expect(seen).toEqual([412]);
  });

  it('sans formateur → 1 décimale maximum (arrondi)', () => {
    expect(formatTooltipValue(82.46, { unit: 'kg' })).toBe('82,5 kg');
    expect(formatTooltipValue(82.44, { unit: 'kg' })).toBe('82,4 kg');
  });

  it('pas de décimale inutile', () => {
    expect(formatTooltipValue(82, { unit: 'kg' })).toBe('82 kg');
    expect(formatTooltipValue(82.0, { unit: 'kg' })).toBe('82 kg');
    expect(formatTooltipValue(82.04, { unit: 'kg' })).toBe('82 kg');
  });

  it('séparateur décimal selon la locale', () => {
    expect(formatTooltipValue(82.5, { unit: 'kg', locale: 'fr' })).toBe('82,5 kg');
    expect(formatTooltipValue(82.5, { unit: 'kg', locale: 'en' })).toBe('82.5 kg');
    expect(formatTooltipValue(82.5, { unit: 'kg', locale: 'en-US' })).toBe('82.5 kg');
  });

  it('locale absente → français (langue par défaut du projet)', () => {
    expect(formatTooltipValue(82.5, { unit: 'kg' })).toBe('82,5 kg');
  });

  it('sans unité → valeur seule (cas équilibre musculaire)', () => {
    expect(formatTooltipValue(18, {})).toBe('18');
    expect(formatTooltipValue(18.5, { locale: 'en' })).toBe('18.5');
  });

  it('zéro affiché, jamais masqué', () => {
    expect(formatTooltipValue(0, { unit: 'kcal' })).toBe('0 kcal');
  });

  it('grande valeur : pas de séparateur de milliers (cohérence avec les libellés d\'axe)', () => {
    expect(formatTooltipValue(2340, { unit: 'kcal' })).toBe('2340 kcal');
    expect(formatTooltipValue(12500, { unit: 'kg' })).toBe('12500 kg');
  });

  it('valeur négative conservée', () => {
    expect(formatTooltipValue(-1.5, { unit: 'kg' })).toBe('-1,5 kg');
  });

  it('unité vide traitée comme absente (pas d\'espace en fin)', () => {
    expect(formatTooltipValue(18, { unit: '' })).toBe('18');
  });

  it('non fini → chaîne vide (garde-fou, ne rend pas « NaN »)', () => {
    expect(formatTooltipValue(Number.NaN, { unit: 'kg' })).toBe('');
    expect(formatTooltipValue(Number.POSITIVE_INFINITY, { unit: 'kg' })).toBe('');
  });
});

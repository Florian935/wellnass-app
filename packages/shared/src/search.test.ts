import { describe, expect, it } from 'vitest';
import { foldDiacritics, matchesSearch, normalizeForSearch } from './search';

describe('foldDiacritics', () => {
  it('replie les accents', () => {
    expect(foldDiacritics('crème brûlée')).toBe('creme brulee');
    expect(foldDiacritics('Pâtes')).toBe('Pates');
  });

  it('replie les ligatures œ / æ', () => {
    expect(foldDiacritics('bœuf')).toBe('boeuf');
    expect(foldDiacritics('CŒUR')).toBe('COEUR');
    expect(foldDiacritics('ex æquo')).toBe('ex aequo');
  });
});

describe('normalizeForSearch', () => {
  it('sans accent, minuscule, trim', () => {
    expect(normalizeForSearch('  Crème  ')).toBe('creme');
  });
});

describe('matchesSearch', () => {
  it('trouve malgré les accents dans les deux sens', () => {
    expect(matchesSearch('Crème fraîche', 'creme')).toBe(true);
    expect(matchesSearch('Boeuf haché', 'bœuf')).toBe(true);
    expect(matchesSearch('Pâtes cuites', 'pates')).toBe(true);
  });

  it('reste insensible à la casse', () => {
    expect(matchesSearch('Banane', 'BAN')).toBe(true);
  });

  it('un terme vide matche tout', () => {
    expect(matchesSearch('Banane', '   ')).toBe(true);
  });

  it('ne matche pas un terme absent', () => {
    expect(matchesSearch('Banane', 'pomme')).toBe(false);
  });
});

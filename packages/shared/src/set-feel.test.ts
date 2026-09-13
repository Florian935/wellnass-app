import { describe, expect, it } from 'vitest';

import { feelToRpe, parseSetFeel, rpeToFeel, SET_FEELS } from './set-feel';

describe('ressenti de série', () => {
  it('mappe les quatre mots sur des RPE croissants', () => {
    expect(SET_FEELS.map(feelToRpe)).toEqual([6, 7, 9, 10]);
  });

  it('garde « solide » SOUS le seuil de 8 — sinon MUSC-F7 coupe la progression', () => {
    // `sessionStruggled` classe une séance difficile dès RPE ≥ 8 : un « Solide » à 8 éteindrait
    // la suggestion de progression puis déclencherait l'allègement. Ce test fixe le seuil.
    expect(feelToRpe('solide')).toBeLessThan(8);
  });

  it('retrouve le mot depuis le RPE, et seulement sur une valeur exacte', () => {
    expect(rpeToFeel(10)).toBe('limite');
    expect(rpeToFeel(7)).toBe('solide');
    expect(rpeToFeel(8)).toBeNull();
    expect(rpeToFeel(null)).toBeNull();
    expect(rpeToFeel(undefined)).toBeNull();
  });

  it("parse une valeur inconnue en `null` plutôt qu'en erreur", () => {
    expect(parseSetFeel('dur')).toBe('dur');
    expect(parseSetFeel('moyen')).toBeNull();
    expect(parseSetFeel(null)).toBeNull();
  });
});

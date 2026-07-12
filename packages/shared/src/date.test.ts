import { describe, expect, it } from 'vitest';
import { addDays, weekdayIndex, startOfWeek, localDayKey } from './date';

describe('localDayKey', () => {
  it("formate une Date en AAAA-MM-JJ selon l'heure locale", () => {
    expect(localDayKey(new Date(2026, 6, 11, 23, 30))).toBe('2026-07-11');
    expect(localDayKey(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});

describe('weekdayIndex (0=lundi..6=dimanche)', () => {
  it('lundi = 0', () => expect(weekdayIndex(new Date(2026, 6, 13))).toBe(0)); // 13/07/2026 = lundi
  it('dimanche = 6', () => expect(weekdayIndex(new Date(2026, 6, 19))).toBe(6));
});

describe('startOfWeek (lundi)', () => {
  it('un mercredi renvoie le lundi de la semaine', () =>
    expect(localDayKey(startOfWeek(new Date(2026, 6, 15)))).toBe('2026-07-13'));
  it('un lundi se renvoie lui-même', () =>
    expect(localDayKey(startOfWeek(new Date(2026, 6, 13)))).toBe('2026-07-13'));
  it('un dimanche renvoie le lundi précédent', () =>
    expect(localDayKey(startOfWeek(new Date(2026, 6, 19)))).toBe('2026-07-13'));
});

describe('addDays', () => {
  it('ajoute des jours en traversant un mois', () =>
    expect(localDayKey(addDays(new Date(2026, 6, 30), 3))).toBe('2026-08-02'));
  it('recule avec un nombre négatif', () =>
    expect(localDayKey(addDays(new Date(2026, 6, 1), -1))).toBe('2026-06-30'));
});

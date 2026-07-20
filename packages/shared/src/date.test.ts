import { describe, expect, it } from 'vitest';
import {
  addDays,
  weekdayIndex,
  startOfWeek,
  localDayKey,
  daysBetween,
  ROLLING_WEEK_DAYS,
  localMidnightDaysAgo,
  rollingWeekStarts,
} from './date';

describe('localDayKey', () => {
  it("formate une Date en AAAA-MM-JJ selon l'heure locale", () => {
    expect(localDayKey(new Date(2026, 6, 11, 23, 30))).toBe('2026-07-11');
    expect(localDayKey(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});

describe('localMidnightDaysAgo / rollingWeekStarts (fenêtre glissante 7 jours)', () => {
  const ref = new Date(2026, 6, 20, 14, 30); // lundi 20/07/2026 14h30 local

  it('localMidnightDaysAgo(0) = minuit local du jour de ref', () => {
    expect(localDayKey(localMidnightDaysAgo(0, ref))).toBe('2026-07-20');
    expect(localMidnightDaysAgo(0, ref).getHours()).toBe(0);
  });

  it('la fenêtre semaine glissante démarre à J−6 (7 jours incluant aujourd’hui)', () => {
    expect(ROLLING_WEEK_DAYS).toBe(7);
    const start = localMidnightDaysAgo(ROLLING_WEEK_DAYS - 1, ref);
    expect(localDayKey(start)).toBe('2026-07-14'); // 14→20 = 7 jours
  });

  it('rollingWeekStarts : bornes récentes→anciennes espacées de 7 jours', () => {
    const starts = rollingWeekStarts(3, ref).map(localDayKey);
    expect(starts).toEqual(['2026-07-14', '2026-07-07', '2026-06-30']);
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

describe('daysBetween', () => {
  it('même jour → 0', () => expect(daysBetween('2026-07-18', '2026-07-18')).toBe(0));
  it('jours consécutifs → 1', () => expect(daysBetween('2026-07-18', '2026-07-19')).toBe(1));
  it('sens inverse → négatif', () => expect(daysBetween('2026-07-19', '2026-07-18')).toBe(-1));
  it('passage de mois', () => expect(daysBetween('2026-06-28', '2026-07-01')).toBe(3));
  it('passage d’année', () => expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1));
  it('fenêtre de 30 jours', () => expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30));
  it('année bissextile (fév. 2028)', () =>
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2));
});

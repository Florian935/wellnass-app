import { describe, expect, it } from 'vitest';
import {
  addDayKeys,
  inServedWindow,
  isMondayKey,
  isValidDayKey,
  parisDayKey,
  weekKeysFrom,
  weekOverlapsServedWindow,
} from './paris-date';

describe('isValidDayKey', () => {
  it('accepte une vraie date du calendrier au format AAAA-MM-JJ', () => {
    expect(isValidDayKey('2026-10-08')).toBe(true);
    expect(isValidDayKey('2028-02-29')).toBe(true);
  });

  it('refuse une date impossible ou mal formée', () => {
    expect(isValidDayKey('2026-02-29')).toBe(false);
    expect(isValidDayKey('2026-13-01')).toBe(false);
    expect(isValidDayKey('2026-10-32')).toBe(false);
    expect(isValidDayKey('2026-1-08')).toBe(false);
    expect(isValidDayKey('2026-10-08T00:00')).toBe(false);
    expect(isValidDayKey('')).toBe(false);
  });
});

describe('addDayKeys', () => {
  it('ajoute et retire des jours civils, mois et années compris', () => {
    expect(addDayKeys('2026-10-08', 14)).toBe('2026-10-22');
    expect(addDayKeys('2026-10-08', -8)).toBe('2026-09-30');
    expect(addDayKeys('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('ignore les changements d’heure : un jour reste un jour', () => {
    expect(addDayKeys('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDayKeys('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDayKeys('2026-10-25', 1)).toBe('2026-10-26');
  });
});

describe('isMondayKey', () => {
  it('reconnaît un lundi', () => {
    expect(isMondayKey('2026-10-05')).toBe(true);
    expect(isMondayKey('2026-10-26')).toBe(true);
  });

  it('refuse les autres jours', () => {
    expect(isMondayKey('2026-10-06')).toBe(false);
    expect(isMondayKey('2026-10-04')).toBe(false);
  });
});

describe('weekKeysFrom', () => {
  it('rend les sept jours du lundi au dimanche, dans l’ordre', () => {
    expect(weekKeysFrom('2026-10-19')).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
  });
});

describe('parisDayKey — le jour à Paris d’un instant', () => {
  it('lundi 26/10/2026 00 h 30 à Paris = dimanche 25/10 23 h 30 UTC (heure d’hiver)', () => {
    expect(parisDayKey(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-26');
  });

  it('lundi 30/03/2026 00 h 30 à Paris = dimanche 29/03 22 h 30 UTC (heure d’été)', () => {
    expect(parisDayKey(new Date('2026-03-29T22:30:00Z'))).toBe('2026-03-30');
  });

  it('25/10/2026 00 h 30 à Paris, encore en heure d’été = 24/10 22 h 30 UTC', () => {
    expect(parisDayKey(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-25');
  });

  it('un instant juste avant minuit à Paris reste la veille', () => {
    expect(parisDayKey(new Date('2026-10-25T22:59:59Z'))).toBe('2026-10-25');
    expect(parisDayKey(new Date('2026-07-14T21:59:59Z'))).toBe('2026-07-14');
  });
});

describe('fenêtre servie — J−8 … J+15 (contrat J−7 … J+14, un jour de marge, D8)', () => {
  const today = '2026-10-08';

  it('sert les bornes, marge comprise', () => {
    expect(inServedWindow('2026-09-30', today)).toBe(true); // J−8
    expect(inServedWindow('2026-10-01', today)).toBe(true); // J−7
    expect(inServedWindow(today, today)).toBe(true);
    expect(inServedWindow('2026-10-22', today)).toBe(true); // J+14
    expect(inServedWindow('2026-10-23', today)).toBe(true); // J+15
  });

  it('refuse au-delà de la marge', () => {
    expect(inServedWindow('2026-09-29', today)).toBe(false); // J−9
    expect(inServedWindow('2026-10-24', today)).toBe(false); // J+16
  });

  it('sert une semaine dont seul le dimanche est à J−8 (grâce à la marge)', () => {
    // Lundi 12/10/2026 : J−8 = dimanche 04/10, dernier jour de la semaine du 28/09.
    expect(weekOverlapsServedWindow('2026-09-28', '2026-10-12')).toBe(true);
    expect(weekOverlapsServedWindow('2026-09-21', '2026-10-12')).toBe(false);
  });

  it('sert une semaine dont seul le lundi est à J+15 (grâce à la marge)', () => {
    // Dimanche 11/10/2026 : J+15 = lundi 26/10.
    expect(weekOverlapsServedWindow('2026-10-26', '2026-10-11')).toBe(true);
    expect(weekOverlapsServedWindow('2026-11-02', '2026-10-11')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { computeAge, isAtLeast, MIN_SIGNUP_AGE, toDate, toIsoDate } from './age';

const NOW = new Date(2026, 6, 5); // 05/07/2026 (mois 0-indexé)

describe('computeAge', () => {
  it('compte les années révolues', () => {
    expect(computeAge(new Date(2000, 6, 5), NOW)).toBe(26);
  });

  it('retire 1 si l’anniversaire n’est pas encore passé cette année', () => {
    expect(computeAge(new Date(2000, 7, 1), NOW)).toBe(25); // anniversaire en août
  });

  it('compte l’année le jour même de l’anniversaire', () => {
    expect(computeAge(new Date(2010, 6, 5), NOW)).toBe(16);
  });

  it('gère un anniversaire plus tôt dans le mois', () => {
    expect(computeAge(new Date(2000, 6, 4), NOW)).toBe(26);
  });
});

describe('isAtLeast', () => {
  it('accepte pile 16 ans', () => {
    expect(isAtLeast(new Date(2010, 6, 5), MIN_SIGNUP_AGE, NOW)).toBe(true);
  });

  it('refuse à un jour près', () => {
    expect(isAtLeast(new Date(2010, 6, 6), MIN_SIGNUP_AGE, NOW)).toBe(false);
  });
});

describe('toDate', () => {
  it('construit une date valide', () => {
    expect(toDate(5, 7, 2000)?.getTime()).toBe(new Date(2000, 6, 5).getTime());
  });

  it('rejette une date inexistante (31/02)', () => {
    expect(toDate(31, 2, 2000)).toBeNull();
  });

  it('rejette un mois hors bornes', () => {
    expect(toDate(1, 13, 2000)).toBeNull();
  });

  it('rejette un jour hors bornes', () => {
    expect(toDate(0, 1, 2000)).toBeNull();
  });

  it('rejette un champ non entier', () => {
    expect(toDate(1.5, 1, 2000)).toBeNull();
  });
});

describe('toIsoDate', () => {
  it('formate sans décalage de fuseau (pas de jour -1)', () => {
    // Régression : le 11 doit rester le 11, quel que soit le fuseau local.
    expect(toIsoDate(11, 5, 1995)).toBe('1995-05-11');
    expect(toIsoDate(17, 7, 2026)).toBe('2026-07-17');
  });

  it('zéro-pad jour et mois', () => {
    expect(toIsoDate(1, 2, 2000)).toBe('2000-02-01');
  });

  it('renvoie null si la date est invalide', () => {
    expect(toIsoDate(31, 2, 2000)).toBeNull();
    expect(toIsoDate(0, 1, 2000)).toBeNull();
  });
});

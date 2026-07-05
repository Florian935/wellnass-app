import { describe, expect, it } from 'vitest';
import { computeAge, isAtLeast, MIN_SIGNUP_AGE, toDate } from './age';

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

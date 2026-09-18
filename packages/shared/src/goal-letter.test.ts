import { describe, it, expect } from 'vitest';
import {
  LETTER_COUNTER_FROM,
  LETTER_MAX_LENGTH,
  letterAgeDays,
  normaliseLetter,
  shouldShowCounter,
  truncateLetter,
} from './goal-letter';

describe('normaliseLetter (cas limite « lettre vidée »)', () => {
  it('garde un texte utile tel quel', () => {
    expect(normaliseLetter('Parce que je veux tenir mes 20 minutes.')).toBe(
      'Parce que je veux tenir mes 20 minutes.',
    );
  });

  it('coupe les blancs de bord sans toucher au milieu', () => {
    expect(normaliseLetter('  deux lignes\n\net une suite  ')).toBe('deux lignes\n\net une suite');
  });

  it('null pour une chaîne vide ou blanche : la lettre disparaît (spec §6)', () => {
    expect(normaliseLetter('')).toBeNull();
    expect(normaliseLetter('   ')).toBeNull();
    expect(normaliseLetter('\n\t ')).toBeNull();
    expect(normaliseLetter(null)).toBeNull();
  });
});

describe('truncateLetter (D6 — aucun texte tronqué en silence)', () => {
  it('ne touche pas un texte sous la limite', () => {
    const text = 'a'.repeat(LETTER_MAX_LENGTH);
    expect(truncateLetter(text)).toBe(text);
  });

  it('coupe net au-delà de la limite', () => {
    expect(truncateLetter('a'.repeat(LETTER_MAX_LENGTH + 50))).toHaveLength(LETTER_MAX_LENGTH);
  });
});

describe('shouldShowCounter (D6)', () => {
  it('silencieux tant qu’on est loin de la limite', () => {
    expect(shouldShowCounter(0)).toBe(false);
    expect(shouldShowCounter(LETTER_COUNTER_FROM - 1)).toBe(false);
  });

  it('apparaît à partir du seuil', () => {
    expect(shouldShowCounter(LETTER_COUNTER_FROM)).toBe(true);
    expect(shouldShowCounter(LETTER_MAX_LENGTH)).toBe(true);
  });
});

describe('letterAgeDays (R4)', () => {
  const now = new Date('2026-09-18T10:00:00.000Z');

  it('compte des jours pleins', () => {
    expect(letterAgeDays('2026-09-18T09:00:00.000Z', now)).toBe(0);
    expect(letterAgeDays('2026-09-17T09:00:00.000Z', now)).toBe(1);
    expect(letterAgeDays('2026-06-20T10:00:00.000Z', now)).toBe(90);
  });

  it('jamais négatif : une date future compte pour zéro', () => {
    expect(letterAgeDays('2026-12-25T10:00:00.000Z', now)).toBe(0);
  });

  it('null sur une date illisible plutôt qu’un NaN affiché', () => {
    expect(letterAgeDays('pas une date', now)).toBeNull();
    expect(letterAgeDays(null, now)).toBeNull();
  });
});

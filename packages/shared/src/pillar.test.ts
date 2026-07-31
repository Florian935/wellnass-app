import { describe, expect, it } from 'vitest';
import { LOCALES, PILLARS, localeSchema, pillarSchema, resolveActivePillars } from './pillar';

describe('pillarSchema', () => {
  it('expose exactement les trois piliers', () => {
    expect(PILLARS).toEqual(['strength', 'running', 'nutrition']);
  });

  it.each(PILLARS)('accepte le pilier « %s »', (pillar) => {
    expect(pillarSchema.parse(pillar)).toBe(pillar);
  });

  it('rejette un pilier inconnu', () => {
    expect(pillarSchema.safeParse('yoga').success).toBe(false);
  });
});

describe('resolveActivePillars', () => {
  it('retombe sur les 3 piliers quand la valeur est undefined (réglages pas encore chargés)', () => {
    expect(resolveActivePillars(undefined)).toEqual(['strength', 'running', 'nutrition']);
  });

  it('retombe sur les 3 piliers quand la valeur est null', () => {
    expect(resolveActivePillars(null)).toEqual(['strength', 'running', 'nutrition']);
  });

  it('ne retombe PAS sur le repli pour un tableau vide saisi (ce n’est pas une absence de donnée)', () => {
    expect(resolveActivePillars([])).toEqual([]);
  });

  it('renvoie le sous-ensemble saisi tel quel', () => {
    expect(resolveActivePillars(['strength'])).toEqual(['strength']);
  });

  it('renvoie une copie défensive, pas la même référence', () => {
    const input: readonly ('strength' | 'running' | 'nutrition')[] = ['strength', 'running'];
    const result = resolveActivePillars(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });
});

describe('localeSchema', () => {
  it('supporte FR et EN dès le lancement (décision G)', () => {
    expect(LOCALES).toEqual(['fr', 'en']);
  });

  it('rejette une locale non supportée', () => {
    expect(localeSchema.safeParse('es').success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { LOCALES, PILLARS, localeSchema, pillarSchema } from './pillar';

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

describe('localeSchema', () => {
  it('supporte FR et EN dès le lancement (décision G)', () => {
    expect(LOCALES).toEqual(['fr', 'en']);
  });

  it('rejette une locale non supportée', () => {
    expect(localeSchema.safeParse('es').success).toBe(false);
  });
});

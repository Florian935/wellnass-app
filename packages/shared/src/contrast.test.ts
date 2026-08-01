import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance } from './contrast';

describe('relativeLuminance', () => {
  it('noir = 0, blanc = 1', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBe(1);
  });

  it('accepte la forme sans #', () => {
    expect(relativeLuminance('ffffff')).toBe(1);
  });

  it('renvoie null sur une valeur illisible', () => {
    expect(relativeLuminance('pas-un-hex')).toBeNull();
    expect(relativeLuminance('#fff')).toBeNull();
    expect(relativeLuminance('')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('noir / blanc = 21 (le maximum WCAG)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('blanc / blanc = 1 (le minimum)', () => {
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('est symétrique (l’ordre des arguments ne compte pas)', () => {
    expect(contrastRatio('#33291f', '#f7eede')).toBeCloseTo(
      contrastRatio('#f7eede', '#33291f')!,
      5,
    );
  });

  it('renvoie null si une des deux couleurs est illisible', () => {
    expect(contrastRatio('#000000', 'pas-un-hex')).toBeNull();
  });
});

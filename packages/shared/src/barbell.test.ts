import { describe, expect, it } from 'vitest';

import { computePlates, DEFAULT_BAR_KG, loadedTotal } from './barbell';

describe('disques par côté', () => {
  it('décompose 82,5 kg sur une barre de 20 en 25 + 5 + 1,25', () => {
    const load = computePlates({ total: 82.5, bar: DEFAULT_BAR_KG });
    expect(load.perSide).toEqual([25, 5, 1.25]);
    expect(load.remainder).toBe(0);
    expect(load.barOnly).toBe(false);
  });

  it('ne laisse AUCUN reste sur les charges usuelles — le piège des flottants', () => {
    // 31,25 − 25 − 5 − 1,25 vaut 3,55e-15 en arithmétique flottante : un reste fantôme s'afficherait.
    for (const total of [60, 62.5, 82.5, 100, 102.5, 137.5]) {
      expect(computePlates({ total, bar: 20 }).remainder).toBe(0);
    }
  });

  it('recompose exactement la charge demandée', () => {
    const load = computePlates({ total: 137.5, bar: 20 });
    expect(loadedTotal({ perSide: load.perSide, bar: 20 })).toBe(137.5);
  });

  it('signale la barre seule quand la charge ne la dépasse pas', () => {
    expect(computePlates({ total: 20, bar: 20 }).barOnly).toBe(true);
    expect(computePlates({ total: 15, bar: 20 }).barOnly).toBe(true);
    expect(computePlates({ total: null, bar: 20 }).barOnly).toBe(true);
  });

  it('sort un reste non chargeable au lieu de mentir', () => {
    // 21,5 kg : 0,75 kg par côté, impossible avec des disques de 1,25 minimum.
    const load = computePlates({ total: 21.5, bar: 20 });
    expect(load.perSide).toEqual([]);
    expect(load.remainder).toBeCloseTo(0.75, 5);
  });

  it('utilise les disques en livres quand l\'unité est lb', () => {
    const load = computePlates({ total: 135, bar: 45, unit: 'lb' });
    expect(load.perSide).toEqual([45]);
    expect(load.remainder).toBe(0);
  });

  it('empile plusieurs disques identiques avant de descendre de calibre', () => {
    expect(computePlates({ total: 220, bar: 20 }).perSide).toEqual([25, 25, 25, 25]);
  });
});

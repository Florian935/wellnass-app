import { describe, it, expect } from 'vitest';
import { linearRegression } from './regression';

describe('linearRegression', () => {
  it('droite parfaite croissante → pente exacte, r2 = 1', () => {
    // y = 2x + 1
    const fit = linearRegression([
      { x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 },
    ]);
    expect(fit).not.toBeNull();
    expect(fit!.slope).toBeCloseTo(2, 10);
    expect(fit!.intercept).toBeCloseTo(1, 10);
    expect(fit!.r2).toBeCloseTo(1, 10);
    expect(fit!.n).toBe(4);
  });

  it('série bruitée → pente approchée, 0 < r2 < 1', () => {
    const fit = linearRegression([
      { x: 0, y: 1 }, { x: 1, y: 2.2 }, { x: 2, y: 4.5 }, { x: 3, y: 6.8 },
    ]);
    expect(fit!.slope).toBeGreaterThan(1.5);
    expect(fit!.r2).toBeGreaterThan(0.9);
    expect(fit!.r2).toBeLessThan(1);
  });

  it('série constante en y → pente 0, r2 = 1', () => {
    const fit = linearRegression([{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }]);
    expect(fit!.slope).toBe(0);
    expect(fit!.r2).toBe(1);
  });

  it('moins de 2 points → null', () => {
    expect(linearRegression([])).toBeNull();
    expect(linearRegression([{ x: 3, y: 9 }])).toBeNull();
  });

  it('tous les x identiques (variance x nulle) → null', () => {
    expect(linearRegression([{ x: 2, y: 1 }, { x: 2, y: 5 }, { x: 2, y: 9 }])).toBeNull();
  });

  it('points non triés en x → même résultat que triés', () => {
    const a = linearRegression([{ x: 3, y: 7 }, { x: 0, y: 1 }, { x: 2, y: 5 }, { x: 1, y: 3 }]);
    expect(a!.slope).toBeCloseTo(2, 10);
    expect(a!.intercept).toBeCloseTo(1, 10);
  });

  it('espacement x irrégulier pris en compte (pente par unité de x)', () => {
    // y = 3x : points à x = 0, 1, 10
    const fit = linearRegression([{ x: 0, y: 0 }, { x: 1, y: 3 }, { x: 10, y: 30 }]);
    expect(fit!.slope).toBeCloseTo(3, 10);
    expect(fit!.r2).toBeCloseTo(1, 10);
  });
});

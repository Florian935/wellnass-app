import { describe, it, expect } from 'vitest';
import { movingAverage } from './moving-average';

describe('movingAverage', () => {
  it('fenêtre 3, centrée, bords rétrécis', () => {
    const out = movingAverage([80, 79, 81, 78, 80], 3);
    expect(out).toHaveLength(5);
    expect(out[0]).toBeCloseTo(79.5, 10);
    expect(out[1]).toBeCloseTo(80, 10);
    expect(out[2]).toBeCloseTo((79 + 81 + 78) / 3, 10);
    expect(out[3]).toBeCloseTo((81 + 78 + 80) / 3, 10);
    expect(out[4]).toBeCloseTo(79, 10);
  });

  it('fenêtre 5 (h=2), centre sur 5 points, bords rétrécis', () => {
    const out = movingAverage([10, 12, 14, 16, 18], 5);
    expect(out).toEqual([12, 13, 14, 15, 16]);
  });

  it('série constante → identique', () => {
    expect(movingAverage([5, 5, 5, 5], 3)).toEqual([5, 5, 5, 5]);
  });

  it('window ≤ 1 → copie', () => {
    expect(movingAverage([3, 1, 4], 1)).toEqual([3, 1, 4]);
    expect(movingAverage([3, 1, 4], 0)).toEqual([3, 1, 4]);
  });

  it('length < 2 → copie', () => {
    expect(movingAverage([42], 3)).toEqual([42]);
    expect(movingAverage([], 3)).toEqual([]);
  });

  it('renvoie une COPIE (pas la même référence)', () => {
    const input = [1, 2];
    expect(movingAverage(input, 1)).not.toBe(input);
  });

  it('fenêtre paire (4) → h=2, fenêtre effective 5', () => {
    expect(movingAverage([10, 12, 14, 16, 18], 4)).toEqual([12, 13, 14, 15, 16]);
  });
});

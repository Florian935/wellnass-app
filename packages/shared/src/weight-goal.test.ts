import { describe, it, expect } from 'vitest';
import { computeWeightGoalProgress } from './weight-goal';

describe('computeWeightGoalProgress', () => {
  it('null si une donnée manque', () => {
    expect(computeWeightGoalProgress({ startKg: null, targetKg: 75, currentKg: 80 })).toBeNull();
    expect(computeWeightGoalProgress({ startKg: 85, targetKg: null, currentKg: 80 })).toBeNull();
    expect(computeWeightGoalProgress({ startKg: 85, targetKg: 75, currentKg: null })).toBeNull();
  });

  it('null si départ = cible (rien à mesurer)', () => {
    expect(computeWeightGoalProgress({ startKg: 75, targetKg: 75, currentKg: 75 })).toBeNull();
  });

  it('perte : mi-chemin = 50 %', () => {
    const r = computeWeightGoalProgress({ startKg: 85, targetKg: 75, currentKg: 80 })!;
    expect(r.pct).toBe(50);
    expect(r.reached).toBe(false);
    expect(r.doneKg).toBeCloseTo(5);
    expect(r.remainingKg).toBeCloseTo(5);
  });

  it('prise : mi-chemin = 50 % (signe s’annule)', () => {
    const r = computeWeightGoalProgress({ startKg: 70, targetKg: 80, currentKg: 75 })!;
    expect(r.pct).toBe(50);
    expect(r.totalKg).toBeCloseTo(10);
  });

  it('atteint exact = 100 %, reached', () => {
    const r = computeWeightGoalProgress({ startKg: 85, targetKg: 75, currentKg: 75 })!;
    expect(r.pct).toBe(100);
    expect(r.reached).toBe(true);
    expect(r.remainingKg).toBeCloseTo(0);
  });

  it('dépassement plafonné à 100 %', () => {
    const r = computeWeightGoalProgress({ startKg: 85, targetKg: 75, currentKg: 73 })!;
    expect(r.pct).toBe(100);
    expect(r.reached).toBe(true);
    expect(r.doneKg).toBeCloseTo(10);
  });

  it('recul planché à 0 %', () => {
    const r = computeWeightGoalProgress({ startKg: 85, targetKg: 75, currentKg: 88 })!;
    expect(r.pct).toBe(0);
    expect(r.reached).toBe(false);
    expect(r.doneKg).toBe(0);
    expect(r.remainingKg).toBeCloseTo(10);
  });

  it('doneKg + remainingKg = totalKg', () => {
    const r = computeWeightGoalProgress({ startKg: 90, targetKg: 78, currentKg: 84 })!;
    expect(r.doneKg + r.remainingKg).toBeCloseTo(r.totalKg);
  });
});

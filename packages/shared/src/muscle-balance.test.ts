import { describe, it, expect } from 'vitest';
import { computeMuscleBalance } from './muscle-balance';
import type { MuscleGroup } from './exercise';

const all = (sets: number) =>
  (['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as MuscleGroup[]).map((m) => ({
    muscle: m,
    sets,
  }));

describe('computeMuscleBalance', () => {
  it('normalise les 6 groupes (absent → 0 série)', () => {
    const b = computeMuscleBalance([{ muscle: 'chest', sets: 20 }]);
    expect(b.groups).toHaveLength(6);
    expect(b.groups.find((g) => g.muscle === 'back')!.sets).toBe(0);
  });
  it('historique maigre (< 12) → hasEnoughData false, aucun neglected, tous balanced', () => {
    const b = computeMuscleBalance([{ muscle: 'chest', sets: 5 }]);
    expect(b.hasEnoughData).toBe(false);
    expect(b.neglected).toEqual([]);
    expect(b.groups.every((g) => g.status === 'balanced')).toBe(true);
  });
  it('un seul groupe (≥12) → lui over, les autres neglected dans l’ordre MUSCLE_GROUPS', () => {
    const b = computeMuscleBalance([{ muscle: 'chest', sets: 24 }]);
    expect(b.hasEnoughData).toBe(true);
    expect(b.groups.find((g) => g.muscle === 'chest')!.status).toBe('over');
    expect(b.neglected).toEqual(['back', 'legs', 'shoulders', 'arms', 'core']);
  });
  it('réparti équitablement (6×4=24) → tous balanced, aucun neglected', () => {
    const b = computeMuscleBalance(all(4));
    expect(b.neglected).toEqual([]);
    expect(b.groups.every((g) => g.status === 'balanced')).toBe(true);
  });
  it('total 0 → pas de division par zéro, shares 0', () => {
    const b = computeMuscleBalance([]);
    expect(b.totalSets).toBe(0);
    expect(b.groups.every((g) => g.share === 0)).toBe(true);
    expect(b.hasEnoughData).toBe(false);
  });
});

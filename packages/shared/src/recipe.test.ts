import { describe, expect, it } from 'vitest';
import { perServing, scalePortions, recipeRowSchema } from './recipe';
import {
  averageIntake,
  shouldAlertDeficitVolume,
  weightTrend,
  bodyWeightEntryRowSchema,
} from './bodyweight';

describe('recipe helpers', () => {
  it('perServing divise le total par le nombre de portions', () => {
    expect(perServing({ kcal: 800, proteinG: 40, carbsG: 100, fatG: 20 }, 4)).toEqual({
      kcal: 200,
      proteinG: 10,
      carbsG: 25,
      fatG: 5,
    });
  });
  it('perServing borne les portions à ≥ 1', () => {
    expect(perServing({ kcal: 500, proteinG: 0, carbsG: 0, fatG: 0 }, 0).kcal).toBe(500);
  });
  it('scalePortions multiplie une portion', () => {
    expect(scalePortions({ kcal: 200, proteinG: 10, carbsG: 25, fatG: 5 }, 2)).toEqual({
      kcal: 400,
      proteinG: 20,
      carbsG: 50,
      fatG: 10,
    });
  });
  it('valide une recette', () => {
    const r = recipeRowSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      createdAt: '2026-07-06T10:00:00Z',
      updatedAt: '2026-07-06T10:00:00Z',
      deletedAt: null,
      name: 'Bowl',
      servings: 2,
    });
    expect(r.servings).toBe(2);
  });
});

describe('bodyweight helpers', () => {
  it('weightTrend détecte hausse/baisse/stable (seuil ±0,3)', () => {
    expect(weightTrend([{ logDate: '2026-07-01', weightKg: 80 }, { logDate: '2026-07-02', weightKg: 81 }])).toBe('up');
    expect(weightTrend([{ logDate: '2026-07-01', weightKg: 81 }, { logDate: '2026-07-02', weightKg: 80 }])).toBe('down');
    expect(weightTrend([{ logDate: '2026-07-01', weightKg: 80 }, { logDate: '2026-07-02', weightKg: 80.1 }])).toBe('stable');
    expect(weightTrend([{ logDate: '2026-07-01', weightKg: 80 }])).toBe('stable');
  });
  it('averageIntake moyenne sur les jours renseignés', () => {
    expect(
      averageIntake([
        { kcal: 2000, proteinG: 100, carbsG: 200, fatG: 60 },
        { kcal: 2500, proteinG: 120, carbsG: 250, fatG: 80 },
      ]),
    ).toEqual({ kcal: 2250, proteinG: 110, carbsG: 225, fatG: 70 });
  });
  it('averageIntake renvoie zéro si vide', () => {
    expect(averageIntake([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
  it('valide une pesée', () => {
    const w = bodyWeightEntryRowSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      createdAt: '2026-07-06T10:00:00Z',
      updatedAt: '2026-07-06T10:00:00Z',
      deletedAt: null,
      logDate: '2026-07-06',
      weightKg: 78.5,
    });
    expect(w.weightKg).toBe(78.5);
  });
});

describe('shouldAlertDeficitVolume (4.32)', () => {
  it('alerte si déficit ≥15% ET fort volume', () => {
    expect(shouldAlertDeficitVolume({ avgDailyKcal: 2000, targetKcal: 2500, weeklyVolume: 9000 })).toBe(true);
  });
  it('pas d’alerte si déficit faible', () => {
    expect(shouldAlertDeficitVolume({ avgDailyKcal: 2400, targetKcal: 2500, weeklyVolume: 9000 })).toBe(false);
  });
  it('pas d’alerte si volume faible', () => {
    expect(shouldAlertDeficitVolume({ avgDailyKcal: 2000, targetKcal: 2500, weeklyVolume: 3000 })).toBe(false);
  });
  it('pas d’alerte si données manquantes', () => {
    expect(shouldAlertDeficitVolume({ avgDailyKcal: 0, targetKcal: 2500, weeklyVolume: 9000 })).toBe(false);
  });
});

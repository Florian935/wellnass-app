import { describe, it, expect } from 'vitest';
import { computeWeeklyTrainingNutrition } from './training-nutrition';

// 3 semaines pour lisibilité : lundis récent → ancien
const weekStarts = ['2026-07-13', '2026-07-06', '2026-06-29'];

describe('computeWeeklyTrainingNutrition', () => {
  it('renvoie une ligne par semaine, dans l\'ordre reçu', () => {
    const r = computeWeeklyTrainingNutrition({ weekStarts, workouts: [], dailyKcals: [] });
    expect(r.map((x) => x.weekStart)).toEqual(weekStarts);
  });

  it('bucketing frontière lundi/dimanche', () => {
    const r = computeWeeklyTrainingNutrition({
      weekStarts,
      workouts: [
        { dayKey: '2026-07-13', tonnage: 100 }, // lundi → semaine courante
        { dayKey: '2026-07-12', tonnage: 200 }, // dimanche → semaine précédente
      ],
      dailyKcals: [],
    });
    expect(r[0]!.sessions).toBe(1);
    expect(r[0]!.tonnage).toBe(100);
    expect(r[1]!.sessions).toBe(1);
    expect(r[1]!.tonnage).toBe(200);
  });

  it('séance sans série qualifiante : comptée, tonnage 0 (pas null)', () => {
    const r = computeWeeklyTrainingNutrition({
      weekStarts, workouts: [{ dayKey: '2026-07-13', tonnage: 0 }], dailyKcals: [],
    });
    expect(r[0]!.sessions).toBe(1);
    expect(r[0]!.tonnage).toBe(0);
  });

  it('tonnage null si 0 séance ; avg null si 0 jour loggé', () => {
    const r = computeWeeklyTrainingNutrition({ weekStarts, workouts: [], dailyKcals: [] });
    expect(r[0]!.tonnage).toBeNull();
    expect(r[0]!.avgKcal).toBeNull();
    expect(r[0]!.avgProteinG).toBeNull();
  });

  it('moyenne kcal/prot sur jours loggés uniquement', () => {
    const r = computeWeeklyTrainingNutrition({
      weekStarts,
      workouts: [],
      dailyKcals: [
        { dayKey: '2026-07-13', kcal: 2000, proteinG: 150 },
        { dayKey: '2026-07-14', kcal: 2200, proteinG: 170 },
      ],
    });
    expect(r[0]!.avgKcal).toBe(2100);
    expect(r[0]!.avgProteinG).toBe(160);
  });

  it('dayKey hors fenêtre (antérieur au plus ancien lundi) ignoré', () => {
    const r = computeWeeklyTrainingNutrition({
      weekStarts, workouts: [{ dayKey: '2026-06-01', tonnage: 999 }], dailyKcals: [],
    });
    expect(r.every((x) => x.sessions === 0)).toBe(true);
  });

  it('delta vs semaine précédente affichée ; null sur la dernière ligne', () => {
    const r = computeWeeklyTrainingNutrition({
      weekStarts,
      workouts: [
        { dayKey: '2026-07-13', tonnage: 120 }, // courante
        { dayKey: '2026-07-06', tonnage: 100 }, // précédente
      ],
      dailyKcals: [],
    });
    expect(r[0]!.tonnageChange?.pct).toBe(20); // 120 vs 100
    expect(r[1]!.tonnageChange).toBeNull();    // précédente (2026-06-29) vide → base null
    expect(r[2]!.tonnageChange).toBeNull();    // dernière ligne
  });

  it('delta kcal null si une des deux semaines n\'a pas d\'apports', () => {
    const r = computeWeeklyTrainingNutrition({
      weekStarts,
      workouts: [],
      dailyKcals: [{ dayKey: '2026-07-13', kcal: 2000, proteinG: 150 }], // seulement semaine courante
    });
    expect(r[0]!.kcalChange).toBeNull(); // semaine précédente sans apports
  });
});

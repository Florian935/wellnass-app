import { describe, expect, it } from 'vitest';
import {
  NO_TARGET_FILL,
  buildNutritionMonthGrid,
  dayFillRatio,
  dayTargetStatus,
  historyListDayKeys,
  nutritionMonthSummary,
} from './nutrition-calendar';

describe('dayTargetStatus — NUTRI-UX03 R7', () => {
  it('dans la marge, bornes incluses', () => {
    expect(dayTargetStatus(2400, 2400, 10)).toBe('in');
    expect(dayTargetStatus(2640, 2400, 10)).toBe('in');
    expect(dayTargetStatus(2160, 2400, 10)).toBe('in');
  });

  it('au-dessus, en dessous', () => {
    expect(dayTargetStatus(2641, 2400, 10)).toBe('over');
    expect(dayTargetStatus(2159, 2400, 10)).toBe('under');
  });

  it('la marge est celle de l’utilisateur', () => {
    expect(dayTargetStatus(2600, 2400, 5)).toBe('over');
  });

  it('🔴 sans cible, ou sans rien de noté : pas de statut', () => {
    expect(dayTargetStatus(2000, null, 10)).toBeNull();
    expect(dayTargetStatus(2000, 0, 10)).toBeNull();
    expect(dayTargetStatus(0, 2400, 10)).toBeNull();
  });
});

describe('dayFillRatio — le verre (décision Q2)', () => {
  it('rempli à hauteur de la cible', () => {
    expect(dayFillRatio(1200, 2400)).toBe(0.5);
  });

  it('plafonné à plein au-delà', () => {
    expect(dayFillRatio(3000, 2400)).toBe(1);
  });

  it('vide sans rien de noté', () => {
    expect(dayFillRatio(0, 2400)).toBe(0);
  });

  it('sans cible : un jour noté est à moitié', () => {
    expect(dayFillRatio(1800, null)).toBe(NO_TARGET_FILL);
  });
});

describe('buildNutritionMonthGrid', () => {
  const days = [
    { dayKey: '2026-09-24', kcal: 2218, target: 2400 },
    { dayKey: '2026-09-19', kcal: 2738, target: 2400 },
    { dayKey: '2026-09-25', kcal: 467, target: 2700 },
  ];
  const grid = buildNutritionMonthGrid({ year: 2026, month: 9, days, todayKey: '2026-09-25', marginPct: 10 });
  const cell = (dayKey: string) => grid.flat().find((c) => c.dayKey === dayKey)!;

  it('lundi en premier : septembre 2026 commence un mardi', () => {
    expect(grid[0]!.map((c) => c.day)).toEqual([null, 1, 2, 3, 4, 5, 6]);
    expect(grid[0]![0]!.kind).toBe('blank');
  });

  it('des semaines complètes, cases vides en fin de mois', () => {
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.flat().filter((c) => c.day !== null)).toHaveLength(30);
  });

  it('un jour passé porte son remplissage et son statut', () => {
    expect(cell('2026-09-24')).toMatchObject({ kind: 'past', logged: true, status: 'in' });
    expect(cell('2026-09-24').fill).toBeCloseTo(2218 / 2400);
    expect(cell('2026-09-19')).toMatchObject({ status: 'over', fill: 1 });
  });

  it('un jour passé sans rien de noté est vide, sans statut', () => {
    expect(cell('2026-09-20')).toMatchObject({ kind: 'past', logged: false, fill: 0, status: null });
  });

  it('aujourd’hui est à part, rempli à hauteur du moment', () => {
    expect(cell('2026-09-25')).toMatchObject({ kind: 'today', logged: true });
    expect(cell('2026-09-25').fill).toBeCloseTo(467 / 2700);
  });

  it('les jours futurs ne portent rien', () => {
    expect(cell('2026-09-26')).toMatchObject({ kind: 'future', fill: 0, status: null });
  });

  it('février bissextile et un mois qui commence un lundi', () => {
    const feb = buildNutritionMonthGrid({ year: 2028, month: 2, days: [], todayKey: '2028-03-01', marginPct: 10 });
    expect(feb.flat().filter((c) => c.day !== null)).toHaveLength(29);
    const june = buildNutritionMonthGrid({ year: 2026, month: 6, days: [], todayKey: '2026-09-25', marginPct: 10 });
    expect(june[0]![0]!.day).toBe(1);
  });
});

describe('nutritionMonthSummary', () => {
  const days = [
    { dayKey: '2026-09-24', kcal: 2200, target: 2400 },
    { dayKey: '2026-09-23', kcal: 3000, target: 2400 },
    { dayKey: '2026-09-22', kcal: 1800, target: 2400 },
    { dayKey: '2026-09-21', kcal: 2000, target: null },
    { dayKey: '2026-09-25', kcal: 400, target: 2400 },
  ];

  it('🔴 aujourd’hui est exclu : une journée en cours fausserait la moyenne (NUTR-17)', () => {
    const s = nutritionMonthSummary(days, '2026-09-25', 10);
    expect(s.loggedDays).toBe(4);
    expect(s.averageKcal).toBe(Math.round((2200 + 3000 + 1800 + 2000) / 4));
  });

  it('la répartition ne compte que les jours qui ont une cible', () => {
    const s = nutritionMonthSummary(days, '2026-09-25', 10);
    expect(s).toMatchObject({ inTarget: 1, over: 1, under: 1, withTarget: 3 });
  });

  it('mois vide', () => {
    expect(nutritionMonthSummary([], '2026-09-25', 10)).toEqual({
      loggedDays: 0,
      averageKcal: 0,
      inTarget: 0,
      over: 0,
      under: 0,
      withTarget: 0,
    });
  });

  it('un jour à 0 kcal n’est pas noté', () => {
    expect(nutritionMonthSummary([{ dayKey: '2026-09-02', kcal: 0, target: 2400 }], '2026-09-25', 10).loggedDays).toBe(0);
  });
});

describe('historyListDayKeys — R8', () => {
  it('les jours notés du mois, du plus récent au plus ancien, plus les trous des 6 derniers jours', () => {
    const keys = historyListDayKeys({
      year: 2026,
      month: 9,
      loggedDayKeys: ['2026-09-24', '2026-09-22', '2026-09-03', '2026-09-25'],
      todayKey: '2026-09-25',
    });
    expect(keys).toEqual([
      '2026-09-25',
      '2026-09-24',
      '2026-09-23',
      '2026-09-22',
      '2026-09-21',
      '2026-09-20',
      '2026-09-19',
      '2026-09-03',
    ]);
  });

  it('aujourd’hui n’y est que s’il a des entrées', () => {
    const keys = historyListDayKeys({ year: 2026, month: 9, loggedDayKeys: ['2026-09-10'], todayKey: '2026-09-25' });
    expect(keys[0]).toBe('2026-09-24');
  });

  it('un mois passé : ses jours notés seulement', () => {
    const keys = historyListDayKeys({
      year: 2026,
      month: 8,
      loggedDayKeys: ['2026-08-30', '2026-08-02', '2026-09-24'],
      todayKey: '2026-09-25',
    });
    expect(keys).toEqual(['2026-08-30', '2026-08-02']);
  });

  it('en début de mois, les trous récents ne débordent pas sur le mois précédent', () => {
    const keys = historyListDayKeys({ year: 2026, month: 10, loggedDayKeys: [], todayKey: '2026-10-03' });
    expect(keys).toEqual(['2026-10-02', '2026-10-01']);
  });
});

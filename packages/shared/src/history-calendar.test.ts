import { describe, expect, it } from 'vitest';
import {
  buildMonthGrid,
  compareMonths,
  monthOfDayKey,
  monthRange,
  monthSummary,
  shiftMonth,
  type CalendarCell,
} from './history-calendar';

const jours = (grid: CalendarCell[][]) => grid.flat().map((c) => c.day);

describe('buildMonthGrid — R5', () => {
  it('septembre 2026 commence un mardi : une case vide devant le 1er', () => {
    const grid = buildMonthGrid({ year: 2026, month: 9, workouts: [], plannedDayKeys: [], todayKey: '2026-09-24' });
    expect(grid[0]!.map((c) => c.day)).toEqual([null, 1, 2, 3, 4, 5, 6]);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(jours(grid).filter((d) => d !== null)).toHaveLength(30);
  });

  it('un mois qui commence un lundi n’a pas de case vide devant', () => {
    // 01/06/2026 est un lundi.
    const grid = buildMonthGrid({ year: 2026, month: 6, workouts: [], plannedDayKeys: [], todayKey: '2026-09-24' });
    expect(grid[0]![0]!.day).toBe(1);
  });

  it('un mois qui commence un dimanche a six cases vides devant', () => {
    // 01/11/2026 est un dimanche.
    const grid = buildMonthGrid({ year: 2026, month: 11, workouts: [], plannedDayKeys: [], todayKey: '2026-09-24' });
    expect(grid[0]!.map((c) => c.day)).toEqual([null, null, null, null, null, null, 1]);
  });

  it('les jours des mois voisins restent vides en fin de grille', () => {
    const grid = buildMonthGrid({ year: 2026, month: 9, workouts: [], plannedDayKeys: [], todayKey: '2026-09-24' });
    const last = grid[grid.length - 1]!;
    expect(last.map((c) => c.day)).toEqual([28, 29, 30, null, null, null, null]);
    expect(last[3]!.dayKey).toBeNull();
  });

  it('février bissextile (2028) : 29 jours', () => {
    const grid = buildMonthGrid({ year: 2028, month: 2, workouts: [], plannedDayKeys: [], todayKey: '2028-02-10' });
    expect(jours(grid).filter((d) => d !== null)).toHaveLength(29);
  });

  it('séance, record, deux séances le même jour', () => {
    const grid = buildMonthGrid({
      year: 2026,
      month: 9,
      workouts: [
        { dayKey: '2026-09-17', recordCount: 0 },
        { dayKey: '2026-09-19', recordCount: 1 },
        { dayKey: '2026-09-19', recordCount: 0 },
      ],
      plannedDayKeys: [],
      todayKey: '2026-09-24',
    });
    const cell = (d: number) => grid.flat().find((c) => c.day === d)!;
    expect(cell(17)).toMatchObject({ state: 'done', count: 1, dayKey: '2026-09-17' });
    expect(cell(19)).toMatchObject({ state: 'record', count: 2 });
    expect(cell(18)).toMatchObject({ state: 'empty', count: 0 });
  });

  it('prévu : aujourd’hui et plus tard seulement, jamais par-dessus une séance', () => {
    const grid = buildMonthGrid({
      year: 2026,
      month: 9,
      workouts: [{ dayKey: '2026-09-24', recordCount: 0 }],
      plannedDayKeys: ['2026-09-10', '2026-09-24', '2026-09-26'],
      todayKey: '2026-09-24',
    });
    const cell = (d: number) => grid.flat().find((c) => c.day === d)!;
    expect(cell(10).state).toBe('empty');
    expect(cell(24).state).toBe('done');
    expect(cell(26).state).toBe('planned');
  });

  it('aujourd’hui est repéré', () => {
    const grid = buildMonthGrid({ year: 2026, month: 9, workouts: [], plannedDayKeys: [], todayKey: '2026-09-24' });
    expect(grid.flat().filter((c) => c.isToday).map((c) => c.day)).toEqual([24]);
  });
});

describe('monthSummary — R6', () => {
  it('compte les séances, additionne le tonnage et les records', () => {
    expect(
      monthSummary([
        { tonnageKg: 11400, recordCount: 2 },
        { tonnageKg: 7800, recordCount: 1 },
        { tonnageKg: 6900, recordCount: 0 },
      ]),
    ).toEqual({ count: 3, tonnageKg: 26100, records: 3 });
  });

  it('un mois vide', () => {
    expect(monthSummary([])).toEqual({ count: 0, tonnageKg: 0, records: 0 });
  });
});

describe('navigation de mois en mois', () => {
  it('shiftMonth passe les années', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 9 }, -14)).toEqual({ year: 2025, month: 7 });
  });

  it('monthOfDayKey', () => {
    expect(monthOfDayKey('2026-08-29')).toEqual({ year: 2026, month: 8 });
  });

  it('compareMonths', () => {
    expect(compareMonths({ year: 2026, month: 8 }, { year: 2026, month: 9 })).toBeLessThan(0);
    expect(compareMonths({ year: 2027, month: 1 }, { year: 2026, month: 12 })).toBeGreaterThan(0);
    expect(compareMonths({ year: 2026, month: 9 }, { year: 2026, month: 9 })).toBe(0);
  });

  it('monthRange : du mois de la première séance au mois courant', () => {
    expect(monthRange('2026-06-02', '2026-09-24')).toEqual({
      min: { year: 2026, month: 6 },
      max: { year: 2026, month: 9 },
    });
  });

  it('monthRange sans aucune séance : le mois courant seul', () => {
    expect(monthRange(null, '2026-09-24')).toEqual({
      min: { year: 2026, month: 9 },
      max: { year: 2026, month: 9 },
    });
  });
});

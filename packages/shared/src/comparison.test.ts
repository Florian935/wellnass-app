import { describe, it, expect } from 'vitest';
import { percentChange, previousPeriodTodayKey } from './comparison';

describe('percentChange', () => {
  it('hausse', () => expect(percentChange(112, 100)).toEqual({ pct: 12, direction: 'up' }));
  it('baisse', () => expect(percentChange(80, 100)).toEqual({ pct: -20, direction: 'down' }));
  it('égalité', () => expect(percentChange(100, 100)).toEqual({ pct: 0, direction: 'flat' }));
  it('previous = 0 → pct null, direction up si current>0', () =>
    expect(percentChange(50, 0)).toEqual({ pct: null, direction: 'up' }));
  it('0 vs 0 → null + flat', () =>
    expect(percentChange(0, 0)).toEqual({ pct: null, direction: 'flat' }));
  it('arrondi entier', () => expect(percentChange(103, 90).pct).toBe(Math.round((13 / 90) * 100)));
});

describe('previousPeriodTodayKey', () => {
  it('week → -7 j', () => expect(previousPeriodTodayKey('2026-07-15', 'week')).toBe('2026-07-08'));
  it('week passage de mois', () =>
    expect(previousPeriodTodayKey('2026-07-03', 'week')).toBe('2026-06-26'));
  it('month → dernier jour du mois précédent', () =>
    expect(previousPeriodTodayKey('2026-07-15', 'month')).toBe('2026-06-30'));
  it('month passage d’année', () =>
    expect(previousPeriodTodayKey('2026-01-10', 'month')).toBe('2025-12-31'));
  it('all → null', () => expect(previousPeriodTodayKey('2026-07-15', 'all')).toBeNull());
});

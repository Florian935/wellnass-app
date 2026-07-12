import { describe, expect, it } from 'vitest';
import { aggregateRunStats, paceTrendPoints, paceTrend, formatDurationHms, type StatRun } from './run-stats';

// today = mercredi 15/07/2026 ; lundi de la semaine = 13/07 ; semaine = 13→19 ; mois = 2026-07
const runs: StatRun[] = [
  { finishedAtDayKey: '2026-07-13', distanceM: 5000, durationS: 1800, paceSPerKm: 360 },
  { finishedAtDayKey: '2026-07-10', distanceM: 8000, durationS: 2400, paceSPerKm: 300 },
  { finishedAtDayKey: '2026-07-15', distanceM: 3000, durationS: 1200, paceSPerKm: 400 },
  { finishedAtDayKey: '2026-06-30', distanceM: 10000, durationS: 3000, paceSPerKm: null },
];

describe('aggregateRunStats', () => {
  it('semaine (lun→dim)', () => expect(aggregateRunStats(runs, 'week', '2026-07-15')).toEqual({ totalDistanceM: 8000, totalDurationS: 3000, count: 2 }));
  it('mois calendaire', () => expect(aggregateRunStats(runs, 'month', '2026-07-15')).toEqual({ totalDistanceM: 16000, totalDurationS: 5400, count: 3 }));
  it('depuis le début', () => expect(aggregateRunStats(runs, 'all', '2026-07-15')).toEqual({ totalDistanceM: 26000, totalDurationS: 8400, count: 4 }));
  it('null distance/durée = 0 mais compte', () => {
    const r: StatRun[] = [{ finishedAtDayKey: '2026-07-15', distanceM: null, durationS: null, paceSPerKm: null }];
    expect(aggregateRunStats(r, 'all', '2026-07-15')).toEqual({ totalDistanceM: 0, totalDurationS: 0, count: 1 });
  });
});

describe('paceTrendPoints', () => {
  it('fenêtre 30 j, exclut hors fenêtre + sans allure, trié asc', () => {
    expect(paceTrendPoints(runs, 30, '2026-07-15')).toEqual([
      { dayKey: '2026-07-10', paceSPerKm: 300 },
      { dayKey: '2026-07-13', paceSPerKm: 360 },
      { dayKey: '2026-07-15', paceSPerKm: 400 },
    ]);
  });
});

describe('paceTrend', () => {
  it('allure qui diminue = improving', () => expect(paceTrend([{dayKey:'a',paceSPerKm:360},{dayKey:'b',paceSPerKm:350},{dayKey:'c',paceSPerKm:330},{dayKey:'d',paceSPerKm:320}])).toBe('improving'));
  it('allure qui augmente = declining', () => expect(paceTrend([{dayKey:'a',paceSPerKm:320},{dayKey:'b',paceSPerKm:330},{dayKey:'c',paceSPerKm:350},{dayKey:'d',paceSPerKm:360}])).toBe('declining'));
  it('< 2 % = stable', () => expect(paceTrend([{dayKey:'a',paceSPerKm:350},{dayKey:'b',paceSPerKm:351},{dayKey:'c',paceSPerKm:349},{dayKey:'d',paceSPerKm:350}])).toBe('stable'));
  it('< 2 points = stable', () => expect(paceTrend([{dayKey:'a',paceSPerKm:350}])).toBe('stable'));
});

describe('formatDurationHms', () => {
  it('null / négatif → ""', () => { expect(formatDurationHms(null)).toBe(''); expect(formatDurationHms(-5)).toBe(''); });
  it('< 1 h → M min SS s', () => expect(formatDurationHms(1830)).toBe('30 min 30 s'));
  it('≥ 1 h → H h MM min SS s', () => expect(formatDurationHms(3930)).toBe('1 h 5 min 30 s'));
  it('0 → 0 min 0 s', () => expect(formatDurationHms(0)).toBe('0 min 0 s'));
});

import { describe, expect, it } from 'vitest';
import {
  aggregateRunStats,
  paceTrendPoints,
  paceTrend,
  formatDurationHms,
  type StatRun,
  type PaceTrendPoint,
} from './run-stats';

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
  it('allure qui diminue = improving', () => expect(paceTrend([{dayKey:'2026-07-01',paceSPerKm:360},{dayKey:'2026-07-02',paceSPerKm:350},{dayKey:'2026-07-03',paceSPerKm:330},{dayKey:'2026-07-04',paceSPerKm:320}])).toBe('improving'));
  it('allure qui augmente = declining', () => expect(paceTrend([{dayKey:'2026-07-01',paceSPerKm:320},{dayKey:'2026-07-02',paceSPerKm:330},{dayKey:'2026-07-03',paceSPerKm:350},{dayKey:'2026-07-04',paceSPerKm:360}])).toBe('declining'));
  it('< 2 % = stable', () => expect(paceTrend([{dayKey:'2026-07-01',paceSPerKm:350},{dayKey:'2026-07-02',paceSPerKm:351},{dayKey:'2026-07-03',paceSPerKm:349},{dayKey:'2026-07-04',paceSPerKm:350}])).toBe('stable'));
  it('< 2 points = stable', () => expect(paceTrend([{dayKey:'2026-07-01',paceSPerKm:350}])).toBe('stable'));
});

// Oracle = ancien paceTrend (moyenne 2e moitié vs 1re moitié, diviseur m1, seuil ±2 %).
function oldPaceTrend(points: PaceTrendPoint[]): 'improving' | 'declining' | 'stable' {
  if (points.length < 2) return 'stable';
  const n = points.length;
  const firstHalf = points.slice(0, Math.floor(n / 2));
  const secondHalf = points.slice(Math.ceil(n / 2));
  const avg = (xs: PaceTrendPoint[]) => xs.reduce((s, p) => s + p.paceSPerKm, 0) / xs.length;
  const m1 = avg(firstHalf), m2 = avg(secondHalf);
  const ratio = (m2 - m1) / m1;
  if (ratio < -0.02) return 'improving';
  if (ratio > 0.02) return 'declining';
  return 'stable';
}

function paces(values: readonly number[]): PaceTrendPoint[] {
  return values.map((paceSPerKm, i) => ({
    dayKey: `2026-07-${String(i + 1).padStart(2, '0')}`,
    paceSPerKm,
  }));
}

describe('paceTrend (refacto régression, iso-comportement)', () => {
  const series: readonly number[][] = [
    [360, 350, 345, 338], // s'améliore (allure ↓)
    [330, 335, 340, 348], // régresse (allure ↑)
    [350, 351, 349, 350], // stable
    [400, 380, 360, 340], // forte amélioration linéaire
  ];
  for (const s of series) {
    it(`concorde avec l'oracle : [${s.join(', ')}]`, () => {
      expect(paceTrend(paces(s))).toBe(oldPaceTrend(paces(s)));
    });
  }
  it('moins de 2 points → stable', () => expect(paceTrend(paces([345]))).toBe('stable'));

  // divergence attendue : non-monotonie / diviseur (m1 → moyenne de série + pente régression).
  // Oracle (moitiés) : 2e moitié [380, 350] moy. 365 vs 1re moitié [360, 340] moy. 350 →
  // ratio +4,3 % → 'declining'. Nouveau (pente régression sur 4 pts) : la pente nette sur la
  // fenêtre reste sous le seuil ±2 % → 'stable'. Valeur RÉELLE figée ci-dessous.
  it("divergence attendue : [360, 340, 380, 350] (non monotone) → 'stable' sous le nouveau moteur", () => {
    expect(paceTrend(paces([360, 340, 380, 350]))).toBe('stable');
  });
});

describe('formatDurationHms', () => {
  it('null / négatif → ""', () => { expect(formatDurationHms(null)).toBe(''); expect(formatDurationHms(-5)).toBe(''); });
  it('< 1 h → M min SS s', () => expect(formatDurationHms(1830)).toBe('30 min 30 s'));
  it('≥ 1 h → H h MM min SS s', () => expect(formatDurationHms(3930)).toBe('1 h 5 min 30 s'));
  it('0 → 0 min 0 s', () => expect(formatDurationHms(0)).toBe('0 min 0 s'));
});

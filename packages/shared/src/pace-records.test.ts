import { describe, expect, it } from 'vitest';
import {
  bestSegmentTimeFromSamples, bestSegmentTime, computeRunRecords, RUNNING_RECORD_DISTANCES,
} from './pace-records';
import type { GpsPoint } from './running';

describe('RUNNING_RECORD_DISTANCES', () => {
  it('les 5 distances attendues', () =>
    expect(RUNNING_RECORD_DISTANCES.map((d) => [d.key, d.meters])).toEqual([
      ['1k', 1000], ['5k', 5000], ['10k', 10000], ['semi', 21097.5], ['marathon', 42195],
    ]));
});

describe('bestSegmentTimeFromSamples', () => {
  const cum = [0, 1000, 2000, 3000, 4000, 5000];
  const t = [0, 300, 600, 900, 1200, 1500]; // 300 s/km constant
  it('1 km = 300 s (allure constante)', () => expect(bestSegmentTimeFromSamples(cum, t, 1000)).toBe(300));
  it('5 km = 1500 s', () => expect(bestSegmentTimeFromSamples(cum, t, 5000)).toBe(1500));
  it('choisit le km le plus rapide', () =>
    expect(bestSegmentTimeFromSamples([0, 1000, 2000], [0, 240, 600], 1000)).toBe(240));
  it('interpole t au franchissement (1500 m @ 300 s/km = 450 s)', () =>
    expect(bestSegmentTimeFromSamples([0, 1000, 2000], [0, 300, 600], 1500)).toBe(450));
  it('trace trop courte → null', () =>
    expect(bestSegmentTimeFromSamples([0, 1000], [0, 300], 5000)).toBeNull());
  it('segment sur zone outlier (0 m) pénalisé en temps', () => {
    // j=3 (cum=1500≥1000) : s0=500 ; while avance k à 2 (cum[1]=500 et cum[2]=500 ≤ 500) ;
    // frac=0, tStart=t[2]=250, seg=550-250=300.
    expect(bestSegmentTimeFromSamples([0, 500, 500, 1500], [0, 150, 250, 550], 1000)).toBe(300);
  });
});

describe('computeRunRecords (composition GPS, équateur)', () => {
  const pts: GpsPoint[] = [ { lat: 0, lng: 0, t: 0 }, { lat: 0, lng: 0.02, t: 600 } ]; // ~2.2 km
  it("n'inclut que les distances atteignables", () => {
    const rec = computeRunRecords(pts);
    expect(Object.keys(rec)).toContain('1k');
    expect(Object.keys(rec)).not.toContain('5k');
  });
  it('trace vide → aucun record', () => expect(computeRunRecords([])).toEqual({}));
});

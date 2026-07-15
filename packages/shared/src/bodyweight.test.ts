import { describe, expect, it } from 'vitest';
import { computeDeficitVolumeAlert } from './bodyweight';

describe('computeDeficitVolumeAlert', () => {
  const base = { targetKcal: 2500, weeklyVolume: 9000 }; // volume ≥ 8000
  it("pas d'alerte si < 4 jours loggés", () => {
    const r = computeDeficitVolumeAlert({ loggedDailyKcals: [2000, 2000, 2000], ...base });
    expect(r.show).toBe(false);
    expect(r.loggedDays).toBe(3);
  });
  it('alerte si ≥ 4 jours, déficit ≥ 15 %, volume ≥ 8000', () => {
    const r = computeDeficitVolumeAlert({ loggedDailyKcals: [2000, 2000, 2000, 2000], ...base });
    expect(r.show).toBe(true);
    expect(r.deficitPct).toBe(20);
  });
  it('moyenne sur jours loggés uniquement', () => {
    const r = computeDeficitVolumeAlert({ loggedDailyKcals: [2000, 2000, 2000, 2000], ...base });
    expect(r.show).toBe(true);
  });
  it("pas d'alerte si déficit < 15 %", () => {
    expect(
      computeDeficitVolumeAlert({ loggedDailyKcals: [2300, 2300, 2300, 2300], ...base }).show,
    ).toBe(false);
  });
  it("pas d'alerte si volume < 8000", () => {
    expect(
      computeDeficitVolumeAlert({
        loggedDailyKcals: [2000, 2000, 2000, 2000],
        targetKcal: 2500,
        weeklyVolume: 5000,
      }).show,
    ).toBe(false);
  });
  it('pas d’alerte si targetKcal <= 0', () => {
    expect(
      computeDeficitVolumeAlert({
        loggedDailyKcals: [2000, 2000, 2000, 2000],
        targetKcal: 0,
        weeklyVolume: 9000,
      }).show,
    ).toBe(false);
  });
});

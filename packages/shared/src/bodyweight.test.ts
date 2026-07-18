import { describe, expect, it } from 'vitest';
import { computeDeficitVolumeAlert, weightTrend } from './bodyweight';

// Oracle = ancienne implémentation (delta premier↔dernier, seuil ±0,3 kg).
function oldWeightTrend(weights: readonly number[]): 'up' | 'down' | 'stable' {
  if (weights.length < 2) return 'stable';
  const delta = weights[weights.length - 1]! - weights[0]!;
  if (delta > 0.3) return 'up';
  if (delta < -0.3) return 'down';
  return 'stable';
}

// Construit des entrées datées à jours consécutifs à partir d'un tableau de poids.
function dated(weights: readonly number[]): { logDate: string; weightKg: number }[] {
  return weights.map((weightKg, i) => ({
    logDate: `2026-07-${String(i + 1).padStart(2, '0')}`,
    weightKg,
  }));
}

describe('weightTrend (refacto régression, iso-comportement)', () => {
  const series: readonly number[][] = [
    [80, 79.5, 79, 78.4],   // monotone ↓
    [70, 70.4, 71, 71.6],   // monotone ↑
    [75, 75.1, 74.9, 75],   // plat (bruit < seuil)
    [82, 81.8, 81.9, 81.5], // quasi-linéaire ↓
    [68],                   // < 2 points
  ];
  for (const s of series) {
    it(`concorde avec l'oracle : [${s.join(', ')}]`, () => {
      expect(weightTrend(dated(s))).toBe(oldWeightTrend(s));
    });
  }

  // divergence attendue : non-monotonie / diviseur (m1 → moyenne de série + pente régression).
  // Oracle (delta 1er↔dernier) : 79 - 80 = -1 kg → 'down'. Nouveau (pente régression, poids
  // remonte au milieu) : pente positive sur la fenêtre → 'up'. Valeur RÉELLE figée ci-dessous.
  it("divergence attendue : [80, 78, 82, 79] (non monotone) → 'up' sous le nouveau moteur", () => {
    expect(weightTrend(dated([80, 78, 82, 79]))).toBe('up');
  });

  it('série vide → stable', () => expect(weightTrend([])).toBe('stable'));

  it('un seul jour (variance x nulle possible) → stable', () =>
    expect(weightTrend([{ logDate: '2026-07-01', weightKg: 80 }])).toBe('stable'));
});

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
  it("n'est pas dilué par les jours non loggés (moyenne sur jours loggés)", () => {
    // Moyenne réelle sur 4 jours = 2500 = objectif → déficit 0 % → pas d'alerte.
    // Une implémentation qui diviserait par 7 donnerait ~1428 → déficit ~43 % → alerte à tort.
    expect(
      computeDeficitVolumeAlert({
        loggedDailyKcals: [2500, 2500, 2500, 2500],
        targetKcal: 2500,
        weeklyVolume: 9000,
      }).show,
    ).toBe(false);
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
  it("pas d'alerte si targetKcal <= 0", () => {
    expect(
      computeDeficitVolumeAlert({
        loggedDailyKcals: [2000, 2000, 2000, 2000],
        targetKcal: 0,
        weeklyVolume: 9000,
      }).show,
    ).toBe(false);
  });
});

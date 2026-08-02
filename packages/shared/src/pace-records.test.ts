import { describe, expect, it } from 'vitest';
import {
  bestSegmentTimeFromSamples, bestSegmentTime, computeRunRecords, RUNNING_RECORD_DISTANCES,
  predictRaceTime, resolveRacePredictions,
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

describe('predictRaceTime (US RUN-14)', () => {
  it('référence connue : 5 km en 25 min → 10 km ≈ 52 min (exposant appliqué, pas une règle de trois)', () => {
    const predicted = predictRaceTime(1500, 5000, 10000);
    // Règle de trois naïve (allure constante) donnerait exactement 3000 s : l'exposant 1,06 doit
    // rendre le temps prédit strictement supérieur.
    expect(predicted).toBeGreaterThan(3000);
    expect(predicted).toBeCloseTo(3127.4, 0);
  });

  it('d2 === d1 → renvoie t1 inchangé (cas limite trivial)', () => {
    expect(predictRaceTime(1500, 5000, 5000)).toBe(1500);
  });

  it('croissance plus rapide que linéaire à mesure que la distance cible s’éloigne', () => {
    const t10k = predictRaceTime(1500, 5000, 10000);
    const tSemi = predictRaceTime(1500, 5000, 21097.5);
    const tMarathon = predictRaceTime(1500, 5000, 42195);
    // Si la formule était linéaire (allure constante), tSemi/t10k === 21097.5/10000 exactement.
    // L'exposant 1,06 doit rendre ce ratio strictement supérieur au ratio des distances.
    expect(tSemi / t10k).toBeGreaterThan(21097.5 / 10000);
    expect(tMarathon / tSemi).toBeGreaterThan(42195 / 21097.5);
  });
});

describe('resolveRacePredictions (US RUN-14, R1/R3)', () => {
  const fiveK = { distanceKey: '5k' as const, bestTimeSeconds: 1500, achievedAt: '2026-07-28T10:00:00.000Z' };

  it('aucun record 5 km → aucune prédiction (R1)', () => {
    expect(resolveRacePredictions([])).toEqual([]);
    expect(
      resolveRacePredictions([{ distanceKey: '1k', bestTimeSeconds: 240, achievedAt: '2026-07-01T00:00:00.000Z' }]),
    ).toEqual([]);
  });

  it('record 5 km seul → 3 prédictions (10 km, semi, marathon), dans cet ordre', () => {
    const preds = resolveRacePredictions([fiveK]);
    expect(preds.map((p) => p.distanceKey)).toEqual(['10k', 'semi', 'marathon']);
    expect(preds.every((p) => p.sourceTimeSeconds === 1500 && p.sourceAchievedAt === fiveK.achievedAt)).toBe(true);
  });

  it('un vrai record semi masque la prédiction semi, sans toucher aux autres (R3 — test central)', () => {
    const semiReal = { distanceKey: 'semi' as const, bestTimeSeconds: 6600, achievedAt: '2026-07-20T00:00:00.000Z' };
    const preds = resolveRacePredictions([fiveK, semiReal]);
    expect(preds.map((p) => p.distanceKey)).toEqual(['10k', 'marathon']);
  });

  it('un vrai record marathon masque la prédiction marathon, sans toucher aux autres (R3)', () => {
    const marathonReal = { distanceKey: 'marathon' as const, bestTimeSeconds: 13000, achievedAt: '2026-06-01T00:00:00.000Z' };
    const preds = resolveRacePredictions([fiveK, marathonReal]);
    expect(preds.map((p) => p.distanceKey)).toEqual(['10k', 'semi']);
  });
});

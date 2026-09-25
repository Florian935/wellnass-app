import { describe, expect, it } from 'vitest';
import { predictRaceTime } from './pace-records';
import { raceObjective } from './race-objective';

const REC_5K = { distanceKey: '5k' as const, bestTimeSeconds: 1420 };
const REC_10K = { distanceKey: '10k' as const, bestTimeSeconds: 3062 };

describe('raceObjective — R11 (Q9 : l’objectif face au chrono du jour)', () => {
  it('sans objectif chrono : rien', () => {
    expect(raceObjective({ targetTimeSeconds: null, raceDistanceM: 10000, records: [REC_5K] })).toBeNull();
  });

  it('distance de course inconnue : l’objectif seul', () => {
    expect(raceObjective({ targetTimeSeconds: 2940, raceDistanceM: null, records: [REC_5K] })).toEqual({
      targetSeconds: 2940,
      compareSeconds: null,
      compareKind: null,
    });
  });

  it('un vrai record à cette distance prime sur une estimation (RUN-14 R3)', () => {
    expect(raceObjective({ targetTimeSeconds: 2940, raceDistanceM: 10000, records: [REC_5K, REC_10K] })).toEqual({
      targetSeconds: 2940,
      compareSeconds: 3062,
      compareKind: 'record',
    });
  });

  it('sinon, l’estimation Riegel depuis le record 5 km, arrondie à la seconde', () => {
    const out = raceObjective({ targetTimeSeconds: 2940, raceDistanceM: 10000, records: [REC_5K] });
    expect(out).toEqual({
      targetSeconds: 2940,
      compareSeconds: Math.round(predictRaceTime(1420, 5000, 10000)),
      compareKind: 'estimate',
    });
  });

  it('🔴 un semi saisi en mètres entiers (21 097) retrouve le vrai record de semi (21 097,5)', () => {
    const REC_SEMI = { distanceKey: 'semi' as const, bestTimeSeconds: 6590 };
    const out = raceObjective({ targetTimeSeconds: 6300, raceDistanceM: 21097, records: [REC_5K, REC_SEMI] });
    expect(out).toEqual({ targetSeconds: 6300, compareSeconds: 6590, compareKind: 'record' });
  });

  it('une course de 5 km se compare au record 5 km lui-même', () => {
    expect(raceObjective({ targetTimeSeconds: 1380, raceDistanceM: 5000, records: [REC_5K] })?.compareKind).toBe('record');
  });

  it('une distance hors canon (15 km) s’estime depuis le 5 km', () => {
    const out = raceObjective({ targetTimeSeconds: 4800, raceDistanceM: 15000, records: [REC_5K, REC_10K] });
    expect(out?.compareKind).toBe('estimate');
    expect(out?.compareSeconds).toBe(Math.round(predictRaceTime(1420, 5000, 15000)));
  });

  it('ni record à la distance ni record 5 km : l’objectif seul', () => {
    expect(raceObjective({ targetTimeSeconds: 2940, raceDistanceM: 10000, records: [] })).toEqual({
      targetSeconds: 2940,
      compareSeconds: null,
      compareKind: null,
    });
  });

  it('🔴 un objectif nul ou négatif (saisie corrompue) ne s’affiche pas', () => {
    expect(raceObjective({ targetTimeSeconds: 0, raceDistanceM: 10000, records: [REC_5K] })).toBeNull();
  });
});

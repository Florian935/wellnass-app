import { describe, expect, it } from 'vitest';
import {
  RUN_FREE_TYPE,
  canRunAgain,
  recordCountsByRun,
  runDayKey,
  runMonthSummary,
  runTypeKey,
  runTypeSummaries,
  type RunHistoryLike,
} from './run-history';

const run = (over: Partial<RunHistoryLike> & { id: string }): RunHistoryLike => ({
  startedAt: '2026-09-18T16:30:00',
  finishedAt: '2026-09-18T17:14:00',
  distanceM: 7400,
  durationSeconds: 2650,
  avgPaceSPerKm: 358,
  sessionType: 'fractionne',
  ...over,
});

describe('runDayKey — R8', () => {
  it('le jour local de la fin de la course', () => {
    expect(runDayKey({ startedAt: '2026-09-18T16:30:00', finishedAt: '2026-09-18T17:14:00' })).toBe('2026-09-18');
  });

  it('à cheval sur minuit : rangée au jour de fin', () => {
    expect(runDayKey({ startedAt: '2026-09-18T23:40:00', finishedAt: '2026-09-19T00:20:00' })).toBe('2026-09-19');
  });

  it('sans fin : le jour du début', () => {
    expect(runDayKey({ startedAt: '2026-09-18T23:40:00', finishedAt: null })).toBe('2026-09-18');
  });
});

describe('canRunAgain — R5 (le seuil du fantôme, FANT-01)', () => {
  it('une sortie GPS d’au moins 500 m peut être recourue', () => {
    expect(canRunAgain({ source: 'gps', distanceM: 500 })).toBe(true);
    expect(canRunAgain({ source: 'gps', distanceM: 8100 })).toBe(true);
  });

  it('🔴 une sortie sans GPS (tapis, manuelle) n’a pas de trace : pas de fantôme', () => {
    expect(canRunAgain({ source: 'manual', distanceM: 6000 })).toBe(false);
  });

  it('une sortie trop courte, ou sans distance, non plus', () => {
    expect(canRunAgain({ source: 'gps', distanceM: 499 })).toBe(false);
    expect(canRunAgain({ source: 'gps', distanceM: null })).toBe(false);
  });
});

describe('recordCountsByRun — R7', () => {
  it('une course peut détenir plusieurs records', () => {
    const counts = recordCountsByRun(['r-1', 'r-2', 'r-1']);
    expect(counts.get('r-1')).toBe(2);
    expect(counts.get('r-2')).toBe(1);
    expect(counts.get('r-3')).toBeUndefined();
  });
});

describe('runMonthSummary — R9', () => {
  it('compte les sorties, la distance, la durée et les records détenus', () => {
    const runs = [
      run({ id: 'r-1', distanceM: 8100, durationSeconds: 2772 }),
      run({ id: 'r-2', distanceM: 5000, durationSeconds: 1420 }),
    ];
    expect(runMonthSummary(runs, recordCountsByRun(['r-2', 'r-2', 'r-9']))).toEqual({
      count: 2,
      distanceM: 13100,
      durationSeconds: 4192,
      records: 2,
    });
  });

  it('un mois vide vaut zéro partout', () => {
    expect(runMonthSummary([], new Map())).toEqual({ count: 0, distanceM: 0, durationSeconds: 0, records: 0 });
  });

  it('🔴 une sortie sans distance ni durée (manuelle incomplète) compte, sans fausser les totaux', () => {
    const runs = [run({ id: 'r-1', distanceM: null, durationSeconds: null }), run({ id: 'r-2' })];
    expect(runMonthSummary(runs, new Map())).toEqual({ count: 2, distanceM: 7400, durationSeconds: 2650, records: 0 });
  });
});

describe('runTypeSummaries — R10', () => {
  it('une course sans séance est rangée sous « course libre »', () => {
    expect(runTypeKey(null)).toBe(RUN_FREE_TYPE);
    expect(runTypeKey('sortie_longue')).toBe('sortie_longue');
  });

  it('un résumé par type, du plus récemment couru au plus ancien', () => {
    const runs = [
      run({ id: 'ef-2', finishedAt: '2026-09-23T07:50:00', sessionType: 'endurance' }),
      run({ id: 'libre-1', finishedAt: '2026-09-16T12:45:00', sessionType: null }),
      run({ id: 'frac-2', finishedAt: '2026-09-18T17:14:00', sessionType: 'fractionne' }),
      run({ id: 'ef-1', finishedAt: '2026-09-21T19:20:00', sessionType: 'endurance' }),
      run({ id: 'frac-1', finishedAt: '2026-09-11T17:14:00', sessionType: 'fractionne' }),
    ];
    const summaries = runTypeSummaries(runs);
    expect(summaries.map((s) => [s.type, s.count, s.lastRunId])).toEqual([
      ['endurance', 2, 'ef-2'],
      ['fractionne', 2, 'frac-2'],
      [RUN_FREE_TYPE, 1, 'libre-1'],
    ]);
    expect(summaries[1]).toMatchObject({
      lastDayKey: '2026-09-18',
      lastDistanceM: 7400,
      lastAvgPaceSPerKm: 358,
    });
  });

  it('les courses non terminées ne comptent pas', () => {
    expect(runTypeSummaries([run({ id: 'x', finishedAt: null })])).toEqual([]);
  });

  it('aucune course : aucun type', () => {
    expect(runTypeSummaries([])).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';

import { addDays, localDateFromDayKey, localDayKey } from './date';
import {
  LAB_ASSOCIATION_MIN_CASES,
  LAB_EXPERIMENT_TEMPLATES,
  LAB_MIN_OBSERVATIONS_PER_ARM,
  buildLabKnowledge,
  drawExperimentSchedule,
  experimentAdherence,
  experimentProgress,
  experimentVerdict,
  type LabExperimentRecord,
  type LabVerdict,
} from './lab-experiments';

// L'expérience démarre le lundi 21 septembre 2026 et finit le dimanche 18 octobre.
const START = '2026-09-21';
const day = (offset: number) => localDayKey(addDays(localDateFromDayKey(START), offset));

const record = (over: Partial<LabExperimentRecord> = {}): LabExperimentRecord => ({
  id: 'exp-1',
  kind: 'legs48h',
  startKey: START,
  schedule: ['test', 'usual', 'usual', 'test'],
  status: 'running',
  ...over,
});

describe('drawExperimentSchedule', () => {
  it('rend toujours deux semaines « essai » et deux « habitude », bornées aux six ordres', () => {
    expect(drawExperimentSchedule(0)).toEqual(['test', 'test', 'usual', 'usual']);
    expect(drawExperimentSchedule(0.5)).toEqual(['usual', 'test', 'test', 'usual']);
    expect(drawExperimentSchedule(0.9999)).toEqual(['usual', 'usual', 'test', 'test']);
    expect(drawExperimentSchedule(1)).toEqual(['usual', 'usual', 'test', 'test']);
    expect(drawExperimentSchedule(-1)).toEqual(['test', 'test', 'usual', 'usual']);
    for (let r = 0; r < 1; r += 0.1) expect(drawExperimentSchedule(r).filter((a) => a === 'test')).toHaveLength(2);
  });
});

describe('experimentProgress', () => {
  it('avant le début, pendant, et une fois fini', () => {
    expect(experimentProgress(record(), day(-3))).toEqual({ day: 0, totalDays: 28, weekIndex: null, arm: null, finished: false, endKey: day(27) });
    expect(experimentProgress(record(), day(0))).toMatchObject({ day: 1, weekIndex: 0, arm: 'test', finished: false });
    expect(experimentProgress(record(), day(9))).toMatchObject({ day: 10, weekIndex: 1, arm: 'usual' });
    expect(experimentProgress(record(), day(27))).toMatchObject({ day: 28, weekIndex: 3, arm: 'test', finished: false });
    expect(experimentProgress(record(), day(28))).toMatchObject({ day: 28, weekIndex: null, arm: null, finished: true });
  });
});

describe('experimentVerdict', () => {
  const obs = (offsets: number[], value: number) => offsets.map((o) => ({ dayKey: day(o), value }));
  const done = day(30);

  it('reste scellé pendant l’expérience, et n’a pas de verdict une fois arrêtée', () => {
    expect(experimentVerdict({ record: record(), todayKey: day(5), observations: [], adherence: [] })).toEqual({ status: 'sealed', endKey: day(27) });
    expect(experimentVerdict({ record: record({ status: 'stopped' }), todayKey: done, observations: [], adherence: [] })).toEqual({ status: 'stopped' });
  });

  it('conclut à un effet quand l’écart dépasse le seuil, dans le bon sens', () => {
    const observations = [...obs([2, 5, 23, 26], 296), ...obs([9, 12, 16, 19], 302), ...obs([-4, 40], 250)];
    const v = experimentVerdict({ record: record(), todayKey: done, observations, adherence: [true, true, true, true] });
    expect(v).toEqual({ status: 'effect', delta: -6, better: true, testCount: 4, usualCount: 4 });
  });

  it('une semaine « essai » non tenue sort du bras essai', () => {
    const observations = [...obs([2, 5], 296), ...obs([23, 26], 320), ...obs([9, 12, 16, 19], 302)];
    const v = experimentVerdict({ record: record(), todayKey: done, observations, adherence: [true, true, true, false] });
    expect(v).toMatchObject({ status: 'effect', delta: -6, testCount: 2 });
  });

  it('pas d’effet net sous le seuil ; un effet contraire est dit ; l’énergie monte pour être meilleure', () => {
    const flat = [...obs([2, 23], 300), ...obs([9, 16], 301)];
    expect(experimentVerdict({ record: record(), todayKey: done, observations: flat, adherence: [true, true, true, true] })).toMatchObject({ status: 'noEffect', delta: -1, better: true });
    const worse = [...obs([2, 23], 310), ...obs([9, 16], 300)];
    expect(experimentVerdict({ record: record(), todayKey: done, observations: worse, adherence: [true, true, true, true] })).toMatchObject({ status: 'effect', better: false });
    const energy = [...obs([2, 23], 4), ...obs([9, 16], 3)];
    expect(
      experimentVerdict({ record: record({ kind: 'earlierBedtime' }), todayKey: done, observations: energy, adherence: [true, true, true, true] }),
    ).toMatchObject({ status: 'effect', delta: 1, better: true });
  });

  it('pas de verdict sans assez de mesures dans chaque bras', () => {
    const v = experimentVerdict({ record: record(), todayKey: done, observations: obs([2, 9, 16], 300), adherence: [true, true, true, true] });
    expect(v).toEqual({ status: 'insufficient', testCount: 1, usualCount: 2, needed: LAB_MIN_OBSERVATIONS_PER_ARM });
  });
});

describe('experimentAdherence', () => {
  const base = { heavyLegDays: [] as string[], qualityRunDays: [] as string[], carbsByDay: [] as { dayKey: string; gPerKg: number }[], carbsHardMinGPerKg: 5 as number | null, nights: [] as { dayKey: string; sleepMinutes: number }[] };

  it('legs48h : tenue sans jambes lourdes la veille d’une séance de qualité', () => {
    const r = record();
    expect(experimentAdherence({ ...base, record: r, qualityRunDays: [day(3), day(24)], heavyLegDays: [day(23)] })).toEqual([true, true, true, false]);
  });

  it('carbsHardDays : glucides au-dessus de la borne tous les jours de qualité', () => {
    const r = record({ kind: 'carbsHardDays' });
    const runs = [day(3), day(24)];
    expect(experimentAdherence({ ...base, record: r, qualityRunDays: runs, carbsByDay: [{ dayKey: day(3), gPerKg: 5.2 }, { dayKey: day(24), gPerKg: 4.1 }] })).toEqual([true, true, true, false]);
    expect(experimentAdherence({ ...base, record: r, qualityRunDays: runs, carbsByDay: [] })).toEqual([false, true, true, false]);
    expect(experimentAdherence({ ...base, record: r, qualityRunDays: runs, carbsHardMinGPerKg: null, carbsByDay: [{ dayKey: day(3), gPerKg: 6 }] })).toEqual([false, true, true, false]);
  });

  it('earlierBedtime : 7 h 30 de moyenne sur les nuits saisies de la semaine', () => {
    const r = record({ kind: 'earlierBedtime' });
    const nights = [{ dayKey: day(1), sleepMinutes: 460 }, { dayKey: day(2), sleepMinutes: 450 }, { dayKey: day(22), sleepMinutes: 400 }];
    expect(experimentAdherence({ ...base, record: r, nights })).toEqual([true, true, true, false]);
    expect(experimentAdherence({ ...base, record: r })).toEqual([false, true, true, false]);
  });
});

describe('buildLabKnowledge', () => {
  const runsOn = (offsets: number[], pace: number) => offsets.map((o) => ({ dayKey: day(o), paceSPerKm: pace }));
  const knowledge = (over: Partial<Parameters<typeof buildLabKnowledge>[0]> = {}) =>
    buildLabKnowledge({
      activePillars: ['strength', 'running', 'nutrition'],
      weightKg: 80,
      carbsHardMinGPerKg: 5,
      qualityRuns: [],
      nights: [],
      heavyLegDays: [],
      carbsByDay: [],
      experiments: [],
      ...over,
    });

  it('transforme les verdicts rendus en acquis, ignore les scellés et les arrêtés', () => {
    const r = record();
    const verdicts: LabVerdict[] = [
      { status: 'sealed', endKey: day(27) },
      { status: 'stopped' },
      { status: 'effect', delta: -6, better: true, testCount: 4, usualCount: 4 },
      { status: 'effect', delta: 5, better: false, testCount: 4, usualCount: 4 },
      { status: 'noEffect', delta: -1, better: true, testCount: 4, usualCount: 4 },
      { status: 'insufficient', testCount: 1, usualCount: 3, needed: 2 },
    ];
    const cards = knowledge({ activePillars: [], experiments: verdicts.map((verdict, i) => ({ record: { ...r, id: `e${i}` }, verdict })) });
    expect(cards.map((c) => [c.id, c.status, c.values])).toEqual([
      ['experiment:e2', 'verified', { delta: -6 }],
      ['experiment:e3', 'contrary', { delta: 5 }],
      ['experiment:e4', 'noEffect', { delta: -1 }],
      ['experiment:e5', 'inconclusive', { testCount: 1, usualCount: 3 }],
    ]);
    expect(cards[0]).toMatchObject({ source: 'experiment', kind: 'legs48h', pair: LAB_EXPERIMENT_TEMPLATES.legs48h.pair, usedBy: null });
  });

  it('nuit courte × allure : en apprentissage, puis probable, solide ou sans lien', () => {
    const nights = (offsets: number[], minutes: number) => offsets.map((o) => ({ dayKey: day(o), sleepMinutes: minutes }));
    const learning = knowledge({ qualityRuns: runsOn([1, 2], 305), nights: nights([1, 2], 330) })[0]!;
    expect(learning).toMatchObject({ kind: 'shortNightPace', status: 'learning', values: { cases: 0, needed: LAB_ASSOCIATION_MIN_CASES }, usedBy: 'shortNight' });

    const probable = knowledge({
      qualityRuns: [...runsOn([1, 2, 3], 306), ...runsOn([4, 5, 6, 7], 300), ...runsOn([8], 280)],
      nights: [...nights([1, 2, 3], 330), ...nights([4, 5, 6, 7], 450), ...nights([8], 400)],
    })[0]!;
    expect(probable).toMatchObject({ status: 'probable', values: { delta: 6, exposed: 3, other: 4 } });

    const offsets = [1, 2, 3, 4, 5, 6];
    const solid = knowledge({ qualityRuns: [...runsOn(offsets, 305), ...runsOn(offsets.map((o) => o + 10), 300)], nights: [...nights(offsets, 330), ...nights(offsets.map((o) => o + 10), 460)] })[0]!;
    expect(solid.status).toBe('solid');

    const noLink = knowledge({ qualityRuns: [...runsOn([1, 2, 3], 301), ...runsOn([4, 5, 6], 300)], nights: [...nights([1, 2, 3], 330), ...nights([4, 5, 6], 460)] })[0]!;
    expect(noLink.status).toBe('noLink');
  });

  it('jambes × allure et glucides × allure, seulement avec leurs piliers et leurs cibles', () => {
    const runs = runsOn([2, 4, 6, 9, 11, 13], 300);
    const cards = knowledge({
      qualityRuns: runs,
      heavyLegDays: [day(1), day(3), day(5)],
      carbsByDay: [2, 4, 6].map((o) => ({ dayKey: day(o), carbsG: 320 })).concat([9, 11, 13].map((o) => ({ dayKey: day(o), carbsG: 480 }))),
    });
    expect(cards.map((c) => c.kind)).toEqual(['shortNightPace', 'heavyLegsPace', 'carbsPace']);
    expect(cards[1]).toMatchObject({ status: 'noLink', usedBy: 'collision', pair: ['strength', 'running'] });
    expect(cards[2]).toMatchObject({ status: 'noLink', usedBy: 'carbs', values: { exposed: 3, other: 3 } });

    expect(knowledge({ activePillars: ['running'] }).map((c) => c.kind)).toEqual(['shortNightPace']);
    expect(knowledge({ activePillars: ['running', 'nutrition'], carbsHardMinGPerKg: null }).map((c) => c.kind)).toEqual(['shortNightPace']);
    expect(knowledge({ activePillars: ['running', 'nutrition'], weightKg: null }).map((c) => c.kind)).toEqual(['shortNightPace']);
    expect(knowledge({ activePillars: ['strength', 'nutrition'] })).toEqual([]);
  });
});

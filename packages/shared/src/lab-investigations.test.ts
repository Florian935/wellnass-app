import { describe, expect, it } from 'vitest';

import { addDays, localDateFromDayKey, localDayKey } from './date';
import {
  LAB_MAX_SUSPECTS,
  PACE_FADE_S_PER_KM,
  buildLabQuestions,
  type LabHistoryInput,
} from './lab-investigations';

// Aujourd'hui : mardi 15 septembre 2026. Fenêtre récente : du 26/08 au 15/09 ; avant : du 05/08 au 25/08.
const TODAY = '2026-09-15';
const d = (offset: number) => localDayKey(addDays(localDateFromDayKey(TODAY), offset));

const PLATEAU = [100, 105, 110, 115, 120, 121, 120, null];

function input(over: Partial<LabHistoryInput> = {}): LabHistoryInput {
  return {
    todayKey: TODAY,
    activePillars: ['strength', 'running', 'nutrition'],
    objective: 'maintain',
    weightKg: 77.6,
    proteinMinGPerKg: 1.8,
    targetKcal: 2500,
    carbsHardMinGPerKg: 5,
    lifts: [],
    weights: [],
    qualityRuns: [],
    strengthDays: [],
    nutritionDays: [],
    nights: [],
    loads: [],
    ...over,
  };
}

/** Cinq jours de semaine récents (mer 26/08 → lun 14/09). */
const RECENT_WEEKDAYS = [-1, -6, -7, -8, -13];
const food = (offsets: number[], over: { kcal?: number; proteinG?: number; carbsG?: number } = {}) =>
  offsets.map((o) => ({ dayKey: d(o), kcal: 2500, proteinG: 150, carbsG: 450, ...over }));

describe('buildLabQuestions — la force qui cale', () => {
  it('détecte le premier exercice à plat, passe ceux qui progressent ou manquent de données', () => {
    const [q] = buildLabQuestions(
      input({
        lifts: [
          { exerciseId: 'bench', name: 'Développé couché', weeks: [60, 62, 64, 66, 68, 70, 72, 74] },
          { exerciseId: 'dead', name: 'Soulevé de terre', weeks: [null, null, null, null, 150, 151, 152, 153] },
          { exerciseId: 'ohp', name: 'Développé militaire', weeks: [40, 41, 42, 43, 44, 45, null, null] },
          { exerciseId: 'squat', name: 'Squat', weeks: PLATEAU },
        ],
      }),
    );
    expect(q).toMatchObject({ id: 'liftPlateau:squat', kind: 'liftPlateau', values: { exerciseName: 'Squat', valueKg: 121, weeksFlat: 3 }, flatFrom: 5 });
    expect(q!.series).toEqual(PLATEAU);
  });

  it('classe les suspects par force, écarte ce qui n’a pas bougé, garde les trois premiers', () => {
    const [q] = buildLabQuestions(
      input({
        lifts: [{ exerciseId: 'squat', name: 'Squat', weeks: PLATEAU }],
        // Deux séances de qualité sur trois précédées de jambes lourdes.
        qualityRuns: [d(-2), d(-9), d(-16)].map((dayKey) => ({ dayKey, paceSPerKm: 300 })),
        strengthDays: [{ dayKey: d(-3), heavyLegs: true }, { dayKey: d(-10), heavyLegs: true }, { dayKey: d(-17), heavyLegs: false }],
        // 116 g/j pour 77,6 kg = 1,5 g/kg (écart 17 %) ; 2 100 kcal pour 2 500 (déficit 16 %).
        nutritionDays: food(RECENT_WEEKDAYS, { kcal: 2100, proteinG: 116 }),
        nights: RECENT_WEEKDAYS.map((o) => ({ dayKey: d(o), sleepMinutes: 400 })),
        loads: [{ dayKey: d(-5), load: 1000 }, { dayKey: d(-30), load: 1000 }],
      }),
    );
    expect(q!.suspects.map((s) => [s.kind, s.level])).toEqual([
      ['proteinLow', 'strong'],
      ['legsBeforeQuality', 'strong'],
      ['deficit', 'medium'],
    ]);
    expect(q!.suspects).toHaveLength(LAB_MAX_SUSPECTS);
    expect(q!.suspects[0]).toMatchObject({ values: { gPerKg: 1.5, targetMin: 1.8 }, proposal: 'protein', experiment: null, pair: ['nutrition', 'strength'] });
    expect(q!.suspects[1]!.values).toEqual({ count: 2, runs: 3 });
    expect(q!.suspects[2]!.values).toEqual({ avgKcal: 2100, targetKcal: 2500, deficitPct: 16 });
    expect(q!.cleared).toEqual(['loadHigh']);
    expect(q!.missing).toEqual([]);
    // La première expérience disponible parmi les suspects : jambes 48 h.
    expect(q!.experiment).toBe('legs48h');
    expect(q!.focus).toEqual(['nutrition', 'strength']);
  });

  it('un suspect faible, un sommeil moyen, une charge qui monte', () => {
    const [q] = buildLabQuestions(
      input({
        activePillars: ['strength'],
        lifts: [{ exerciseId: 'squat', name: 'Squat', weeks: PLATEAU }],
        nights: RECENT_WEEKDAYS.map((o) => ({ dayKey: d(o), sleepMinutes: 390 })),
        loads: [{ dayKey: d(-5), load: 1250 }, { dayKey: d(-30), load: 1000 }],
      }),
    );
    expect(q!.suspects.map((s) => [s.kind, s.level, s.effect])).toEqual([
      ['sleepShort', 'medium', 0.5],
      ['loadHigh', 'medium', 0.5],
    ]);
    expect(q!.suspects[0]).toMatchObject({ values: { avgMinutes: 390 }, experiment: 'earlierBedtime', pair: ['sleep', 'strength'] });
    expect(q!.suspects[1]!.values).toEqual({ changePct: 25 });
    // Musculation seule : ni jambes × course, ni facteurs d'alimentation n'entrent dans l'enquête.
    expect(q!.missing).toEqual([]);
    expect(q!.focus).toEqual(['sleep', 'strength']);

    const weak = buildLabQuestions(
      input({ activePillars: ['strength'], lifts: [{ exerciseId: 'squat', name: 'Squat', weeks: PLATEAU }], loads: [{ dayKey: d(-5), load: 1150 }, { dayKey: d(-30), load: 1000 }] }),
    )[0]!;
    expect(weak.suspects[0]).toMatchObject({ kind: 'loadHigh', level: 'weak', effect: 0.17 });
  });

  it('sans données, tout est « à mesurer » et la scène regarde la musculation', () => {
    const [q] = buildLabQuestions(
      input({
        lifts: [{ exerciseId: 'squat', name: 'Squat', weeks: PLATEAU }],
        weightKg: null,
        targetKcal: null,
        nutritionDays: food(RECENT_WEEKDAYS),
        // Des séances hors fenêtre récente ne comptent pas pour « jambes × qualité ».
        qualityRuns: [{ dayKey: d(-30), paceSPerKm: 300 }],
        loads: [{ dayKey: d(-5), load: 1000 }],
      }),
    );
    expect(q!.suspects).toEqual([]);
    expect(q!.missing).toEqual(['legsBeforeQuality', 'proteinLow', 'deficit', 'sleepShort', 'loadHigh']);
    expect(q!.focus).toEqual(['strength']);
    expect(q!.experiment).toBeNull();

    const fewDays = buildLabQuestions(input({ lifts: [{ exerciseId: 's', name: 'S', weeks: PLATEAU }], nutritionDays: food([-1, -2]) }))[0]!;
    expect(fewDays.missing).toContain('proteinLow');
    expect(fewDays.missing).toContain('deficit');
  });
});

describe('buildLabQuestions — l’allure qui ralentit', () => {
  const runs = [300, 300, 300, 300, 306, 306, 306].map((pace, i) => ({ dayKey: d(-6 * (6 - i) - 1), paceSPerKm: pace }));

  it('ouvre une enquête quand les trois dernières séances ralentissent', () => {
    const [q] = buildLabQuestions(
      input({
        activePillars: ['running', 'strength', 'nutrition'],
        qualityRuns: runs,
        nights: RECENT_WEEKDAYS.map((o) => ({ dayKey: d(o), sleepMinutes: 340 })),
        strengthDays: [{ dayKey: d(-8), heavyLegs: true }],
        nutritionDays: runs.map((r) => ({ dayKey: r.dayKey, kcal: 2500, proteinG: 150, carbsG: 310 })),
      }),
    );
    expect(q).toMatchObject({ id: 'paceFade', values: { recentPace: 306, previousPace: 300, deltaS: 6 }, flatFrom: 4 });
    expect(q!.series).toHaveLength(7);
    // Sommeil, glucides des jours de qualité (4,0 g/kg pour 5) et jambes la veille (1 sur 3).
    expect(q!.suspects.map((s) => s.kind)).toEqual(['sleepShort', 'carbsLowHardDays', 'legsBeforeQuality']);
    expect(q!.suspects[0]!.pair).toEqual(['sleep', 'running']);
    expect(q!.suspects[1]).toMatchObject({ values: { gPerKg: 4, targetMin: 5 }, experiment: 'carbsHardDays' });
    expect(q!.missing).toEqual(['loadHigh']);
    expect(q!.focus).toEqual(['sleep', 'running']);
  });

  it('ne garde que les huit dernières séances, et se tait sous le seuil ou sans assez de séances', () => {
    const older = [{ dayKey: d(-77), paceSPerKm: 200 }, { dayKey: d(-70), paceSPerKm: 200 }];
    expect(buildLabQuestions(input({ activePillars: ['running'], qualityRuns: [...older, ...runs] }))[0]!.series).toHaveLength(8);
    expect(buildLabQuestions(input({ activePillars: ['running'], qualityRuns: runs.slice(0, 4) }))).toEqual([]);
    const flat = runs.map((r) => ({ ...r, paceSPerKm: 300 + (r.paceSPerKm > 300 ? PACE_FADE_S_PER_KM - 1 : 0) }));
    expect(buildLabQuestions(input({ activePillars: ['running'], qualityRuns: flat }))).toEqual([]);
  });

  it('course seule : ni jambes, ni glucides ; sans suspect, la scène regarde la course', () => {
    const [q] = buildLabQuestions(input({ activePillars: ['running'], qualityRuns: runs, carbsHardMinGPerKg: null }));
    expect(q!.missing).toEqual(['sleepShort', 'loadHigh']);
    expect(q!.focus).toEqual(['running']);
    const noCarbTarget = buildLabQuestions(input({ activePillars: ['running', 'nutrition'], qualityRuns: runs, carbsHardMinGPerKg: null }))[0]!;
    expect(noCarbTarget.missing).toContain('carbsLowHardDays');
    const noWeight = buildLabQuestions(input({ activePillars: ['running', 'nutrition'], qualityRuns: runs, weightKg: null }))[0]!;
    expect(noWeight.missing).toContain('carbsLowHardDays');
    const oneDay = buildLabQuestions(input({ activePillars: ['running', 'nutrition'], qualityRuns: runs, nutritionDays: food([-1]) }))[0]!;
    expect(oneDay.missing).toContain('carbsLowHardDays');
  });
});

describe('buildLabQuestions — le poids qui ne descend plus', () => {
  const flatWeights = [-1, -2, -4, -6, -8, -10, -12, -40].map((o, i) => ({ dayKey: d(o), weightKg: 76.4 + (i % 2) * 0.2 }));

  it('en perte de poids, sur une pente à plat : week-ends et jours sans saisie', () => {
    const [q] = buildLabQuestions(
      input({
        activePillars: ['nutrition'],
        objective: 'weightloss',
        weights: flatWeights,
        nutritionDays: [...food([-2, -3], { kcal: 3000 }), ...food(RECENT_WEEKDAYS, { kcal: 2400 })],
      }),
    );
    expect(q).toMatchObject({ id: 'weightPlateau', focus: ['nutrition'], experiment: null, flatFrom: 5 });
    expect(q!.values).toEqual({ avgKg: 76.5, rangeKg: 0.2, weeks: 3 });
    expect(q!.series).toHaveLength(8);
    expect(q!.series[7]).toBe(76.5);
    expect(q!.series[0]).toBeNull();
    // +600 kcal le week-end vaut 1 ; 14 jours sans saisie sur 21 aussi.
    expect(q!.suspects.map((s) => [s.kind, s.effect])).toEqual([
      ['weekendSurplus', 1],
      ['journalGaps', 1],
    ]);
    expect(q!.suspects[0]!.pair).toEqual(['nutrition', 'nutrition']);
    expect(q!.suspects[1]!.values).toEqual({ gaps: 14, days: 21 });
  });

  it('se tait hors objectif de perte, sans assez de pesées, ou quand le poids descend encore', () => {
    expect(buildLabQuestions(input({ activePillars: ['nutrition'], objective: 'maintain', weights: flatWeights }))).toEqual([]);
    expect(buildLabQuestions(input({ activePillars: ['nutrition'], objective: 'cut', weights: flatWeights.slice(0, 5) }))).toEqual([]);
    const losing = [-1, -3, -5, -8, -11, -14, -17, -20].map((o) => ({ dayKey: d(o), weightKg: 76 - o * 0.1 }));
    expect(buildLabQuestions(input({ activePillars: ['nutrition'], objective: 'weightloss', weights: losing }))).toEqual([]);
  });

  it('journal complet et week-ends sages : tout est écarté ; trop peu de week-ends : manquant', () => {
    const everyDay = Array.from({ length: 21 }, (_, i) => ({ dayKey: d(-i), kcal: 2300, proteinG: 150, carbsG: 300 }));
    const [q] = buildLabQuestions(input({ activePillars: ['nutrition'], objective: 'cut', weights: flatWeights, nutritionDays: everyDay }));
    expect(q!.suspects).toEqual([]);
    expect(q!.cleared).toEqual(['weekendSurplus', 'journalGaps']);
    const [few] = buildLabQuestions(input({ activePillars: ['nutrition'], objective: 'cut', weights: flatWeights, nutritionDays: food(RECENT_WEEKDAYS) }));
    expect(few!.missing).toEqual(['weekendSurplus']);
  });
});

describe('buildLabQuestions — piliers', () => {
  it('ne pose aucune question sur un pilier désactivé', () => {
    expect(
      buildLabQuestions(
        input({ activePillars: [], lifts: [{ exerciseId: 's', name: 'S', weeks: PLATEAU }], objective: 'cut', qualityRuns: [] }),
      ),
    ).toEqual([]);
  });
});

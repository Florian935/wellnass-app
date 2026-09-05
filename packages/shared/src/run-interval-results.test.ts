/** US RUN-F4 (lot F) — le realise descend au niveau de la repetition. */
import { describe, expect, it } from 'vitest';
import {
  buildIntervalDraft,
  summarizeIntervalSeries,
  type RunIntervalRow,
} from './run-interval-results';
import { expandIntervalPhases, type IntervalPhaseBlockInput } from './running-intervals';

function block(overrides: Partial<IntervalPhaseBlockInput> = {}): IntervalPhaseBlockInput {
  return {
    reps: 1,
    fastDistanceM: null,
    fastDurationSeconds: null,
    fastPacePctVma: null,
    recoveryDistanceM: null,
    recoveryDurationSeconds: null,
    ...overrides,
  };
}

function row(overrides: Partial<RunIntervalRow> = {}): RunIntervalRow {
  return {
    phaseIndex: 0,
    phaseKind: 'fast',
    segmentKind: 'work',
    rep: 1,
    totalReps: 1,
    plannedDistanceM: 400,
    plannedDurationSeconds: null,
    plannedPaceMinSPerKm: null,
    plannedPaceMaxSPerKm: null,
    actualDistanceM: 400,
    actualDurationSeconds: 98,
    actualPaceSPerKm: 245,
    ...overrides,
  };
}

describe('buildIntervalDraft', () => {
  const [fastPhase] = expandIntervalPhases([
    block({ fastDistanceM: 400, fastPaceMinSPerKm: 245, fastPaceMaxSPerKm: 250 }),
  ]);

  it('fige le prevu et mesure le realise', () => {
    const draft = buildIntervalDraft({
      phaseIndex: 3,
      phase: fastPhase!,
      actualDistanceM: 402,
      actualDurationSeconds: 100,
    });
    expect(draft.phaseIndex).toBe(3);
    expect(draft.phaseKind).toBe('fast');
    expect(draft.plannedDistanceM).toBe(400);
    expect(draft.plannedPaceMinSPerKm).toBe(245);
    expect(draft.actualDistanceM).toBe(402);
    expect(draft.actualPaceSPerKm).toBeCloseTo((100 * 1000) / 402, 5);
  });

  it("rend une allure nulle plutot qu'Infinity si rien n'a ete parcouru", () => {
    const draft = buildIntervalDraft({
      phaseIndex: 0,
      phase: fastPhase!,
      actualDistanceM: 0,
      actualDurationSeconds: 12,
    });
    expect(draft.actualPaceSPerKm).toBeNull();
  });

  it('accepte une plage prevue resolue par l appelant (%VMA converti)', () => {
    const [pctPhase] = expandIntervalPhases([block({ fastDistanceM: 400, fastPacePctVma: 95 })]);
    const draft = buildIntervalDraft({
      phaseIndex: 0,
      phase: pctPhase!,
      actualDistanceM: 400,
      actualDurationSeconds: 98,
      plannedPace: { minSPerKm: 240, maxSPerKm: 240 },
    });
    // Le module ne connait pas le profil coureur et ne doit pas le connaitre.
    expect(draft.plannedPaceMinSPerKm).toBe(240);
  });
});

describe('summarizeIntervalSeries', () => {
  it('ne resume que les fractions rapides, jamais les recuperations', () => {
    // Melanger 4:00/km et 6:30/km rendrait moyenne et ecart-type illisibles — meme piege que
    // la polarisation ponderee par les courses plutot que par les kilometres (RUN-08).
    const summary = summarizeIntervalSeries([
      row({ phaseIndex: 0, actualPaceSPerKm: 240 }),
      row({ phaseIndex: 1, phaseKind: 'recovery', actualPaceSPerKm: 390 }),
      row({ phaseIndex: 2, actualPaceSPerKm: 250 }),
    ]);
    expect(summary.fastCount).toBe(2);
    expect(summary.avgFastPaceSPerKm).toBe(245);
  });

  it('mesure la regularite — le vrai sujet d une seance de VMA', () => {
    const regular = summarizeIntervalSeries([
      row({ phaseIndex: 0, actualPaceSPerKm: 245 }),
      row({ phaseIndex: 1, actualPaceSPerKm: 245 }),
    ]);
    expect(regular.paceStdDevSPerKm).toBe(0);

    const irregular = summarizeIntervalSeries([
      row({ phaseIndex: 0, actualPaceSPerKm: 240 }),
      row({ phaseIndex: 1, actualPaceSPerKm: 280 }),
    ]);
    expect(irregular.paceStdDevSPerKm).toBe(20);
  });

  it('designe la fraction la plus lente — « la 7e a lache »', () => {
    const summary = summarizeIntervalSeries([
      row({ phaseIndex: 0, actualPaceSPerKm: 241 }),
      row({ phaseIndex: 1, actualPaceSPerKm: 280 }),
      row({ phaseIndex: 2, actualPaceSPerKm: 239 }),
    ]);
    expect(summary.slowestRep).toBe(2);
    expect(summary.fastestRep).toBe(3);
  });

  it("ne designe ni plus lente ni plus rapide sur une seule fraction", () => {
    // Il n'y a pas de serie : le classement n'aurait aucun sens.
    const summary = summarizeIntervalSeries([row()]);
    expect(summary.slowestRep).toBeNull();
    expect(summary.fastestRep).toBeNull();
  });

  it('compte les fractions tenues dans la plage, et celles qui avaient une plage', () => {
    const summary = summarizeIntervalSeries([
      row({ phaseIndex: 0, actualPaceSPerKm: 246, plannedPaceMinSPerKm: 245, plannedPaceMaxSPerKm: 250 }),
      row({ phaseIndex: 1, actualPaceSPerKm: 268, plannedPaceMinSPerKm: 245, plannedPaceMaxSPerKm: 250 }),
      row({ phaseIndex: 2, actualPaceSPerKm: 246 }), // aucune plage prevue
    ]);
    expect(summary.inRangeCount).toBe(1);
    expect(summary.ratedCount).toBe(2);
  });

  it('reste silencieux sans aucune fraction mesurable', () => {
    const summary = summarizeIntervalSeries([row({ actualPaceSPerKm: null })]);
    expect(summary.avgFastPaceSPerKm).toBeNull();
    expect(summary.paceStdDevSPerKm).toBeNull();
    expect(summary.fastCount).toBe(1);
  });

  it('une serie vide ne leve pas', () => {
    expect(summarizeIntervalSeries([]).fastCount).toBe(0);
  });
});

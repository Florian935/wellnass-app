/** US RUN-F4 (lot F) — le realise descend au niveau de la repetition. */
import { describe, expect, it } from 'vitest';
import {
  buildIntervalDraft,
  summarizeIntervalSeries,
  type RunIntervalRow,
} from './run-interval-results';
import { lastTimeReps, repsInRange } from './run-last-time';
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

/**
 * US CARDIO-08 — « X sur Y dans la plage » sans l'échauffement.
 *
 * `expandIntervalPhases` développe CHAQUE segment en phase `fast` (RUN-F4 lot B) : l'échauffement,
 * les gammes, le retour au calme et un segment de nature « récupération » passaient pour des
 * fractions dans l'analyse, alors que le hub (`lastTimeReps`) ne compte que le corps de séance.
 * Pour une même sortie, les deux chiffres doivent dire la même chose.
 */
describe('CARDIO-08 — le corps de séance seul', () => {
  type Realise = { distanceM: number | null; durationSeconds: number | null };

  /** Une sortie construite par le chemin du tracker : phases développées, puis figées une à une. */
  function sortie(blocks: IntervalPhaseBlockInput[], realises: Realise[]): RunIntervalRow[] {
    const phases = expandIntervalPhases(blocks);
    expect(phases).toHaveLength(realises.length);
    return phases.map((phase, phaseIndex) =>
      buildIntervalDraft({
        phaseIndex,
        phase,
        actualDistanceM: realises[phaseIndex]!.distanceM,
        actualDurationSeconds: realises[phaseIndex]!.durationSeconds,
      }),
    );
  }

  /** La sortie de référence de la spec (§5) : 6 × 400 m avec échauffement, gammes, retour au calme. */
  const BLOCS_REFERENCE: IntervalPhaseBlockInput[] = [
    block({ kind: 'warmup', fastDurationSeconds: 900, fastPaceMinSPerKm: 340, fastPaceMaxSPerKm: 370 }),
    // Les gammes n'ont pas de récupération : trois phases rapides, rien entre elles.
    block({ kind: 'drills', reps: 3, fastDistanceM: 80 }),
    block({
      kind: 'work',
      reps: 6,
      fastDistanceM: 400,
      fastPaceMinSPerKm: 230,
      fastPaceMaxSPerKm: 240,
      recoveryDistanceM: 200,
    }),
    block({ kind: 'cooldown', fastDurationSeconds: 600, fastPaceMinSPerKm: 360, fastPaceMaxSPerKm: 390 }),
  ];

  /** 1:34 · 1:33 · 1:35 · 1:34 · 1:35 · 1:40 au 400 — la 6ᵉ sort de la plage 3:50–4:00. */
  const FRACTIONS_S = [94, 93, 95, 94, 95, 100];

  function realisesReference(warmup: Realise = { distanceM: 2500, durationSeconds: 900 }): Realise[] {
    return [
      warmup,
      { distanceM: 80, durationSeconds: 18 },
      { distanceM: 80, durationSeconds: 17 },
      { distanceM: 80, durationSeconds: 19 },
      ...FRACTIONS_S.flatMap((s) => [
        { distanceM: 400, durationSeconds: s },
        { distanceM: 200, durationSeconds: 75 },
      ]),
      // 6:54/km : au-delà de la plage 6:00–6:30.
      { distanceM: 1450, durationSeconds: 600 },
    ];
  }

  const sortieDeReference = () => sortie(BLOCS_REFERENCE, realisesReference());

  /** Le « X sur Y » de l'analyse, sous la forme qu'emploie le hub (`null` : rien à juger). */
  function analyse(rows: readonly RunIntervalRow[]): { done: number; total: number } | null {
    const summary = summarizeIntervalSeries(rows);
    return summary.ratedCount === 0 ? null : { done: summary.inRangeCount, total: summary.ratedCount };
  }

  const fractions400 = (secondes: number[]): Realise[] =>
    secondes.map((s) => ({ distanceM: 400, durationSeconds: s }));

  it('🔴 ni l’échauffement, ni les gammes, ni le retour au calme, ni un segment de récupération ne sont des fractions', () => {
    // Chacune de ces lignes a une plage et y tient : sans le filtre, elles gonflaient le compte
    // (5 sur 6) autant que la moyenne.
    const summary = summarizeIntervalSeries([
      row({ phaseIndex: 0, segmentKind: 'warmup', actualPaceSPerKm: 360, plannedPaceMinSPerKm: 340, plannedPaceMaxSPerKm: 370 }),
      row({ phaseIndex: 1, segmentKind: 'drills', actualPaceSPerKm: 225, plannedPaceMinSPerKm: 220, plannedPaceMaxSPerKm: 230 }),
      row({ phaseIndex: 2, actualPaceSPerKm: 235, plannedPaceMinSPerKm: 230, plannedPaceMaxSPerKm: 240 }),
      row({ phaseIndex: 3, segmentKind: 'recovery', actualPaceSPerKm: 380, plannedPaceMinSPerKm: 370, plannedPaceMaxSPerKm: 390 }),
      row({ phaseIndex: 4, actualPaceSPerKm: 250, plannedPaceMinSPerKm: 230, plannedPaceMaxSPerKm: 240 }),
      row({ phaseIndex: 5, segmentKind: 'cooldown', actualPaceSPerKm: 400, plannedPaceMinSPerKm: 390, plannedPaceMaxSPerKm: 420 }),
    ]);
    expect(summary.fastCount).toBe(2);
    expect(summary.inRangeCount).toBe(1);
    expect(summary.ratedCount).toBe(2);
    expect(summary.avgFastPaceSPerKm).toBe(242.5);
    expect(summary.paceStdDevSPerKm).toBe(7.5);
    expect(summary.slowestRep).toBe(2);
    expect(summary.fastestRep).toBe(1);
  });

  it('🔴 la sortie de référence : 5 sur 6, 3:58, ± 6 — et non 6 sur 8, 4:21, ± 61', () => {
    const rows = sortieDeReference();
    // 17 phases : échauffement, 3 gammes, 6 × (fraction + récupération), retour au calme.
    expect(rows).toHaveLength(17);
    expect(rows[0]!.segmentKind).toBe('warmup');
    expect(rows[16]!.segmentKind).toBe('cooldown');

    const summary = summarizeIntervalSeries(rows);
    expect(summary.fastCount).toBe(6);
    expect(summary.inRangeCount).toBe(5);
    expect(summary.ratedCount).toBe(6);
    expect(Math.round(summary.avgFastPaceSPerKm!)).toBe(238);
    expect(Math.round(summary.paceStdDevSPerKm!)).toBe(6);
    expect(summary.slowestRep).toBe(6);
  });

  const cas: [string, () => RunIntervalRow[]][] = [
    ['la sortie de référence (spec §5)', sortieDeReference],
    // Arrêtée après les gammes : seules les phases franchies ont été écrites.
    ['une sortie arrêtée après l’échauffement', () => sortieDeReference().slice(0, 4)],
    [
      'des fractions sans plage prévue',
      () => sortie([block({ kind: 'work', reps: 2, fastDistanceM: 400 })], fractions400([94, 97])),
    ],
    [
      'une fraction franchie en rattrapage silencieux (réalisé nul)',
      () => {
        const realises = realisesReference();
        realises[8] = { distanceM: 400, durationSeconds: null };
        return sortie(BLOCS_REFERENCE, realises);
      },
    ],
    [
      'deux séries groupées (lot D), séparées par un segment de récupération',
      () =>
        sortie(
          [
            block({
              kind: 'work',
              reps: 2,
              fastDistanceM: 200,
              fastPaceMinSPerKm: 220,
              fastPaceMaxSPerKm: 230,
              groupKey: 'serie',
              groupReps: 2,
            }),
            block({ kind: 'recovery', fastDurationSeconds: 180, groupKey: 'serie' }),
          ],
          [
            { distanceM: 200, durationSeconds: 45 },
            { distanceM: 200, durationSeconds: 47 },
            { distanceM: 400, durationSeconds: 180 },
            { distanceM: 200, durationSeconds: 44 },
            { distanceM: 200, durationSeconds: 49 },
            { distanceM: 380, durationSeconds: 180 },
          ],
        ),
    ],
    [
      'un segment de récupération qui porte une plage',
      () =>
        sortie(
          [
            block({ kind: 'work', reps: 2, fastDistanceM: 400, fastPaceMinSPerKm: 230, fastPaceMaxSPerKm: 240 }),
            block({ kind: 'recovery', fastDurationSeconds: 180, fastPaceMinSPerKm: 380, fastPaceMaxSPerKm: 420 }),
            block({ kind: 'work', reps: 2, fastDistanceM: 400, fastPaceMinSPerKm: 230, fastPaceMaxSPerKm: 240 }),
          ],
          [...fractions400([94, 95]), { distanceM: 450, durationSeconds: 180 }, ...fractions400([96, 101])],
        ),
    ],
    [
      'une sortie RUN-F2c, sans nature de segment',
      () =>
        sortie(
          [block({ reps: 3, fastDistanceM: 400, fastPaceMinSPerKm: 230, fastPaceMaxSPerKm: 240, recoveryDurationSeconds: 90 })],
          [94, 99, 95].flatMap((s) => [
            { distanceM: 400, durationSeconds: s },
            { distanceM: 250, durationSeconds: 90 },
          ]),
        ),
    ],
    [
      'des allures réalisées sur les bornes de la plage',
      () =>
        sortie(
          [block({ kind: 'work', reps: 2, fastDistanceM: 400, fastPaceMinSPerKm: 230, fastPaceMaxSPerKm: 240 })],
          // 92 s = 3:50/km, 96 s = 4:00/km : les deux bornes, incluses des deux côtés.
          fractions400([92, 96]),
        ),
    ],
    [
      'un échauffement sorti de sa plage',
      // 2 700 m en 15 min = 5:33/km, plus vite que 5:40.
      () => sortie(BLOCS_REFERENCE, realisesReference({ distanceM: 2700, durationSeconds: 900 })),
    ],
  ];

  it.each(cas)('🔴 dit le même chiffre que le hub — %s', (_nom, construire) => {
    const rows = construire();
    expect(analyse(rows)).toEqual(repsInRange(lastTimeReps(rows)));
  });

  it('une sortie sans nature de segment garde exactement ses chiffres (RUN-F2c)', () => {
    // Le dépôt lit `segment_kind` nul comme `'work'` : rien ne change pour ces séances.
    const rows = cas.find(([nom]) => nom.includes('RUN-F2c'))![1]();
    const summary = summarizeIntervalSeries(rows);
    expect(summary.fastCount).toBe(3);
    expect(analyse(rows)).toEqual({ done: 2, total: 3 });
    expect(summary.avgFastPaceSPerKm).toBeCloseTo((235 + 247.5 + 237.5) / 3, 10);
  });
});

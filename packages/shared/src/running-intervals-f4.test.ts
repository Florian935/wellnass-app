/**
 * US RUN-F4 (lots B, C, D) — segments types, chrono cible, groupes imbriques.
 * Les tests RUN-F2c/F2d historiques restent dans `running-intervals.test.ts` : ils passent
 * inchanges, c'est la preuve de retrocompatibilite du moteur.
 */
import { describe, expect, it } from 'vitest';
import {
  expandIntervalPhases,
  phasePaceRange,
  resolvePhasePace,
  sessionVolume,
  type IntervalPhaseBlockInput,
} from './running-intervals';
import { derivedVmaPace } from './running-paces';

/** Bloc minimal ; chaque test ne surcharge que ce dont il parle. */
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

describe('lot B — nature des segments', () => {
  it("un bloc sans nature vaut 'work' : les lignes RUN-F2c gardent leur sens", () => {
    const [phase] = expandIntervalPhases([block({ fastDistanceM: 400 })]);
    expect(phase!.segmentKind).toBe('work');
  });

  it('un echauffement, un corps et un retour au calme se suivent dans l ordre', () => {
    // La seance type du plan analyse : 12-15 min faciles, 8x400 m, 8-10 min tres lents.
    const phases = expandIntervalPhases([
      block({ kind: 'warmup', fastDurationSeconds: 780 }),
      block({ kind: 'work', reps: 8, fastDistanceM: 400, recoveryDurationSeconds: 75 }),
      block({ kind: 'cooldown', fastDurationSeconds: 540 }),
    ]);
    expect(phases[0]!.segmentKind).toBe('warmup');
    expect(phases[1]!.segmentKind).toBe('work');
    expect(phases.at(-1)!.segmentKind).toBe('cooldown');
    // 1 echauffement + 8x(rapide+recup) + 1 retour au calme
    expect(phases).toHaveLength(1 + 16 + 1);
  });

  it('la nature de recuperation ne se pose que sur les phases de recuperation', () => {
    const phases = expandIntervalPhases([
      block({ reps: 1, fastDistanceM: 400, recoveryDurationSeconds: 75, recoveryKind: 'walk' }),
    ]);
    expect(phases[0]!.recoveryKind).toBeNull();
    expect(phases[1]!.recoveryKind).toBe('walk');
  });
});

describe('lot C — chrono cible distinct de l etendue', () => {
  it('« 400 m en 1:38-1:40 » porte la distance ET le chrono, sans les confondre', () => {
    const [phase] = expandIntervalPhases([
      block({ fastDistanceM: 400, fastTargetTimeMinSeconds: 98, fastTargetTimeMaxSeconds: 100 }),
    ]);
    // La distance reste l'etendue (ce qui termine la phase)...
    expect(phase!.distanceM).toBe(400);
    expect(phase!.durationSeconds).toBeNull();
    // ...et le chrono est la cible a tenir dedans : milieu de la plage saisie.
    expect(phase!.targetTimeSeconds).toBe(99);
  });

  it('une seule borne de chrono vaut pour cible', () => {
    const [phase] = expandIntervalPhases([
      block({ fastDistanceM: 400, fastTargetTimeMinSeconds: 96 }),
    ]);
    expect(phase!.targetTimeSeconds).toBe(96);
  });
});

describe('lot D — groupes imbriques', () => {
  it('« 3 x (800 m + 400 m) » produit 3 passages des deux fractions, dans l ordre', () => {
    // S19 du plan analyse : 3 x (800 m en 3:10-3:12 + 400 m en 1:34-1:36), recup 1:30 entre les
    // deux fractions et 3 min entre les blocs. Inexprimable avant ce lot.
    const phases = expandIntervalPhases([
      block({ groupKey: 'g1', groupReps: 3, fastDistanceM: 800, recoveryDurationSeconds: 90 }),
      block({ groupKey: 'g1', groupReps: 3, fastDistanceM: 400, recoveryDurationSeconds: 180 }),
    ]);
    expect(phases).toHaveLength(12); // 3 x (800 + recup + 400 + recup)
    expect(phases.map((p) => p.distanceM)).toEqual([
      800, null, 400, null,
      800, null, 400, null,
      800, null, 400, null,
    ]);
    expect(phases[0]!.groupRep).toBe(1);
    expect(phases[4]!.groupRep).toBe(2);
    expect(phases[8]!.groupRep).toBe(3);
    expect(phases[0]!.groupTotalReps).toBe(3);
  });

  it('un bloc sans cle de groupe se joue une fois — comportement RUN-F2c intact', () => {
    const phases = expandIntervalPhases([block({ reps: 2, fastDistanceM: 400 })]);
    expect(phases).toHaveLength(2);
    expect(phases.every((p) => p.groupRep === 1 && p.groupTotalReps === 1)).toBe(true);
  });

  it('deux groupes de meme cle mais non consecutifs ne fusionnent pas', () => {
    // « Consecutifs » et non « partout » : l'ordre des order_index reste la verite de la seance.
    const phases = expandIntervalPhases([
      block({ groupKey: 'g', groupReps: 2, fastDistanceM: 400 }),
      block({ fastDistanceM: 1000 }),
      block({ groupKey: 'g', groupReps: 3, fastDistanceM: 200 }),
    ]);
    expect(phases.map((p) => p.distanceM)).toEqual([400, 400, 1000, 200, 200, 200]);
  });

  it('groupReps absent ou nul vaut une seule execution', () => {
    const phases = expandIntervalPhases([block({ groupKey: 'g', fastDistanceM: 400 })]);
    expect(phases).toHaveLength(1);
  });

  it('les blocs du groupe gardent leur index d origine', () => {
    // `blockIndex` doit toujours designer la LIGNE editee, pas la position linearisee, sinon
    // l'ecran ne saurait plus quel segment surligner.
    const phases = expandIntervalPhases([
      block({ groupKey: 'g1', groupReps: 2, fastDistanceM: 800 }),
      block({ groupKey: 'g1', groupReps: 2, fastDistanceM: 400 }),
    ]);
    expect(phases.map((p) => p.blockIndex)).toEqual([0, 1, 0, 1]);
  });
});

describe('resolvePhasePace — ordre de priorite', () => {
  const vma = derivedVmaPace(240); // allure a 100 % VMA depuis une reference 5 km a 4:00/km

  it("l'allure absolue saisie gagne sur le %VMA", () => {
    const [phase] = expandIntervalPhases([
      block({ fastDistanceM: 400, fastPaceMinSPerKm: 245, fastPaceMaxSPerKm: 250, fastPacePctVma: 95 }),
    ]);
    expect(resolvePhasePace(phase!, vma)).toEqual({
      range: { minSPerKm: 245, maxSPerKm: 250 },
      source: 'explicit',
    });
  });

  it('a defaut, le chrono cible sur la distance', () => {
    const [phase] = expandIntervalPhases([
      block({ fastDistanceM: 400, fastTargetTimeMinSeconds: 98 }),
    ]);
    const resolved = resolvePhasePace(phase!, vma);
    expect(resolved?.source).toBe('target-time');
    expect(resolved?.range.minSPerKm).toBeCloseTo(245, 5);
  });

  it('a defaut, le %VMA — le repli RUN-F2c, qui n a pas ete supprime', () => {
    const [phase] = expandIntervalPhases([block({ fastDistanceM: 400, fastPacePctVma: 95 })]);
    expect(resolvePhasePace(phase!, vma)?.source).toBe('derived');
  });

  it('sans allure de reference, le %VMA seul ne donne rien', () => {
    const [phase] = expandIntervalPhases([block({ fastDistanceM: 400, fastPacePctVma: 95 })]);
    expect(resolvePhasePace(phase!, null)).toBeNull();
    expect(phasePaceRange(phase!, null)).toBeNull();
  });
});

describe('sessionVolume', () => {
  it("additionne l'echauffement et le retour au calme, pas seulement le corps", () => {
    // C'est tout l'interet du lot B : le « volume estime » du plan analyse compte la seance
    // entiere, et l'echauffement pesait jusqu'ici pour zero parce qu'il n'existait pas.
    const phases = expandIntervalPhases([
      block({ kind: 'warmup', fastDurationSeconds: 780 }),
      block({ kind: 'work', reps: 4, fastDistanceM: 1000, recoveryDurationSeconds: 150 }),
      block({ kind: 'cooldown', fastDurationSeconds: 540 }),
    ]);
    const volume = sessionVolume(phases);
    expect(volume.distanceM).toBe(4000);
    expect(volume.durationSeconds).toBe(780 + 4 * 150 + 540);
    expect(volume.fastPhaseCount).toBe(1 + 4 + 1);
    expect(volume.partial).toBe(false);
  });

  it('signale un total partiel des qu une phase n a ni distance ni duree', () => {
    const phases = expandIntervalPhases([
      block({ fastDistanceM: 1000 }),
      block({ kind: 'cooldown' }), // « retour au calme libre » : aucune borne
    ]);
    expect(sessionVolume(phases).partial).toBe(true);
  });

  it('un volume vide reste a zero, sans etre partiel', () => {
    expect(sessionVolume([])).toEqual({
      distanceM: 0,
      durationSeconds: 0,
      fastPhaseCount: 0,
      partial: false,
    });
  });
});

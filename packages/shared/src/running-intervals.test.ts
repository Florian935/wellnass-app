import { describe, expect, it } from 'vitest';
import {
  expandIntervalPhases,
  isIntervalPhaseComplete,
  resyncIntervalPhase,
  type ExpandedIntervalPhase,
  type IntervalPhaseBlockInput,
} from './running-intervals';

const warmup: IntervalPhaseBlockInput = {
  reps: 1,
  fastDistanceM: 1000,
  fastDurationSeconds: null,
  fastPacePctVma: null,
  recoveryDistanceM: null,
  recoveryDurationSeconds: null,
};

const sixByFour: IntervalPhaseBlockInput = {
  reps: 6,
  fastDistanceM: 400,
  fastDurationSeconds: null,
  fastPacePctVma: 95,
  recoveryDistanceM: 200,
  recoveryDurationSeconds: null,
};

describe('expandIntervalPhases', () => {
  it('un bloc reps=1 sans récup (échauffement) -> 1 seule phase', () => {
    const phases = expandIntervalPhases([warmup]);
    expect(phases).toHaveLength(1);
    expect(phases[0]).toMatchObject({ kind: 'fast', blockIndex: 0, rep: 1, totalReps: 1, distanceM: 1000 });
  });

  it('un bloc reps=6 avec récup -> 12 phases alternées, rep 1..6 chacun deux fois', () => {
    const phases = expandIntervalPhases([sixByFour]);
    expect(phases).toHaveLength(12);
    for (let i = 0; i < 6; i += 1) {
      expect(phases[i * 2]).toMatchObject({ kind: 'fast', blockIndex: 0, rep: i + 1, totalReps: 6, distanceM: 400, fastPacePctVma: 95 });
      expect(phases[i * 2 + 1]).toMatchObject({ kind: 'recovery', blockIndex: 0, rep: i + 1, totalReps: 6, distanceM: 200 });
    }
  });

  it('deux blocs (échauffement puis 3 reps avec récup) -> 1 + 6 = 7 phases, frontière de bloc correcte', () => {
    const threeReps: IntervalPhaseBlockInput = { ...sixByFour, reps: 3 };
    const phases = expandIntervalPhases([warmup, threeReps]);
    expect(phases).toHaveLength(7);
    expect(phases[0]).toMatchObject({ blockIndex: 0, kind: 'fast', rep: 1 });
    // La frontière tombe exactement après la phase d'échauffement (index 1).
    expect(phases[1]).toMatchObject({ blockIndex: 1, kind: 'fast', rep: 1 });
    expect(phases[6]).toMatchObject({ blockIndex: 1, kind: 'recovery', rep: 3 });
  });

  it('aucun bloc -> liste vide', () => {
    expect(expandIntervalPhases([])).toEqual([]);
  });
});

describe('isIntervalPhaseComplete', () => {
  const distancePhase: ExpandedIntervalPhase = {
    kind: 'fast', blockIndex: 0, rep: 1, totalReps: 1, distanceM: 400, durationSeconds: null, fastPacePctVma: null,
  };
  const durationPhase: ExpandedIntervalPhase = {
    kind: 'recovery', blockIndex: 0, rep: 1, totalReps: 1, distanceM: null, durationSeconds: 90, fastPacePctVma: null,
  };
  const emptyPhase: ExpandedIntervalPhase = {
    kind: 'fast', blockIndex: 0, rep: 1, totalReps: 1, distanceM: null, durationSeconds: null, fastPacePctVma: null,
  };

  it('phase distance : sous le seuil -> false, au seuil -> true, au-dessus -> true', () => {
    expect(isIntervalPhaseComplete(distancePhase, 399, 0)).toBe(false);
    expect(isIntervalPhaseComplete(distancePhase, 400, 0)).toBe(true);
    expect(isIntervalPhaseComplete(distancePhase, 450, 0)).toBe(true);
  });

  it('phase durée : sous le seuil -> false, au seuil -> true, au-dessus -> true', () => {
    expect(isIntervalPhaseComplete(durationPhase, 0, 89)).toBe(false);
    expect(isIntervalPhaseComplete(durationPhase, 0, 90)).toBe(true);
    expect(isIntervalPhaseComplete(durationPhase, 0, 120)).toBe(true);
  });

  it('phase sans aucune cible (defensive) -> false, jamais une exception', () => {
    expect(isIntervalPhaseComplete(emptyPhase, 1000, 1000)).toBe(false);
  });
});

describe('resyncIntervalPhase', () => {
  const phases = expandIntervalPhases([sixByFour]); // 12 phases : 400m, 200m, 400m, 200m...

  it('aucun seuil franchi -> advanced=false, index inchangé', () => {
    const result = resyncIntervalPhase(phases, 0, 100, 0, 0, 0);
    expect(result).toEqual({ index: 0, phaseStartDistanceM: 0, phaseStartDurationS: 0, advanced: false });
  });

  it('une seule phase franchie -> avance de 1', () => {
    const result = resyncIntervalPhase(phases, 0, 400, 0, 0, 0);
    expect(result.index).toBe(1);
    expect(result.advanced).toBe(true);
    expect(result.phaseStartDistanceM).toBe(400);
  });

  it('plusieurs phases franchies d\'un coup (écran resté fermé pendant tout un rapide + sa récup) -> atterrit sur la bonne phase, sans effacer la progression déjà faite dans la nouvelle phase courante', () => {
    // distance cumulée 700 m depuis le début du run, baseline de phase à 0 : franchit
    // la phase 0 (400m) puis la phase 1 (200m, cumul 600m) ; phase 2 (400m) pas encore atteinte
    // (700 - 600 = 100 < 400). La baseline avance de EXACTEMENT 400 + 200 = 600, pas jusqu'à 700 —
    // sinon les 100 m déjà courus dans la phase 2 seraient effacés (bug corrigé en cours de route).
    const result = resyncIntervalPhase(phases, 0, 700, 0, 0, 0);
    expect(result.index).toBe(2);
    expect(result.advanced).toBe(true);
    expect(result.phaseStartDistanceM).toBe(600);
  });

  it('peut atteindre la fin de la séquence (index === phases.length)', () => {
    const result = resyncIntervalPhase(phases, 0, 100_000, 0, 0, 0);
    expect(result.index).toBe(phases.length);
    expect(result.advanced).toBe(true);
  });
});

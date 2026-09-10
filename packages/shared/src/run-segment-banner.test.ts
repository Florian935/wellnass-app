import { describe, expect, it } from 'vitest';
import {
  resolveHeroMetric,
  resolveSegmentBanner,
  type SegmentBannerInput,
} from './run-segment-banner';
import type { IntervalPhaseBlockInput } from './running-intervals';

/** Bloc minimal : `reps` × `fastDistanceM`, récupération optionnelle. */
function bloc(over: Partial<IntervalPhaseBlockInput> = {}): IntervalPhaseBlockInput {
  return {
    reps: 1,
    fastDistanceM: null,
    fastDurationSeconds: null,
    fastPacePctVma: null,
    recoveryDistanceM: null,
    recoveryDurationSeconds: null,
    ...over,
  };
}

/** La séance de référence de l'audit : 2 km éch + 6×400 m / 200 m récup + 1 km calme. */
const SEANCE: IntervalPhaseBlockInput[] = [
  bloc({ kind: 'warmup', fastDistanceM: 2000 }),
  bloc({
    kind: 'work',
    reps: 6,
    fastDistanceM: 400,
    recoveryDistanceM: 200,
    fastPaceMinSPerKm: 245,
    fastPaceMaxSPerKm: 250,
  }),
  bloc({ kind: 'cooldown', fastDistanceM: 1000 }),
];

function entree(over: Partial<SegmentBannerInput> = {}): SegmentBannerInput {
  return {
    blocks: SEANCE,
    phaseIndex: 0,
    phaseStartDistanceM: 0,
    phaseStartDurationS: 0,
    distanceM: 0,
    durationSeconds: 0,
    vmaPaceSPerKm: null,
    ...over,
  };
}

describe('resolveSegmentBanner — rien à dire, rien à l’écran', () => {
  it('rend null sur une course libre (aucun bloc)', () => {
    expect(resolveSegmentBanner(entree({ blocks: [] }))).toBeNull();
  });

  it('rend null tant que le guidage n’a pas posé de curseur', () => {
    // Le curseur est persisté par RUN-F2d ; avant la première phase franchie il vaut `null`.
    // Afficher un bandeau « phase 1 » à ce moment inventerait un état.
    expect(resolveSegmentBanner(entree({ phaseIndex: null }))).toBeNull();
  });

  it('rend null sur un curseur négatif (donnée abîmée)', () => {
    expect(resolveSegmentBanner(entree({ phaseIndex: -1 }))).toBeNull();
  });
});

describe('resolveSegmentBanner — la phase courante', () => {
  it('nomme l’échauffement et décompte ses mètres', () => {
    const b = resolveSegmentBanner(entree({ phaseIndex: 0, distanceM: 1200 }));

    expect(b).not.toBeNull();
    if (b?.state !== 'running') throw new Error('attendu running');
    expect(b.segmentKind).toBe('warmup');
    expect(b.remaining).toEqual({ axis: 'distance', meters: 800 });
    expect(b.progress).toBeCloseTo(0.6, 6);
  });

  it('🔴 annonce « fraction 3 sur 6 » et les 250 m restants', () => {
    // C'est LE chiffre qui manquait : phases = [éch, (400+200)×6, calme] → la 3ᵉ fraction est
    // la phase d'index 5 (1 échauffement + 2×(rapide+récup) = 5).
    const b = resolveSegmentBanner(
      entree({
        phaseIndex: 5,
        phaseStartDistanceM: 3600,
        distanceM: 3750,
      }),
    );

    if (b?.state !== 'running') throw new Error('attendu running');
    expect(b.kind).toBe('fast');
    expect(b.rep).toBe(3);
    expect(b.totalReps).toBe(6);
    expect(b.remaining).toEqual({ axis: 'distance', meters: 250 });
    expect(b.progress).toBeCloseTo(0.375, 6);
  });

  it('porte l’allure cible saisie sur le bloc', () => {
    const b = resolveSegmentBanner(entree({ phaseIndex: 5, phaseStartDistanceM: 3600, distanceM: 3750 }));

    if (b?.state !== 'running') throw new Error('attendu running');
    expect(b.targetRange).toEqual({ minSPerKm: 245, maxSPerKm: 250 });
  });

  it('annonce la phase suivante — la récupération après la fraction', () => {
    const b = resolveSegmentBanner(entree({ phaseIndex: 5, phaseStartDistanceM: 3600, distanceM: 3750 }));

    if (b?.state !== 'running') throw new Error('attendu running');
    expect(b.next).toEqual({
      kind: 'recovery',
      segmentKind: 'work',
      distanceM: 200,
      durationSeconds: null,
    });
  });

  it('n’annonce rien après la dernière phase', () => {
    const b = resolveSegmentBanner(entree({ phaseIndex: 13, distanceM: 8000 }));

    if (b?.state !== 'running') throw new Error('attendu running');
    expect(b.phaseNumber).toBe(14);
    expect(b.totalPhases).toBe(14);
    expect(b.next).toBeNull();
  });

  it('🔴 curseur au-delà de la dernière phase → séance finie, jamais « 15 sur 14 »', () => {
    const b = resolveSegmentBanner(entree({ phaseIndex: 14 }));

    expect(b).toEqual({ state: 'done', totalPhases: 14 });
  });
});

describe('resolveSegmentBanner — phases bornées en durée', () => {
  const gammes: IntervalPhaseBlockInput[] = [
    bloc({ kind: 'drills', reps: 4, fastDurationSeconds: 30, recoveryDurationSeconds: 60 }),
  ];

  it('décompte les secondes quand la phase est bornée en durée', () => {
    const b = resolveSegmentBanner(
      entree({
        blocks: gammes,
        phaseIndex: 0,
        phaseStartDurationS: 100,
        durationSeconds: 118,
      }),
    );

    if (b?.state !== 'running') throw new Error('attendu running');
    expect(b.remaining).toEqual({ axis: 'duration', seconds: 12 });
    expect(b.progress).toBeCloseTo(0.6, 6);
  });

  it('ne décompte rien sur une phase sans borne — et ce n’est pas une erreur', () => {
    const libre: IntervalPhaseBlockInput[] = [bloc({ kind: 'work', reps: 1 })];
    const b = resolveSegmentBanner(entree({ blocks: libre, phaseIndex: 0 }));

    if (b?.state !== 'running') throw new Error('attendu running');
    expect(b.remaining).toBeNull();
    expect(b.progress).toBeNull();
  });

  it('ne rend jamais un restant négatif quand on dépasse la borne', () => {
    const b = resolveSegmentBanner(
      entree({ blocks: gammes, phaseIndex: 0, phaseStartDurationS: 0, durationSeconds: 90 }),
    );

    if (b?.state !== 'running') throw new Error('attendu running');
    expect(b.remaining).toEqual({ axis: 'duration', seconds: 0 });
    expect(b.progress).toBe(1);
  });
});

describe('resolveSegmentBanner — allure progressive (mur M8)', () => {
  const rampe: IntervalPhaseBlockInput[] = [
    bloc({
      kind: 'work',
      fastDistanceM: 1000,
      fastPaceMinSPerKm: 265,
      fastPaceMaxSPerKm: 275,
      fastPaceProgressive: true,
    }),
  ];

  it('déplace la cible au fil de la phase', () => {
    const debut = resolveSegmentBanner(entree({ blocks: rampe, phaseIndex: 0, distanceM: 0 }));
    const fin = resolveSegmentBanner(entree({ blocks: rampe, phaseIndex: 0, distanceM: 1000 }));

    if (debut?.state !== 'running' || fin?.state !== 'running') throw new Error('attendu running');
    // Une rampe « de 4:35 vers 4:25 » : la cible n'est pas la même au début et à la fin.
    expect(debut.targetRange).not.toEqual(fin.targetRange);
  });
});

describe('resolveSegmentBanner — avancement de la séance', () => {
  it('avance en continu, pas par paliers de phase', () => {
    const moitie = resolveSegmentBanner(
      entree({ phaseIndex: 0, distanceM: 1000 }), // moitié de l'échauffement de 2 km
    );

    if (moitie?.state !== 'running') throw new Error('attendu running');
    // (0 + 0,5) / 14 phases : la barre bouge dès qu'on court, sans attendre la fin de la phase.
    expect(moitie.sessionProgress).toBeCloseTo(0.5 / 14, 6);
  });

  it('reste borné à 1', () => {
    const b = resolveSegmentBanner(entree({ phaseIndex: 13, phaseStartDistanceM: 0, distanceM: 99_999 }));

    if (b?.state !== 'running') throw new Error('attendu running');
    expect(b.sessionProgress).toBe(1);
  });
});

describe('resolveHeroMetric', () => {
  it('un fractionné met l’allure en héros — c’est elle qu’on corrige', () => {
    expect(resolveHeroMetric({ sessionType: 'fractionne' })).toBe('pace');
    expect(resolveHeroMetric({ sessionType: 'test' })).toBe('pace');
  });

  it('une sortie longue met la distance en héros', () => {
    expect(resolveHeroMetric({ sessionType: 'sortie_longue' })).toBe('distance');
    expect(resolveHeroMetric({ sessionType: 'course' })).toBe('distance');
  });

  it('une séance bornée en durée met le chrono en héros, quel que soit son type', () => {
    expect(resolveHeroMetric({ sessionType: 'fractionne', boundedByDuration: true })).toBe('duration');
  });

  it('une course libre met la distance en héros', () => {
    expect(resolveHeroMetric({ sessionType: null })).toBe('distance');
  });

  it('🔴 le choix de l’utilisateur prime toujours sur le défaut', () => {
    expect(
      resolveHeroMetric({ sessionType: 'sortie_longue', override: 'duration' }),
    ).toBe('duration');
    expect(
      resolveHeroMetric({ sessionType: 'fractionne', boundedByDuration: true, override: 'distance' }),
    ).toBe('distance');
  });
});

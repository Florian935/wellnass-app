import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN_REST_SECONDS,
  SET_EXECUTION_SECONDS,
  estimateSessionMinutes,
} from './session-estimate';

describe('estimateSessionMinutes', () => {
  it('estime une séance type et arrondit à 5 minutes', () => {
    // 4+4+3 séries à 90 s de repos : 11 × 130 s − 90 s = 1 340 s ≈ 22 min → 20.
    expect(
      estimateSessionMinutes([
        { targetSets: 4, restSeconds: 90 },
        { targetSets: 4, restSeconds: 90 },
        { targetSets: 3, restSeconds: 90 },
      ]),
    ).toBe(20);
  });

  it('retombe sur le repos par défaut quand le plan n’en donne pas', () => {
    expect(estimateSessionMinutes([{ targetSets: 4, restSeconds: null }])).toBe(
      estimateSessionMinutes([{ targetSets: 4, restSeconds: DEFAULT_PLAN_REST_SECONDS }]),
    );
  });

  it('tient compte du repos réel : plus de repos, plus long', () => {
    const court = estimateSessionMinutes([{ targetSets: 5, restSeconds: 60 }]) ?? 0;
    const long = estimateSessionMinutes([{ targetSets: 5, restSeconds: 180 }]) ?? 0;
    expect(long).toBeGreaterThan(court);
  });

  it('ne compte pas le dernier repos — on ne récupère pas avant de rentrer', () => {
    const brut = 3 * (SET_EXECUTION_SECONDS + 120);
    expect(estimateSessionMinutes([{ targetSets: 3, restSeconds: 120 }])).toBe(
      Math.round((brut - 120) / 60 / 5) * 5,
    );
  });

  it('arrondit toujours à un multiple de 5', () => {
    for (const sets of [1, 2, 3, 5, 8, 13]) {
      expect((estimateSessionMinutes([{ targetSets: sets, restSeconds: 75 }]) ?? 0) % 5).toBe(0);
    }
  });

  it('ne descend jamais sous 5 minutes', () => {
    expect(estimateSessionMinutes([{ targetSets: 1, restSeconds: 0 }])).toBe(5);
  });

  it('ne rend rien quand il n’y a rien à estimer', () => {
    // Mieux vaut masquer la mention que d'afficher « 0 min » ou un chiffre inventé.
    expect(estimateSessionMinutes([])).toBeNull();
    expect(estimateSessionMinutes([{ targetSets: null, restSeconds: 90 }])).toBeNull();
    expect(estimateSessionMinutes([{ targetSets: 0, restSeconds: 90 }])).toBeNull();
  });

  it('ignore les exercices sans série cible mais garde les autres', () => {
    const minutes = estimateSessionMinutes([
      { targetSets: null, restSeconds: 90 },
      { targetSets: 4, restSeconds: 90 },
    ]);
    expect(minutes).not.toBeNull();
    expect(minutes).toBeGreaterThan(0);
  });
});

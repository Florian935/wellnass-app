import { describe, expect, it } from 'vitest';
import {
  SNAPSHOT_MIN_AGE_HOURS,
  computeSinceLastVisit,
  shouldReplaceSnapshot,
  type VisitSnapshot,
} from './since-last-visit';

const snap = (over: Partial<VisitSnapshot> = {}): VisitSnapshot => ({
  takenAt: '2026-09-13T21:00:00.000Z',
  weightKg: 78.6,
  recordsCount: 12,
  prediction10kSeconds: 3312,
  ...over,
});

describe('computeSinceLastVisit (US DASH-01, §4.5)', () => {
  it('premier lancement (aucun instantané) → rien à dire', () => {
    expect(computeSinceLastVisit(null, snap())).toEqual([]);
  });

  it('rien n’a bougé → liste vide (pas de « 0 » affiché)', () => {
    expect(computeSinceLastVisit(snap(), snap({ takenAt: '2026-09-14T07:42:00.000Z' }))).toEqual([]);
  });

  it('poids, records et prédiction bougent → trois écarts, dans cet ordre', () => {
    const items = computeSinceLastVisit(
      snap(),
      snap({ weightKg: 78.2, recordsCount: 13, prediction10kSeconds: 3300 }),
    );
    expect(items).toEqual([
      { kind: 'weight', deltaKg: -0.4 },
      { kind: 'records', count: 1 },
      { kind: 'prediction10k', deltaSeconds: -12 },
    ]);
  });

  it('un écart de poids sous 0,1 kg est du bruit de balance → ignoré', () => {
    expect(computeSinceLastVisit(snap(), snap({ weightKg: 78.64 }))).toEqual([]);
  });

  it('le poids arrondi au dixième, sans erreur de flottant', () => {
    expect(computeSinceLastVisit(snap({ weightKg: 78.3 }), snap({ weightKg: 78.6 }))).toEqual([
      { kind: 'weight', deltaKg: 0.3 },
    ]);
  });

  it('un poids absent d’un côté → pas d’écart de poids', () => {
    expect(computeSinceLastVisit(snap({ weightKg: null }), snap({ weightKg: 78 }))).toEqual([]);
  });

  it('moins de records qu’avant (suppression) → pas d’écart négatif affiché', () => {
    expect(computeSinceLastVisit(snap({ recordsCount: 12 }), snap({ recordsCount: 11 }))).toEqual([]);
  });

  it('une prédiction qui ralentit se dit aussi (écart positif)', () => {
    expect(
      computeSinceLastVisit(snap(), snap({ prediction10kSeconds: 3320 })),
    ).toEqual([{ kind: 'prediction10k', deltaSeconds: 8 }]);
  });
});

describe('shouldReplaceSnapshot', () => {
  const now = '2026-09-14T07:42:00.000Z';

  it('aucun instantané → on en prend un', () => {
    expect(shouldReplaceSnapshot(null, now)).toBe(true);
  });

  it(`un instantané de moins de ${SNAPSHOT_MIN_AGE_HOURS} h est gardé (les écarts restent visibles toute la matinée)`, () => {
    expect(shouldReplaceSnapshot(snap({ takenAt: '2026-09-14T03:00:00.000Z' }), now)).toBe(false);
  });

  it(`un instantané de plus de ${SNAPSHOT_MIN_AGE_HOURS} h est remplacé`, () => {
    expect(shouldReplaceSnapshot(snap({ takenAt: '2026-09-13T21:00:00.000Z' }), now)).toBe(true);
  });

  it('une date illisible → remplacée', () => {
    expect(shouldReplaceSnapshot(snap({ takenAt: 'n’importe quoi' }), now)).toBe(true);
  });
});

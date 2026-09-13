import { describe, expect, it } from 'vitest';

import { computeSetVerdict, type VerdictSet } from './workout-verdict';

const set = (over: Partial<VerdictSet> = {}): VerdictSet => ({
  setType: 'normal',
  reps: 8,
  weightKg: 80,
  durationSeconds: null,
  ...over,
});

const NOW = new Date('2026-09-13T18:00:00.000Z');

describe('verdict de série', () => {
  it('annonce la charge en plus', () => {
    const verdict = computeSetVerdict({
      current: set({ weightKg: 82.5 }),
      reference: set({ weightKg: 77.5 }),
      finishedAt: '2026-09-08T18:00:00.000Z',
      now: NOW,
    });
    expect(verdict.kind).toBe('heavier');
    expect(verdict.deltaKg).toBe(5);
    expect(verdict.dayKind).toBe('named');
  });

  it('annonce les répétitions en plus à charge égale', () => {
    const verdict = computeSetVerdict({ current: set({ reps: 9 }), reference: set(), now: NOW });
    expect(verdict.kind).toBe('moreReps');
    expect(verdict.deltaReps).toBe(1);
  });

  it('dit « pareil » quand rien ne bouge', () => {
    expect(computeSetVerdict({ current: set(), reference: set(), now: NOW }).kind).toBe('equal');
  });

  it('constate une série en dessous sans la qualifier', () => {
    const verdict = computeSetVerdict({ current: set({ reps: 6 }), reference: set(), now: NOW });
    expect(verdict.kind).toBe('below');
    expect(verdict.deltaReps).toBe(-2);
    expect(verdict.reference?.reps).toBe(8);
  });

  it('compare le temps sur une série à la durée, pas la charge', () => {
    const gainage = { setType: 'duration' as const, reps: null, weightKg: null };
    const verdict = computeSetVerdict({
      current: { ...gainage, durationSeconds: 80 },
      reference: { ...gainage, durationSeconds: 70 },
      now: NOW,
    });
    expect(verdict.kind).toBe('longer');
    expect(verdict.deltaSeconds).toBe(10);
  });

  it('ne juge jamais un échauffement', () => {
    expect(computeSetVerdict({ current: set({ setType: 'warmup' }), reference: set(), now: NOW }).kind).toBe('warmup');
  });

  it('retombe sur « première référence » sans série de référence', () => {
    const verdict = computeSetVerdict({ current: set(), reference: null, now: NOW });
    expect(verdict.kind).toBe('first');
    expect(verdict.dayKind).toBe('none');
  });

  it('nomme le jour sous 7 jours, la date au-delà', () => {
    const args = { current: set({ weightKg: 82.5 }), reference: set({ weightKg: 80 }), now: NOW };
    expect(computeSetVerdict({ ...args, finishedAt: '2026-09-10T18:00:00.000Z' }).dayKind).toBe('named');
    expect(computeSetVerdict({ ...args, finishedAt: '2026-08-02T18:00:00.000Z' }).dayKind).toBe('date');
    expect(computeSetVerdict({ ...args, finishedAt: null }).dayKind).toBe('none');
  });

  it('ne fabrique pas un écart de charge sur des flottants', () => {
    const verdict = computeSetVerdict({
      current: set({ weightKg: 82.5 }),
      reference: set({ weightKg: 80.25 }),
      now: NOW,
    });
    expect(verdict.deltaKg).toBe(2.25);
  });
});

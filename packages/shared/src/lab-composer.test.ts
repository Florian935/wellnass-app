import { describe, expect, it } from 'vitest';

import {
  LAB_DOSE_BOUNDS,
  bestLabSteps,
  composeLab,
  stepDose,
  type LabComposerContext,
  type LabDoses,
} from './lab-composer';
import { CARB_TARGETS_G_PER_KG } from './carb-target';

const BASE: LabDoses = { strengthSessions: 3, runningFrequency: 3, proteinGPerKg: 1.8, objective: 'weightloss', sleep: 'long' };

function ctx(over: Partial<LabComposerContext> = {}): LabComposerContext {
  return {
    activePillars: ['strength', 'running', 'nutrition'],
    baseline: BASE,
    weightKg: 77.6,
    tdeeKcal: 2750,
    sbd: { lastTotalKg: 372, slopePerWeek: 1 },
    loadRatio: 1.0,
    hoursPerRun: 0.8,
    ...over,
  };
}

describe('stepDose', () => {
  it('avance et recule dans les bornes, et refuse d’en sortir', () => {
    expect(stepDose(BASE, 'strengthSessions', 1)!.strengthSessions).toBe(4);
    expect(stepDose({ ...BASE, strengthSessions: LAB_DOSE_BOUNDS.strengthSessions.max }, 'strengthSessions', 1)).toBeNull();
    expect(stepDose({ ...BASE, runningFrequency: 0 }, 'runningFrequency', -1)).toBeNull();
    expect(stepDose(BASE, 'proteinGPerKg', 1)!.proteinGPerKg).toBe(2);
    expect(stepDose({ ...BASE, proteinGPerKg: 1.2 }, 'proteinGPerKg', -1)).toBeNull();
  });

  it('parcourt les objectifs du plus restrictif au plus généreux', () => {
    expect(stepDose(BASE, 'objective', 1)!.objective).toBe('maintain');
    expect(stepDose(BASE, 'objective', -1)!.objective).toBe('cut');
    expect(stepDose({ ...BASE, objective: 'cut' }, 'objective', -1)).toBeNull();
    expect(stepDose({ ...BASE, objective: 'bulk' }, 'objective', 1)).toBeNull();
  });

  it('bascule le sommeil entre court et long', () => {
    expect(stepDose(BASE, 'sleep', 1)).toBeNull();
    expect(stepDose(BASE, 'sleep', -1)!.sleep).toBe('short');
    expect(stepDose({ ...BASE, sleep: 'short' }, 'sleep', 1)!.sleep).toBe('long');
  });
});

describe('composeLab', () => {
  it('à la formule appliquée : aucun écart, les chiffres de référence', () => {
    const r = composeLab(ctx(), BASE);
    expect(r.changes).toEqual([]);
    expect(r.sbd).toMatchObject({ deltaKg: 0 });
    expect(r.sbd!.projectedKg).toBeGreaterThan(372);
    expect(r.load).toEqual({ ratio: 1, zone: 'safe', delta: 0 });
    expect(r.kcalTarget).toBe(2500);
    expect(r.weightChangeKg).toBe(-1.8);
    expect(r.proteinGPerDay).toBe(140);
    expect(r.proteinStatus).toBe('in');
    expect(r.carbTarget).toEqual(CARB_TARGETS_G_PER_KG.light);
    expect(r.crossings.map((c) => [c.kind, c.tone])).toEqual([
      ['proteinStrength', 'syn'],
      ['sleepSupports', 'syn'],
    ]);
  });

  it('plus de séances : la force monte, la charge aussi, et les écarts sont listés', () => {
    const doses = { ...BASE, strengthSessions: 5, runningFrequency: 4 };
    const r = composeLab(ctx(), doses);
    expect(r.sbd!.deltaKg).toBeGreaterThan(0);
    expect(r.load!.zone).toBe('risk');
    expect(r.load!.delta).toBeCloseTo(0.33, 2);
    expect(r.crossings.map((c) => c.kind)).toEqual(['loadRisk', 'deficitHeavyWeek', 'proteinStrength', 'sleepSupports']);
    expect(r.changes).toEqual([
      { lever: 'strengthSessions', from: 3, to: 5, writable: false },
      { lever: 'runningFrequency', from: 3, to: 4, writable: true },
    ]);
  });

  it('sommeil court et deux séances de plus : garde-fou de surcharge ; vigilance de charge', () => {
    const r = composeLab(ctx({ loadRatio: 0.7 }), { ...BASE, strengthSessions: 5, sleep: 'short' });
    expect(r.crossings.map((c) => [c.kind, c.tone])).toEqual([
      ['overreach', 'guard'],
      ['deficitHeavyWeek', 'tension'],
      ['proteinStrength', 'syn'],
    ]);
    expect(r.crossings[0]!.values).toEqual({ extraSessions: 2 });
    const watch = composeLab(ctx({ loadRatio: 1.1 }), { ...BASE, strengthSessions: 4 });
    expect(watch.crossings[0]).toMatchObject({ kind: 'loadWatch', tone: 'tension' });
  });

  it('protéines basses face à la musculation ; au-dessus de la fourchette : « haut »', () => {
    const low = composeLab(ctx(), { ...BASE, proteinGPerKg: 1.4 });
    expect(low.crossings.find((c) => c.kind === 'proteinLow')).toMatchObject({ values: { gPerKg: 1.4, targetMin: 1.8 } });
    expect(low.proteinStatus).toBe('low');
    expect(composeLab(ctx(), { ...BASE, proteinGPerKg: 2.4, objective: 'maintain' }).proteinStatus).toBe('high');
  });

  it('déficit et semaine chargée côté course seule ; pas de croisement nutrition sans le pilier', () => {
    const runOnly = composeLab(ctx({ activePillars: ['running', 'nutrition'] }), { ...BASE, runningFrequency: 5 });
    expect(runOnly.crossings.find((c) => c.kind === 'deficitHeavyWeek')!.pair).toEqual(['nutrition', 'running']);
    expect(runOnly.sbd).toBeNull();
    expect(runOnly.crossings.find((c) => c.kind === 'sleepSupports')!.pair).toEqual(['sleep', 'running']);
    const noNutrition = composeLab(ctx({ activePillars: ['strength', 'running'] }), { ...BASE, strengthSessions: 4 });
    expect(noNutrition.crossings.map((c) => c.kind)).not.toContain('deficitHeavyWeek');
    expect(noNutrition.crossings.map((c) => c.kind)).not.toContain('proteinStrength');
    expect(composeLab(ctx(), { ...BASE, strengthSessions: 1, runningFrequency: 2 }).crossings).toEqual([]);
  });

  it('dégrade proprement sans historique, sans TDEE, sans poids, sans course', () => {
    const r = composeLab(ctx({ sbd: null, loadRatio: null, tdeeKcal: null, weightKg: null, hoursPerRun: null }), BASE);
    expect(r.sbd).toBeNull();
    expect(r.load).toBeNull();
    expect(r.kcalTarget).toBeNull();
    expect(r.proteinGPerDay).toBeNull();
    expect(r.carbTarget).toBeNull();
    expect(composeLab(ctx({ activePillars: ['strength', 'nutrition'] }), BASE).carbTarget).toBeNull();
    expect(composeLab(ctx(), { ...BASE, runningFrequency: 0 }).carbTarget).toBeNull();
    expect(composeLab(ctx(), { ...BASE, runningFrequency: 7 }).carbTarget).toEqual(CARB_TARGETS_G_PER_KG.moderate);
  });
});

describe('bestLabSteps', () => {
  it('propose les crans qui font gagner de la force sans ouvrir de tension', () => {
    // +1 séance ouvrirait « déficit × semaine chargée » : écartée malgré le gain.
    const steps = bestLabSteps(ctx({ loadRatio: 0.7, sbd: { lastTotalKg: 372, slopePerWeek: 2 } }), { ...BASE, proteinGPerKg: 1.6, sleep: 'short' });
    expect(steps.map((s) => s.lever)).toEqual(['sleep', 'proteinGPerKg']);
    expect(steps[0]!.deltaKg).toBeGreaterThan(steps[1]!.deltaKg);
    expect(steps.every((s) => s.deltaKg > 0)).toBe(true);
  });

  it('écarte un cran qui ouvre une vigilance, et se tait sans projection de force', () => {
    const steps = bestLabSteps(ctx({ loadRatio: 1.08 }), BASE);
    expect(steps.map((s) => s.lever)).not.toContain('strengthSessions');
    expect(bestLabSteps(ctx({ sbd: null }), BASE)).toEqual([]);
    expect(bestLabSteps(ctx(), { ...BASE, strengthSessions: 6, proteinGPerKg: 2.4 })).toEqual([]);
  });
});

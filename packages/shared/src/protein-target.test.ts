import { describe, it, expect } from 'vitest';
import { computeProteinPerKg, PROTEIN_TARGETS_G_PER_KG } from './protein-target';

describe('computeProteinPerKg', () => {
  it('null si poids manquant/≤0 ou protéines nulles', () => {
    expect(computeProteinPerKg({ avgProteinG: 150, weightKg: null, objective: 'bulk' })).toBeNull();
    expect(computeProteinPerKg({ avgProteinG: 150, weightKg: 0, objective: 'bulk' })).toBeNull();
    expect(computeProteinPerKg({ avgProteinG: null, weightKg: 75, objective: 'bulk' })).toBeNull();
  });

  it('gPerKg = protéines ÷ poids, arrondi 1 décimale', () => {
    expect(computeProteinPerKg({ avgProteinG: 149, weightKg: 75, objective: 'bulk' })!.gPerKg).toBe(2.0);
    expect(computeProteinPerKg({ avgProteinG: 150, weightKg: 80, objective: 'bulk' })!.gPerKg).toBe(1.9);
  });

  it('statut low/in/high (bulk 1,6–2,2), bornes incluses = in', () => {
    expect(computeProteinPerKg({ avgProteinG: 105, weightKg: 75, objective: 'bulk' })!.status).toBe('low');  // 1.4
    expect(computeProteinPerKg({ avgProteinG: 120, weightKg: 75, objective: 'bulk' })!.status).toBe('in');   // 1.6 (=min)
    expect(computeProteinPerKg({ avgProteinG: 165, weightKg: 75, objective: 'bulk' })!.status).toBe('in');   // 2.2 (=max)
    expect(computeProteinPerKg({ avgProteinG: 180, weightKg: 75, objective: 'bulk' })!.status).toBe('high'); // 2.4
  });

  it('cut a une borne basse plus haute (1,8)', () => {
    expect(computeProteinPerKg({ avgProteinG: 120, weightKg: 75, objective: 'cut' })!.status).toBe('low');   // 1.6 < 1.8
    expect(computeProteinPerKg({ avgProteinG: 135, weightKg: 75, objective: 'cut' })!.status).toBe('in');    // 1.8 (=min)
  });

  it('weightloss mappé sur 1,8–2,2 (pas de défaut silencieux)', () => {
    expect(PROTEIN_TARGETS_G_PER_KG.weightloss).toEqual({ min: 1.8, max: 2.2 });
    const r = computeProteinPerKg({ avgProteinG: 150, weightKg: 75, objective: 'weightloss' })!;
    expect(r.gPerKg).toBe(2.0);
    expect(r.status).toBe('in');
    expect(r.target).toEqual({ min: 1.8, max: 2.2 });
  });
});

import { describe, expect, it } from 'vitest';
import { ACWR_RISK_THRESHOLD } from './training-time';
import { projectWhatIf, whatIfConsequences, type WhatIfInput } from './what-if';

const input = (over: Partial<WhatIfInput['levers']> = {}, weights?: WhatIfInput['ruleWeights']): WhatIfInput => ({
  lastTotalKg: 372.5,
  slopePerWeek: 3.06,
  weeks: 9,
  levers: { sessionsPerWeek: 3, baselineSessions: 3, sleep: 'short', protein: 'base', ...over },
  ruleWeights: weights,
});

describe('projectWhatIf (US DASH-01, §6.3 — moteur déterministe)', () => {
  it('leviers au niveau actuel → la projection brute de projectSbd', () => {
    const r = projectWhatIf(input());
    expect(r.projectedKg).toBeCloseTo(372.5 + 3.06 * 9, 5);
    expect(r.factors).toEqual({ sessions: 1, sleep: 1, protein: 1, overreach: 1 });
    expect(r.overreach).toBe(false);
  });

  it('une séance de plus accélère la pente', () => {
    expect(projectWhatIf(input({ sessionsPerWeek: 4 })).slopePerWeek).toBeCloseTo(3.06 * 1.22, 5);
  });

  it('rendement décroissant : la 2ᵉ séance ajoute moins que la 1ʳᵉ', () => {
    const one = projectWhatIf(input({ sessionsPerWeek: 4 })).factors.sessions - 1;
    const two = projectWhatIf(input({ sessionsPerWeek: 5 })).factors.sessions - 1;
    expect(two - one).toBeLessThan(one);
  });

  it('+2 séances avec un sommeil court → garde-fou de surcharge, presque rien gagné', () => {
    const r = projectWhatIf(input({ sessionsPerWeek: 5 }));
    expect(r.overreach).toBe(true);
    expect(r.factors.overreach).toBe(0.82);
    expect(r.projectedKg).toBeLessThan(projectWhatIf(input({ sessionsPerWeek: 4 })).projectedKg);
  });

  it('le même volume avec un sommeil long ne déclenche pas la surcharge', () => {
    expect(projectWhatIf(input({ sessionsPerWeek: 5, sleep: 'long' })).overreach).toBe(false);
  });

  it('sommeil long et protéines hautes multiplient la pente', () => {
    const r = projectWhatIf(input({ sleep: 'long', protein: 'high' }));
    expect(r.factors.sleep).toBeCloseTo(1.12, 5);
    expect(r.factors.protein).toBeCloseTo(1.06, 5);
  });

  it('moins de séances que d’habitude ralentit la pente, sans passer sous 40 %', () => {
    expect(projectWhatIf(input({ sessionsPerWeek: 2 })).factors.sessions).toBeCloseTo(0.75, 5);
    expect(projectWhatIf(input({ sessionsPerWeek: 0 })).factors.sessions).toBe(0.4);
  });

  it('une règle contestée pèse moins (poids de règle, R12)', () => {
    const r = projectWhatIf(input({ sleep: 'long' }, { sleep: 0.5 }));
    expect(r.factors.sleep).toBeCloseTo(1.06, 5);
  });

  it('le garde-fou de surcharge ne se conteste pas (R12)', () => {
    const r = projectWhatIf(input({ sessionsPerWeek: 5 }, { sleep: 0 }));
    expect(r.factors.overreach).toBe(0.82);
  });

  it('la fourchette encadre la projection et s’élargit avec la surcharge', () => {
    const calm = projectWhatIf(input({ sleep: 'long' }));
    const tired = projectWhatIf(input({ sessionsPerWeek: 5 }));
    expect(calm.lowKg).toBeLessThan(calm.projectedKg);
    expect(calm.highKg).toBeGreaterThan(calm.projectedKg);
    expect(tired.highKg - tired.lowKg).toBeGreaterThan(calm.highKg - calm.lowKg);
  });

  it('une pente négative reste négative et la fourchette reste ordonnée', () => {
    const r = projectWhatIf({ ...input(), slopePerWeek: -1 });
    expect(r.projectedKg).toBeLessThan(372.5);
    expect(r.lowKg).toBeLessThan(r.highKg);
  });
});

describe('whatIfConsequences — ce que ça change sur les autres piliers', () => {
  it('rythme actuel → charge inchangée, cible inchangée', () => {
    expect(
      whatIfConsequences({
        sessionsPerWeek: 3,
        baselineSessions: 3,
        loadRatio: 1.12,
        baseKcalTarget: 2180,
        protein: 'base',
        weightKg: 78,
      }),
    ).toEqual({ loadRatio: 1.12, loadZone: 'safe', kcalTarget: 2180 });
  });

  it('+2 séances → la charge franchit le seuil de risque ACWR', () => {
    const r = whatIfConsequences({
      sessionsPerWeek: 5,
      baselineSessions: 3,
      loadRatio: 1.12,
      baseKcalTarget: 2180,
      protein: 'base',
      weightKg: 78,
    });
    expect(r.loadRatio).toBeGreaterThan(ACWR_RISK_THRESHOLD);
    expect(r.loadZone).toBe('risk');
  });

  it('+1 séance → zone de vigilance, sans alerte', () => {
    expect(
      whatIfConsequences({
        sessionsPerWeek: 4,
        baselineSessions: 3,
        loadRatio: 1.12,
        baseKcalTarget: 2180,
        protein: 'base',
        weightKg: 78,
      }).loadZone,
    ).toBe('watch');
  });

  it('protéines à 2,0 g/kg → la cible monte de 0,4 g/kg × 4 kcal', () => {
    expect(
      whatIfConsequences({
        sessionsPerWeek: 3,
        baselineSessions: 3,
        loadRatio: null,
        baseKcalTarget: 2180,
        protein: 'high',
        weightKg: 75,
      }),
    ).toEqual({ loadRatio: null, loadZone: null, kcalTarget: 2180 + 120 });
  });
});

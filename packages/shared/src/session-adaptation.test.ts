/** US RUN-F4 (lot J) — regles d'adaptation de la seance du jour, strictement consultatives. */
import { describe, expect, it } from 'vitest';
import {
  isIntenseSessionType,
  proposeSessionAdaptation,
  reducedReps,
} from './session-adaptation';
import type { AcwrResult } from './training-time';

const riskLoad: AcwrResult = { ratio: 1.6, zone: 'risk', showAlert: true };
const safeLoad: AcwrResult = { ratio: 1.0, zone: 'safe', showAlert: false };

describe('isIntenseSessionType', () => {
  it('fractionne, test et course sont intenses ; les autres sont deja la solution', () => {
    expect(isIntenseSessionType('fractionne')).toBe(true);
    expect(isIntenseSessionType('test')).toBe(true);
    expect(isIntenseSessionType('course')).toBe(true);
    expect(isIntenseSessionType('endurance')).toBe(false);
    expect(isIntenseSessionType('recuperation')).toBe(false);
    expect(isIntenseSessionType(null)).toBe(false);
  });
});

describe('proposeSessionAdaptation — douleur (DOUL-01)', () => {
  it('une douleur bloquante arrete la seance, quelle que soit son intensite', () => {
    for (const type of ['fractionne', 'endurance'] as const) {
      const proposal = proposeSessionAdaptation(type, { worstPainLevel: 'blocking' });
      expect(proposal.action).toBe('stop');
      expect(proposal.severity).toBe('alert');
    }
  });

  it('une douleur decale une seance intense de 24 h plutot que de l alleger', () => {
    // Courir moins vite sur une douleur mecanique reste courir dessus.
    expect(proposeSessionAdaptation('fractionne', { worstPainLevel: 'pain' }).action).toBe('postpone');
  });

  it('une douleur transforme une seance facile en footing', () => {
    expect(proposeSessionAdaptation('endurance', { worstPainLevel: 'pain' }).action).toBe('convert_easy');
  });

  it('une simple gene informe sans rien proposer de changer', () => {
    const proposal = proposeSessionAdaptation('fractionne', { worstPainLevel: 'discomfort' });
    expect(proposal.action).toBe('none');
    expect(proposal.severity).toBe('caution');
    expect(proposal.reasons.map((r) => r.code)).toEqual(['pain_discomfort']);
  });
});

describe('proposeSessionAdaptation — fatigue et charge', () => {
  it('une energie basse retire des repetitions et garde l echauffement', () => {
    // C'est la decision exacte du plan analyse, et elle preserve la qualite de ce qui reste.
    const proposal = proposeSessionAdaptation('fractionne', { energyLevel: 2 });
    expect(proposal.action).toBe('reduce_reps');
    expect(proposal.repsReductionPct).toBe(25);
  });

  it('une charge en zone risque retire aussi des repetitions', () => {
    expect(proposeSessionAdaptation('fractionne', { acwr: riskLoad }).action).toBe('reduce_reps');
  });

  it('ne reinvente aucun seuil de charge — seule la zone deja calculee est lue', () => {
    expect(proposeSessionAdaptation('fractionne', { acwr: safeLoad }).action).toBe('none');
  });

  it('des jambes lourdes la veille ralentissent l allure sans toucher au volume', () => {
    const proposal = proposeSessionAdaptation('fractionne', { heavyLegSessionYesterday: true });
    expect(proposal.action).toBe('slow_pace');
    expect(proposal.paceSlowdownSPerKm).toBe(4);
  });

  it("n'allege jamais une seance facile : elle EST deja la reponse adaptee", () => {
    const proposal = proposeSessionAdaptation('endurance', {
      energyLevel: 1,
      heavyLegSessionYesterday: true,
    });
    expect(proposal.action).toBe('none');
    // Le signal reste liste : on informe, on ne propose simplement rien a changer.
    expect(proposal.reasons.map((r) => r.code)).toContain('low_energy');
    expect(proposal.reasons.map((r) => r.code)).not.toContain('heavy_legs_yesterday');
  });
});

describe('proposeSessionAdaptation — combinaison des signaux', () => {
  it('un seul signal grave suffit : la douleur ne se compense pas par le reste', () => {
    // Regle R4 de readiness.ts, reprise telle quelle — jamais une moyenne qui lisserait.
    const proposal = proposeSessionAdaptation('fractionne', {
      worstPainLevel: 'blocking',
      energyLevel: 5,
      acwr: safeLoad,
    });
    expect(proposal.action).toBe('stop');
  });

  it('liste tous les signaux actifs, du plus grave au moins grave', () => {
    const proposal = proposeSessionAdaptation('fractionne', {
      worstPainLevel: 'pain',
      energyLevel: 1,
      acwr: riskLoad,
      temperatureC: 31,
    });
    expect(proposal.action).toBe('postpone');
    expect(proposal.reasons.map((r) => r.code)).toEqual([
      'pain_present',
      'low_energy',
      'load_risk',
      'heat',
    ]);
  });

  it('aucun signal : aucune proposition', () => {
    const proposal = proposeSessionAdaptation('fractionne', {});
    expect(proposal).toEqual({ action: 'none', severity: 'info', reasons: [] });
  });

  it('des signaux absents ne valent pas des signaux negatifs', () => {
    // Pas de check-in, pas d'historique de charge : on ne conclut rien.
    const proposal = proposeSessionAdaptation('fractionne', {
      worstPainLevel: null,
      energyLevel: null,
      acwr: null,
    });
    expect(proposal.action).toBe('none');
  });

  it('la chaleur fait courir a l effort — regle ecrite, source encore absente', () => {
    // La meteo est RUN-F3b, bloquee avant lancement sur un arbitrage de confidentialite.
    const proposal = proposeSessionAdaptation('fractionne', { temperatureC: 31 });
    expect(proposal.action).toBe('effort_based');
    expect(proposal.severity).toBe('info');
  });
});

describe('reducedReps', () => {
  it('8 repetitions moins 25 % en donnent 6', () => {
    expect(reducedReps(8, 25)).toBe(6);
  });

  it('ne descend jamais sous 1 : proposer zero serait une annulation, pas une adaptation', () => {
    expect(reducedReps(2, 90)).toBe(1);
    expect(reducedReps(1, 50)).toBe(1);
  });
});

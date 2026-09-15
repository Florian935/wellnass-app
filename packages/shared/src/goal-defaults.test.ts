import { describe, expect, it } from 'vitest';
import { pillarDefaults } from './goal-defaults';
import { objectiveFromGoal } from './nutrition';
import { GOALS } from './profile';

describe('pillarDefaults', () => {
  it('couvre les quatre objectifs et l’absence d’objectif', () => {
    for (const goal of GOALS) {
      const d = pillarDefaults(goal);
      expect(d.strength).toBeDefined();
      expect(d.cardio).toBeDefined();
      expect(d.nutrition).toBeDefined();
    }
    expect(pillarDefaults(null)).toBeDefined();
    expect(pillarDefaults(undefined)).toBeDefined();
  });

  /**
   * 🔴 LE test de cette US. Avant GUID-01, `performance` et `health` tombaient dans le même
   * `default → maintain` et **aucun autre site** ne lisait l'objectif : deux options sur quatre
   * donnaient une application identique à celle de quelqu'un qui avait appuyé sur « Passer ».
   */
  it('rend « performance » et « santé générale » réellement différents', () => {
    const perf = pillarDefaults('performance');
    const health = pillarDefaults('health');
    expect(perf).not.toEqual(health);
    expect(perf.strength.progression).not.toBe(health.strength.progression);
    expect(perf.cardio.emphasis).not.toBe(health.cardio.emphasis);
    expect(perf.cardio.allowIntervals).not.toBe(health.cardio.allowIntervals);
    expect(perf.nutrition.emphasis).not.toBe(health.nutrition.emphasis);
  });

  it('distingue aussi « pas de réponse » de « santé générale »', () => {
    expect(pillarDefaults(null)).not.toEqual(pillarDefaults('health'));
  });

  it('plafonne le volume de course en prise de masse (interférence MR-08), et seulement là', () => {
    expect(pillarDefaults('muscle').cardio.capVolume).toBe(true);
    expect(pillarDefaults('weightloss').cardio.capVolume).toBe(false);
    expect(pillarDefaults('performance').cardio.capVolume).toBe(false);
    expect(pillarDefaults('health').cardio.capVolume).toBe(false);
  });

  it('n’arme pas le deload en perte de poids — une stagnation y est attendue', () => {
    expect(pillarDefaults('weightloss').strength.deloadOnStagnation).toBe(false);
    expect(pillarDefaults('weightloss').strength.progression).toBe('maintain');
    expect(pillarDefaults('muscle').strength.deloadOnStagnation).toBe(true);
  });

  it('rend le garde-fou plus prudent pour « santé générale » uniquement', () => {
    expect(pillarDefaults('health').strength.conservativeGuardrail).toBe(true);
    expect(pillarDefaults('muscle').strength.conservativeGuardrail).toBe(false);
    expect(pillarDefaults('performance').strength.conservativeGuardrail).toBe(false);
  });

  it('monte le plancher de protéines en déficit', () => {
    expect(pillarDefaults('weightloss').nutrition.minProteinGPerKg).toBeGreaterThan(
      pillarDefaults('muscle').nutrition.minProteinGPerKg,
    );
  });

  it('arme les glucides péri-séance pour la masse et la performance', () => {
    expect(pillarDefaults('muscle').nutrition.periWorkoutCarbs).toBe(true);
    expect(pillarDefaults('performance').nutrition.periWorkoutCarbs).toBe(true);
    expect(pillarDefaults('weightloss').nutrition.periWorkoutCarbs).toBe(false);
  });
});

describe('objectiveFromGoal — non-régression', () => {
  /**
   * Huit sites appellent cette fonction. Elle délègue désormais à `pillarDefaults`, mais ses
   * résultats ne doivent pas avoir bougé d'un pouce : ce test fige les cinq entrées possibles.
   */
  it('rend exactement les mêmes valeurs qu’avant la délégation', () => {
    expect(objectiveFromGoal('muscle')).toBe('bulk');
    expect(objectiveFromGoal('weightloss')).toBe('weightloss');
    expect(objectiveFromGoal('performance')).toBe('maintain');
    expect(objectiveFromGoal('health')).toBe('maintain');
    expect(objectiveFromGoal(null)).toBe('maintain');
  });

  it('reste alignée sur la matrice — une seule source de vérité', () => {
    for (const goal of GOALS) {
      expect(objectiveFromGoal(goal)).toBe(pillarDefaults(goal).nutrition.objective);
    }
  });
});

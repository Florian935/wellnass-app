import { describe, it, expect } from 'vitest';
import {
  CARB_LOAD_THRESHOLDS_H,
  CARB_TARGETS_G_PER_KG,
  classifyRunningDay,
  computeCarbLoadLevel,
  computeCarbsPerKg,
  weeklyEquivalentHours,
} from './carb-target';

const H = 3600;

describe('weeklyEquivalentHours (R6 bis — normalisation de la fenêtre)', () => {
  it('fenêtre de 7 jours : identité (7/7 = 1)', () => {
    expect(weeklyEquivalentHours(5 * H, 7)).toBe(5);
  });

  it('fenêtre de 30 jours : ramène à l’équivalent hebdomadaire', () => {
    // 20 h sur 30 j = 0,667 h/j = 4,67 h/semaine
    expect(weeklyEquivalentHours(20 * H, 30)).toBeCloseTo(4.667, 3);
  });

  it('null si la fenêtre est absurde (≤ 0) — jamais une division par zéro', () => {
    expect(weeklyEquivalentHours(5 * H, 0)).toBeNull();
    expect(weeklyEquivalentHours(5 * H, -7)).toBeNull();
  });

  it('null sur une durée non finie ou négative', () => {
    expect(weeklyEquivalentHours(Number.NaN, 7)).toBeNull();
    expect(weeklyEquivalentHours(-1, 7)).toBeNull();
  });

  it('0 seconde reste 0 (c’est computeCarbLoadLevel qui décide de masquer)', () => {
    expect(weeklyEquivalentHours(0, 7)).toBe(0);
  });
});

describe('computeCarbLoadLevel (R2)', () => {
  it('aucune course → null : pas de niveau « repos » affichable (§2 condition 3)', () => {
    expect(computeCarbLoadLevel(0)).toBeNull();
  });

  it('null sur une entrée non finie ou négative (défensif, jamais un niveau au hasard)', () => {
    expect(computeCarbLoadLevel(Number.NaN)).toBeNull();
    expect(computeCarbLoadLevel(-2)).toBeNull();
    expect(computeCarbLoadLevel(null)).toBeNull();
  });

  it('> 0 h et < 3 h → light', () => {
    expect(computeCarbLoadLevel(0.1)).toBe('light');
    expect(computeCarbLoadLevel(2.99)).toBe('light');
  });

  it('borne 3 h INCLUSE → moderate', () => {
    expect(computeCarbLoadLevel(CARB_LOAD_THRESHOLDS_H.moderate)).toBe('moderate');
    expect(computeCarbLoadLevel(3)).toBe('moderate');
    expect(computeCarbLoadLevel(5.99)).toBe('moderate');
  });

  it('borne 6 h INCLUSE → high', () => {
    expect(computeCarbLoadLevel(CARB_LOAD_THRESHOLDS_H.high)).toBe('high');
    expect(computeCarbLoadLevel(6)).toBe('high');
    expect(computeCarbLoadLevel(12)).toBe('high');
  });
});

describe('computeCarbsPerKg (R3)', () => {
  it('null si poids manquant / ≤ 0, ou glucides absents (R8)', () => {
    expect(computeCarbsPerKg({ avgCarbsG: 300, weightKg: null, level: 'light' })).toBeNull();
    expect(computeCarbsPerKg({ avgCarbsG: 300, weightKg: 0, level: 'light' })).toBeNull();
    expect(computeCarbsPerKg({ avgCarbsG: 300, weightKg: -70, level: 'light' })).toBeNull();
    expect(computeCarbsPerKg({ avgCarbsG: null, weightKg: 70, level: 'light' })).toBeNull();
  });

  it('gPerKg = glucides ÷ poids, arrondi à 1 décimale', () => {
    expect(computeCarbsPerKg({ avgCarbsG: 294, weightKg: 70, level: 'light' })!.gPerKg).toBe(4.2);
    expect(computeCarbsPerKg({ avgCarbsG: 300, weightKg: 80, level: 'light' })!.gPerKg).toBe(3.8);
  });

  it('statut low / in / high, bornes INCLUSES = in (light 3–5)', () => {
    expect(computeCarbsPerKg({ avgCarbsG: 140, weightKg: 70, level: 'light' })!.status).toBe('low'); // 2.0
    expect(computeCarbsPerKg({ avgCarbsG: 210, weightKg: 70, level: 'light' })!.status).toBe('in'); // 3.0 = min
    expect(computeCarbsPerKg({ avgCarbsG: 350, weightKg: 70, level: 'light' })!.status).toBe('in'); // 5.0 = max
    expect(computeCarbsPerKg({ avgCarbsG: 420, weightKg: 70, level: 'light' })!.status).toBe('high'); // 6.0
  });

  it('le niveau change la fourchette, donc le statut, à apports constants', () => {
    // 4,2 g/kg : dans la cible en volume léger, sous la cible en gros volume.
    const light = computeCarbsPerKg({ avgCarbsG: 294, weightKg: 70, level: 'light' })!;
    const high = computeCarbsPerKg({ avgCarbsG: 294, weightKg: 70, level: 'high' })!;
    expect(light.gPerKg).toBe(high.gPerKg);
    expect(light.status).toBe('in');
    expect(high.status).toBe('low');
    expect(high.target).toEqual({ min: 7, max: 10 });
  });

  it('les 3 niveaux exposent bien leur fourchette (aucun défaut silencieux)', () => {
    expect(CARB_TARGETS_G_PER_KG.light).toEqual({ min: 3, max: 5 });
    expect(CARB_TARGETS_G_PER_KG.moderate).toEqual({ min: 5, max: 7 });
    expect(CARB_TARGETS_G_PER_KG.high).toEqual({ min: 7, max: 10 });
  });
});

describe('classifyRunningDay (R5, D4)', () => {
  it('aucune séance planifiée → rest', () => {
    expect(classifyRunningDay([])).toBe('rest');
  });

  it('fractionné et sortie longue → hard', () => {
    expect(classifyRunningDay(['fractionne'])).toBe('hard');
    expect(classifyRunningDay(['sortie_longue'])).toBe('hard');
  });

  it('endurance et récupération → easy', () => {
    expect(classifyRunningDay(['endurance'])).toBe('easy');
    expect(classifyRunningDay(['recuperation'])).toBe('easy');
  });

  it('le plus exigeant gagne quand deux séances tombent le même jour (§9)', () => {
    expect(classifyRunningDay(['fractionne', 'endurance'])).toBe('hard');
    expect(classifyRunningDay(['endurance', 'sortie_longue'])).toBe('hard');
  });

  it('course libre → unavailable : on ne connaît pas son type (D4)', () => {
    expect(classifyRunningDay(['course_libre'])).toBe('unavailable');
  });

  it('l’inconnu contamine : une course libre à côté d’une endurance → unavailable', () => {
    // On ne peut pas affirmer « journée facile » quand une des deux séances est de type inconnu.
    expect(classifyRunningDay(['course_libre', 'endurance'])).toBe('unavailable');
    expect(classifyRunningDay(['course_libre', 'fractionne'])).toBe('unavailable');
  });

  it('un type inattendu (donnée corrompue) est traité comme inconnu, pas ignoré', () => {
    expect(classifyRunningDay(['zumba' as never])).toBe('unavailable');
  });
});

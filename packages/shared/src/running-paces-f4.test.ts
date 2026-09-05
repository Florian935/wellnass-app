/**
 * US RUN-F4 (lot A) — l'allure cible devient une donnee saisissable.
 * Tests des ajouts a `running-paces.ts` ; les tests historiques restent dans
 * `running-paces.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SEGMENT_KIND,
  RECOVERY_KINDS,
  SEGMENT_KINDS,
  isTimedSessionType,
  formatMmSs,
  normalizePaceRange,
  parseMmSs,
  paceFromDistanceAndTime,
  resolveSessionPace,
  sessionTargetPace,
} from './running-paces';

describe('paceFromDistanceAndTime', () => {
  it('lit « 400 m en 1:38 » comme 4:05/km', () => {
    // 98 s / 0,4 km = 245 s/km = 4:05/km. C'est la conversion qui manquait pour la forme
    // canonique de 12 des 24 seances du plan analyse.
    expect(paceFromDistanceAndTime(400, 98)).toBeCloseTo(245, 5);
  });

  it('lit « 5 km en 20:00 » comme 4:00/km', () => {
    expect(paceFromDistanceAndTime(5000, 1200)).toBeCloseTo(240, 5);
  });

  it("rend null plutot qu'Infinity sur une distance nulle ou negative", () => {
    expect(paceFromDistanceAndTime(0, 98)).toBeNull();
    expect(paceFromDistanceAndTime(-400, 98)).toBeNull();
  });

  it('rend null sur une entree absente ou un temps nul', () => {
    expect(paceFromDistanceAndTime(null, 98)).toBeNull();
    expect(paceFromDistanceAndTime(400, null)).toBeNull();
    expect(paceFromDistanceAndTime(400, 0)).toBeNull();
  });
});

describe('normalizePaceRange', () => {
  it('deux bornes ordonnees passent telles quelles', () => {
    expect(normalizePaceRange(245, 250)).toEqual({ minSPerKm: 245, maxSPerKm: 250 });
  });

  it("remet des bornes inversees dans l'ordre", () => {
    // En allure, min = le chiffre le PLUS PETIT (le plus rapide) : l'erreur de saisie est
    // frequente parce que « minimum » evoque spontanement l'effort le plus faible.
    expect(normalizePaceRange(250, 245)).toEqual({ minSPerKm: 245, maxSPerKm: 250 });
  });

  it('une seule borne donne une plage degeneree', () => {
    // « exactement 4:00/km » (affutage du plan analyse) est un usage normal.
    expect(normalizePaceRange(240, null)).toEqual({ minSPerKm: 240, maxSPerKm: 240 });
    expect(normalizePaceRange(null, 240)).toEqual({ minSPerKm: 240, maxSPerKm: 240 });
  });

  it('aucune borne, ou des bornes non positives, donnent null', () => {
    expect(normalizePaceRange(null, null)).toBeNull();
    expect(normalizePaceRange(0, 0)).toBeNull();
    expect(normalizePaceRange(-10, undefined)).toBeNull();
  });
});

describe('resolveSessionPace — ordre de priorite', () => {
  it("l'allure saisie gagne sur tout le reste", () => {
    const resolved = resolveSessionPace({
      explicitMinSPerKm: 260,
      explicitMaxSPerKm: 265,
      sessionType: 'endurance',
      targetDistanceM: 5000,
      targetTimeSeconds: 1200,
      ref5kPaceSPerKm: 240,
    });
    expect(resolved).toEqual({ range: { minSPerKm: 260, maxSPerKm: 265 }, source: 'explicit' });
  });

  it("a defaut, l'objectif chrono sur la distance", () => {
    const resolved = resolveSessionPace({
      sessionType: 'course',
      targetDistanceM: 5000,
      targetTimeSeconds: 1200,
      ref5kPaceSPerKm: 240,
    });
    expect(resolved?.source).toBe('target-time');
    expect(resolved?.range.minSPerKm).toBeCloseTo(240, 5);
  });

  it('a defaut, la bande derivee historique — comportement inchange', () => {
    const resolved = resolveSessionPace({ sessionType: 'endurance', ref5kPaceSPerKm: 240 });
    expect(resolved).toEqual({ range: { minSPerKm: 300, maxSPerKm: 330 }, source: 'derived' });
  });

  it("rend null quand rien n'est calculable — jamais une valeur neutre inventee", () => {
    // Sans allure de reference ET sans saisie, il n'existe aucune allure par defaut : l'ecran
    // doit afficher l'indisponibilite et son remede (patron ALLURE-01).
    expect(resolveSessionPace({ sessionType: 'endurance', ref5kPaceSPerKm: null })).toBeNull();
    expect(resolveSessionPace({})).toBeNull();
  });

  it("une seance test sans chrono ni saisie n'a pas d'allure derivee", () => {
    // Inventer une bande pour un contre-la-montre reviendrait a prescrire une consigne que
    // personne n'a donnee.
    expect(resolveSessionPace({ sessionType: 'test', ref5kPaceSPerKm: 240 })).toBeNull();
  });
});

describe('types de seance chronometres (lot G)', () => {
  it('test et course sont chronometres, les autres non', () => {
    expect(isTimedSessionType('test')).toBe(true);
    expect(isTimedSessionType('course')).toBe(true);
    expect(isTimedSessionType('fractionne')).toBe(false);
    expect(isTimedSessionType(null)).toBe(false);
  });

  it('sessionTargetPace ne derive aucune bande pour test et course', () => {
    expect(sessionTargetPace('test', 240)).toBeNull();
    expect(sessionTargetPace('course', 240)).toBeNull();
  });
});

describe('natures de segment (lot B)', () => {
  it('couvre echauffement, gammes, corps, recuperation et retour au calme', () => {
    expect(SEGMENT_KINDS).toEqual(['warmup', 'drills', 'work', 'recovery', 'cooldown']);
  });

  it('le defaut est « work » — le sens exact des lignes RUN-F2c deja en base', () => {
    expect(DEFAULT_SEGMENT_KIND).toBe('work');
    expect(SEGMENT_KINDS).toContain(DEFAULT_SEGMENT_KIND);
  });

  it('distingue trot, marche, arret et libre en recuperation', () => {
    expect(RECOVERY_KINDS).toEqual(['jog', 'walk', 'static', 'free']);
  });
});

describe('parseMmSs / formatMmSs — la saisie du coureur', () => {
  it('lit « 4:05 » comme 245 secondes', () => {
    // Personne n'écrit « 245 s/km » : tout le monde écrit « 4:05 ».
    expect(parseMmSs('4:05')).toBe(245);
  });

  it('lit un nombre nu comme des MINUTES', () => {
    // « 20 » sur un objectif de course vaut 20:00, jamais 20 secondes.
    expect(parseMmSs('20')).toBe(1200);
  });

  it('lit un format h:mm:ss — un objectif de marathon dépasse l’heure', () => {
    expect(parseMmSs('3:30:00')).toBe(12_600);
  });

  it('tolère la virgule comme séparateur et les espaces', () => {
    expect(parseMmSs(' 4,05 ')).toBe(245);
  });

  it('rend null sur une saisie illisible — jamais un zéro qui effacerait la consigne', () => {
    expect(parseMmSs('abc')).toBeNull();
    expect(parseMmSs('4:5:6:7')).toBeNull();
    expect(parseMmSs('4:75')).toBeNull();
    expect(parseMmSs('')).toBeNull();
    expect(parseMmSs(null)).toBeNull();
  });

  it('formate pour la saisie, et le résultat se relit', () => {
    expect(formatMmSs(245)).toBe('4:05');
    expect(formatMmSs(1200)).toBe('20:00');
    expect(formatMmSs(12_600)).toBe('3:30:00');
    expect(parseMmSs(formatMmSs(245))).toBe(245);
  });

  it('rend une chaîne vide sur une absence de valeur', () => {
    expect(formatMmSs(null)).toBe('');
    expect(formatMmSs(-5)).toBe('');
  });
});

import { describe, expect, it } from 'vitest';
import {
  computeAcwr,
  computeConcurrentTrainingInterference,
  computeLoadStreakAlert,
  computeOvertrainingGuard,
  computeTrainingTime,
  countDeficitDaysInWindow,
  formatHoursMinutes,
  sessionLoad,
} from './training-time';

describe('computeTrainingTime', () => {
  it('somme muscu + course', () => {
    expect(computeTrainingTime({ strengthSeconds: 7800, runningSeconds: 8400 })).toEqual({
      totalSeconds: 16200,
      strengthSeconds: 7800,
      runningSeconds: 8400,
    });
  });
  it('clamp les valeurs négatives / non finies à 0', () => {
    expect(computeTrainingTime({ strengthSeconds: -10, runningSeconds: Number.NaN })).toEqual({
      totalSeconds: 0,
      strengthSeconds: 0,
      runningSeconds: 0,
    });
  });
  it('tout à zéro', () => {
    expect(computeTrainingTime({ strengthSeconds: 0, runningSeconds: 0 })).toEqual({
      totalSeconds: 0,
      strengthSeconds: 0,
      runningSeconds: 0,
    });
  });
});

describe('formatHoursMinutes', () => {
  it('formate Xh YY (minutes zéro-paddées, arrondi minute inférieure)', () => {
    expect(formatHoursMinutes(16200)).toBe('4h 30');
    expect(formatHoursMinutes(16259)).toBe('4h 30'); // 59 s résiduelles ignorées
    expect(formatHoursMinutes(0)).toBe('0h 00');
    expect(formatHoursMinutes(300)).toBe('0h 05');
    expect(formatHoursMinutes(3600)).toBe('1h 00');
  });
  it('robuste aux valeurs invalides', () => {
    expect(formatHoursMinutes(-5)).toBe('0h 00');
    expect(formatHoursMinutes(Number.NaN)).toBe('0h 00');
  });
});

describe('sessionLoad (US META-19)', () => {
  it('RPE × durée en minutes', () => {
    expect(sessionLoad({ rpe: 7, durationSeconds: 3600 })).toBe(420); // 7 × 60 min
  });
  it('rpe manquant → 0 (ni ignorée ni inventée, spec R1)', () => {
    expect(sessionLoad({ rpe: null, durationSeconds: 3600 })).toBe(0);
  });
  it('durationSeconds manquant → 0', () => {
    expect(sessionLoad({ rpe: 7, durationSeconds: null })).toBe(0);
  });
});

describe('computeAcwr (US META-19)', () => {
  it('aucune charge chronique → null (spec R6, pas de division par une base vide)', () => {
    expect(computeAcwr({ acuteSessions: [], chronicSessions: [] })).toBeNull();
    expect(
      computeAcwr({
        acuteSessions: [{ rpe: 8, durationSeconds: 3600 }],
        chronicSessions: [{ rpe: null, durationSeconds: 3600 }], // contribue 0
      }),
    ).toBeNull();
  });

  it('ratio = 1 quand aiguë/j == chronique/j (formule vérifiée à la main)', () => {
    const result = computeAcwr({
      acuteSessions: [{ rpe: 10, durationSeconds: 4200 }], // charge 700, /7 = 100
      chronicSessions: [{ rpe: 10, durationSeconds: 16800 }], // charge 2800, /28 = 100
    });
    expect(result?.ratio).toBeCloseTo(1, 5);
    expect(result?.showAlert).toBe(false);
    expect(result?.zone).toBe('safe');
  });

  it('ratio > 1,3 → showAlert true (zone de risque, spec R4)', () => {
    const result = computeAcwr({
      acuteSessions: [{ rpe: 10, durationSeconds: 6000 }], // charge 1000, /7 ≈ 142,86
      chronicSessions: [{ rpe: 10, durationSeconds: 16800 }], // charge 2800, /28 = 100
    });
    expect(result?.ratio).toBeGreaterThan(1.3);
    expect(result?.showAlert).toBe(true);
    expect(result?.zone).toBe('risk');
  });

  it('ratio < 0,8 → showAlert false aussi (zone basse hors périmètre, spec R5)', () => {
    const result = computeAcwr({
      acuteSessions: [{ rpe: 5, durationSeconds: 4200 }], // charge 350, /7 = 50
      chronicSessions: [{ rpe: 10, durationSeconds: 16800 }], // charge 2800, /28 = 100
    });
    expect(result?.ratio).toBeLessThan(0.8);
    expect(result?.showAlert).toBe(false);
    expect(result?.zone).toBe('low');
  });
});

describe('computeAcwr — zone (US RUN-18, bornes inclusives)', () => {
  it('ratio pile 0,8 → zone saine (borne basse incluse)', () => {
    const result = computeAcwr({
      acuteSessions: [{ rpe: 10, durationSeconds: 3360 }], // charge 560, /7 = 80
      chronicSessions: [{ rpe: 10, durationSeconds: 16800 }], // charge 2800, /28 = 100
    });
    expect(result?.ratio).toBeCloseTo(0.8, 5);
    expect(result?.zone).toBe('safe');
  });

  it('ratio pile 1,3 → zone saine (borne haute incluse, pas encore risque)', () => {
    const result = computeAcwr({
      acuteSessions: [{ rpe: 10, durationSeconds: 5460 }], // charge 910, /7 = 130
      chronicSessions: [{ rpe: 10, durationSeconds: 16800 }], // charge 2800, /28 = 100
    });
    expect(result?.ratio).toBeCloseTo(1.3, 5);
    expect(result?.zone).toBe('safe');
    expect(result?.showAlert).toBe(false);
  });
});

describe('computeConcurrentTrainingInterference (US MR-08, spec R1/R2/R3)', () => {
  it('course en forte hausse + muscu en forte chute → runningUpStrengthDown', () => {
    const result = computeConcurrentTrainingInterference({
      acuteRunDistanceM: 21000, // /7 = 3000/j
      chronicRunDistanceM: 42000, // /28 = 1500/j → ratio = 2 (> 1,3)
      acuteStrengthVolumeKg: 500, // /7 ≈ 71,4/j
      chronicStrengthVolumeKg: 5600, // /28 = 200/j → ratio ≈ 0,357 (< 0,8)
    });
    expect(result).toEqual({ show: true, direction: 'runningUpStrengthDown' });
  });

  it('muscu en forte hausse + course en forte chute → strengthUpRunningDown (symétrique, R4)', () => {
    const result = computeConcurrentTrainingInterference({
      acuteRunDistanceM: 500,
      chronicRunDistanceM: 5600, // ratio ≈ 0,357 (< 0,8)
      acuteStrengthVolumeKg: 21000,
      chronicStrengthVolumeKg: 42000, // ratio = 2 (> 1,3)
    });
    expect(result).toEqual({ show: true, direction: 'strengthUpRunningDown' });
  });

  it('les deux ratios montent ensemble → pas de divergence (R2)', () => {
    const result = computeConcurrentTrainingInterference({
      acuteRunDistanceM: 21000,
      chronicRunDistanceM: 42000, // ratio = 2
      acuteStrengthVolumeKg: 21000,
      chronicStrengthVolumeKg: 42000, // ratio = 2
    });
    expect(result).toEqual({ show: false, direction: null });
  });

  it('les deux ratios chutent ensemble → pas de divergence (R2)', () => {
    const result = computeConcurrentTrainingInterference({
      acuteRunDistanceM: 500,
      chronicRunDistanceM: 5600, // ratio ≈ 0,357
      acuteStrengthVolumeKg: 500,
      chronicStrengthVolumeKg: 5600, // ratio ≈ 0,357
    });
    expect(result).toEqual({ show: false, direction: null });
  });

  it('un ratio haut, l’autre en zone saine (pas franchement bas) → pas de divergence (R2)', () => {
    const result = computeConcurrentTrainingInterference({
      acuteRunDistanceM: 21000,
      chronicRunDistanceM: 42000, // ratio = 2 (haut)
      acuteStrengthVolumeKg: 2800, // /7 = 400/j
      chronicStrengthVolumeKg: 11200, // /28 = 400/j → ratio = 1 (zone saine, pas < 0,8)
    });
    expect(result).toEqual({ show: false, direction: null });
  });

  it('aucune course sur 28 j (chronique nul) → historique insuffisant, masqué (R3)', () => {
    const result = computeConcurrentTrainingInterference({
      acuteRunDistanceM: 0,
      chronicRunDistanceM: 0,
      acuteStrengthVolumeKg: 500,
      chronicStrengthVolumeKg: 5600,
    });
    expect(result).toEqual({ show: false, direction: null });
  });

  it('aucune séance muscu sur 28 j (chronique nul) → historique insuffisant, masqué (R3, symétrique)', () => {
    const result = computeConcurrentTrainingInterference({
      acuteRunDistanceM: 21000,
      chronicRunDistanceM: 42000,
      acuteStrengthVolumeKg: 0,
      chronicStrengthVolumeKg: 0,
    });
    expect(result).toEqual({ show: false, direction: null });
  });

  it('ratios pile aux bornes (1,3 et 0,8 exacts) → zone saine côté bornes, pas de divergence', () => {
    const result = computeConcurrentTrainingInterference({
      acuteRunDistanceM: 5460, // /7 = 780
      chronicRunDistanceM: 16800, // /28 = 600 → ratio = 1,3 exact
      acuteStrengthVolumeKg: 3360, // /7 = 480
      chronicStrengthVolumeKg: 16800, // /28 = 600 → ratio = 0,8 exact
    });
    expect(result).toEqual({ show: false, direction: null });
  });
});

describe('countDeficitDaysInWindow (US TRI-12)', () => {
  it('4 jours en déficit sur une liste de 7 → 4', () => {
    const days = [
      { kcal: 1500 }, // (2000-1500)/2000 = 25 % → déficit
      { kcal: 1600 }, // 20 % → déficit
      { kcal: 1700 }, // 15 % → pile le seuil, déficit
      { kcal: 1900 }, // 5 % → pas déficit
      { kcal: 2000 }, // 0 % → pas déficit
      { kcal: 1000 }, // 50 % → déficit
      { kcal: 2100 }, // surplus → pas déficit
    ];
    expect(countDeficitDaysInWindow(days, 2000)).toBe(4);
  });

  it('3 jours en déficit sur une liste de 5 (jours loggés incomplets) → 3, pas une proportion', () => {
    // 3/5 = 60 % des jours loggés, mais la fonction ne connaît que le compte absolu — elle ne
    // renvoie jamais un ratio ni n'extrapole sur les jours manquants (spec R3, point relu).
    const days = [{ kcal: 1000 }, { kcal: 1200 }, { kcal: 1300 }, { kcal: 1900 }, { kcal: 2000 }];
    expect(countDeficitDaysInWindow(days, 2000)).toBe(3);
  });

  it('targetKcal <= 0 → 0 (pas de division par une cible absente)', () => {
    expect(countDeficitDaysInWindow([{ kcal: 500 }], 0)).toBe(0);
    expect(countDeficitDaysInWindow([{ kcal: 500 }], -100)).toBe(0);
  });

  it('aucun jour → 0', () => {
    expect(countDeficitDaysInWindow([], 2000)).toBe(0);
  });
});

describe('computeOvertrainingGuard (US TRI-12)', () => {
  it('streak 6 + déficit 4 → show true (les deux bornes pile atteintes)', () => {
    expect(computeOvertrainingGuard({ loadStreakDays: 6, deficitDaysCount: 4 })).toEqual({
      show: true,
    });
  });

  it('streak 6 + déficit 3 → show false (R4, un seul signal ne suffit pas)', () => {
    expect(computeOvertrainingGuard({ loadStreakDays: 6, deficitDaysCount: 3 })).toEqual({
      show: false,
    });
  });

  it('streak 5 + déficit 4 → show false', () => {
    expect(computeOvertrainingGuard({ loadStreakDays: 5, deficitDaysCount: 4 })).toEqual({
      show: false,
    });
  });

  it('streak 8 + déficit 7 → show true (au-delà des deux seuils)', () => {
    expect(computeOvertrainingGuard({ loadStreakDays: 8, deficitDaysCount: 7 })).toEqual({
      show: true,
    });
  });
});

describe('computeLoadStreakAlert (US MR-14, spec R2/R3)', () => {
  const noGuard = { overtrainingGuardShown: false };

  it('streak 5 → masqué (sous le seuil de 6)', () => {
    expect(computeLoadStreakAlert({ streakDays: 5, ...noGuard })).toEqual({
      show: false,
      streakDays: 5,
    });
  });

  it('streak 6 → visible (borne incluse, même seuil que TRI-12 — pas un nouveau chiffre)', () => {
    expect(computeLoadStreakAlert({ streakDays: 6, ...noGuard })).toEqual({
      show: true,
      streakDays: 6,
    });
  });

  it('streak 10 → visible, streakDays remonté tel quel pour le message interpolé', () => {
    expect(computeLoadStreakAlert({ streakDays: 10, ...noGuard })).toEqual({
      show: true,
      streakDays: 10,
    });
  });

  it('streak 0 (compte neuf, aucun historique) → masqué', () => {
    expect(computeLoadStreakAlert({ streakDays: 0, ...noGuard })).toEqual({
      show: false,
      streakDays: 0,
    });
  });

  it('ne regarde aucune donnée nutrition (spec R4) — le streak seul décide du seuil', () => {
    // Contraste explicite avec `computeOvertrainingGuard`, qui exige deux signaux : à streak égal
    // et sans déficit, TRI-12 se taît et MR-14 parle — c'est exactement le résidu que cette US
    // couvre (spec §0).
    expect(computeLoadStreakAlert({ streakDays: 7, ...noGuard }).show).toBe(true);
    expect(computeOvertrainingGuard({ loadStreakDays: 7, deficitDaysCount: 0 }).show).toBe(false);
  });

  // -------------------------------------------------------------------------
  // D1 — masquage mutuel avec TRI-12 (règle sans aucun test avant la revue de code)
  // -------------------------------------------------------------------------

  it('D1 — streak au-dessus du seuil MAIS TRI-12 affiché → masqué (TRI-12 prime)', () => {
    expect(
      computeLoadStreakAlert({ streakDays: 9, overtrainingGuardShown: true }),
    ).toEqual({ show: false, streakDays: 9 });
  });

  it('D1 — `streakDays` reste renseigné même masqué (seul `show` est neutralisé)', () => {
    // Garde-fou contre une implémentation qui remettrait le compte à 0 en même temps que `show` :
    // la valeur reste juste, seule la décision d'affichage change.
    const masked = computeLoadStreakAlert({ streakDays: 12, overtrainingGuardShown: true });
    expect(masked.streakDays).toBe(12);
    expect(masked.show).toBe(false);
  });

  it('D1 — sous le seuil ET TRI-12 affiché → masqué (les deux raisons cumulées)', () => {
    expect(
      computeLoadStreakAlert({ streakDays: 3, overtrainingGuardShown: true }),
    ).toEqual({ show: false, streakDays: 3 });
  });
});

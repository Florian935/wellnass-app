import { describe, expect, it } from 'vitest';
import {
  computeAcwr,
  computeConcurrentTrainingInterference,
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

describe('computeOvertrainingGuard (US TRI-12, fusionnée par GARDE-01)', () => {
  // Les 4 tests d'origine de TRI-12 sont **conservés et adaptés** (GARDE-01 plan étape 1) : ils
  // restent la preuve de non-régression du diagnostic composite. Seule la forme du retour change…
  // …sauf le deuxième, dont la **valeur attendue** change volontairement (voir son commentaire).

  it('streak 6 + déficit 4 → niveau surcharge (les deux bornes pile atteintes)', () => {
    expect(computeOvertrainingGuard({ loadStreakDays: 6, deficitDaysCount: 4 })).toEqual({
      show: true,
      severity: 'streakAndDeficit',
      streakDays: 6,
    });
  });

  it('streak 6 + déficit 3 → visible au niveau repos (R2 de GARDE-01 remplace R4 de TRI-12)', () => {
    // ⚠️ **Changement de comportement assumé, pas une régression.** TRI-12 R4 disait « un seul
    // signal ne suffit jamais » → `{show: false}`. MR-14 affirmait l'inverse ; GARDE-01 arbitre la
    // contradiction (spec §0) en faveur de MR-14 : le streak seul suffit à afficher, le déficit ne
    // décide plus que du **niveau**. C'est LE test à ne pas confondre avec une régression en revue.
    expect(computeOvertrainingGuard({ loadStreakDays: 6, deficitDaysCount: 3 })).toEqual({
      show: true,
      severity: 'streak',
      streakDays: 6,
    });
  });

  it('streak 5 + déficit 4 → masqué (sous le seuil de streak, le déficit ne rattrape pas)', () => {
    expect(computeOvertrainingGuard({ loadStreakDays: 5, deficitDaysCount: 4 })).toEqual({
      show: false,
      severity: null,
      streakDays: 5,
    });
  });

  it('streak 8 + déficit 7 → niveau surcharge (au-delà des deux seuils)', () => {
    expect(computeOvertrainingGuard({ loadStreakDays: 8, deficitDaysCount: 7 })).toEqual({
      show: true,
      severity: 'streakAndDeficit',
      streakDays: 8,
    });
  });

  // ---- Niveaux de sévérité (GARDE-01, spec R3) ----------------------------------

  it('streak 6 pile + aucun déficit → niveau repos (borne basse du streak incluse)', () => {
    expect(computeOvertrainingGuard({ loadStreakDays: 6, deficitDaysCount: 0 })).toEqual({
      show: true,
      severity: 'streak',
      streakDays: 6,
    });
  });

  it('déficit 4 pile avec streak suffisant → niveau surcharge (borne basse du déficit incluse)', () => {
    expect(computeOvertrainingGuard({ loadStreakDays: 7, deficitDaysCount: 4 }).severity).toBe(
      'streakAndDeficit',
    );
  });

  it('nutrition inactive (vue de la fonction : deficitDaysCount 0) → niveau repos, jamais surcharge', () => {
    // Spec R4/D2 : la nutrition **dégrade la composante** au lieu de garder le widget. Le hook
    // passe 0 quand le pilier est inactif ; le niveau surcharge devient alors inatteignable.
    const result = computeOvertrainingGuard({ loadStreakDays: 9, deficitDaysCount: 0 });
    expect(result.show).toBe(true);
    expect(result.severity).toBe('streak');
  });

  it('streak 0 → masqué, severity null', () => {
    expect(computeOvertrainingGuard({ loadStreakDays: 0, deficitDaysCount: 0 })).toEqual({
      show: false,
      severity: null,
      streakDays: 0,
    });
  });

  it('`streakDays` est remonté fidèlement dans les trois états (masqué / repos / surcharge)', () => {
    // Sert le titre interpolé du niveau repos (spec §6) — doit rester juste même quand masqué.
    expect(computeOvertrainingGuard({ loadStreakDays: 4, deficitDaysCount: 9 }).streakDays).toBe(4);
    expect(computeOvertrainingGuard({ loadStreakDays: 11, deficitDaysCount: 0 }).streakDays).toBe(11);
    expect(computeOvertrainingGuard({ loadStreakDays: 11, deficitDaysCount: 5 }).streakDays).toBe(11);
  });
});

// `computeLoadStreakAlert` (US MR-14) et ses 8 tests ont été **supprimés** par GARDE-01 : la
// fonction est entièrement absorbée par `computeOvertrainingGuard` ci-dessus (niveau `streak`).
// Les 3 tests qui couvraient sa règle D1 (masquage mutuel) disparaissent avec la règle elle-même ;
// leur remplaçant est « streak 6 + déficit 3 → niveau repos » (spec §0, arbitrage de la contradiction).

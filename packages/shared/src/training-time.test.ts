import { describe, expect, it } from 'vitest';
import { computeAcwr, computeTrainingTime, formatHoursMinutes, sessionLoad } from './training-time';

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
  });

  it('ratio > 1,3 → showAlert true (zone de risque, spec R4)', () => {
    const result = computeAcwr({
      acuteSessions: [{ rpe: 10, durationSeconds: 6000 }], // charge 1000, /7 ≈ 142,86
      chronicSessions: [{ rpe: 10, durationSeconds: 16800 }], // charge 2800, /28 = 100
    });
    expect(result?.ratio).toBeGreaterThan(1.3);
    expect(result?.showAlert).toBe(true);
  });

  it('ratio < 0,8 → showAlert false aussi (zone basse hors périmètre, spec R5)', () => {
    const result = computeAcwr({
      acuteSessions: [{ rpe: 5, durationSeconds: 4200 }], // charge 350, /7 = 50
      chronicSessions: [{ rpe: 10, durationSeconds: 16800 }], // charge 2800, /28 = 100
    });
    expect(result?.ratio).toBeLessThan(0.8);
    expect(result?.showAlert).toBe(false);
  });
});

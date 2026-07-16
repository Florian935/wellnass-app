import { describe, expect, it } from 'vitest';
import { computeTrainingTime, formatHoursMinutes } from './training-time';

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

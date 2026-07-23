import { describe, expect, it } from 'vitest';
import {
  WORKOUT_DISPLAY_LEVELS,
  coerceWorkoutDisplayLevel,
  workoutDisplayLevelSchema,
} from './workout-display';

describe('workout display level', () => {
  it('expose exactement 3 niveaux', () => {
    expect(WORKOUT_DISPLAY_LEVELS).toEqual(['simplified', 'normal', 'detailed']);
  });

  it('valide les valeurs connues', () => {
    for (const v of WORKOUT_DISPLAY_LEVELS) {
      expect(workoutDisplayLevelSchema.parse(v)).toBe(v);
    }
  });

  it('coerce null / inconnu / undefined → normal', () => {
    expect(coerceWorkoutDisplayLevel(null)).toBe('normal');
    expect(coerceWorkoutDisplayLevel(undefined)).toBe('normal');
    expect(coerceWorkoutDisplayLevel('bogus')).toBe('normal');
  });

  it('coerce une valeur connue en elle-même', () => {
    expect(coerceWorkoutDisplayLevel('simplified')).toBe('simplified');
    expect(coerceWorkoutDisplayLevel('detailed')).toBe('detailed');
  });
});

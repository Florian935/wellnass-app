import { describe, expect, it } from 'vitest';
import {
  WORKOUT_DISPLAY_LEVELS,
  coerceWorkoutDisplayLevel,
  workoutDisplayLevelSchema,
  workoutFieldVisibility,
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

describe('workoutFieldVisibility', () => {
  it('simplifiée : tout le supplémentaire est masqué', () => {
    expect(workoutFieldVisibility('simplified')).toEqual({
      delta: false, suggestion: false, warmupShortcut: false,
      typeSelector: false, rpe: false, note: false, superset: false,
    });
  });
  it('normale : delta + suggestion + échauffement ; pas de types/rpe/note/superset', () => {
    expect(workoutFieldVisibility('normal')).toEqual({
      delta: true, suggestion: true, warmupShortcut: true,
      typeSelector: false, rpe: false, note: false, superset: false,
    });
  });
  it('détaillée : tout est visible', () => {
    expect(workoutFieldVisibility('detailed')).toEqual({
      delta: true, suggestion: true, warmupShortcut: true,
      typeSelector: true, rpe: true, note: true, superset: true,
    });
  });
});

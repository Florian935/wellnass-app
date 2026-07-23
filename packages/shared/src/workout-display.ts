import { z } from 'zod';

/** Niveaux d'affichage de l'écran de séance muscu (MUSC-F13). */
export const WORKOUT_DISPLAY_LEVELS = ['simplified', 'normal', 'detailed'] as const;
export const workoutDisplayLevelSchema = z.enum(WORKOUT_DISPLAY_LEVELS);
export type WorkoutDisplayLevel = z.infer<typeof workoutDisplayLevelSchema>;

/** Défaut applicatif : toute valeur NULL / inconnue est traitée comme « normal ». */
export function coerceWorkoutDisplayLevel(value: string | null | undefined): WorkoutDisplayLevel {
  return value === 'simplified' || value === 'normal' || value === 'detailed' ? value : 'normal';
}

import { z } from 'zod';
import { syncFieldsSchema, uuidSchema, utcTimestampSchema } from './sync';

/**
 * Types de série — détermine comment interpréter reps/poids/durée.
 * - `normal`     : série classique (reps + poids).
 * - `warmup`     : échauffement ; **exclue du calcul de volume**.
 * - `superset`   : enchaînement avec un autre exercice.
 * - `duration`   : série à la durée (reps non pertinent, durationSeconds utilisé).
 * - `bodyweight` : série au poids de corps (weightKg peut être nul).
 */
export const SET_TYPES = ['normal', 'warmup', 'superset', 'duration', 'bodyweight'] as const;
export const setTypeSchema = z.enum(SET_TYPES);
export type SetType = z.infer<typeof setTypeSchema>;

/**
 * Statuts d'une séance.
 * - `active`    : séance en cours.
 * - `completed` : séance terminée normalement.
 * - `cancelled` : séance interrompue / abandonnée.
 */
export const WORKOUT_STATUSES = ['active', 'completed', 'cancelled'] as const;
export const workoutStatusSchema = z.enum(WORKOUT_STATUSES);
export type WorkoutStatus = z.infer<typeof workoutStatusSchema>;

/**
 * Ligne séance (table `workouts`).
 * Étend `syncFieldsSchema` (id + userId + timestamps + soft delete).
 */
export const workoutRowSchema = syncFieldsSchema.extend({
  /** Identifiant de la session planifiée associée (nullable). */
  sessionId: uuidSchema.nullable(),
  /** Identifiant du programme associé (nullable). */
  programId: uuidSchema.nullable(),
  /** Statut courant de la séance. */
  status: workoutStatusSchema,
  /** Moment de démarrage de la séance (UTC). */
  startedAt: utcTimestampSchema,
  /** Moment de fin de la séance (UTC, nullable si en cours). */
  finishedAt: utcTimestampSchema.nullable(),
  /** Durée totale en secondes (nullable, calculée à la fin). */
  durationSeconds: z.number().int().nonnegative().nullable(),
  /** Effort perçu (Rate of Perceived Exertion), entier entre 1 et 10. */
  rpe: z.number().int().min(1).max(10).nullable(),
  /** Notes libres sur la séance. */
  notes: z.string().nullable(),
});
export type WorkoutRow = z.infer<typeof workoutRowSchema>;

/**
 * Ligne série (table `workout_sets`).
 * Étend `syncFieldsSchema` (id + userId + timestamps + soft delete).
 */
export const workoutSetRowSchema = syncFieldsSchema.extend({
  /** Séance parente. */
  workoutId: uuidSchema,
  /** Exercice réalisé. */
  exerciseId: uuidSchema,
  /** Position de la série dans la séance (0-based). */
  orderIndex: z.number().int().min(0),
  /** Type de série. */
  setType: setTypeSchema,
  /** Nombre de répétitions (nullable pour les séries à la durée). */
  reps: z.number().int().nullable(),
  /** Charge en kilogrammes (nullable pour les séries au poids de corps). */
  weightKg: z.number().nullable(),
  /** Durée en secondes (utilisée pour `setType === 'duration'`). */
  durationSeconds: z.number().int().nullable(),
  /** Indique si la série a été validée (cochée) par l'utilisateur. */
  done: z.boolean(),
});
export type WorkoutSetRow = z.infer<typeof workoutSetRowSchema>;

// ---------------------------------------------------------------------------
// Helpers de calcul
// ---------------------------------------------------------------------------

/**
 * Calcule le volume total d'une liste de séries.
 *
 * Volume = Σ (reps × weightKg) pour les séries où :
 *   - `done === true`
 *   - `setType !== 'warmup'`
 *
 * Les valeurs `null` pour `reps` ou `weightKg` sont traitées comme 0
 * (contribution nulle, sans lever d'erreur).
 *
 * @param sets - Liste (en lecture seule) de séries.
 * @returns Volume total en kg·reps.
 */
export function computeVolume(
  sets: ReadonlyArray<{
    setType: string;
    reps: number | null;
    weightKg: number | null;
    done: boolean;
  }>,
): number {
  return sets.reduce<number>((total, set) => {
    if (!set.done || set.setType === 'warmup') {
      return total;
    }
    const reps = set.reps ?? 0;
    const weightKg = set.weightKg ?? 0;
    return total + reps * weightKg;
  }, 0);
}

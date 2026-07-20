import { z } from 'zod';
import { syncFieldsSchema, uuidSchema, utcTimestampSchema } from './sync';

/**
 * Types de série — détermine comment interpréter reps/poids/durée.
 * - `normal`     : série classique (reps + poids).
 * - `warmup`     : échauffement ; **exclue du calcul de volume**.
 * - `superset`   : enchaînement avec un autre exercice.
 * - `duration`   : série à la durée (reps non pertinent, durationSeconds utilisé) ;
 *                  **exclue du calcul des records** (une charge tenue en gainage
 *                  n'est pas un record de charge max).
 * - `bodyweight` : série au poids de corps (weightKg peut être nul).
 * - `dropset`    : série dégressive (baisse de charge sans repos entre les blocs).
 * - `failure`    : série menée jusqu'à l'échec musculaire.
 */
export const SET_TYPES = [
  'normal',
  'warmup',
  'superset',
  'duration',
  'bodyweight',
  'dropset',
  'failure',
] as const;
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
  /**
   * Effort perçu (RPE) de **cette série**, entier entre 1 et 10.
   * Distinct du `rpe` de séance (`workoutRowSchema.rpe`), qui reflète le
   * ressenti global de la séance.
   */
  rpe: z.number().int().min(1).max(10).nullable(),
  /** Charge planifiée pour la série, figée au démarrage de la séance. */
  plannedWeightKg: z.number().nonnegative().nullable(),
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

export type ReorderOperation =
  | { type: 'swap'; exerciseId: string; direction: 'up' | 'down' }
  | { type: 'toEnd'; exerciseId: string };

/**
 * Calcule le nouvel ordre des exercices d'une séance après une opération de
 * réorganisation (§2.1/§4.3 US Refonte-C3). Ne réordonne QUE les exercices
 * `done: false` entre eux ; les exercices `done: true` gardent leur position
 * absolue (index dans le tableau retourné). Fonction pure : ne fait aucune
 * lecture/écriture, le repository se charge de dériver l'entrée et d'écrire
 * le résultat (renumérotation complète des `order_index`, voir workout-repository.ts).
 */
export function computeReorderedExerciseOrder(
  exercises: ReadonlyArray<{ exerciseId: string; done: boolean }>,
  operation: ReorderOperation,
): string[] {
  const remaining = exercises.filter((e) => !e.done).map((e) => e.exerciseId);

  if (operation.type === 'swap') {
    const index = remaining.indexOf(operation.exerciseId);
    if (index === -1) return exercises.map((e) => e.exerciseId);
    const target = operation.direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= remaining.length) return exercises.map((e) => e.exerciseId);
    [remaining[index], remaining[target]] = [remaining[target]!, remaining[index]!];
  } else {
    const index = remaining.indexOf(operation.exerciseId);
    if (index !== -1) {
      remaining.splice(index, 1);
      remaining.push(operation.exerciseId);
    }
  }

  let cursor = 0;
  return exercises.map((e) => (e.done ? e.exerciseId : remaining[cursor++] ?? e.exerciseId));
}

export type ProgressionSuggestion =
  | { kind: 'weightOrReps'; weightKg: number; reps: number }
  | { kind: 'reps'; reps: number }
  | { kind: 'duration'; durationSeconds: number }
  | null;

/**
 * Règle de suggestion de progression discrète (§2.4/§3 US Refonte-C3), RPE-aware.
 * `lastSets` = séries qualifiantes (non-warmup) de la dernière séance terminée où
 * l'exercice apparaît — sert de garde-fou (échec / RPE élevé → aucune suggestion).
 * `referenceSet` = la série de la dernière fois au même rang que la série en cours
 * (peut être absente) — sert de base aux valeurs suggérées.
 */
export function computeProgressionSuggestion(
  lastSets: ReadonlyArray<{ setType: string; rpe: number | null; done: boolean }>,
  referenceSet:
    | { setType: string; reps: number | null; weightKg: number | null; durationSeconds: number | null }
    | undefined,
  opts: { weightIncrementKg: number; durationIncrementSeconds: number },
): ProgressionSuggestion {
  const qualifying = lastSets.filter((s) => s.done);
  if (qualifying.length === 0 || !referenceSet) return null;
  if (qualifying.some((s) => s.setType === 'failure')) return null;

  const rpeValues = qualifying.map((s) => s.rpe).filter((r): r is number => r != null);
  const maxRpe = rpeValues.length > 0 ? Math.max(...rpeValues) : null;
  if (maxRpe != null && maxRpe >= 8) return null;

  if (referenceSet.setType === 'duration') {
    if (referenceSet.durationSeconds == null) return null;
    return { kind: 'duration', durationSeconds: referenceSet.durationSeconds + opts.durationIncrementSeconds };
  }
  if (referenceSet.weightKg == null) {
    if (referenceSet.reps == null) return null;
    return { kind: 'reps', reps: referenceSet.reps + 1 };
  }
  if (referenceSet.reps == null) return null;
  return {
    kind: 'weightOrReps',
    weightKg: referenceSet.weightKg + opts.weightIncrementKg,
    reps: referenceSet.reps + 1,
  };
}

import { z } from 'zod';
import { syncFieldsSchema, uuidSchema, utcTimestampSchema } from './sync';

/**
 * Types de records personnels muscu.
 * - `max_weight`    : charge maximale soulevée en une série.
 * - `estimated_1rm` : 1RM estimé par la formule Epley.
 * - `best_volume`   : meilleur volume en une seule série (reps × charge).
 */
export const RECORD_TYPES = ['max_weight', 'estimated_1rm', 'best_volume'] as const;
export const recordTypeSchema = z.enum(RECORD_TYPES);
export type RecordType = z.infer<typeof recordTypeSchema>;

// ---------------------------------------------------------------------------
// Schéma de ligne record (table `personal_records`)
// ---------------------------------------------------------------------------

/**
 * Ligne record personnel (table `personal_records`).
 * Étend `syncFieldsSchema` (id + userId + timestamps + soft delete).
 */
export const personalRecordRowSchema = syncFieldsSchema.extend({
  /** Exercice auquel se rapporte le record. */
  exerciseId: uuidSchema,
  /** Type de record. */
  type: recordTypeSchema,
  /** Valeur du record (charge en kg, 1RM estimé en kg, ou volume en kg·reps). */
  value: z.number(),
  /** Nombre de répétitions de la série qui a produit ce record (contexte). */
  reps: z.number().int().nullable(),
  /** Charge en kg de la série qui a produit ce record (contexte). */
  weightKg: z.number().nullable(),
  /** Séance lors de laquelle le record a été réalisé (nullable). */
  workoutId: uuidSchema.nullable(),
  /** Horodatage UTC de la réalisation du record. */
  achievedAt: utcTimestampSchema,
});
export type PersonalRecordRow = z.infer<typeof personalRecordRowSchema>;

// ---------------------------------------------------------------------------
// Helpers de calcul
// ---------------------------------------------------------------------------

/**
 * Estime le 1RM (une répétition maximum) avec la formule d'Epley.
 *
 * Formule : `weightKg × (1 + reps / 30)`
 *
 * Garde-fous :
 *  - Si `reps <= 1`, retourne `weightKg` directement (un 1RM est le poids lui-même).
 *  - Si `reps <= 0` (y compris négatif), retourne `weightKg` (pas de calcul possible).
 *
 * @param weightKg - Charge soulevée en kilogrammes.
 * @param reps     - Nombre de répétitions réalisées.
 * @returns 1RM estimé, arrondi à 2 décimales.
 */
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 1) {
    return weightKg;
  }
  const raw = weightKg * (1 + reps / 30);
  return Math.round(raw * 100) / 100;
}

/**
 * Calcule le meilleur 1RM estimé d'une séance à partir de ses séries.
 *
 * Seules les séries ayant à la fois `reps` et `weightKg` renseignés
 * (non `null`) sont prises en compte ; le meilleur (maximum) des
 * `estimate1RM` obtenus est retourné.
 *
 * @param sets - Séries de la séance (reps et poids potentiellement `null`).
 * @returns Meilleur 1RM estimé, ou `0` si aucune série n'est qualifiante.
 */
export function sessionBestEstimated1RM(
  sets: ReadonlyArray<{ reps: number | null; weightKg: number | null }>,
): number {
  let best = 0;
  for (const s of sets) {
    if (s.reps == null || s.weightKg == null) continue;
    const oneRm = estimate1RM(s.weightKg, s.reps);
    if (oneRm > best) best = oneRm;
  }
  return best;
}

/** Une mesure de 1RM (valeur en kg + date ISO UTC de réalisation). */
export type OneRepMaxSample = { value: number; date: string };

/**
 * Choisit le 1RM à afficher : le **réel** (série effectuée à 1 rep) s'il existe,
 * sinon l'**estimé** (Epley). `real` indique la provenance. `null` si aucun.
 */
export function pickOneRepMax(
  real: OneRepMaxSample | null,
  estimated: OneRepMaxSample | null,
): { value: number; date: string; real: boolean } | null {
  if (real) return { value: real.value, date: real.date, real: true };
  if (estimated) return { value: estimated.value, date: estimated.date, real: false };
  return null;
}

// ---------------------------------------------------------------------------
// Calcul des records d'une séance
// ---------------------------------------------------------------------------

/** Candidat record produit par `computeWorkoutRecords`. */
export interface WorkoutRecordCandidate {
  exerciseId: string;
  type: RecordType;
  value: number;
  /** Reps de la série ayant produit la valeur (contexte). */
  reps: number | null;
  /** Charge de la série ayant produit la valeur (contexte). */
  weightKg: number | null;
}

/**
 * Calcule les candidats records d'une séance à partir de ses exercices.
 *
 * Pour chaque exercice, seules les séries satisfaisant toutes les conditions
 * suivantes sont considérées :
 *  - `done === true`
 *  - `setType !== 'warmup'`
 *  - `setType !== 'duration'` (une charge tenue en gainage ne doit pas
 *    produire de record « charge max » ; `bodyweight` lesté reste éligible)
 *  - les valeurs numériques requises sont non-nulles
 *
 * Pour chaque (exercice, type), un seul candidat est émis — celui
 * correspondant à la valeur maximale. Si aucune série valide n'existe
 * pour un type donné, aucun candidat n'est émis.
 *
 * @param exercises - Exercices de la séance avec leurs séries.
 * @returns Tableau de candidats records (un par combinaison exercice × type valide).
 */
export function computeWorkoutRecords(
  exercises: ReadonlyArray<{
    exerciseId: string;
    sets: ReadonlyArray<{
      reps: number | null;
      weightKg: number | null;
      setType: string;
      done: boolean;
    }>;
  }>,
): WorkoutRecordCandidate[] {
  const candidates: WorkoutRecordCandidate[] = [];

  for (const exercise of exercises) {
    const { exerciseId } = exercise;

    // Filtre des séries éligibles (done + non-warmup + non-duration)
    const validSets = exercise.sets.filter(
      (s) => s.done === true && s.setType !== 'warmup' && s.setType !== 'duration',
    );

    // --- max_weight ---
    // Requiert : weightKg != null
    let bestMaxWeight: { value: number; reps: number | null; weightKg: number } | null = null;
    for (const s of validSets) {
      if (s.weightKg == null) continue;
      if (bestMaxWeight === null || s.weightKg > bestMaxWeight.value) {
        bestMaxWeight = { value: s.weightKg, reps: s.reps, weightKg: s.weightKg };
      }
    }
    if (bestMaxWeight !== null) {
      candidates.push({
        exerciseId,
        type: 'max_weight',
        value: bestMaxWeight.value,
        reps: bestMaxWeight.reps,
        weightKg: bestMaxWeight.weightKg,
      });
    }

    // --- estimated_1rm ---
    // Requiert : weightKg != null && reps != null
    let bestEst1rm: { value: number; reps: number; weightKg: number } | null = null;
    for (const s of validSets) {
      if (s.weightKg == null || s.reps == null) continue;
      const est = estimate1RM(s.weightKg, s.reps);
      if (bestEst1rm === null || est > bestEst1rm.value) {
        bestEst1rm = { value: est, reps: s.reps, weightKg: s.weightKg };
      }
    }
    if (bestEst1rm !== null) {
      candidates.push({
        exerciseId,
        type: 'estimated_1rm',
        value: bestEst1rm.value,
        reps: bestEst1rm.reps,
        weightKg: bestEst1rm.weightKg,
      });
    }

    // --- best_volume ---
    // Volume d'une seule série = reps × weightKg
    // Requiert : weightKg != null && reps != null
    let bestVolume: { value: number; reps: number; weightKg: number } | null = null;
    for (const s of validSets) {
      if (s.weightKg == null || s.reps == null) continue;
      const vol = s.reps * s.weightKg;
      if (bestVolume === null || vol > bestVolume.value) {
        bestVolume = { value: vol, reps: s.reps, weightKg: s.weightKg };
      }
    }
    if (bestVolume !== null) {
      candidates.push({
        exerciseId,
        type: 'best_volume',
        value: bestVolume.value,
        reps: bestVolume.reps,
        weightKg: bestVolume.weightKg,
      });
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Record par plage de répétitions (US MUSC-09, roadmap 3.56)
// ---------------------------------------------------------------------------

/**
 * Plages de reps — bornes fixes, non paramétrables (spec R1). Couvrent tout le spectre sans trou
 * ni chevauchement : une série réelle tombe rarement pile sur les ancres du catalogue
 * (1/3/5/8/10/12+), d'où des plages plutôt que des valeurs exactes. `maxReps: Infinity` sur la
 * dernière plage — 15, 20 reps y tombent aussi, pas seulement 12-13.
 */
export const REP_BUCKETS = [
  { key: '1', minReps: 1, maxReps: 1 },
  { key: '3', minReps: 2, maxReps: 4 },
  { key: '5', minReps: 5, maxReps: 7 },
  { key: '8', minReps: 8, maxReps: 9 },
  { key: '10', minReps: 10, maxReps: 11 },
  { key: '12plus', minReps: 12, maxReps: Infinity },
] as const;
export type RepBucketKey = (typeof REP_BUCKETS)[number]['key'];

/** Un record de plage de reps, prêt pour l'affichage. */
export type RepBucketRecord = {
  bucketKey: RepBucketKey;
  weightKg: number;
  achievedAt: string;
};

/**
 * Distribue des séries (déjà filtrées en éligibilité par l'appelant, spec R3 — cette fonction ne
 * réapplique pas `done`/`set_type`) vers les 6 plages de reps, en gardant la charge maximale de
 * chacune. Égalité de charge dans une même plage → la plus récente gagne (spec R5). Une plage sans
 * série qualifiante est **absente** du résultat (spec R4). Ordre du résultat = ordre de
 * `REP_BUCKETS` (spec R6), jamais un tri par charge.
 */
export function resolveRepBucketRecords(
  sets: ReadonlyArray<{ reps: number; weightKg: number; achievedAt: string }>,
): RepBucketRecord[] {
  const bestByBucket = new Map<RepBucketKey, RepBucketRecord>();

  for (const bucket of REP_BUCKETS) {
    let best: RepBucketRecord | null = null;
    for (const s of sets) {
      if (s.reps < bucket.minReps || s.reps > bucket.maxReps) continue;
      if (
        best === null ||
        s.weightKg > best.weightKg ||
        (s.weightKg === best.weightKg && s.achievedAt > best.achievedAt)
      ) {
        best = { bucketKey: bucket.key, weightKg: s.weightKg, achievedAt: s.achievedAt };
      }
    }
    if (best !== null) bestByBucket.set(bucket.key, best);
  }

  return REP_BUCKETS.map((b) => bestByBucket.get(b.key)).filter(
    (r): r is RepBucketRecord => r !== undefined,
  );
}

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Objectifs coureur
// ---------------------------------------------------------------------------

export const RUNNER_OBJECTIVES = ['5k', '10k', 'semi', 'marathon', 'perte_poids', 'endurance'] as const;
export const runnerObjectiveSchema = z.enum(RUNNER_OBJECTIVES);
export type RunnerObjective = z.infer<typeof runnerObjectiveSchema>;

// ---------------------------------------------------------------------------
// Niveaux coureur
// ---------------------------------------------------------------------------

export const RUNNER_LEVELS = ['debutant', 'regulier', 'confirme'] as const;
export const runnerLevelSchema = z.enum(RUNNER_LEVELS);
export type RunnerLevel = z.infer<typeof runnerLevelSchema>;

// ---------------------------------------------------------------------------
// Types de seance
// ---------------------------------------------------------------------------

export const SESSION_TYPES = ['endurance', 'fractionne', 'sortie_longue', 'recuperation', 'course_libre'] as const;
export const sessionTypeSchema = z.enum(SESSION_TYPES);
export type SessionType = z.infer<typeof sessionTypeSchema>;

/** Types de seance utilisables dans un programme (course libre exclue). */
export const PROGRAM_SESSION_TYPES = ['endurance', 'fractionne', 'sortie_longue', 'recuperation'] as const;
export type ProgramSessionType = (typeof PROGRAM_SESSION_TYPES)[number];

// ---------------------------------------------------------------------------
// Validation de cible de seance
// ---------------------------------------------------------------------------

/** Une seance running de programme a besoin d'au moins une cible (distance en m OU duree en s). */
export function hasRunningSessionTarget(
  targetDistanceM: number | null | undefined,
  targetDurationSeconds: number | null | undefined,
): boolean {
  return (targetDistanceM != null && targetDistanceM > 0)
    || (targetDurationSeconds != null && targetDurationSeconds > 0);
}

// ---------------------------------------------------------------------------
// Derivation VMA
// ---------------------------------------------------------------------------

/** Allure 5 km ~= 95 % de l'allure a VMA (vitesse). Ajustable. */
export const VMA_COEFFICIENT = 0.95;

/** Allure (s/km) a 100 % VMA, derivee de l'allure de ref 5 km. */
export function derivedVmaPace(ref5kPaceSPerKm: number): number {
  return ref5kPaceSPerKm * VMA_COEFFICIENT;
}

// ---------------------------------------------------------------------------
// Plages d'allure cible par type de seance
// ---------------------------------------------------------------------------

export type PaceRange = { minSPerKm: number; maxSPerKm: number };

/**
 * Plage d'allure cible pour un type de seance, depuis l'allure de ref 5 km (s/km).
 * Retourne null pour course_libre (pas de cible).
 *
 * - endurance     : ref + 60 .. ref + 90  (allure confortable)
 * - sortie_longue : ref + 30 .. ref + 60  (allure moderee)
 * - recuperation  : ref + 90 .. ref + 120 (allure tres lente)
 * - fractionne    : vma .. ref            (effort intense)
 * - course_libre  : null
 */
export function sessionTargetPace(type: SessionType, ref5kPaceSPerKm: number): PaceRange | null {
  switch (type) {
    case 'endurance':
      return { minSPerKm: ref5kPaceSPerKm + 60, maxSPerKm: ref5kPaceSPerKm + 90 };
    case 'sortie_longue':
      return { minSPerKm: ref5kPaceSPerKm + 30, maxSPerKm: ref5kPaceSPerKm + 60 };
    case 'recuperation':
      return { minSPerKm: ref5kPaceSPerKm + 90, maxSPerKm: ref5kPaceSPerKm + 120 };
    case 'fractionne': {
      const vma = derivedVmaPace(ref5kPaceSPerKm);
      return { minSPerKm: vma, maxSPerKm: vma / VMA_COEFFICIENT };
    }
    case 'course_libre':
      return null;
  }
}

import { z } from 'zod';
import { addDays, localDayKey, startOfWeek } from './date';

export type PlannedStatus = 'planned' | 'done' | 'skipped';

/**
 * Schéma de validation runtime des entrées de planification d'un programme (R3c-i).
 * Sécurise les saisies UI (TextField) : `durationWeeks` doit être un entier > 0 (sinon
 * `generatePlannedSessions` produirait 0 séance en silence), les jours affectés ∈ [0..6].
 */
export const planProgramInputSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationWeeks: z.number().int().positive(),
  dayAssignments: z.record(z.string(), z.number().int().min(0).max(6)),
});
export type PlanProgramInput = z.infer<typeof planProgramInputSchema>;

/** Session du template de programme : un type de séance associé à un jour de semaine. */
export interface PlanTemplateSession {
  sessionId: string;
  dayOfWeek: number; // 0 = lundi … 6 = dimanche
}

/** Instance de séance planifiée générée à partir du template. */
export interface GeneratedPlannedSession {
  sessionId: string;
  scheduledDate: string; // AAAA-MM-JJ
  weekIndex: number;
}

/**
 * Génère les instances de séances planifiées pour toutes les semaines du programme.
 * La génération est alignée sur le lundi de la semaine contenant `startDate`.
 */
export function generatePlannedSessions(input: {
  templateSessions: PlanTemplateSession[];
  startDate: string; // AAAA-MM-JJ
  durationWeeks: number;
}): GeneratedPlannedSession[] {
  const [y, m, d] = input.startDate.split('-').map(Number);
  const weekMonday = startOfWeek(new Date(y!, m! - 1, d!));
  const out: GeneratedPlannedSession[] = [];
  for (let w = 0; w < input.durationWeeks; w++) {
    for (const s of input.templateSessions) {
      const date = addDays(weekMonday, w * 7 + s.dayOfWeek);
      out.push({ sessionId: s.sessionId, scheduledDate: localDayKey(date), weekIndex: w });
    }
  }
  return out;
}

/**
 * Détermine si une séance est manquée : date passée (strictement avant aujourd'hui)
 * et statut encore `planned`. Dates au format AAAA-MM-JJ (comparaison lexicographique = chronologique).
 */
export function isMissed(scheduledDate: string, status: PlannedStatus, today: string): boolean {
  return status === 'planned' && scheduledDate < today;
}

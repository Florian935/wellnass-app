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
 *
 * ── Première semaine partielle (US MUSCU-UX01) ───────────────────────────────────────────────────
 * Les occurrences **antérieures à `startDate`** ne sont pas générées.
 *
 * Jusqu'ici l'assistant imposait de commencer un lundi (`weekStart` initialisé au lundi *suivant*),
 * donc `startDate` était toujours un lundi et aucune occurrence ne pouvait tomber avant : le filtre
 * ne changeait rien. Il devient nécessaire dès qu'on peut démarrer **aujourd'hui** — sans lui, un
 * programme lancé un mercredi naîtrait avec ses séances du lundi et du mardi déjà « manquées ».
 *
 * La première semaine est donc **incomplète**, et c'est le comportement juste : quand on démarre un
 * programme en milieu de semaine, on fait les séances qui restent, pas celles qui sont passées. Les
 * semaines suivantes sont pleines, et `weekIndex` reste calé sur la semaine calendaire — ce dont
 * dépend l'adhérence à la semaine précédente (MUSC-F15).
 *
 * ⚠️ **Non-régression course** : `startDate` y reste un lundi, donc aucune occurrence n'est filtrée
 * et le comportement est strictement inchangé.
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
      const scheduledDate = localDayKey(date);
      // Comparaison lexicographique = chronologique sur AAAA-MM-JJ (même patron qu'`isMissed`).
      if (scheduledDate < input.startDate) continue;
      out.push({ sessionId: s.sessionId, scheduledDate, weekIndex: w });
    }
  }
  return out;
}

/**
 * Compte les occurrences qu'engendrerait une planification, **première semaine partielle comprise**.
 *
 * Sert au libellé du bouton de l'assistant, qui annonçait `séances × semaines` — un compte devenu
 * faux dès qu'on peut démarrer en milieu de semaine.
 */
export function countPlannedSessions(input: {
  templateSessions: PlanTemplateSession[];
  startDate: string;
  durationWeeks: number;
}): number {
  return generatePlannedSessions(input).length;
}

/**
 * Détermine si une séance est manquée : date passée (strictement avant aujourd'hui)
 * et statut encore `planned`. Dates au format AAAA-MM-JJ (comparaison lexicographique = chronologique).
 */
export function isMissed(scheduledDate: string, status: PlannedStatus, today: string): boolean {
  return status === 'planned' && scheduledDate < today;
}

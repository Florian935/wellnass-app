/** Entrée du helper pur de détection des jours d'entraînement. */
export interface TrainingDayInput {
  /** Une séance muscu/course a été TERMINÉE ce jour-là (rétroactif, tout jour). */
  retroactiveDone: boolean;
  /** Une séance est PLANIFIÉE ce jour-là (statut planned|done). */
  hasPlanned: boolean;
  /** Jour évalué, `AAAA-MM-JJ` (clé locale). */
  dayKey: string;
  /** Aujourd'hui, `AAAA-MM-JJ` (clé locale). */
  todayKey: string;
}

/**
 * Un jour est « jour d'entraînement » si une séance y a été FAITE (rétroactif,
 * tout jour) OU si une séance y est PLANIFIÉE et que le jour est aujourd'hui ou
 * futur (anticipation). Le passé n'est jamais anticipé. Comparaison de clés
 * `AAAA-MM-JJ` (lexicographique = chronologique).
 */
export function isTrainingDay(i: TrainingDayInput): boolean {
  return i.retroactiveDone || (i.hasPlanned && i.dayKey >= i.todayKey);
}

/**
 * L'objectif d'un exercice planifié, tel que l'aperçu de la séance l'annonce — US MUSCU-UX07, §4.5.
 *
 * L'aperçu doit dire **exactement ce que Démarrer créera** : `startWorkoutFromSession` crée
 * `max(1, target_sets)` séries, reprend `target_reps` (du texte : « 8-12 », « AMRAP ») et pose
 * `target_weight_kg` comme charge de départ. D'où la même règle ici.
 */

export type SessionTarget = {
  /** Nombre de séries que le démarrage créera (au moins une). */
  sets: number;
  /** Répétitions cibles telles qu'écrites dans le plan, `null` si rien n'est écrit. */
  reps: string | null;
  /** Charge prévue par le programme, `null` sinon. */
  plannedWeightKg: number | null;
};

export function resolveSessionTarget(plan: {
  targetSets: number | null;
  targetReps: string | null;
  targetWeightKg: number | null;
}): SessionTarget {
  const reps = plan.targetReps?.trim() ?? '';
  return {
    sets: Math.max(1, plan.targetSets ?? 1),
    reps: reps === '' ? null : reps,
    plannedWeightKg: plan.targetWeightKg,
  };
}

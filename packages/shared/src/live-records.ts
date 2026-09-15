/**
 * Records détectés **pendant** la séance — US MUSCU-UX03, spec §5.4.
 *
 * Jusqu'ici les records n'étaient évalués qu'à la clôture (`evaluateWorkoutRecords`) : on apprenait
 * qu'on avait battu son record au bilan, une fois l'émotion retombée. Ce module refait la même
 * comparaison **en mémoire**, à chaque validation, à partir des meilleures valeurs lues une fois au
 * lancement de la séance.
 *
 * Trois principes, tous dans la spec :
 *  - **mêmes règles d'éligibilité** que `computeWorkoutRecords` (série faite, ni échauffement ni
 *    durée, valeurs non nulles) — sinon l'app fêterait un record que la clôture n'enregistrerait pas ;
 *  - **pas de record sans passé** : un exercice sans aucun record enregistré ne déclenche rien (une
 *    première séance vaudrait quinze records) ;
 *  - **rien n'est écrit ici**. L'écriture reste le fait de la clôture ; ce module ne sert qu'à
 *    l'affichage en direct, ce qui rend la dé-validation d'une série gratuite (on recalcule).
 */

import { estimate1RM } from './records';
import type { SetType } from './workout';

/** Meilleures valeurs connues pour un exercice, au lancement de la séance puis mises à jour. */
export type ExerciseBests = {
  /** Charge maximale enregistrée, `null` si l'exercice n'a aucun record. */
  maxWeightKg: number | null;
  /** Meilleur 1RM estimé enregistré, `null` si aucun. */
  estimated1rm: number | null;
};

/** Une série candidate — mêmes champs que ceux que regarde `computeWorkoutRecords`. */
export type LiveSet = {
  setType: SetType;
  reps: number | null;
  weightKg: number | null;
  done: boolean;
};

export type LiveRecord = {
  type: 'max_weight' | 'estimated_1rm';
  /** Valeur atteinte (kg, ou 1RM estimé en kg). */
  value: number;
  /** Valeur précédente, toujours définie : sans passé, il n'y a pas de record (voir en-tête). */
  previous: number;
};

/** Éligibilité, copiée sur `computeWorkoutRecords` : une seule définition, deux implémentations. */
function isEligible(set: LiveSet): boolean {
  return set.done && set.setType !== 'warmup' && set.setType !== 'duration';
}

/**
 * Le record que cette série vient de battre, ou `null`.
 *
 * Priorité **charge max** puis **1RM estimé** : une seule annonce par série, et la charge parle plus
 * fort que l'estimation. Le volume (`best_volume`) n'est jamais annoncé en direct (spec §5.4) — il
 * reste compté à la clôture.
 */
export function evaluateLiveRecord(set: LiveSet, bests: ExerciseBests): LiveRecord | null {
  if (!isEligible(set) || set.weightKg === null) return null;

  if (bests.maxWeightKg !== null && set.weightKg > bests.maxWeightKg) {
    return { type: 'max_weight', value: set.weightKg, previous: bests.maxWeightKg };
  }

  if (set.reps === null) return null;
  const estimated = estimate1RM(set.weightKg, set.reps);
  if (bests.estimated1rm !== null && estimated > bests.estimated1rm) {
    return { type: 'estimated_1rm', value: estimated, previous: bests.estimated1rm };
  }

  return null;
}

/**
 * Meilleures valeurs après cette série. Appliqué **même quand aucun record n'a été annoncé** : la
 * première série d'un exercice sans passé pose la référence, et la deuxième ne doit pas se comparer
 * à un record vide (sinon la même séance annoncerait deux fois « plus lourd que jamais »).
 */
export function applyLiveSet(bests: ExerciseBests, set: LiveSet): ExerciseBests {
  if (!isEligible(set) || set.weightKg === null) return bests;

  const maxWeightKg =
    bests.maxWeightKg === null ? set.weightKg : Math.max(bests.maxWeightKg, set.weightKg);

  if (set.reps === null) return { maxWeightKg, estimated1rm: bests.estimated1rm };

  const estimated = estimate1RM(set.weightKg, set.reps);
  const estimated1rm =
    bests.estimated1rm === null ? estimated : Math.max(bests.estimated1rm, estimated);

  return { maxWeightKg, estimated1rm };
}

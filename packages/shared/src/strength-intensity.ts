/**
 * US MUSCPWR-01 (catalogue MUSC-16) — **intensité relative** : exprimer une charge en % du 1RM.
 *
 * C'est la brique qui rend lisible une séance de force : « 5 × 100 kg » ne dit rien sans le maximum
 * de la personne, « 5 × 82 % » se compare d'une semaine à l'autre et d'un pratiquant à l'autre.
 *
 * Réf. : docs/specs/functional/us/muscpwr01-module-force.md
 */

/** Une série, réduite à ce dont l'intensité a besoin. */
export type IntensitySet = {
  weightKg: number | null;
  reps: number | null;
  /** `'warmup'` est exclu du calcul (règle R5). */
  setType: string;
};

/** Un record personnel, réduit de même. */
export type OneRmRecord = {
  exerciseId: string;
  /** Seul `'estimated_1rm'` est retenu (décision D6). */
  type: string;
  value: number;
};

/**
 * Charge exprimée en % du 1RM.
 *
 * **Non borné à 100** (règle R3) : une série au-dessus du maximum connu affiche > 100 %, parce que
 * c'est un nouveau record et que l'information est juste. Rabattre à 100 % masquerait précisément
 * ce qu'on veut voir.
 *
 * `null` si le 1RM est inconnu ou absurde (règle R2) : afficher un pourcentage calculé sur un
 * maximum inventé est pire que ne rien afficher.
 */
export function percentOfMax(
  weightKg: number | null | undefined,
  oneRmKg: number | null | undefined,
): number | null {
  if (weightKg == null || !Number.isFinite(weightKg)) return null;
  if (oneRmKg == null || !Number.isFinite(oneRmKg) || oneRmKg <= 0) return null;
  return (weightKg / oneRmKg) * 100;
}

/**
 * Meilleur 1RM estimé connu pour un exercice — **le plus élevé, pas le plus récent** (règle R1).
 *
 * Prendre le plus récent ferait bondir les pourcentages après une séance légère : « 95 % du max »
 * sur une séance de récupération n'a aucun sens, et donnerait l'impression d'un effort maximal.
 */
export function bestKnownOneRm(
  records: readonly OneRmRecord[],
  exerciseId: string,
): number | null {
  let best: number | null = null;
  for (const r of records) {
    if (r.exerciseId !== exerciseId || r.type !== 'estimated_1rm') continue;
    if (!Number.isFinite(r.value) || r.value <= 0) continue;
    if (best === null || r.value > best) best = r.value;
  }
  return best;
}

/**
 * Intensité relative moyenne d'une séance, **pondérée par les répétitions** (règle R4).
 *
 * Une moyenne simple des séries mettrait sur le même plan un single à 95 % et 10 répétitions à
 * 60 % — alors que la seconde série représente dix fois plus de travail. La pondération par les
 * reps reflète la charge réellement soulevée.
 *
 * Les séries d'échauffement sont **exclues** (règle R5) : elles tireraient la moyenne vers le bas et
 * feraient passer une séance lourde pour une séance modérée.
 *
 * `null` si aucune série ne qualifie — jamais 0 %, qui se lirait comme « aucun effort ».
 */
export function sessionRelativeIntensity(
  sets: readonly IntensitySet[],
  oneRmKg: number | null | undefined,
): number | null {
  if (oneRmKg == null || !Number.isFinite(oneRmKg) || oneRmKg <= 0) return null;

  let weightedSum = 0;
  let totalReps = 0;

  for (const set of sets) {
    if (set.setType === 'warmup') continue;
    if (set.weightKg == null || !Number.isFinite(set.weightKg)) continue;
    if (set.reps == null || !Number.isFinite(set.reps) || set.reps <= 0) continue;

    const percent = (set.weightKg / oneRmKg) * 100;
    weightedSum += percent * set.reps;
    totalReps += set.reps;
  }

  return totalReps > 0 ? weightedSum / totalReps : null;
}

/**
 * US MUSCU-UX01 — écart d'un exercice depuis la dernière fois (règle R5-1).
 *
 * ── Ce que ça sert ───────────────────────────────────────────────────────────────────────────────
 * Le résumé de séance affichait cinq agrégats et rien sur ce qui avait été soulevé. Le détail par
 * exercice, avec l'écart depuis la fois précédente, est **ce qui donne le sentiment de progresser**
 * — et il est déjà entièrement calculable à partir des séries enregistrées.
 *
 * ── La règle de comparaison ──────────────────────────────────────────────────────────────────────
 * On compare la **meilleure série de travail** de chaque séance, échauffements exclus (règle
 * métier de `musculation.md` §8 : ils sortent du volume, des records et de la progression).
 *
 *  1. charge maximale différente → l'écart est en charge ;
 *  2. charge égale, reps du meilleur set différentes → l'écart est en reps ;
 *  3. tout égal → `equal`.
 *
 * Pour un exercice **à la durée**, la comparaison porte sur la durée maximale tenue.
 *
 * `null` quand il n'y a pas de référence : un premier passage sur un exercice n'a pas « progressé
 * de 0 », il n'a simplement rien à comparer — et afficher « = » y serait un contresens.
 */

/** Une série telle que la comparaison en a besoin. */
export type ComparableSet = {
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  setType: string;
  done: boolean;
};

/** Écart mesuré entre deux passages sur le même exercice. */
export type ExerciseDelta =
  | { kind: 'weight'; deltaKg: number }
  | { kind: 'reps'; deltaReps: number }
  | { kind: 'duration'; deltaSeconds: number }
  | { kind: 'equal' };

/** Séries retenues pour la comparaison : validées, hors échauffement. */
function workingSets(sets: readonly ComparableSet[]): ComparableSet[] {
  return sets.filter((s) => s.done && s.setType !== 'warmup');
}

/**
 * Meilleure série de travail : charge maximale, puis reps maximales à charge égale.
 * `null` si aucune série de travail exploitable.
 */
function bestSet(sets: readonly ComparableSet[]): ComparableSet | null {
  const working = workingSets(sets);
  if (working.length === 0) return null;
  return working.reduce((best, s) => {
    const bw = best.weightKg ?? 0;
    const sw = s.weightKg ?? 0;
    if (sw !== bw) return sw > bw ? s : best;
    return (s.reps ?? 0) > (best.reps ?? 0) ? s : best;
  });
}

/** Durée maximale tenue sur une série de travail, `null` si aucune. */
function bestDuration(sets: readonly ComparableSet[]): number | null {
  const durations = workingSets(sets)
    .map((s) => s.durationSeconds)
    .filter((d): d is number => d != null);
  return durations.length > 0 ? Math.max(...durations) : null;
}

/**
 * Compare la performance d'un exercice à celle du passage précédent (règle R5-1).
 *
 * `null` = rien à comparer (pas de référence, ou aucune série de travail d'un côté).
 */
export function compareExercisePerformance(
  current: readonly ComparableSet[],
  previous: readonly ComparableSet[] | null | undefined,
): ExerciseDelta | null {
  if (!previous || previous.length === 0) return null;

  // Exercice à la durée : on compare ce qui fait la performance, le temps tenu.
  const currentDuration = bestDuration(current);
  const previousDuration = bestDuration(previous);
  if (currentDuration != null && previousDuration != null) {
    const deltaSeconds = currentDuration - previousDuration;
    return deltaSeconds === 0 ? { kind: 'equal' } : { kind: 'duration', deltaSeconds };
  }

  const currentBest = bestSet(current);
  const previousBest = bestSet(previous);
  if (!currentBest || !previousBest) return null;

  // Arrondi au dixième : les charges sont saisies au demi-kilo, et un flottant qui traîne
  // afficherait « +2.4999999999 kg ».
  const deltaKg = Math.round(((currentBest.weightKg ?? 0) - (previousBest.weightKg ?? 0)) * 10) / 10;
  if (deltaKg !== 0) return { kind: 'weight', deltaKg };

  const deltaReps = (currentBest.reps ?? 0) - (previousBest.reps ?? 0);
  if (deltaReps !== 0) return { kind: 'reps', deltaReps };

  return { kind: 'equal' };
}

/**
 * US RUN-F3 (roadmap 5.25) — comparaison d'une course terminée à l'objectif de sa séance
 * planifiée. Calcul pur, aucun accès donnée : `distanceM`/`durationS` viennent de la course,
 * `targetDistanceM`/`targetDurationS` de `sessions` (via la `planned_session` réalisée).
 */

/** Tolérance relative « objectif atteint » (R5) — un GPS ne rend jamais une valeur exacte. */
export const TARGET_TOLERANCE = 0.02;

export type TargetAxisResult = {
  /** Valeur réalisée (mètres ou secondes selon l'axe). */
  doneValue: number;
  /** Valeur visée. */
  targetValue: number;
  /** `doneValue - targetValue`, signé — sert à afficher « dépassé de 200 m » (R2). */
  diff: number;
  status: 'reached' | 'over' | 'under';
};

export type TargetComparison = {
  /** Absent si la séance ne visait pas de distance (R3) — jamais présent à `undefined` explicite. */
  distance?: TargetAxisResult;
  /** Absent si la séance ne visait pas de durée (R3). */
  duration?: TargetAxisResult;
};

/**
 * Statut d'un axe : `reached` dans une fenêtre de ±`TARGET_TOLERANCE` autour de la cible (R5),
 * sinon `over`/`under` selon le signe de l'écart. La tolérance est **relative** (R6) : le verdict
 * ne dépend pas de l'unité d'affichage (mètres/miles, secondes/minutes).
 */
function compareAxis(doneValue: number, targetValue: number): TargetAxisResult {
  const diff = doneValue - targetValue;
  const status: TargetAxisResult['status'] =
    Math.abs(diff) / targetValue <= TARGET_TOLERANCE ? 'reached' : diff > 0 ? 'over' : 'under';
  return { doneValue, targetValue, diff, status };
}

/**
 * Compare une course réalisée à l'objectif de sa séance planifiée. Une cible absente ou nulle
 * (séance ne visant pas cet axe, ou course sans distance/durée exploitable) laisse la clé
 * correspondante **absente** du résultat — jamais un axe à zéro (R1, R3).
 */
export function compareToTarget(
  actual: { distanceM: number | null; durationS: number | null },
  target: { targetDistanceM: number | null; targetDurationS: number | null },
): TargetComparison {
  const result: TargetComparison = {};
  if (
    target.targetDistanceM != null &&
    target.targetDistanceM > 0 &&
    actual.distanceM != null
  ) {
    result.distance = compareAxis(actual.distanceM, target.targetDistanceM);
  }
  if (
    target.targetDurationS != null &&
    target.targetDurationS > 0 &&
    actual.durationS != null
  ) {
    result.duration = compareAxis(actual.durationS, target.targetDurationS);
  }
  return result;
}

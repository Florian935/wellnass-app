export type WeightGoalProgress = {
  pct: number; // 0..100, arrondi entier
  reached: boolean; // cible atteinte ou dépassée
  startKg: number;
  targetKg: number;
  currentKg: number;
  totalKg: number; // |départ - cible|
  doneKg: number; // parcouru, borné [0, totalKg]
  remainingKg: number; // totalKg - doneKg
};

/**
 * Progression vers l'objectif de poids (pur, sans I/O ni Date).
 * `null` si une donnée manque OU si départ = cible (rien à mesurer, div/0 évitée).
 * Formule bornée [0,1] : marche pour une perte (départ>cible) comme une prise (départ<cible).
 */
export function computeWeightGoalProgress(params: {
  startKg: number | null;
  targetKg: number | null;
  currentKg: number | null;
}): WeightGoalProgress | null {
  const { startKg, targetKg, currentKg } = params;
  if (startKg == null || targetKg == null || currentKg == null) return null;
  if (startKg === targetKg) return null;

  const progressRaw = (startKg - currentKg) / (startKg - targetKg);
  const ratio = Math.min(1, Math.max(0, progressRaw));
  const totalKg = Math.abs(startKg - targetKg);
  const doneKg = ratio * totalKg;

  return {
    pct: Math.round(ratio * 100),
    reached: progressRaw >= 1,
    startKg,
    targetKg,
    currentKg,
    totalKg,
    doneKg,
    remainingKg: totalKg - doneKg,
  };
}

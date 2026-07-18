/**
 * Moyenne mobile centrée (fenêtre en points). Débruite une série pour en lire la tendance
 * de fond. Brique socle (META-09) ; réutilisée par les courbes et les projections futures.
 */

/**
 * Lisse `values` par moyenne mobile **centrée** de taille `window` (en points).
 * - Centrée : chaque point = moyenne de `[i - h, i + h]`, `h = floor(window / 2)`.
 * - Bords : fenêtre **rétrécie** aux voisins disponibles (chaque point reçoit une valeur).
 * - `window <= 1` ou `values.length < 2` → **copie** de `values` (aucun lissage).
 * Sortie de **même longueur** que l'entrée.
 */
export function movingAverage(values: ReadonlyArray<number>, window: number): number[] {
  const n = values.length;
  if (window <= 1 || n < 2) return values.slice();

  const h = Math.floor(window / 2);
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - h);
    const hi = Math.min(n - 1, i + h);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += values[j]!;
    out[i] = sum / (hi - lo + 1);
  }
  return out;
}

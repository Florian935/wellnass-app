/**
 * Régression linéaire générique (moindres carrés ordinaires). Brique socle (META-08) :
 * généralise les heuristiques de tendance et débloque les projections (META-14/15/16).
 */

export type RegressionPoint = { x: number; y: number };
export type LinearFit = {
  /** Pente : unité de y par unité de x. */
  slope: number;
  /** Ordonnée à l'origine (y estimé en x = 0). */
  intercept: number;
  /** Qualité d'ajustement (coefficient de détermination), borné [0, 1]. */
  r2: number;
  /** Nombre de points utilisés. */
  n: number;
};

/**
 * Ajuste une droite par moindres carrés. Retourne `null` quand le fit n'a pas de sens :
 * moins de 2 points, ou variance de x nulle (tous les points au même x → pente indéfinie).
 * Série constante en y → droite plate parfaite (`slope 0`, `r2 1`).
 */
export function linearRegression(points: ReadonlyArray<RegressionPoint>): LinearFit | null {
  const n = points.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let ssXX = 0; // Σ(x - x̄)²
  let ssXY = 0; // Σ(x - x̄)(y - ȳ)
  let ssYY = 0; // Σ(y - ȳ)²
  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    ssXX += dx * dx;
    ssXY += dx * dy;
    ssYY += dy * dy;
  }

  if (ssXX === 0) return null; // variance de x nulle → pente indéfinie

  const slope = ssXY / ssXX;
  const intercept = meanY - slope * meanX;
  // r2 = corrélation² ; ssYY === 0 (y constant) → droite plate parfaite par convention.
  const r2 = ssYY === 0 ? 1 : Math.max(0, Math.min(1, (ssXY * ssXY) / (ssXX * ssYY)));

  return { slope, intercept, r2, n };
}

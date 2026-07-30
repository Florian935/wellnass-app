import { type MicronutrientKey } from './food';

/**
 * **Valeurs nutritionnelles de référence (VNR)** pour un adulte, telles que publiées à
 * l'annexe XIII du **règlement (UE) n° 1169/2011** — celles qui servent déjà à afficher les
 * « % des apports de référence » sur les étiquettes alimentaires européennes.
 *
 * Elles servent uniquement à **situer** un apport (« tu es à 62 % de la référence calcium »),
 * pas à prescrire : ce sont des repères de population, pas un objectif personnalisé. C'est
 * pourquoi rien ici n'est présenté comme un « objectif » côté UI.
 *
 * Deux familles de clés du panel sont **volontairement absentes** :
 *
 * - **`sodium_mg`** — l'annexe XIII ne lui donne pas de VNR, et pour cause : le sodium est un
 *   **plafond** (l'OMS recommande de rester *sous* 2 000 mg/j), pas une cible à atteindre.
 *   Afficher « 95 % couverts » sur un plafond inverserait le message.
 * - **Lipides détaillés** (`cholesterol_mg`, `trans_fat_g`, `omega_*`, mono/poly-insaturés) —
 *   aucune VNR réglementaire ; certains sont eux aussi des plafonds.
 *
 * Ces clés restent affichées avec leur valeur brute, sans anneau de couverture.
 */
export const MICRONUTRIENT_NRV: Partial<Record<MicronutrientKey, number>> = {
  // Minéraux
  potassium_mg: 2000,
  calcium_mg: 800,
  phosphorus_mg: 700,
  magnesium_mg: 375,
  iron_mg: 14,
  zinc_mg: 10,
  copper_mg: 1,
  manganese_mg: 2,
  selenium_ug: 55,
  iodine_ug: 150,
  // Vitamines
  vitamin_a_ug: 800,
  vitamin_d_ug: 5,
  vitamin_e_mg: 12,
  vitamin_k_ug: 75,
  vitamin_c_mg: 80,
  vitamin_b1_mg: 1.1,
  vitamin_b2_mg: 1.4,
  vitamin_b3_mg: 16,
  vitamin_b5_mg: 6,
  vitamin_b6_mg: 1.4,
  vitamin_b7_ug: 50,
  vitamin_b9_ug: 200,
  vitamin_b12_ug: 2.5,
};

/** Palier de couverture — pilote le code couleur sobre de la grille micronutriments. */
export type CoverageLevel = 'low' | 'mid' | 'high';

/**
 * Couverture d'un micronutriment en **% de la VNR**, arrondie à l'entier.
 *
 * Renvoie `null` quand la clé n'a pas de VNR (sodium, lipides détaillés — voir
 * {@link MICRONUTRIENT_NRV}) : l'appelant affiche alors la valeur brute sans anneau.
 *
 * Le pourcentage **n'est pas plafonné** — dépasser la référence est une information utile
 * (et fréquent sur le sel ou la vitamine C). C'est à l'affichage de borner l'anneau à 100 %.
 */
export function micronutrientCoverage(key: MicronutrientKey, amount: number): number | null {
  const nrv = MICRONUTRIENT_NRV[key];
  if (nrv == null || nrv <= 0) return null;
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round((amount / nrv) * 100);
}

/**
 * Palier d'une couverture. Seuils repris de la maquette de refonte Nutrition
 * (`design/FitTrio - Nutrition.dc.html`) : vert ≥ 70 %, ambre 45–69 %, terracotta < 45 %.
 */
export function coverageLevel(pct: number): CoverageLevel {
  if (pct >= 70) return 'high';
  if (pct >= 45) return 'mid';
  return 'low';
}

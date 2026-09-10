/**
 * Hydratation du jour (US NUTRI-UX01, R5 — catalogue NUTR-12).
 *
 * Ouverte en V1 par arbitrage de Florian (10/09/2026), contre la spec §8 qui la reportait en V2.
 * Motif : c'est le seul geste du pilier qui coûte **un tap** — aucune base à interroger, aucune
 * pesée, aucun calcul — et un motif de retour quotidien.
 *
 * ── Le modèle ────────────────────────────────────────────────────────────────────────────────
 * Une ligne par ajout, jamais un total mis à jour. Deux raisons : le retrait défait **le dernier
 * geste** plutôt qu'un cumul (annuler un double-tap doit rendre exactement ce qui a été ajouté),
 * et une synchronisation offline qui additionne des lignes ne peut pas produire de conflit
 * d'écriture — deux appareils qui boivent en même temps donnent deux lignes, pas un écrasement.
 */

/** Volume d'un verre par défaut (ml). Réglable par l'utilisateur. */
export const DEFAULT_GLASS_ML = 250;
/** Objectif journalier par défaut (ml). Réglable par l'utilisateur. */
export const DEFAULT_WATER_TARGET_ML = 2000;
/** Garde-fou d'affichage : au-delà, la grille de verres deviendrait illisible. */
export const MAX_GLASSES_DISPLAYED = 12;

export interface HydrationProgress {
  /** Somme des ajouts du jour, en ml. */
  totalMl: number;
  /** Objectif du jour, en ml. */
  targetMl: number;
  /** Verres entiers consommés (arrondi bas) — ce que la grille remplit. */
  glasses: number;
  /** Verres que représente l'objectif, borné à `MAX_GLASSES_DISPLAYED`. */
  targetGlasses: number;
  /** Avancement dans [0, 1], borné : la barre ne déborde pas de sa piste. */
  ratio: number;
  /** Vrai dès que l'objectif est atteint ou dépassé. */
  reached: boolean;
}

/**
 * État d'hydratation d'une journée.
 *
 * `ratio` est **borné à 1** (comme les barres de macros) : le dépassement se lit sur les
 * chiffres, pas sur une barre qui sortirait de sa piste. Boire plus que son objectif n'est pas
 * une faute — aucune couleur d'alerte ici.
 */
export function hydrationProgress(
  totalMl: number,
  targetMl: number = DEFAULT_WATER_TARGET_ML,
  glassMl: number = DEFAULT_GLASS_ML,
): HydrationProgress {
  const total = Number.isFinite(totalMl) ? Math.max(0, Math.round(totalMl)) : 0;
  const target = Number.isFinite(targetMl) && targetMl > 0 ? Math.round(targetMl) : 0;
  const glass = Number.isFinite(glassMl) && glassMl > 0 ? Math.round(glassMl) : DEFAULT_GLASS_ML;

  return {
    totalMl: total,
    targetMl: target,
    glasses: Math.floor(total / glass),
    targetGlasses: target > 0 ? Math.min(MAX_GLASSES_DISPLAYED, Math.ceil(target / glass)) : 0,
    ratio: target > 0 ? Math.min(1, total / target) : 0,
    reached: target > 0 && total >= target,
  };
}

/** Litres affichables (« 1,25 L »). La virgule décimale est posée par la couche i18n. */
export function millilitresToLitres(ml: number): number {
  const value = Number.isFinite(ml) ? Math.max(0, ml) : 0;
  return Math.round(value / 100) / 10;
}

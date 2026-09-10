/**
 * Multiples de portion et pas de saisie (US NUTRI-UX01, R2.5).
 *
 * ── Le défaut corrigé ────────────────────────────────────────────────────────────────────────
 * Les puces de portion **écrasaient** la quantité en grammes : « 1 banane (120 g) » posait 120,
 * et « j'en ai mangé deux » imposait un calcul mental puis une saisie au clavier. Or manger deux
 * unités d'une même chose est le cas courant, pas l'exception.
 *
 * On expose donc la portion en **multiples** (½ · 1 · 2) et un **pas de saisie** adaptatif pour
 * le stepper : 1 g quand la quantité est petite (une cuillère d'huile), 10 g quand elle est
 * grande (une assiette de riz) — un pas fixe obligerait, dans un cas, à quinze appuis, et dans
 * l'autre, à une précision que personne ne pèse.
 */

/** Facteurs proposés, dans l'ordre d'affichage. */
export const PORTION_FACTORS = [0.5, 1, 2] as const;
export type PortionFactor = (typeof PORTION_FACTORS)[number];

/** Une puce de portion prête à afficher. */
export interface PortionMultiple {
  factor: PortionFactor;
  /** Grammes correspondants, entiers et ≥ 1. */
  grams: number;
  /** `true` pour le facteur 1 — la puce sélectionnée par défaut. */
  isBase: boolean;
}

/**
 * Décline une portion de référence en multiples.
 *
 * Les demi-portions sous 2 g ne sont pas proposées : « ½ » d'une portion de 1 g ne veut rien dire
 * et l'arrondi la rendrait identique à la portion entière. Idem pour un `baseGrams` non
 * exploitable (0, négatif, non fini) → aucune puce, l'appelant retombe sur la saisie libre.
 */
export function portionMultiples(baseGrams: number | null | undefined): PortionMultiple[] {
  if (baseGrams == null || !Number.isFinite(baseGrams) || baseGrams <= 0) return [];
  const base = Math.round(baseGrams);
  if (base <= 0) return [];
  return PORTION_FACTORS.filter((factor) => !(factor === 0.5 && base < 2)).map((factor) => ({
    factor,
    grams: Math.max(1, Math.round(base * factor)),
    isBase: factor === 1,
  }));
}

/**
 * Pas du stepper pour une quantité donnée. Croissant par paliers, jamais nul.
 * Le pas est calculé sur la valeur **courante** : descendre de 105 g rend 100, puis 95…
 */
export function stepGrams(currentGrams: number): number {
  const g = Number.isFinite(currentGrams) ? Math.abs(currentGrams) : 0;
  if (g < 20) return 1;
  if (g < 100) return 5;
  return 10;
}

/**
 * Applique un cran de stepper. Le résultat est **aligné sur le pas** (105 → 100, pas 95) et borné
 * à 1 g : une entrée de journal à 0 g n'a pas de sens, et l'écran désactive déjà « Ajouter ».
 */
export function nudgeGrams(currentGrams: number, direction: 1 | -1): number {
  const current = Number.isFinite(currentGrams) ? Math.max(0, Math.round(currentGrams)) : 0;
  const step = stepGrams(current);
  if (direction === 1) {
    const aligned = Math.floor(current / step) * step + step;
    return Math.max(1, aligned);
  }
  // À la baisse, on descend d'abord au multiple inférieur s'il y en a un strictement plus petit.
  const floored = Math.floor(current / step) * step;
  const next = floored < current ? floored : current - step;
  return Math.max(1, next);
}

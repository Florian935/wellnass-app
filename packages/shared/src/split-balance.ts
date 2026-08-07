/**
 * US ALLURE-01 (roadmap 5.35, catalogue RUN-11) — negative split : gestion d'effort sur une sortie.
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 *
 * ── Pourquoi trois verdicts et pas deux (spec D4) ────────────────────────────────────────────────
 * Comparer deux moyennes au centième ferait de **toute** course un « positive » ou un « negative
 * split » : personne ne court deux moitiés exactement égales. Sans zone morte, l'analyse dirait
 * quelque chose de faux à chaque sortie — et une analyse qui a toujours un verdict tranché à annoncer
 * cesse d'être crédible.
 *
 * ── 🔴 Plus rapide = nombre plus PETIT ──────────────────────────────────────────────────────────
 * Les allures sont en secondes par kilomètre. Un `deltaPct` **négatif** signifie donc que la 2ᵉ moitié
 * est **plus rapide** — c'est le bon signe, celui du negative split. Le signe se lit à l'envers de
 * l'intuition, et c'est le piège de tout ce lot.
 */

import { meanSplitPace, type KmSplit } from './running';

// ---------------------------------------------------------------------------
// Constantes de règle
// ---------------------------------------------------------------------------

/**
 * Tolérance d'égalité, en **pourcentage** de l'allure de la 1ʳᵉ moitié (spec D4).
 *
 * ⚠️ Nombre **choisi, pas mesuré** — même statut que `LEG_SETS_CONFLICT_THRESHOLD` (COLLIS-01) et
 * `NEGLECTED_AFTER_WEEKS` (EXEC-01). Exporté et nommé exprès : un seuil enfoui dans une condition ne
 * se rediscute jamais. À calibrer en recette.
 */
export const EVEN_SPLIT_TOLERANCE_PCT = 2;

/** Sous deux kilomètres pleins, il n'y a pas deux moitiés à comparer (spec R3). */
export const MIN_KM_FOR_SPLIT_BALANCE = 2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SplitVerdict = 'negative' | 'even' | 'positive';

export type SplitBalance = {
  verdict: SplitVerdict;
  firstHalfPaceSPerKm: number;
  secondHalfPaceSPerKm: number;
  /**
   * Écart relatif de la 2ᵉ moitié, en %. **Négatif = plus rapide** (negative split).
   *
   * C'est le chiffre que la carte affiche : « negative split » sans son écart n'est pas vérifiable
   * par celui qui le lit (spec R2).
   */
  deltaPct: number;
};

// ---------------------------------------------------------------------------
// Calcul
// ---------------------------------------------------------------------------

/**
 * Le verdict de gestion d'effort d'une sortie.
 *
 * Rend `null` sous `MIN_KM_FOR_SPLIT_BALANCE` kilomètres pleins, ou si un split est inexploitable.
 *
 * ⚠️ **Nombre impair de kilomètres : le km central va à la 1ʳᵉ moitié.** C'est arbitraire — donc
 * **figé par un test** et écrit en spec §4. Sans cette trace, la prochaine lecture du code hésitera
 * et pourra l'inverser en croyant corriger un bug.
 *
 * ⚠️ Le dernier kilomètre **partiel** n'est pas ici : `computeKmSplits` ne rend que les kilomètres
 * pleins (spec R5). Une sortie de 5,8 km est lue sur 5 km, et on ne bricole pas d'extrapolation.
 */
export function computeSplitBalance(splits: ReadonlyArray<KmSplit>): SplitBalance | null {
  if (splits.length < MIN_KM_FOR_SPLIT_BALANCE) return null;

  // `ceil` : sur 5 km, la 1ʳᵉ moitié prend 3 km et la 2ᵉ en prend 2.
  const cut = Math.ceil(splits.length / 2);
  const first = meanSplitPace(splits.slice(0, cut));
  const second = meanSplitPace(splits.slice(cut));
  if (first === null || second === null) return null;

  const deltaPct = ((second - first) / first) * 100;

  // 🔴 Le signe se lit à l'envers : delta négatif = 2ᵉ moitié plus rapide = negative split.
  const verdict: SplitVerdict =
    Math.abs(deltaPct) <= EVEN_SPLIT_TOLERANCE_PCT
      ? 'even'
      : deltaPct < 0
        ? 'negative'
        : 'positive';

  return {
    verdict,
    firstHalfPaceSPerKm: first,
    secondHalfPaceSPerKm: second,
    deltaPct,
  };
}

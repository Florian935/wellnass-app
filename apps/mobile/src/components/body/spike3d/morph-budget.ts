/**
 * Spike 3D — rejoue la sélection d'influences de morph de three r128. **Code jetable.**
 *
 * Pourquoi rejouer un algorithme du moteur plutôt que de l'observer : parce qu'il **ne dit rien**.
 * `WebGLMorphtargets.update` garde les 8 influences les plus fortes en valeur absolue et met les
 * autres à zéro, sans erreur ni avertissement. Le corps affiché est alors faux, et rien ne l'annonce.
 * Le spike a justement pour but de rendre ce silence visible : on recalcule la même sélection et on
 * **nomme les cibles sacrifiées** à l'écran.
 *
 * Extrait de `node_modules/three/build/three.js` (r128) :
 *
 * ```js
 * influences.sort( absNumericalSort );                 // |b| - |a|
 * for ( let i = 0; i < 8; i ++ ) {
 *   if ( i < length && influences[ i ][ 1 ] ) { …garder… } else { …zéro… }
 * }
 * ```
 */

import type { BodySpikeInfluence } from './body-spike-state';

/** three r128 : 8 influences simultanées par maillage. Tombe à 4 si l'on morphe les normales. */
export const MORPH_LIMIT_R128 = 8;

export type MorphBudget = {
  /** Noms réellement appliqués par three, du plus fort au plus faible. */
  applied: string[];
  /** Noms demandés mais **silencieusement ignorés**. */
  ignored: string[];
  /** `true` dès qu'au moins une cible est sacrifiée. */
  overflow: boolean;
};

export function morphBudget(influences: BodySpikeInfluence[]): MorphBudget {
  // Une influence nulle ne consomme pas d'emplacement : three l'écarte avant de compter.
  const demandees = influences.filter((influence) => influence.value !== 0);

  // Tri par valeur ABSOLUE décroissante — une proportion à −1 pèse autant qu'une intention à +1.
  // `Array.prototype.sort` est stable depuis ES2019, donc à égalité l'ordre de déclaration tranche,
  // exactement comme dans le moteur. C'est ce qui rend « tout au max » reproductible.
  const triees = [...demandees].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const applied = triees.slice(0, MORPH_LIMIT_R128).map((influence) => influence.name);
  const ignored = triees.slice(MORPH_LIMIT_R128).map((influence) => influence.name);

  return { applied, ignored, overflow: ignored.length > 0 };
}

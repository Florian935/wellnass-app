/**
 * US ALLURE-01 (roadmap 5.35, catalogue RUN-20) — indice de dégradation en fin de sortie.
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 *
 * ── Pourquoi des quarts et pas le 1ᵉʳ km contre le dernier (spec R6) ─────────────────────────────
 * Comparer le premier kilomètre au dernier serait à la merci d'un feu rouge au 12ᵉ. On compare la
 * **moyenne du premier quart** à celle du **dernier quart** : ça lisse l'accident local tout en gardant
 * la tendance, qui est la seule chose qu'on prétend mesurer.
 *
 * ── Ce que ce module N'EST PAS ───────────────────────────────────────────────────────────────────
 * Le catalogue parle de « dérive cardio-mécanique ». La **fréquence cardiaque n'est pas dans le modèle
 * de données** (V2, wearables) : cette analyse est donc une approximation par la **seule allure**, et
 * la spec le dit au lieu de laisser croire à une mesure physiologique qu'on ne fait pas.
 *
 * ── 🔴 Le borne est en DISTANCE, pas en type de séance (spec D2) ─────────────────────────────────
 * `runs` **n'a pas de `session_type`** — le type n'existe que sur une séance planifiée. Les courses
 * libres n'en ont aucun, et elles sont majoritaires chez qui ne suit pas de programme. Filtrer sur
 * « sortie longue » rendrait donc l'analyse muette pour la majorité, et muette précisément pour ceux à
 * qui elle sert le plus. C'est le même mur qui laisse RUN-07 en ⏳ au catalogue.
 */

import { meanSplitPace, type KmSplit } from './running';

// ---------------------------------------------------------------------------
// Constantes de règle
// ---------------------------------------------------------------------------

/**
 * Kilomètres pleins minimum pour que la dérive ait un sens (spec D2).
 *
 * ⚠️ **Le seul nombre inventé du lot.** Il ne repose sur rien de mesuré dans ce produit — la dérive ne
 * veut rien dire sur 3 km, et il faut assez de matière pour que quatre quarts soient chacun
 * représentatif. Exporté et nommé ; à calibrer en recette par un pratiquant (critère 22).
 */
export const FADE_MIN_DISTANCE_KM = 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaceFade = {
  /**
   * Perte d'allure du premier au dernier quart, en %. **Positif = ralentissement.**
   *
   * ⚠️ **Jamais plafonné à 0** : accélérer sur la fin donne une valeur **négative**, et c'est une
   * information (bonne gestion d'effort), pas une anomalie à écrêter.
   */
  fadePct: number;
  firstQuarterPaceSPerKm: number;
  lastQuarterPaceSPerKm: number;
  /** Kilomètres par quart — la carte l'affiche pour que le chiffre soit vérifiable (spec R2). */
  kmPerQuarter: number;
};

// ---------------------------------------------------------------------------
// Calcul
// ---------------------------------------------------------------------------

/**
 * La dégradation d'allure d'une sortie assez longue.
 *
 * Rend `null` sous `FADE_MIN_DISTANCE_KM` kilomètres pleins, ou si un split est inexploitable.
 *
 * Le découpage prend `floor(n / 4)` kilomètres **à chaque bout** ; le milieu est **volontairement
 * ignoré** — c'est exactement l'intention de R6, on ne mesure que les extrémités.
 */
export function computePaceFade(splits: ReadonlyArray<KmSplit>): PaceFade | null {
  if (splits.length < FADE_MIN_DISTANCE_KM) return null;

  // 🔴 **`kmPerQuarter` vaut au minimum 2**, par construction : le garde ci-dessus impose au moins
  // `FADE_MIN_DISTANCE_KM` (= 10) splits. Défendre le cas `< 1` serait du code mort, et le dépôt les
  // supprime plutôt que d'écrire un test qui fige un appel impossible (cf. `bucketOf` le 04/08/2026,
  // `findFallbackDay` le 07/08/2026, `computeSessionDuration` le même jour).
  //
  // ⚠️ **Ce que ça implique avant d'y toucher** : `FADE_MIN_DISTANCE_KM` n'est pas qu'un choix
  // produit, c'est aussi ce qui tient ce calcul. Le descendre sous **4** viderait les quarts et
  // `meanPace([])` rendrait `null` — l'analyse se tairait silencieusement au lieu d'échouer.
  const kmPerQuarter = Math.floor(splits.length / 4);

  const first = meanSplitPace(splits.slice(0, kmPerQuarter));
  const last = meanSplitPace(splits.slice(splits.length - kmPerQuarter));
  if (first === null || last === null) return null;

  return {
    fadePct: ((last - first) / first) * 100,
    firstQuarterPaceSPerKm: first,
    lastQuarterPaceSPerKm: last,
    kmPerQuarter,
  };
}

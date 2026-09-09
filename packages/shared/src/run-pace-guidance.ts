/**
 * US RUN-F4 (lot E) — piloter a l'allure pendant la course.
 * Ref. : docs/product/analyse-seances-structurees-running.md (mur M13)
 *
 * `run/active.tsx` affichait l'allure instantanee et l'allure moyenne, et depuis RUN-F2b la
 * cible DE DISTANCE/DUREE — mais jamais une allure cible, aucun signal de sortie de plage,
 * aucune alerte vocale d'ecart. Le plan analyse demande pourtant, pour sa seance de tempo,
 * « programmer un bloc de 20 min avec ALERTE D'ALLURE 4:20-4:25/km ».
 *
 * Calcul pur : aucune notion de GPS, de temps reel ni de voix ici. L'ecran fournit l'allure
 * courante, ce module rend un verdict, et la couche UI/audio decide quoi en faire.
 */

import type { PaceRange } from './running-paces';

export type PaceVerdict = 'too_fast' | 'in_range' | 'too_slow';

export type PaceEvaluation = {
  verdict: PaceVerdict;
  /**
   * Ecart signe a la plage, en s/km : negatif = plus RAPIDE que la borne rapide, positif =
   * plus LENT que la borne lente, 0 quand on est dans la plage (y compris dans la tolerance).
   * C'est ce nombre qui se lit « tu es 6 s/km trop lent ».
   */
  deltaSPerKm: number;
};

/**
 * Tolerance par defaut, en s/km, de part et d'autre de la plage.
 *
 * ⚠️ **Seul nombre invente de ce lot**, et il est assume comme tel — meme parti pris que
 * `FADE_MIN_DISTANCE_KM` (ALLURE-01) et que le seuil ACWR a 1,3 (RUN-18). Motif : l'allure
 * instantanee d'un GPS grand public oscille de plusieurs secondes au kilometre a effort
 * strictement constant (virages, tunnels d'immeubles, lissage du fournisseur). Sans zone morte,
 * le verdict clignoterait entre `too_fast` et `too_slow` a chaque rafraichissement et l'alerte
 * vocale deviendrait inutilisable. A recalibrer apres la premiere recette terrain.
 */
export const PACE_TOLERANCE_S_PER_KM = 5;

/**
 * Ou se situe une allure courante par rapport a sa plage cible.
 *
 * Rappel du sens des chiffres : en allure (s/km), **plus petit = plus rapide**. `range.minSPerKm`
 * est donc la borne RAPIDE. C'est l'inversion qui rend ce calcul facile a ecrire a l'envers, et
 * la raison pour laquelle les tests couvrent explicitement les deux cotes.
 *
 * Retourne `null` si l'allure n'est pas exploitable (a l'arret, en debut de course, GPS perdu) :
 * il n'existe **aucun verdict neutre** — « dans la plage » serait un mensonge, « hors plage » une
 * fausse alerte.
 */
export function evaluatePace(
  currentPaceSPerKm: number | null | undefined,
  range: PaceRange | null | undefined,
  toleranceSPerKm: number = PACE_TOLERANCE_S_PER_KM,
): PaceEvaluation | null {
  if (currentPaceSPerKm == null || !Number.isFinite(currentPaceSPerKm)) return null;
  if (currentPaceSPerKm <= 0) return null;
  if (range == null) return null;

  if (currentPaceSPerKm < range.minSPerKm - toleranceSPerKm) {
    return { verdict: 'too_fast', deltaSPerKm: currentPaceSPerKm - range.minSPerKm };
  }
  if (currentPaceSPerKm > range.maxSPerKm + toleranceSPerKm) {
    return { verdict: 'too_slow', deltaSPerKm: currentPaceSPerKm - range.maxSPerKm };
  }
  return { verdict: 'in_range', deltaSPerKm: 0 };
}

/**
 * Cible instantanee d'un segment a allure PROGRESSIVE (mur M8).
 *
 * « Les 10 dernieres minutes de 4:35 vers 4:25 » : la consigne n'est pas une tolerance entre
 * deux bornes, c'est une RAMPE. A 30 % du segment, la cible n'est ni 4:35 ni 4:25 — elle est a
 * 30 % du chemin entre les deux.
 *
 * Interpolation **lineaire sur l'avancement**, pas sur le temps ecoule seul : `progress` est
 * fourni par l'appelant (distance parcourue / distance du segment, ou duree / duree), ce qui
 * rend la fonction valable pour un segment borne en distance comme en duree.
 *
 * Retourne une plage degeneree (min = max) : a un instant donne, une rampe a **une** cible, pas
 * une fourchette. C'est ce qui permet a `evaluatePace` de la consommer sans cas particulier —
 * la tolerance de +/- 5 s/km s'applique ensuite comme partout ailleurs.
 */
export function progressivePaceTarget(
  range: PaceRange | null | undefined,
  progress: number,
): PaceRange | null {
  if (range == null) return null;
  // Hors [0, 1] : on borne plutot que d'extrapoler. Avant le depart la cible est celle du debut,
  // apres la fin celle de l'arrivee — extrapoler produirait une allure que personne n'a demandee.
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  // On part de la borne LENTE (`max`) et on va vers la RAPIDE (`min`) : une seance progressive
  // accelere. L'inverse (une rampe descendante) n'existe pas dans les plans reels.
  const target = range.maxSPerKm + (range.minSPerKm - range.maxSPerKm) * clamped;
  return { minSPerKm: target, maxSPerKm: target };
}

/**
 * Faut-il ANNONCER cet ecart a la voix ?
 *
 * Trois garde-fous, dans cet ordre :
 *  1. on n'annonce jamais « tu es dans la plage » — une alerte qui se declenche quand tout va
 *     bien n'est plus une alerte ;
 *  2. on n'annonce pas deux fois de suite le meme verdict — sinon la voix repeterait « trop
 *     lent » tous les cycles de rafraichissement pendant toute une cote ;
 *  3. on respecte un delai minimum entre deux annonces, meme si le verdict a change (un
 *     coureur qui oscille autour de la borne declencherait sinon une alternance permanente).
 *
 * `elapsedSecondsSinceLastAnnounce` vaut `null` quand rien n'a encore ete annonce.
 */
export const PACE_ANNOUNCE_MIN_INTERVAL_S = 30;

export function shouldAnnouncePace(input: {
  evaluation: PaceEvaluation | null;
  lastAnnouncedVerdict: PaceVerdict | null;
  elapsedSecondsSinceLastAnnounce: number | null;
  minIntervalSeconds?: number;
}): boolean {
  const { evaluation, lastAnnouncedVerdict, elapsedSecondsSinceLastAnnounce } = input;
  const minInterval = input.minIntervalSeconds ?? PACE_ANNOUNCE_MIN_INTERVAL_S;

  if (evaluation == null) return false;
  if (evaluation.verdict === 'in_range') return false;
  if (evaluation.verdict === lastAnnouncedVerdict) return false;
  if (elapsedSecondsSinceLastAnnounce != null && elapsedSecondsSinceLastAnnounce < minInterval) {
    return false;
  }
  return true;
}

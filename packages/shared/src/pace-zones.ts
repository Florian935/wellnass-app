/**
 * US ALLURE-01 (roadmap 5.35, catalogue RUN-17 / RUN-08) — le modèle de zones d'allure.
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 *
 * ── Les zones ne sont PAS inventées, et c'est tout l'intérêt (spec D1) ───────────────────────────
 * `sessionTargetPace` définit déjà, depuis l'allure de référence 5 km, quatre bandes d'allure
 * **calibrées et déjà défendues** dans le produit. Mais ce sont des **cibles par type de séance**, pas
 * des zones : elles laissent des trous (rien entre `ref` et `ref+30`, rien au-delà de `ref+120`, rien
 * sous `vma`), donc une allure pouvait ne tomber dans aucune.
 *
 * Ce module en dérive une **partition** — cinq zones contiguës qui couvrent tout — en **prolongeant**
 * ces bandes, sans ajouter un seul nombre. Conséquence qui compte : un ajustement de
 * `sessionTargetPace` se répercute **mécaniquement** ici. Recopier `ref + 60` en littéral marcherait
 * aujourd'hui et divergerait au premier ajustement, **sans que rien n'échoue**.
 *
 * ── 🔴 Le piège de tout ce lot ───────────────────────────────────────────────────────────────────
 * Une allure **plus rapide** est un nombre **plus PETIT** — des secondes par kilomètre. Donc
 * `paceSPerKm < vmaPace` veut dire « plus rapide que la VMA ». Chaque comparaison de ce fichier doit
 * être relue avec ça en tête : une inversion passe la revue, passe le typecheck, et produit une
 * répartition exactement inversée — crédible et fausse.
 */

import { derivedVmaPace, sessionTargetPace } from './running-paces';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Les cinq zones, **de la plus rapide à la plus lente**. L'ordre est celui de l'affichage et celui du
 * classement : il fait partie du contrat.
 */
export const PACE_ZONES = ['vma', 'seuil', 'tempo', 'endurance', 'recuperation'] as const;
export type PaceZone = (typeof PACE_ZONES)[number];

/**
 * Les zones considérées comme **haute intensité** pour la polarisation (RUN-08).
 *
 * Le partage se fait à `ref + 60` : au-delà, on est dans l'allure confortable d'une endurance
 * fondamentale ; en deçà, l'effort compte comme qualitatif. C'est la borne de la bande `endurance`
 * de `sessionTargetPace`, pas un choix neuf.
 */
export const HIGH_INTENSITY_ZONES: ReadonlyArray<PaceZone> = ['vma', 'seuil', 'tempo'];

/** Borne haute (allure la plus lente) de chaque zone, en s/km. `Infinity` pour la plus lente. */
export type PaceZoneBounds = Record<PaceZone, number>;

// ---------------------------------------------------------------------------
// Bornes
// ---------------------------------------------------------------------------

/**
 * Les bornes des cinq zones, **dérivées** de `sessionTargetPace` et `derivedVmaPace` (spec D1).
 *
 * Chaque valeur est la borne **haute** de sa zone, c'est-à-dire l'allure la plus **lente** qui y
 * appartient encore. Une zone contient donc `]borne précédente, borne]`.
 *
 * | Zone | Bornes | Origine |
 * |---|---|---|
 * | `vma` | plus rapide que `vma` | borne basse de `fractionne` |
 * | `seuil` | `vma` .. `ref` | bande `fractionne` |
 * | `tempo` | `ref` .. `ref+60` | comble le trou · borne haute de `sortie_longue` |
 * | `endurance` | `ref+60` .. `ref+90` | bande `endurance` |
 * | `recuperation` | plus lent que `ref+90` | borne basse de `recuperation` |
 *
 * ⚠️ **Rien n'est écrit en dur.** `fractionne` fournit `vma` et `ref` ; `sortie_longue` fournit
 * `ref+60` ; `endurance` fournit `ref+90`. Un test change la référence et vérifie que **toutes** les
 * bornes suivent — c'est ce test qui interdit de recopier les nombres.
 */
export function paceZoneBounds(ref5kPaceSPerKm: number): PaceZoneBounds {
  // `fractionne` rend { minSPerKm: vma, maxSPerKm: ref } — donc les deux bornes rapides d'un coup.
  const quality = sessionTargetPace('fractionne', ref5kPaceSPerKm)!;
  // `sortie_longue` rend { ref+30, ref+60 } : on ne retient que sa borne haute (la plus lente).
  const longRun = sessionTargetPace('sortie_longue', ref5kPaceSPerKm)!;
  // `endurance` rend { ref+60, ref+90 } : sa borne haute ferme la zone d'endurance.
  const easy = sessionTargetPace('endurance', ref5kPaceSPerKm)!;

  return {
    vma: derivedVmaPace(ref5kPaceSPerKm),
    seuil: quality.maxSPerKm,
    tempo: longRun.maxSPerKm,
    endurance: easy.maxSPerKm,
    recuperation: Number.POSITIVE_INFINITY,
  };
}

// ---------------------------------------------------------------------------
// Classement
// ---------------------------------------------------------------------------

/**
 * La zone d'une allure, ou `null` si elle n'est pas classable.
 *
 * Rend `null` dans deux cas, et **jamais une zone par défaut** (spec R4) :
 *  - **l'allure de référence est absente** — elle est nullable en base, il n'existe aucune valeur
 *    neutre pour la remplacer, et en inventer une produirait une répartition **fausse et crédible** ;
 *  - **l'allure mesurée est absurde** (≤ 0, `NaN`, `Infinity`) — un split à zéro seconde n'a pas de
 *    zone. Précédent du dépôt : `bestSegmentTimeFromSamples` a écrit un record « NaN seconde » en base
 *    (corrigé le 04/08/2026).
 *
 * 🔴 Les comparaisons se lisent « à l'envers » : `paceSPerKm <= bounds.vma` signifie **plus rapide ou
 * égal** à l'allure VMA. Le balayage va donc de la zone la plus rapide à la plus lente, dans l'ordre
 * de `PACE_ZONES`, et la première borne franchie gagne.
 */
export function paceZoneOf(
  paceSPerKm: number,
  ref5kPaceSPerKm: number | null,
): PaceZone | null {
  if (ref5kPaceSPerKm === null) return null;
  if (!Number.isFinite(ref5kPaceSPerKm) || ref5kPaceSPerKm <= 0) return null;
  if (!Number.isFinite(paceSPerKm) || paceSPerKm <= 0) return null;

  const bounds = paceZoneBounds(ref5kPaceSPerKm);
  // 🔴 `find` trouve **toujours** : `bounds.recuperation` vaut `Infinity`, et l'allure est déjà
  // garantie finie et positive par les gardes ci-dessus. C'est exactement ce que « partition » veut
  // dire (spec R8), et un test le vérifie en balayant 120 → 1200 s/km sur cinq références.
  //
  // Le `!` s'appuie donc sur cet invariant plutôt qu'un `?? 'recuperation'` qui serait du code mort —
  // convention du dépôt (cf. `bucketOf` 04/08, `findFallbackDay` et `computeSessionDuration` 07/08).
  return PACE_ZONES.find((zone) => paceSPerKm <= bounds[zone])!;
}

/** Vrai si la zone compte comme **haute intensité** pour la polarisation (RUN-08). */
export function isHighIntensity(zone: PaceZone): boolean {
  return HIGH_INTENSITY_ZONES.includes(zone);
}

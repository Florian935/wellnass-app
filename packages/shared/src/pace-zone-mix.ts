/**
 * US ALLURE-01 (roadmap 5.35, catalogue RUN-17 et RUN-08) — répartition du volume par zone d'allure,
 * et polarisation de l'entraînement.
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 *
 * Les deux analyses vivent dans le même fichier parce que la seconde est **l'agrégation de la
 * première** sur plusieurs courses : les séparer aurait dupliqué le classement en zones.
 *
 * ── 🔴 On compte des KILOMÈTRES, jamais des courses (spec R9) ────────────────────────────────────
 * Une sortie longue de 20 km doit peser **quatre fois** un fractionné de 5 km dans la répartition du
 * volume. C'est l'erreur la plus facile à commettre ici, et elle est **invisible** : en comptant les
 * courses, 20 km d'endurance et 5 km de seuil donneraient **50/50** au lieu de **80/20** — un chiffre
 * plausible, et faux. Un test est écrit exprès pour échouer sur cette erreur précise.
 *
 * ── Sans allure de référence, rien n'est calculable (spec R4) ────────────────────────────────────
 * `running_profiles.ref_5k_pace_s_per_km` est **nullable**, et il n'existe **aucune valeur neutre**
 * pour la remplacer : en inventer une produirait une répartition fausse et parfaitement crédible. Les
 * deux fonctions rendent donc `null`, et l'écran affiche l'indisponibilité **et son remède** — jamais
 * un « — », et jamais une carte simplement masquée : sinon l'utilisateur ne saura jamais qu'il lui
 * manque un réglage.
 */

import { PACE_ZONES, isHighIntensity, paceZoneOf, type PaceZone } from './pace-zones';
import type { KmSplit } from './running';
import { sharesOf } from './shares';

// ---------------------------------------------------------------------------
// Constantes de règle
// ---------------------------------------------------------------------------

/** Courses minimum pour parler de polarisation — une seule sortie n'est pas une répartition (R3). */
export const MIN_RUNS_FOR_POLARISATION = 2;

/**
 * Le repère souvent cité en littérature : ~80 % de volume à faible intensité.
 *
 * ⚠️ **C'est un repère nommé, pas un objectif** (spec D5). Il vaut pour un coureur qui s'entraîne pour
 * **performer**, pas pour quelqu'un qui court trois fois par semaine pour se sentir bien. L'exporter
 * sert à l'**afficher**, jamais à juger un écart.
 */
export const POLARISATION_REFERENCE_LOW_PCT = 80;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaceZoneShare = {
  zone: PaceZone;
  /** Kilomètres pleins passés dans la zone. */
  km: number;
  /** Part entière. La somme des parts vaut exactement 100 (spec R8). */
  percent: number;
};

export type Polarisation = {
  lowIntensityPct: number;
  highIntensityPct: number;
  /** Kilomètres pleins pris en compte — le chiffre qui rend la part vérifiable (spec R2). */
  totalKm: number;
  /** Courses ayant contribué : une trace absente ou trop courte ne compte pas. */
  runCount: number;
};

// ---------------------------------------------------------------------------
// Classement d'un lot de splits
// ---------------------------------------------------------------------------

/**
 * Compte les kilomètres par zone. Rend `null` si la référence manque ou si rien n'est classable.
 *
 * ⚠️ Un split inexploitable (0 s, `NaN`) est **ignoré** plutôt que de faire échouer le lot entier :
 * contrairement au negative split — où une moitié fausse rendrait le verdict faux —, un kilomètre
 * manquant dans une répartition ne fait que déplacer légèrement les parts. Refuser tout le calcul
 * serait ici une sévérité inutile.
 */
function countKmByZone(
  splits: ReadonlyArray<KmSplit>,
  ref5kPaceSPerKm: number | null,
): Map<string, number> | null {
  if (ref5kPaceSPerKm === null) return null;

  const counts = new Map<string, number>();
  for (const split of splits) {
    // Un split de 1 km plein : sa durée EST son allure en s/km. C'est ce qui rend ce module trivial
    // et c'est pour ça que `computeKmSplits` est la bonne entrée.
    const zone = paceZoneOf(split.seconds, ref5kPaceSPerKm);
    if (zone === null) continue;
    counts.set(zone, (counts.get(zone) ?? 0) + 1);
  }

  return counts.size === 0 ? null : counts;
}

/**
 * La répartition par zone d'une **course** (RUN-17).
 *
 * Triée de la zone la plus représentée à la moins. Les zones non touchées sont **absentes**, pas à
 * « 0 % » — ce serait du bruit visuel pour une information nulle.
 */
export function computePaceZoneMix(input: {
  splits: ReadonlyArray<KmSplit>;
  ref5kPaceSPerKm: number | null;
}): PaceZoneShare[] | null {
  const counts = countKmByZone(input.splits, input.ref5kPaceSPerKm);
  if (counts === null) return null;

  // 🔴 `sharesOf` ne rend pas `null` ici : `countKmByZone` a déjà écarté la carte vide, et chacune de
  // ses valeurs vaut au moins 1 — donc le total est strictement positif. Le `!` s'appuie sur cet
  // invariant plutôt qu'une garde morte (convention du dépôt).
  return sharesOf(counts)!.map(({ key, count, percent }) => ({
    zone: key as PaceZone,
    km: count,
    percent,
  }));
}

// ---------------------------------------------------------------------------
// Polarisation sur plusieurs courses
// ---------------------------------------------------------------------------

/**
 * La polarisation du volume sur une fenêtre (RUN-08).
 *
 * Rend `null` sous `MIN_RUNS_FOR_POLARISATION` courses **ayant contribué**, ou sans allure de
 * référence. Le seuil porte sur ce qui a survécu au filtre, pas sur ce qui est entré : deux courses
 * dont une sans trace ne font pas une répartition.
 *
 * 🔴 **L'agrégation se fait sur les kilomètres de toutes les courses confondues**, pas sur une moyenne
 * des pourcentages par course. Moyenner des pourcentages donnerait le même poids à un 5 km et à un
 * 20 km — précisément l'erreur que R9 interdit.
 */
export function computePolarisation(input: {
  /** Une entrée par course de la fenêtre. Les traces vides sont tolérées et ignorées. */
  runs: ReadonlyArray<{ splits: ReadonlyArray<KmSplit> }>;
  ref5kPaceSPerKm: number | null;
}): Polarisation | null {
  const { runs, ref5kPaceSPerKm } = input;
  if (ref5kPaceSPerKm === null) return null;

  let lowKm = 0;
  let highKm = 0;
  let runCount = 0;

  for (const run of runs) {
    const counts = countKmByZone(run.splits, ref5kPaceSPerKm);
    if (counts === null) continue; // course sans trace exploitable : ignorée, pas une erreur
    runCount += 1;

    for (const zone of PACE_ZONES) {
      const km = counts.get(zone) ?? 0;
      if (km === 0) continue;
      if (isHighIntensity(zone)) highKm += km;
      else lowKm += km;
    }
  }

  if (runCount < MIN_RUNS_FOR_POLARISATION) return null;

  const totalKm = lowKm + highKm;
  // `runCount ≥ 2` implique au moins un kilomètre classé par course, donc `totalKm > 0` : la garde
  // serait morte. On s'appuie sur l'invariant plutôt que de le défendre (convention du dépôt).
  const lowIntensityPct = Math.round((lowKm / totalKm) * 100);

  return {
    lowIntensityPct,
    // Complément exact : les deux parts somment à 100 par construction, sans second arrondi qui
    // pourrait donner 99 ou 101.
    highIntensityPct: 100 - lowIntensityPct,
    totalKm,
    runCount,
  };
}

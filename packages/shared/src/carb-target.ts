/**
 * FUEL-01 — socle glucidique du coureur (catalogue RN-05 + RN-06).
 *
 * Calqué sur [protein-target.ts](./protein-target.ts) : même forme de constante, même statut à
 * 3 états, mêmes bornes incluses. Deux macros lues côte à côte dans la même carte doivent se
 * calculer de la même façon.
 *
 * 🔴 **Ce module est DESCRIPTIF, jamais prescriptif** (spec règle R1, décision D1). Il ne calcule
 * aucune cible du journal : `trainingDayMacroGrams` (`nutrition.ts`, US MN-04) reste la seule
 * autorité sur les grammes cibles affichés. Les deux méthodes ne donnent pas le même nombre — MN-04
 * raisonne en **pourcentage des calories**, ce module en **g/kg de poids de corps** — et les faire
 * cohabiter comme deux cibles concurrentes reproduirait le défaut qui a coûté l'US GARDE-01.
 * Un test de non-régression dans `nutrition.test.ts` garde cette frontière.
 */

/** Niveau de charge de course sur la fenêtre, dérivé de la seule durée (décision D3). */
export type CarbLoadLevel = 'light' | 'moderate' | 'high';

/** Fourchette de référence en g/kg de poids de corps. */
export type CarbTarget = { min: number; max: number };

/**
 * Bornes de charge en **heures de course par semaine**, bornes basses INCLUSES.
 *
 * ⚠️ Ces deux nombres sont un **choix de cadrage, pas une mesure** : le catalogue nommait les paliers
 * (« modéré », « gros volume ») sans les chiffrer. Exportés et nommés exprès — c'est ce qui rend la
 * relecture par un pratiquant praticable (critère de recette 9) et ce qui permet d'ajuster un seuil
 * sans relire la logique. Même intention que `OVERTRAINING_LOAD_STREAK_DAYS`.
 */
export const CARB_LOAD_THRESHOLDS_H = { moderate: 3, high: 6 } as const;

/**
 * Fourchettes glucidiques par niveau de charge (g/kg PdC) — **repères de référence, heuristiques**,
 * au même titre que `PROTEIN_TARGETS_G_PER_KG`. Affichées comme un repère à côté d'un fait mesuré,
 * jamais comme une prescription (spec R4, décision D5).
 */
export const CARB_TARGETS_G_PER_KG: Record<CarbLoadLevel, CarbTarget> = {
  light: { min: 3, max: 5 },
  moderate: { min: 5, max: 7 },
  high: { min: 7, max: 10 },
};

export type CarbsPerKgStatus = 'low' | 'in' | 'high';
export type CarbsPerKg = { gPerKg: number; target: CarbTarget; status: CarbsPerKgStatus };

/**
 * Durée de course d'une fenêtre → **équivalent hebdomadaire en heures** (spec R6 bis).
 *
 * Les seuils de `CARB_LOAD_THRESHOLDS_H` sont définis **par semaine** ; la carte, elle, propose deux
 * fenêtres (7 j / 30 j). Sans normalisation, une fenêtre de 30 jours comparerait un cumul d'un mois à
 * des seuils hebdomadaires et classerait presque tout en « gros volume ».
 *
 * Sur 7 jours c'est l'**identité** (7/7 = 1) : R6 bis complète R6 pour le cas des 30 jours, elle ne
 * la contredit pas. `null` sur une fenêtre ≤ 0 (jamais de division par zéro) ou une durée invalide.
 */
export function weeklyEquivalentHours(
  totalDurationSeconds: number,
  windowDays: number,
): number | null {
  if (!Number.isFinite(totalDurationSeconds) || totalDurationSeconds < 0) return null;
  if (!Number.isFinite(windowDays) || windowDays <= 0) return null;
  return (totalDurationSeconds / 3600 / windowDays) * 7;
}

/**
 * Heures de course hebdomadaires → niveau de charge (spec R2).
 *
 * `null` quand il n'y a **aucune course** (0 h) : l'analyse n'a alors pas de sujet et la ligne est
 * masquée — ce n'est pas un « niveau repos » à afficher (§2 condition 3). `null` aussi sur une
 * entrée invalide, plutôt qu'un niveau choisi par défaut.
 */
export function computeCarbLoadLevel(weeklyHours: number | null): CarbLoadLevel | null {
  if (weeklyHours == null || !Number.isFinite(weeklyHours) || weeklyHours <= 0) return null;
  if (weeklyHours >= CARB_LOAD_THRESHOLDS_H.high) return 'high';
  if (weeklyHours >= CARB_LOAD_THRESHOLDS_H.moderate) return 'moderate';
  return 'light';
}

/**
 * Apport glucidique en g/kg et statut vs la fourchette du niveau de charge (déterministe, pur, sans
 * I/O ni `Date`). `null` si données insuffisantes : pas de poids valide (R8), ou aucun glucide moyen
 * (aucun jour loggé). Bornes INCLUSES → `in`, comme `computeProteinPerKg`.
 */
export function computeCarbsPerKg(params: {
  avgCarbsG: number | null;
  weightKg: number | null;
  level: CarbLoadLevel;
}): CarbsPerKg | null {
  const { avgCarbsG, weightKg, level } = params;
  if (avgCarbsG == null || weightKg == null || weightKg <= 0) return null;
  const gPerKg = Math.round((avgCarbsG / weightKg) * 10) / 10; // 1 décimale
  const target = CARB_TARGETS_G_PER_KG[level];
  const status: CarbsPerKgStatus =
    gPerKg < target.min ? 'low' : gPerKg > target.max ? 'high' : 'in';
  return { gPerKg, target, status };
}

/** Nature de la journée de course (spec R5). `unavailable` = on ne sait pas, et on le dit. */
export type RunningDayKind = 'hard' | 'easy' | 'rest' | 'unavailable';

const HARD_TYPES = new Set(['fractionne', 'sortie_longue']);
const EASY_TYPES = new Set(['endurance', 'recuperation']);

/**
 * Types des séances de course planifiées du jour → nature de la journée (spec R5, décision D4).
 *
 * 🔴 **Un type inconnu contamine le verdict** : `course_libre` n'a structurellement pas de
 * `session_type` — c'est la raison pour laquelle RUN-07 est encore différée au catalogue. On ne peut
 * pas affirmer « journée facile » quand l'une des séances du jour est de type inconnu, donc le
 * résultat est `unavailable`. Deviner « c'est sûrement de l'endurance » serait inventer une donnée
 * (précédent MUSC-20 critère 2 : « jamais un chiffre inventé »).
 *
 * Quand plusieurs séances tombent le même jour, **la plus exigeante gagne** — le cas existe et est
 * déjà signalé ailleurs par le badge « deux séances le même jour » (MR-01).
 */
export function classifyRunningDay(
  plannedSessionTypes: ReadonlyArray<string>,
): RunningDayKind {
  if (plannedSessionTypes.length === 0) return 'rest';
  if (plannedSessionTypes.some((t) => !HARD_TYPES.has(t) && !EASY_TYPES.has(t))) {
    return 'unavailable';
  }
  return plannedSessionTypes.some((t) => HARD_TYPES.has(t)) ? 'hard' : 'easy';
}

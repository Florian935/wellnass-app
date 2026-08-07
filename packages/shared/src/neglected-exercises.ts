/**
 * US EXEC-01 (roadmap 3.58, catalogue MUSC-21) — favoris délaissés.
 *
 * Aucune dépendance React, ni base, ni horloge : `todayKey` entre par paramètre, comme
 * `selectInsights` (INSIGHTS-01) et `findSessionConflicts` (COLLIS-01). Lire l'heure dans un hook la
 * ferait geler par React Compiler dans un slot mount-only.
 *
 * ── Niveau exercice, jamais niveau groupe musculaire ─────────────────────────────────────────────
 * Le catalogue décrit deux choses sous MUSC-21 : les favoris non pratiqués **et** les groupes
 * musculaires négligés. La seconde **existe déjà** (`muscle_neglected` dans le moteur d'insights, et
 * la carte d'équilibre musculaire sur ce même écran). On ne livre donc que la première : redire ce
 * qui est déjà affiché deux centimètres plus haut n'apporte rien (spec §1.2).
 *
 * ── On ne devine pas l'intention ─────────────────────────────────────────────────────────────────
 * L'analyse porte sur les **favoris déclarés**, et sur rien d'autre. Se rabattre sur « les exercices
 * les plus pratiqués » quand il n'y a pas de favoris reviendrait à reprocher à quelqu'un d'avoir
 * arrêté un exercice qu'il n'a jamais dit vouloir garder (spec R8).
 */

import { daysBetween } from './date';

// ---------------------------------------------------------------------------
// Constantes de règle
// ---------------------------------------------------------------------------

/**
 * Semaines sans pratique au-delà desquelles un favori est « délaissé ».
 *
 * ⚠️ Nombre **choisi, pas mesuré** — même statut que `LEG_SETS_CONFLICT_THRESHOLD` (COLLIS-01).
 * Exporté et nommé exprès : un seuil enfoui dans une condition ne se rediscute jamais. Validé à 4
 * par Florian le 07/08/2026, à calibrer en recette.
 */
export const NEGLECTED_AFTER_WEEKS = 4;

const DAYS_PER_WEEK = 7;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FavoriteExercise = {
  exerciseId: string;
  /** Libellé déjà résolu par l'appelant — ce module ne connaît ni la base ni la langue. */
  name: string;
  /** `dayKey` d'ajout aux favoris : c'est le point de départ quand l'exercice n'a jamais été fait. */
  favoritedOn: string;
  /** `dayKey` de la dernière série **validée**. `null` = jamais pratiqué. */
  lastPracticedOn: string | null;
};

export type NeglectedExercise = {
  exerciseId: string;
  name: string;
  /** Semaines entières écoulées depuis la dernière pratique — le chiffre que la carte affiche (R2). */
  weeksSince: number;
  /** Vrai si l'exercice n'a **jamais** été pratiqué depuis son ajout aux favoris. */
  neverPracticed: boolean;
};

// ---------------------------------------------------------------------------
// Calcul
// ---------------------------------------------------------------------------

/**
 * Les favoris délaissés, du plus ancien au plus récent.
 *
 * Rend `[]` quand il n'y a rien à dire — y compris quand il n'y a aucun favori (spec R8). L'appelant
 * ne montre alors pas la sous-section.
 *
 * ⚠️ **Les exercices archivés doivent être exclus en amont**, par la requête : proposer de reprendre
 * un exercice que l'utilisateur a retiré de sa bibliothèque serait absurde.
 *
 * ⚠️ **Un favori plus récent que le seuil n'est jamais délaissé**, même s'il n'a jamais été
 * pratiqué : on ne reproche pas à quelqu'un de ne pas avoir encore fait ce qu'il vient d'ajouter.
 * C'est `favoritedOn` qui sert alors de point de départ.
 */
export function findNeglectedExercises(input: {
  favorites: ReadonlyArray<FavoriteExercise>;
  todayKey: string;
}): NeglectedExercise[] {
  const { favorites, todayKey } = input;
  const thresholdDays = NEGLECTED_AFTER_WEEKS * DAYS_PER_WEEK;

  const neglected: NeglectedExercise[] = [];

  for (const fav of favorites) {
    const since = fav.lastPracticedOn ?? fav.favoritedOn;
    const days = daysBetween(since, todayKey);

    // Une date future (horloge décalée, saisie rétroactive) rend un négatif : jamais un délaissé.
    if (days < thresholdDays) continue;

    neglected.push({
      exerciseId: fav.exerciseId,
      name: fav.name,
      weeksSince: Math.floor(days / DAYS_PER_WEEK),
      neverPracticed: fav.lastPracticedOn === null,
    });
  }

  // Le plus délaissé en tête. À égalité, l'ordre alphabétique rend la sortie déterministe — sinon
  // deux rendus successifs pourraient intervertir deux lignes identiques à l'écran.
  return neglected.sort((a, b) => b.weeksSince - a.weeksSince || a.name.localeCompare(b.name));
}

/**
 * US ACCUEIL-01 — le résolveur de la carte « maintenant » de l'accueil.
 *
 * Répond à une seule question : **quelle est la prochaine action de l'utilisateur, là,
 * maintenant ?** Une carte, un sujet. L'accueil livré n'avait aucune notion de priorité — six
 * rectangles de poids égal, dont aucun n'était garanti à l'écran.
 *
 * ⚠️ **Le classement est une table ordonnée, pas un score** (même parti pris qu'`INSIGHT_ORDER`
 * dans `insights.ts`, et que le `SIGNAL_ORDER` de BILAN-01, pour la même raison : une priorité
 * écrite une fois se relit d'un coup d'œil en revue, là où un score se discute sans se prouver).
 *
 * ⚠️ **Aucune lecture d'horloge ici.** Tous les faits entrent par paramètre — y compris l'heure et
 * le moment de la journée. C'est la règle du dépôt (`useTodayKey`) : une valeur calculée sans
 * entrée réactive est rangée par React Compiler dans un slot mount-only, et l'accueil resterait
 * bloqué sur l'heure de son montage.
 *
 * ⚠️ **Cette fonction ne calcule rien** : elle ne fait que choisir. Les faits qu'elle reçoit sont
 * tous déjà produits ailleurs (`useTodaySession`, `useTodayRunSession`, `useMealDeadline`,
 * `useWeighInDeadline`, `useTodayWellbeing`) — c'est même tout l'intérêt : ces signaux existaient
 * déjà et ne servaient qu'à programmer des notifications, jamais à être montrés à l'ouverture.
 */

import type { DayMoment } from './day-moment';
import { dueMeal, mealsComplete, missedMeal, nextMeal, type MealSlot } from './meal-slots';

// ---------------------------------------------------------------------------
// La décision
// ---------------------------------------------------------------------------

/**
 * **L'ordre de ce tableau EST la priorité.** Le raisonnement, de haut en bas :
 *  1. ce qui **tourne déjà** passe avant tout — laisser une séance en cours hors de l'écran
 *     d'accueil est le pire cas possible, l'utilisateur revient précisément pour la reprendre ;
 *  2. puis ce qui est **planifié aujourd'hui** : c'est l'engagement que l'utilisateur a pris ;
 *  3. puis les **saisies dues** — repas, pesée — dans l'ordre de ce qu'elles coûtent si on les
 *     oublie : un repas non saisi fausse la journée entière, une pesée manquée ne fausse qu'un
 *     point de la courbe ;
 *  4. puis le **prochain repas** (US ACCUEIL-07) : la journée se lit dans l'ordre des heures, le
 *     dîner de 19 h 30 passe avant le point du soir ;
 *  5. puis le **check-in de bien-être**, qui n'a de sens qu'en fin de journée ;
 *  6. puis le **rattrapage** d'un repas manqué (US ACCUEIL-07) — la journée n'est pas faite tant
 *     qu'il manque, mais on ne le réclame qu'une fois tout le reste dit ;
 *  7. puis, si tout est fait, on **rend compte** au lieu de réclamer ;
 *  8. et si vraiment il n'y a rien à dire, on le dit court plutôt que d'inventer une tâche — avec
 *     un geste qui a du sens pour cette personne-là (`RestSuggestion`).
 */
export const NOW_ACTION_ORDER = [
  'workout-active',
  'run-active',
  'session-today',
  'meal-due',
  'weigh-in-due',
  'meal-next',
  'wellbeing-due',
  'meal-missed',
  'day-done',
  'idle',
] as const;
export type NowActionKind = (typeof NOW_ACTION_ORDER)[number];

/**
 * Une séance d'entraînement planifiée aujourd'hui, quel que soit son pilier.
 *
 * ⚠️ **Données brutes, jamais de chaîne pré-formatée** (correctif du 10/09/2026). Le premier jet
 * portait un champ `detail: string | null` que `useNowAction` remplissait… à `null`, faute d'avoir
 * accès à i18n et aux unités depuis un hook de collecte. Résultat en recette : la carte affichait
 * « Séance A » et le nom du programme, **sans le nombre d'exercices** que la maquette validée
 * annonçait (« 6 exercices · PPL semaine 3 »).
 *
 * La mise en forme appartient donc à l'UI (`NowCard`), qui a `t()` et `useUnits()`. Ce module ne
 * transporte que des nombres.
 */
export interface TodayTraining {
  pillar: 'strength' | 'running';
  /** Nom de séance déjà résolu par l'appelant (repli « Séance N » compris). */
  name: string;
  /** Heure locale `HH:MM` si l'occurrence en porte une (HORAIRE-01), sinon `null`. */
  scheduledTime: string | null;
  /** Nombre d'exercices planifiés (musculation). `null` si inconnu ou non pertinent. */
  exerciseCount: number | null;
  /** Distance cible en mètres (course). */
  targetDistanceM: number | null;
  /** Durée cible en secondes (course). */
  targetDurationSeconds: number | null;
  /** Nom du programme, si connu. */
  programName: string | null;
  /** Identifiants nécessaires au démarrage, opaques pour ce module. */
  plannedSessionId: string;
  sessionId: string;
}

/** Ce qui a été accompli aujourd'hui, pour l'état « la journée est faite ». */
export interface DayTally {
  strengthSessions: number;
  runs: number;
  /** Repas qui portent au moins une entrée aujourd'hui (US ACCUEIL-07 : un compte, plus un booléen). */
  mealsLogged: number;
  /** Série en cours (jours), pour donner un enjeu au compte rendu du soir. */
  streak: number;
}

/**
 * Le geste proposé quand rien n'est prévu (US ACCUEIL-07, constat 2).
 *
 * L'accueil livré proposait « Créer un programme » (haltère) à **tout le monde** : un jour de repos
 * avec un programme actif, et même un compte nutrition seule (décision H). Désormais :
 *  - `program` — la musculation est active et aucun programme ne l'est : là, et là seulement ;
 *  - `meal` — le pilier nutrition est actif et rien n'est noté : le premier repas ;
 *  - `activity` — sinon, un jour de repos : une marche, du vélo, du yoga… tout compte pour la série.
 */
export type RestSuggestion = 'program' | 'meal' | 'activity';

/** La décision rendue : un `kind` et juste ce qu'il faut pour la peindre. */
export type NowAction =
  | { kind: 'workout-active'; workoutId: string }
  | { kind: 'run-active' }
  | { kind: 'session-today'; training: TodayTraining }
  | { kind: 'meal-due'; meal: MealSlot }
  | { kind: 'weigh-in-due' }
  | { kind: 'meal-next'; meal: MealSlot }
  | { kind: 'wellbeing-due' }
  | { kind: 'meal-missed'; meal: MealSlot }
  | { kind: 'day-done'; tally: DayTally }
  | { kind: 'idle'; moment: DayMoment; suggestion: RestSuggestion };

// ---------------------------------------------------------------------------
// Les faits
// ---------------------------------------------------------------------------

/**
 * Tout ce que le résolveur a besoin de savoir. Chaque champ est un **fait constaté**, jamais une
 * intention : c'est ce qui rend la décision relisible et le test exhaustif.
 */
export interface NowActionInput {
  /** Heure locale courante (0-23, décimale admise : 12,5 = 12 h 30), fournie par l'appelant. */
  hour: number;
  moment: DayMoment;
  /** Séance de musculation en cours, si elle existe. */
  activeWorkoutId: string | null;
  /** Course en cours. */
  hasActiveRun: boolean;
  /**
   * Séances planifiées aujourd'hui et **non encore faites**, tous piliers.
   *
   * ⚠️ C'est ici que se corrige le défaut le plus visible de l'accueil livré : son widget appelait
   * `useTodaySession('strength')` avec le pilier **en dur**. Un coureur lisait « Rien de prévu
   * aujourd'hui » le jour de sa sortie longue. Le widget d'écran d'accueil Android, lui, balayait
   * bien les deux piliers — le tableau de bord dans l'app était donc moins juste que celui dehors.
   */
  todayTrainings: readonly TodayTraining[];
  /**
   * Les repas du jour, chacun à son heure apprise (`resolveMealSlots`). **Vide** si le pilier
   * nutrition est éteint.
   *
   * ⚠️ US ACCUEIL-07 — remplace `mealDue` / `mealDeadlineHour`, qui ne savaient qu'une chose :
   * « au moins une entrée aujourd'hui ? ». Un petit-déj noté éteignait donc le déjeuner et le dîner,
   * et suffisait à déclarer la journée faite.
   */
  meals: readonly MealSlot[];
  nutritionActive: boolean;
  /** Pesée due aujourd'hui (échéance passée, rien de saisi). */
  weighInDue: boolean;
  /**
   * La personne se pèse : au moins une pesée sur 30 jours. Même garde d'habitude que le bien-être
   * (US ACCUEIL-07, constat 3 : la pesée était réclamée à tous, chaque jour, dès 10 h).
   */
  weighInHabit: boolean;
  /** Check-in de bien-être déjà fait aujourd'hui. */
  wellbeingLogged: boolean;
  /** Pilier bien-être proposé — le check-in n'est suggéré que si l'utilisateur le suit. */
  wellbeingEnabled: boolean;
  /** Pilier musculation actif (décision H) — sans lui, jamais de « programme » à proposer. */
  strengthActive: boolean;
  /** Un programme de musculation est actif. */
  hasStrengthProgram: boolean;
  tally: DayTally;
}

// ---------------------------------------------------------------------------
// Le choix
// ---------------------------------------------------------------------------

/**
 * Trie les séances du jour par heure croissante, celles **sans heure** en dernier.
 *
 * Deux séances le même jour (une muscu le matin, une course le soir) est un cas normal chez
 * quelqu'un qui suit deux piliers — et c'est même le cœur du produit. Sans tri, l'ordre dépendrait
 * de celui des requêtes, donc de rien.
 *
 * La comparaison lexicographique sur `HH:MM` est correcte **parce que** les heures sont
 * zéro-remplies en base (`scheduled_time`) ; une heure malformée est traitée comme absente plutôt
 * que de désordonner la liste.
 */
export function sortTrainingsByTime(
  trainings: readonly TodayTraining[],
): readonly TodayTraining[] {
  const timeKey = (t: TodayTraining): string =>
    typeof t.scheduledTime === 'string' && /^\d{2}:\d{2}/.test(t.scheduledTime)
      ? t.scheduledTime
      : '99:99';
  // `toSorted` n'est pas disponible sur toutes les cibles Hermes : copie explicite.
  return [...trainings].sort((a, b) => {
    const k = timeKey(a).localeCompare(timeKey(b));
    if (k !== 0) return k;
    // À heure égale (ou toutes deux sans heure), la musculation d'abord — l'ordre des piliers du
    // produit, et le pilier livré en premier. Un choix arbitraire, mais un choix STABLE.
    if (a.pillar !== b.pillar) return a.pillar === 'strength' ? -1 : 1;
    return 0;
  });
}

/**
 * Choisit la prochaine action, en parcourant `NOW_ACTION_ORDER`.
 *
 * Ne rend **jamais** `null` : l'accueil doit toujours avoir quelque chose à mettre dans sa carte
 * épinglée, quitte à ce que ce soit `idle`. Une carte épinglée qui disparaît réintroduirait
 * exactement le trou de mise en page que la grille a mis quatre tentatives à corriger.
 */
export function resolveNowAction(input: NowActionInput): NowAction {
  // 1 · Ce qui tourne déjà.
  if (input.activeWorkoutId) {
    return { kind: 'workout-active', workoutId: input.activeWorkoutId };
  }
  if (input.hasActiveRun) {
    return { kind: 'run-active' };
  }

  // 2 · Ce qui est planifié aujourd'hui, la plus proche d'abord.
  const next = sortTrainingsByTime(input.todayTrainings)[0];
  if (next) {
    return { kind: 'session-today', training: next };
  }

  // 3 · Les saisies dues : le repas dont l'heure apprise est passée (le plus récent s'il y en a
  // deux), puis la pesée — à qui se pèse.
  const due = dueMeal(input.meals, input.hour);
  if (due) {
    return { kind: 'meal-due', meal: due };
  }
  if (input.weighInDue && input.weighInHabit) {
    return { kind: 'weigh-in-due' };
  }

  // 4 · Le prochain repas, à son heure.
  const upcoming = nextMeal(input.meals, input.hour);
  if (upcoming) {
    return { kind: 'meal-next', meal: upcoming };
  }

  // 5 · Le check-in du soir — seulement le soir, et seulement s'il est suivi.
  if (input.wellbeingEnabled && !input.wellbeingLogged && input.moment === 'evening') {
    return { kind: 'wellbeing-due' };
  }

  // 6 · Le rattrapage d'un repas manqué : la journée n'est pas faite tant qu'il manque.
  const missed = missedMeal(input.meals, input.hour);
  if (missed) {
    return { kind: 'meal-missed', meal: missed };
  }

  // 7 · Rendre compte plutôt que réclamer. « Faite » = la séance prévue faite (ou rien de prévu :
  // `todayTrainings` ne contient que ce qui reste) ET chaque repas noté (US ACCUEIL-07).
  if (mealsComplete(input.meals) && hasDoneSomething(input.tally)) {
    return { kind: 'day-done', tally: input.tally };
  }

  // 8 · Rien à dire — mais un geste qui a du sens pour cette personne.
  return { kind: 'idle', moment: input.moment, suggestion: restSuggestion(input) };
}

/** Le geste d'un jour sans rien de prévu — voir `RestSuggestion`. */
function restSuggestion(input: NowActionInput): RestSuggestion {
  if (input.strengthActive && !input.hasStrengthProgram) return 'program';
  if (input.nutritionActive && input.tally.mealsLogged === 0) return 'meal';
  return 'activity';
}

/** Vrai si la journée porte au moins une trace — sinon « la journée est faite » serait un mensonge. */
export function hasDoneSomething(tally: DayTally): boolean {
  return tally.strengthSessions > 0 || tally.runs > 0 || tally.mealsLogged > 0;
}

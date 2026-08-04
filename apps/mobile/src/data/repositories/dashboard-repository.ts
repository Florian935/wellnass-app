/**
 * Repository de composition pour le tableau de bord (dashboard).
 *
 * Ce fichier compose surtout des hooks existants des autres repositories et des
 * utilitaires de `@wellness/shared` pour exposer des vues agrégées prêtes pour les
 * widgets du dashboard. Exception : `useMostRecentRecord` exécute une requête SQL
 * directe owner-scopée (dernier record muscu) faute de hook existant équivalent.
 *
 * Hooks exposés :
 *  - `useTodaySession`      → widget 7.4 + hub muscu (occurrence planifiée du jour)
 *  - `useNutritionSummary` → widget 7.5 (résumé nutritionnel du jour)
 *  - `useStreakData`        → widget 7.6 (série de jours actifs + pastilles semaine)
 *  - `useMostRecentRecord`  → widget 7.8 (dernier record battu, muscu ou course)
 *  - `useTrainingTime`      → widget MR-06 (temps d'entraînement muscu + course, semaine)
 *  - `useTrainingLoadAlert` → widget conditionnel Tier 2 (garde-fou ACWR, US META-19)
 *  - `useOvertrainingGuardAlert` → widget conditionnel Tier 2 (garde-fou tri-pilier, US TRI-12)
 *
 * Règles d'appel des hooks :
 *  - Tous les hooks sous-jacents sont appelés inconditionnellement (règle des hooks React).
 */

import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { useTranslation } from 'react-i18next';
import {
  activeDayKeys,
  averageIntake,
  classifyLoadComponent,
  classifyNutritionComponent,
  classifyWellbeingComponent,
  computeAcwr,
  computeAge,
  computeDeficitVolumeAlert,
  computeEffectiveTargetForDay,
  computeGoalAdherence,
  computeOvertrainingGuard,
  computeReadiness,
  computeStreak,
  computeStreakWithJokers,
  countDeficitDaysInWindow,
  findRestorableGap,
  computeTrainingTime,
  dayCalorieBonus,
  estimateRunCalories,
  isTrainingDay as computeIsTrainingDay,
  localDayKey,
  localMidnightDaysAgo,
  objectiveFromGoal,
  resolveActivePillars,
  ROLLING_WEEK_DAYS,
  sessionLoad,
  stepsActiveDays,
  suggestActivityLevel,
  targetCalories,
  tdee,
  trainingDayCalories,
  wellbeingAverages,
  type ActivityLevel,
  type DayActivity,
  type RestorableGap,
  type DeficitVolumeAlert,
  type Pillar,
  type ReadinessResult,
  type RecordDistanceKey,
  type RecordType,
  type TrainingBonusMode,
} from '@wellness/shared';
import { useNutritionProfile } from './nutrition-repository';
import { useProfile } from './profile-repository';
import { useLatestWeight } from './bodyweight-repository';
import { useDailyTotals } from './journal-repository';
import { useDailySteps, useStepGoal } from './daily-steps-repository';
import { useWellbeingRows } from './daily-wellbeing-repository';
import { useJokerDays } from './streak-joker-repository';
import { useActiveWorkout, useWorkoutHistory } from './workout-repository';
import { useRunHistory, useRunStats } from './run-repository';
import { useRunningRecords } from './running-record-repository';
import { useSettings } from './settings-repository';
import { useActiveProgram } from './program-repository';
import { useHasPlannedSession } from './planned-session-repository';
import { useAuthStore } from '@/stores/auth-store';
import { getAppLanguage } from '@/i18n';
import { useTodayDate, useTodayKey, useWindowStartKey } from '@/hooks/useTodayKey';

// ---------------------------------------------------------------------------
// useTodaySession — hub muscu + widget dashboard (Refonte-B)
// ---------------------------------------------------------------------------

/** État retourné par `useTodaySession`. */
export type TodaySessionState =
  | { state: 'active-workout'; workoutId: string; isLoading: boolean }
  | {
      state: 'today-session';
      session: {
        /** Id `planned_sessions.id` — lien de complétion (marquer l'occurrence faite). */
        plannedSessionId: string;
        /** Id `sessions.id` — gabarit, pour démarrer la séance. */
        sessionId: string;
        /** Nom de la séance (fallback « Séance N » appliqué côté UI, N = orderIndex + 1). */
        name: string | null;
        /** Position 0-based dans le programme (orderIndex de la séance). */
        orderIndex: number;
        /** Nombre d'exercices planifiés. */
        exerciseCount: number;
        /** Nom du programme (traduit langue courante → repli fr). */
        programName: string | null;
      };
      isLoading: boolean;
    }
  | {
      state: 'none';
      /** Occurrence déjà faite aujourd'hui, si aucune occurrence planifiée ne reste. */
      doneToday: { name: string | null } | null;
      /** Prochaine occurrence planifiée à venir (strictement après aujourd'hui), si connue. */
      nextUpcoming: { scheduledDate: string; name: string | null } | null;
      /** Vrai si un programme est actif pour `pillar`, même sans occurrence aujourd'hui. */
      hasActiveProgram: boolean;
      isLoading: boolean;
    };

/** Ligne brute d'occurrence planifiée du jour (`SELECT_TODAY_OCCURRENCES`). */
// ─────────────────────────────────────────────────────────────────────────────
// Requêtes — exportées pour être testables
//
// Les constantes `SELECT_*` de ce fichier sont `export` **uniquement pour les tests** : hors d'ici,
// personne ne les consomme. Ce sont des jointures à 4 tables filtrées sur propriétaire, pilier et
// date ; une jointure fausse ou un `deleted_at` oublié produit un dashboard qui affiche la mauvaise
// séance sans jamais planter. Les hooks `useQuery` qui les portent ne sont pas exécutables hors
// React — les exécuter contre le harness SQLite (`@/test-utils/sqlite-harness`) est le seul moyen
// de vérifier le SQL lui-même.
// ─────────────────────────────────────────────────────────────────────────────

type TodayOccurrenceDbRow = {
  id: string;
  session_id: string;
  status: string;
  session_name: string | null;
  order_index: number;
  exercise_count: number;
  program_name: string | null;
};

/**
 * Occurrences de `pillar` planifiées pour aujourd'hui (`ps.scheduled_date = ?`), quel que soit
 * leur statut — permet de distinguer une occurrence encore `planned` d'une occurrence déjà
 * `done` le même jour. Paramètres : `[lang, userId, pillar, todayKey]`.
 */
export const SELECT_TODAY_OCCURRENCES = `
  SELECT ps.id, ps.session_id, ps.status, s.name AS session_name, s.order_index,
         (SELECT COUNT(*) FROM exercise_plans ep WHERE ep.session_id = ps.session_id AND ep.deleted_at IS NULL) AS exercise_count,
         COALESCE(tl.name, tfr.name) AS program_name
  FROM planned_sessions ps
  JOIN sessions s ON s.id = ps.session_id AND s.deleted_at IS NULL
  JOIN programs  p ON p.id = ps.program_id AND p.deleted_at IS NULL
  LEFT JOIN program_translations tl  ON tl.program_id  = p.id AND tl.lang  = ?  AND tl.deleted_at  IS NULL
  LEFT JOIN program_translations tfr ON tfr.program_id = p.id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE ps.owner_id = ? AND ps.deleted_at IS NULL AND p.pillar = ? AND ps.scheduled_date = ?
  ORDER BY s.order_index
`;

/** Ligne brute de la prochaine occurrence planifiée à venir (`SELECT_NEXT_UPCOMING`). */
type NextUpcomingDbRow = { scheduled_date: string; session_name: string | null };

/**
 * Prochaine occurrence `planned` de `pillar` strictement après aujourd'hui, la plus proche.
 * Paramètres : `[userId, pillar, todayKey]`.
 */
export const SELECT_NEXT_UPCOMING = `
  SELECT ps.scheduled_date, s.name AS session_name
  FROM planned_sessions ps
  JOIN sessions s ON s.id = ps.session_id AND s.deleted_at IS NULL
  JOIN programs  p ON p.id = ps.program_id AND p.deleted_at IS NULL
  WHERE ps.owner_id = ? AND ps.deleted_at IS NULL AND p.pillar = ? AND ps.status = 'planned' AND ps.scheduled_date > ?
  ORDER BY ps.scheduled_date, s.order_index
  LIMIT 1
`;

/**
 * Expose l'occurrence planifiée du jour pour `pillar` — source de vérité pour le hub muscu et
 * le widget dashboard (Refonte-B). Ce hook raisonne en **occurrences** (`planned_sessions`)
 * datées sur `scheduled_date` (et non « première séance du programme »).
 *
 * Priorité :
 *  1. Une séance est en cours → `active-workout`.
 *  2. Une occurrence `planned` existe aujourd'hui → `today-session` (contient
 *     `plannedSessionId`, le lien de complétion).
 *  3. Sinon → `none`, avec repli informatif : occurrence déjà `done` aujourd'hui (`doneToday`),
 *     prochaine occurrence à venir (`nextUpcoming`), et si un programme est actif (`hasActiveProgram`).
 *
 * Tous les hooks sous-jacents sont appelés inconditionnellement (règle des hooks React).
 */
export function useTodaySession(pillar: Pillar): TodaySessionState {
  const userId = useAuthStore((s) => s.session?.user.id ?? '');
  const lang = getAppLanguage() === 'en' ? 'en' : 'fr';
  const today = useTodayKey();

  const { workout, isLoading: workoutLoading } = useActiveWorkout();
  const { program, isLoading: programLoading } = useActiveProgram(pillar);
  const { data: todayRows, isLoading: todayLoading } = useQuery<TodayOccurrenceDbRow>(
    SELECT_TODAY_OCCURRENCES,
    [lang, userId, pillar, today],
  );
  const { data: nextRows, isLoading: nextLoading } = useQuery<NextUpcomingDbRow>(
    SELECT_NEXT_UPCOMING,
    [userId, pillar, today],
  );

  const isLoading = workoutLoading || programLoading || todayLoading || nextLoading;

  // 1. Séance en cours
  if (workout != null) {
    return { state: 'active-workout', workoutId: workout.id, isLoading };
  }

  // 2. Occurrence planifiée aujourd'hui — lien de complétion via plannedSessionId
  const planned = todayRows.find((r) => r.status === 'planned');
  if (planned) {
    return {
      state: 'today-session',
      session: {
        plannedSessionId: planned.id,
        sessionId: planned.session_id,
        name: planned.session_name,
        orderIndex: planned.order_index,
        exerciseCount: planned.exercise_count,
        programName: planned.program_name,
      },
      isLoading,
    };
  }

  // 3. Pas d'occurrence planifiée aujourd'hui — repli informatif (déjà fait / à venir / programme actif)
  const done = todayRows.find((r) => r.status === 'done');
  const next = nextRows[0];
  return {
    state: 'none',
    doneToday: done ? { name: done.session_name } : null,
    nextUpcoming: next ? { scheduledDate: next.scheduled_date, name: next.session_name } : null,
    hasActiveProgram: program != null,
    isLoading,
  };
}

// ---------------------------------------------------------------------------
// useIsTrainingDay — support 4.7 (calories des jours d'entraînement)
// ---------------------------------------------------------------------------

/**
 * Indique si `dayKey` (AAAA-MM-JJ local) est un « jour d'entraînement » :
 * au moins une séance muscu terminée OU une course terminée ce jour-là
 * (rétroactif, tout jour) OU une séance planifiée ce jour-là si `dayKey`
 * est aujourd'hui ou futur (anticipé via le planning — US 4.7b).
 *
 * Composé de `useWorkoutHistory` + `useRunHistory` (logique rétroactive
 * inchangée) + `useHasPlannedSession(dayKey)` (anticipation). Les trois hooks
 * sont appelés inconditionnellement (React Compiler). L'import du helper pur
 * est aliasé en `computeIsTrainingDay` pour éviter la collision de nom avec
 * le champ retourné `isTrainingDay`.
 */
export function useIsTrainingDay(dayKey: string): { isTrainingDay: boolean; isLoading: boolean } {
  // hooks inconditionnels (règle des hooks React / React Compiler)
  const { workouts, isLoading: workoutsLoading } = useWorkoutHistory();
  const { runs, isLoading: runsLoading } = useRunHistory();
  const { hasPlanned, isLoading: plannedLoading } = useHasPlannedSession(dayKey);

  const retroactiveDone = useMemo(() => {
    const doneOnDay = (arr: { finishedAt: string | null }[]) =>
      arr.some((x) => x.finishedAt != null && localDayKey(new Date(x.finishedAt)) === dayKey);
    return doneOnDay(workouts) || doneOnDay(runs);
  }, [workouts, runs, dayKey]);

  const todayKey = useTodayKey();

  return {
    isTrainingDay: computeIsTrainingDay({ retroactiveDone, hasPlanned, dayKey, todayKey }),
    isLoading: workoutsLoading || runsLoading || plannedLoading,
  };
}

// ---------------------------------------------------------------------------
// useNutritionSummary — widget 7.5
// ---------------------------------------------------------------------------

/** Résumé nutritionnel du jour retourné par `useNutritionSummary`. */
export type NutritionSummary = {
  /** Calories consommées aujourd'hui (0 si aucune entrée). */
  kcal: number;
  /**
   * Objectif calorique **de base** (TDEE + delta objectif, ou override manuel),
   * hors bonus jour d'entraînement. Sert de référence pour les macros cibles.
   * `null` si le profil est incomplet (poids, taille, âge ou objectif manquants).
   */
  target: number | null;
  /**
   * Objectif calorique **effectif** du jour = `target` + bonus jour d'entraînement
   * si aujourd'hui est un jour de séance ET qu'un bonus > 0 est réglé (4.7).
   * Égal à `target` sinon. `null` si `target` est `null`.
   */
  effectiveTarget: number | null;
  /** Vrai si aujourd'hui est un jour d'entraînement ET qu'un bonus s'applique (4.7). */
  isTrainingDay: boolean;
  /** Bonus calorique jour de séance effectivement appliqué (0 si aucun). */
  trainingBonus: number;
  /**
   * Origine du bonus finalement appliqué (RN-02) :
   *  - `run`     : mode auto, dépense d'une course terminée aujourd'hui (> 0) ;
   *  - `forfait` : forfait fixe jour de séance (mode fixed, ou mode auto sans course) ;
   *  - `none`    : aucun bonus appliqué.
   */
  bonusSource: 'run' | 'forfait' | 'none';
  /** Macronutriments consommés aujourd'hui en grammes (0 si aucune entrée). */
  macros: { p: number; g: number; l: number };
  /**
   * Vrai si un profil nutritionnel avec un objectif défini existe pour l'utilisateur.
   * Permet aux widgets de basculer entre vue « configurée » et vue « vide ».
   */
  hasProfile: boolean;
  isLoading: boolean;
};

/** Objectif calorique et bonus du jour `dayKey`, retourné par `useDayCalorieTarget`. */
export type DayCalorieTarget = {
  /**
   * Objectif calorique **de base** (TDEE + delta objectif, ou override manuel),
   * hors bonus jour d'entraînement. Indépendant du jour. `null` si le profil est
   * incomplet (poids, taille, âge ou objectif manquants).
   */
  target: number | null;
  /**
   * Objectif calorique **effectif** de `dayKey` = `target` + bonus du jour si
   * `dayKey` est un jour de séance ET qu'un bonus > 0 s'applique. Égal à `target`
   * sinon. `null` si `target` est `null`.
   */
  effectiveTarget: number | null;
  /** Bonus calorique du jour effectivement appliqué (0 si aucun). */
  trainingBonus: number;
  /**
   * Origine du bonus appliqué (RN-02) :
   *  - `run`     : mode auto, dépense d'une course terminée ce jour (> 0) ;
   *  - `forfait` : forfait fixe jour de séance (mode fixed, ou mode auto sans course) ;
   *  - `none`    : aucun bonus appliqué.
   */
  bonusSource: 'run' | 'forfait' | 'none';
  /** Vrai si `dayKey` est un jour d'entraînement ET qu'un bonus s'applique. */
  isTrainingDay: boolean;
  isLoading: boolean;
};

/**
 * Objectif calorique effectif et bonus d'un jour donné `dayKey` (RN-02).
 *
 * Centralise le calcul jusque-là dupliqué entre le dashboard et l'écran journal.
 * Paramétré par le jour : `useIsTrainingDay(dayKey)` et les courses filtrées sur
 * `dayKey` — l'écran journal peut donc naviguer entre les jours en restant correct.
 *
 * Bonus du jour (délégué à `dayCalorieBonus`, règle pure `@wellness/shared`) :
 *  - mode `fixed` (défaut) : forfait fixe les jours de séance, 0 sinon
 *    (strictement identique au comportement 4.7 antérieur) ;
 *  - mode `auto` : dépense des courses terminées ce jour si > 0 (pilier running
 *    actif), sinon repli sur le forfait fixe.
 *
 * L'objectif de base (`target`) reproduit le patron de `nutrition-stats.tsx` et
 * reste indépendant du jour. Tous les hooks sous-jacents sont appelés
 * inconditionnellement (règle des hooks React / React Compiler).
 */
export function useDayCalorieTarget(dayKey: string): DayCalorieTarget {
  const { nutritionProfile, isLoading: nutritionLoading } = useNutritionProfile();
  const { profile, isLoading: profileLoading } = useProfile();
  const { latest, isLoading: weightLoading } = useLatestWeight();
  const { isTrainingDay: trainedThatDay, isLoading: trainingLoading } = useIsTrainingDay(dayKey);
  const { settings } = useSettings();
  const { runs, isLoading: runsLoading } = useRunHistory();

  const isLoading = nutritionLoading || profileLoading || weightLoading || trainingLoading || runsLoading;

  // Calcul de l'objectif de base — même logique que nutrition-stats.tsx (indépendant du jour)
  const objective =
    nutritionProfile?.objective ?? objectiveFromGoal(profile?.mainGoal ?? null);
  const age = profile?.birthDate ? computeAge(new Date(profile.birthDate)) : undefined;
  const tdeeValue = tdee({
    sex: profile?.sex ?? 'unspecified',
    weightKg: profile?.weightKg ?? undefined,
    heightCm: profile?.heightCm ?? undefined,
    age,
    activityLevel: nutritionProfile?.activityLevel ?? 'moderate',
  });
  const target =
    tdeeValue != null && objective != null
      ? targetCalories(tdeeValue, objective, nutritionProfile?.manualCalories ?? null)
      : null;

  // --- Bonus du jour (RN-02) : mode forfait / auto + dépense des courses ---
  const mode: TrainingBonusMode = nutritionProfile?.trainingBonusMode ?? 'fixed';
  const fixedBonus = nutritionProfile?.trainingDayBonus ?? 0;

  // Poids : dernière pesée si dispo, sinon poids du profil général, sinon null.
  const weightKg = latest?.weightKg ?? profile?.weightKg ?? null;

  // Piliers actifs (même patron que useMostRecentRecord / useDeficitVolumeAlert).
  const activePillars = resolveActivePillars(settings?.activePillars);
  const runningActive = activePillars.includes('running');

  // Dépense des courses terminées ce jour (0 si running inactif).
  const runCaloriesOnDay = runningActive
    ? runs
        .filter((r) => r.finishedAt && localDayKey(new Date(r.finishedAt)) === dayKey)
        .reduce(
          (sum, r) =>
            sum +
            estimateRunCalories({
              distanceM: r.distanceM,
              durationSeconds: r.durationSeconds,
              weightKg,
            }),
          0,
        )
    : 0;

  const bonus = dayCalorieBonus({
    mode,
    isTrainingDay: trainedThatDay,
    fixedBonus,
    runCaloriesToday: runCaloriesOnDay,
  });

  const trainingBonus = bonus;
  const isTrainingDay = trainedThatDay && bonus > 0 && target != null;
  const effectiveTarget = target != null ? trainingDayCalories(target, bonus) : target;

  // Origine du bonus appliqué.
  const bonusSource: 'run' | 'forfait' | 'none' =
    mode === 'auto' && runCaloriesOnDay > 0 ? 'run' : bonus > 0 ? 'forfait' : 'none';

  return { target, effectiveTarget, trainingBonus, bonusSource, isTrainingDay, isLoading };
}

/**
 * Expose le résumé nutritionnel du jour courant pour le widget 7.5.
 *
 * Composition de `useDailyTotals` (aujourd'hui), `useNutritionProfile` (pour
 * `hasProfile`) et `useDayCalorieTarget(todayKey)` (objectif de base, objectif
 * effectif, bonus et son origine — calcul centralisé, RN-02).
 *
 * Tous les hooks sous-jacents sont appelés inconditionnellement (règle des
 * hooks React / React Compiler).
 */
export function useNutritionSummary(): NutritionSummary {
  const todayKey = useTodayKey();

  const { totals, isLoading: totalsLoading } = useDailyTotals(todayKey);
  const { nutritionProfile, isLoading: nutritionLoading } = useNutritionProfile();
  const {
    target,
    effectiveTarget,
    trainingBonus,
    bonusSource,
    isTrainingDay,
    isLoading: targetLoading,
  } = useDayCalorieTarget(todayKey);

  const isLoading = totalsLoading || nutritionLoading || targetLoading;

  // Totaux du jour (peut être absent = zéros)
  const todayTotal = totals.find((t) => t.logDate === todayKey);
  const kcal = todayTotal?.kcal ?? 0;
  const macros = {
    p: todayTotal?.proteinG ?? 0,
    g: todayTotal?.carbsG ?? 0,
    l: todayTotal?.fatG ?? 0,
  };

  // Profil considéré « configuré » si un objectif nutritionnel explicite est posé
  const hasProfile = nutritionProfile?.objective != null;

  return {
    kcal,
    target,
    effectiveTarget,
    isTrainingDay,
    trainingBonus,
    bonusSource,
    macros,
    hasProfile,
    isLoading,
  };
}

// ---------------------------------------------------------------------------
// useStreakData — widget 7.6
// ---------------------------------------------------------------------------

/** Un jour de la pastille semaine. */
export type WeekDay = {
  /** Clé AAAA-MM-JJ du jour. */
  key: string;
  /** Vrai si le jour est actif (au moins un pilier pratiqué). */
  active: boolean;
  /** Vrai si ce jour est le jour courant. */
  isToday: boolean;
};

/** Données de streak retournées par `useStreakData`. */
export type StreakData = {
  /** Nombre de jours actifs consécutifs (0 si aucune activité récente). */
  current: number;
  /** Vrai si aujourd'hui est un jour actif. */
  activeToday: boolean;
  /**
   * Les 7 jours de la semaine courante (lundi → dimanche, local), avec état
   * actif/inactif et marqueur "aujourd'hui". Pour les pastilles du widget.
   */
  last7: WeekDay[];
  /**
   * US STREAK-01 — trou rattrapable par un joker, ou `null` (le cas courant).
   *
   * Non nul seulement si un **seul** jour a été manqué, dans les 7 derniers jours, et qu'un joker
   * reste disponible ce mois-ci. `streakIfUsed` porte l'enjeu à annoncer : sans ce chiffre, la
   * proposition n'a pas de sens.
   */
  restorableGap: RestorableGap | null;
  isLoading: boolean;
};

/**
 * Expose la série de jours actifs et les pastilles de la semaine pour le widget 7.6.
 *
 * @param windowDays - Fenêtre d'analyse en jours (défaut : 30).
 *
 * Un jour est actif si au moins une dimension a été remplie :
 *  - Musculation : séance terminée (`finishedAt != null`).
 *  - Running : course terminée (`finishedAt != null`).
 *  - Nutrition : au moins 1 kcal journalisé.
 *  - **Pas (US PAS-01) : objectif de pas quotidien atteint** — et non « au moins un pas », sinon le
 *    téléphone dans la poche rendrait la série inbrisable et vide de sens.
 *
 * ⚠️ Les pas n'étant lus qu'au premier plan (aucune lecture en arrière-plan), un jour où l'objectif
 * a été atteint sans ouvrir l'app n'apparaît actif qu'**au prochain import** : la série se répare
 * alors rétroactivement. Limite assumée, cf. spec PAS-01 §2.5-2.6.
 *
 * `last7` représente la semaine ISO courante (lundi → dimanche). Les jours futurs
 * de la semaine en cours sont inclus mais seront inévitablement inactifs.
 */
export function useStreakData(windowDays = 30): StreakData {
  const { workouts, isLoading: workoutsLoading } = useWorkoutHistory();
  const { runs, isLoading: runsLoading } = useRunHistory();

  // Fenêtre d'analyse. `windowDays + 1` : la borne est inclusive côté aujourd'hui, donc `windowDays`
  // jours d'historique + le jour courant — c'est ce que faisait le `setDate(- windowDays)` précédent.
  const sinceKey = useWindowStartKey(windowDays + 1);

  const { totals, isLoading: totalsLoading } = useDailyTotals(sinceKey);
  const { rows: stepRows, isLoading: stepsLoading } = useDailySteps(sinceKey);
  const { goal: stepGoal, isLoading: goalLoading } = useStepGoal();
  // US STREAK-01 — les jours couverts par un joker comptent dans la série, et **seulement** là.
  const { days: jokerDayList, isLoading: jokersLoading } = useJokerDays();

  const isLoading =
    workoutsLoading ||
    runsLoading ||
    totalsLoading ||
    stepsLoading ||
    goalLoading ||
    jokersLoading;

  const today = useTodayDate();
  const todayKey = useTodayKey();

  const { streak, last7, restorableGap } = useMemo(() => {
    // Construire la map des activités par jour
    const map = new Map<string, DayActivity>();

    const touch = (k: string): DayActivity => {
      let entry = map.get(k);
      if (!entry) {
        entry = { day: k, strength: false, running: false, nutrition: false };
        map.set(k, entry);
      }
      return entry;
    };

    for (const w of workouts) {
      if (w.finishedAt != null) {
        const k = localDayKey(new Date(w.finishedAt));
        touch(k).strength = true;
      }
    }

    for (const r of runs) {
      if (r.finishedAt != null) {
        const k = localDayKey(new Date(r.finishedAt));
        touch(k).running = true;
      }
    }

    for (const t of totals) {
      if (t.kcal > 0) {
        touch(t.logDate).nutrition = true;
      }
    }

    // US PAS-01 : seul l'objectif atteint compte (cf. `isGoalReached`, brique pure testée).
    for (const day of stepsActiveDays(stepRows, stepGoal)) {
      touch(day).steps = true;
    }

    const activities = [...map.values()];
    const activeDays = activeDayKeys(activities);
    const jokerDays = new Set(jokerDayList);
    const streak = computeStreakWithJokers(activeDays, jokerDays, todayKey);
    // Trou rattrapable : un seul jour manqué, récent, avec un joker encore disponible. `null` la
    // plupart du temps — c'est ce qui fait qu'on ne propose rien quand il n'y a rien à réparer.
    const restorableGap = findRestorableGap({ activeDays, jokerDays, todayKey });

    // Semaine courante lundi → dimanche (heure locale)
    const todayObj = new Date(todayKey + 'T00:00:00');
    // getDay() : 0 = dimanche, 1 = lundi … 6 = samedi
    const dayOfWeek = todayObj.getDay(); // 0-6
    // Décalage pour ramener lundi en position 0
    const offsetToMonday = (dayOfWeek + 6) % 7; // lundi = 0, mardi = 1 … dimanche = 6
    const mondayMs = todayObj.getTime() - offsetToMonday * 86_400_000;

    const last7: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mondayMs + i * 86_400_000);
      const key = localDayKey(d);
      return {
        key,
        active: activeDays.has(key),
        isToday: key === todayKey,
      };
    });

    return { streak, last7, restorableGap };
  }, [workouts, runs, totals, stepRows, stepGoal, jokerDayList, todayKey]);

  return {
    current: streak.current,
    activeToday: streak.activeToday,
    last7,
    restorableGap,
    isLoading,
  };
}

// ---------------------------------------------------------------------------
// useMostRecentRecord — widget 7.8
// ---------------------------------------------------------------------------

/**
 * Dernier record battu, tous piliers actifs confondus, retourné par
 * `useMostRecentRecord`. Discriminé par `pillar` :
 *  - `strength` : record muscu (`type`, `value`, `exerciseName`) ;
 *  - `running`  : record d'allure (`distanceKey`, `bestTimeSeconds`).
 * Dans les deux cas, `achievedAt` (ISO UTC) sert au tri et à l'affichage de la date.
 */
export type MostRecentRecord =
  | {
      pillar: 'strength';
      type: RecordType;
      value: number;
      exerciseName: string;
      achievedAt: string;
    }
  | {
      pillar: 'running';
      distanceKey: RecordDistanceKey;
      bestTimeSeconds: number;
      achievedAt: string;
    };

/** Ligne brute du record muscu le plus récent (nom d'exercice résolu langue → fr). */
type MostRecentRecordDbRow = {
  type: string;
  value: number;
  achieved_at: string;
  exercise_name: string | null;
};

/**
 * Record muscu le plus récent de l'utilisateur courant, avec nom d'exercice résolu
 * (langue courante → fr). Paramètres : `[lang, userId]` — 1er `?` = langue courante
 * (jointure translations), 2nd `?` = `user_id` (owner-scope). Reproduit le patron de
 * jointure/langue de `SELECT_RECORDS_FOR_WORKOUT` (records-repository).
 */
export const SELECT_MOST_RECENT_STRENGTH_RECORD = `
  SELECT r.type, r.value, r.achieved_at,
         COALESCE(tl.name, tfr.name) AS exercise_name
  FROM personal_records r
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = r.exercise_id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = r.exercise_id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE r.user_id = ? AND r.deleted_at IS NULL
  ORDER BY r.achieved_at DESC
  LIMIT 1
`;

/**
 * Expose le dernier record battu (muscu OU course) pour le widget 7.8.
 *
 * Compose deux sources — record muscu le plus récent (`useQuery` ci-dessus) et
 * records d'allure (`useRunningRecords`, on garde le `achievedAt` le plus récent) —
 * puis retourne le plus récent des deux.
 *
 * **Respect des piliers actifs** : les deux sources sont TOUJOURS lues (hooks
 * inconditionnels, React Compiler), mais on ignore la source d'un pilier non actif
 * lors de la fusion (filtrage sur les résultats). On ne montre jamais le record
 * d'un pilier désactivé. Tant que les réglages ne sont pas chargés, tous les
 * piliers sont supposés actifs (cohérent avec le dashboard).
 */
export function useMostRecentRecord(): {
  record: MostRecentRecord | null;
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('en') ? 'en' : 'fr';

  const userId = useAuthStore((s) => s.session?.user.id ?? '');

  const { settings } = useSettings();
  const activePillars = resolveActivePillars(settings?.activePillars);
  const strengthActive = activePillars.includes('strength');
  const runningActive = activePillars.includes('running');

  // Sources lues inconditionnellement (règle des hooks / React Compiler).
  const { data: strengthRows, isLoading: strengthLoading } =
    useQuery<MostRecentRecordDbRow>(SELECT_MOST_RECENT_STRENGTH_RECORD, [lang, userId]);
  const { records: runningRecords, isLoading: runningLoading } = useRunningRecords();

  const isLoading = strengthLoading || runningLoading;

  // Candidat muscu (si le pilier est actif).
  const strengthRow = strengthRows[0];
  const strengthCandidate: MostRecentRecord | null =
    strengthActive && strengthRow != null
      ? {
          pillar: 'strength',
          type: strengthRow.type as RecordType,
          value: strengthRow.value,
          exerciseName: strengthRow.exercise_name ?? '',
          achievedAt: strengthRow.achieved_at,
        }
      : null;

  // Candidat running : le record d'allure au `achievedAt` le plus récent (si actif).
  let runningCandidate: MostRecentRecord | null = null;
  if (runningActive) {
    let latest: (typeof runningRecords)[number] | null = null;
    for (const rec of runningRecords) {
      if (latest == null || rec.achievedAt > latest.achievedAt) {
        latest = rec;
      }
    }
    if (latest != null) {
      runningCandidate = {
        pillar: 'running',
        distanceKey: latest.distanceKey,
        bestTimeSeconds: latest.bestTimeSeconds,
        achievedAt: latest.achievedAt,
      };
    }
  }

  // Fusion : le plus récent des candidats restants.
  let record: MostRecentRecord | null = null;
  if (strengthCandidate != null && runningCandidate != null) {
    record =
      strengthCandidate.achievedAt >= runningCandidate.achievedAt
        ? strengthCandidate
        : runningCandidate;
  } else {
    record = strengthCandidate ?? runningCandidate;
  }

  return { record, isLoading };
}

/** Un record muscu récent (liste), nom d'exercice résolu langue → fr. */
export type RecentStrengthRecord = {
  type: RecordType;
  value: number;
  exerciseName: string;
  achievedAt: string;
};

/** Les `limit` records muscu les plus récents (nom d'exercice résolu). Paramètres : `[lang, userId, limit]`. */
export const SELECT_RECENT_STRENGTH_RECORDS = `
  SELECT r.type, r.value, r.achieved_at,
         COALESCE(tl.name, tfr.name) AS exercise_name
  FROM personal_records r
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = r.exercise_id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = r.exercise_id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE r.user_id = ? AND r.deleted_at IS NULL
  ORDER BY r.achieved_at DESC
  LIMIT ?
`;

/**
 * Liste des `limit` derniers records muscu battus (widget Records récents, forme grand carré).
 * Owner-scopée, noms d'exercices résolus (langue courante → fr). Pilier gardé en amont par le hub.
 */
export function useRecentStrengthRecords(limit = 4): {
  records: RecentStrengthRecord[];
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('en') ? 'en' : 'fr';
  const userId = useAuthStore((s) => s.session?.user.id ?? '');

  const { data, isLoading } = useQuery<MostRecentRecordDbRow>(SELECT_RECENT_STRENGTH_RECORDS, [
    lang,
    userId,
    limit,
  ]);

  const records: RecentStrengthRecord[] = data.map((r) => ({
    type: r.type as RecordType,
    value: r.value,
    exerciseName: r.exercise_name ?? '',
    achievedAt: r.achieved_at,
  }));
  return { records, isLoading };
}

// ---------------------------------------------------------------------------
// useDeficitVolumeAlert — widget 7.9 (US 4.32)
// ---------------------------------------------------------------------------

/**
 * Clé AAAA-MM-JJ locale du jour situé `n` jours avant `ref`.
 *
 * `ref` est **injectée** et non lue de l'horloge : sans ça, React Compiler gèle l'appel dans un slot
 * mount-only et la fenêtre glissante cesse de glisser. Les appelants passent `useTodayDate()`.
 */
const daysAgo = (n: number, ref: Date) => localDayKey(localMidnightDaysAgo(n, ref));

/**
 * Volume muscu (Σ reps × poids) des sets effectifs (non warmup, terminés) sur les 7
 * derniers jours, tous exercices confondus. Requête copiée de `nutrition-stats.tsx`
 * (US 4.32, tâche 6 la retirera de cet écran) — duplication temporaire assumée.
 */
export const SELECT_WEEKLY_STRENGTH_VOLUME = `
  SELECT ws.reps, ws.weight_kg FROM workout_sets ws
  JOIN workouts w ON w.id = ws.workout_id AND w.deleted_at IS NULL
  WHERE ws.deleted_at IS NULL AND ws.done = 1 AND ws.set_type != 'warmup' AND w.started_at >= ?
`;

/**
 * Expose l'alerte croisée déficit calorique + fort volume muscu (widget 7.9, US 4.32).
 *
 * Composition : apports 7 j (`useDailyTotals`, tableau épars des seuls jours loggés),
 * cible calorique de base (`useNutritionSummary().target`, hors bonus jour d'entraînement),
 * volume muscu 7 j (requête dédiée ci-dessus), puis délégation à `computeDeficitVolumeAlert`
 * (règle pure, `@wellness/shared`).
 *
 * **Gating piliers** : nécessite `strength` ET `nutrition` actifs (même lecture de
 * `settings?.activePillars` que `useMostRecentRecord`). Tous les hooks sous-jacents sont
 * appelés inconditionnellement (règle des hooks React) ; le gating n'intervient qu'au
 * moment de retourner le résultat.
 */
export function useDeficitVolumeAlert(): DeficitVolumeAlert {
  const { settings } = useSettings();
  const activePillars = resolveActivePillars(settings?.activePillars);
  const strengthActive = activePillars.includes('strength');
  const nutritionActive = activePillars.includes('nutrition');

  // ⚠️ Bornes **volontairement identiques à l'avant-correctif** : `daysAgo(7)` donne J-7, donc une
  // fenêtre de 8 jours inclusifs alors que le hook s'appelle « weekly ». Et le `+ 'T00:00:00.000Z'`
  // étiquette un minuit **local** comme s'il était UTC, donc décale d'un fuseau. Ces deux écarts
  // sont antérieurs à ce correctif : les redresser ici changerait les chiffres de l'alerte au milieu
  // d'un commit censé ne corriger que le gel. Consignés pour une passe dédiée.
  const today = useTodayDate();
  const windowStartKey = daysAgo(7, today);

  const { totals } = useDailyTotals(windowStartKey);
  const { target } = useNutritionSummary();
  const { data: volRows } = useQuery<{ reps: number | null; weight_kg: number | null }>(
    SELECT_WEEKLY_STRENGTH_VOLUME,
    [windowStartKey + 'T00:00:00.000Z'],
  );

  if (!(strengthActive && nutritionActive)) {
    return { show: false, deficitPct: 0, loggedDays: 0 };
  }

  const loggedDailyKcals = totals.map((d) => d.kcal);
  const weeklyVolume = volRows.reduce((s, r) => s + (r.reps ?? 0) * (r.weight_kg ?? 0), 0);

  return computeDeficitVolumeAlert({
    loggedDailyKcals,
    targetKcal: target ?? 0,
    weeklyVolume,
  });
}

// ---------------------------------------------------------------------------
// useTrainingTime — widget MR-06 (temps d'entraînement muscu + course)
// ---------------------------------------------------------------------------

export type TrainingTime = {
  totalSeconds: number;
  strengthSeconds: number;
  runningSeconds: number;
  strengthActive: boolean;
  runningActive: boolean;
  isLoading: boolean;
};

/**
 * Temps d'entraînement des **7 derniers jours glissants** : muscu + course.
 *
 * Composition : `useRunStats('week')` fournit la durée course (fenêtre glissante 7 jours) ;
 * `useWorkoutHistory()` fournit les séances muscu terminées, filtrées sur la même fenêtre
 * (borne `finished_at` ≥ J−6, jour-alignée) et sommées. Gating transverse (`strength`/`running`)
 * appliqué au retour ; hooks appelés inconditionnellement (règle des hooks).
 */
export function useTrainingTime(): TrainingTime {
  const { settings } = useSettings();
  const activePillars = resolveActivePillars(settings?.activePillars);
  const strengthActive = activePillars.includes('strength');
  const runningActive = activePillars.includes('running');

  const { stats, isLoading: runLoading } = useRunStats('week');
  const { workouts, isLoading: workoutLoading } = useWorkoutHistory();

  const weekStartKey = useWindowStartKey(ROLLING_WEEK_DAYS);
  const strengthSecondsRaw = workouts.reduce((sum, w) => {
    if (w.durationSeconds == null || w.finishedAt == null) return sum;
    const dayKey = localDayKey(new Date(w.finishedAt));
    return dayKey >= weekStartKey ? sum + w.durationSeconds : sum;
  }, 0);

  const agg = computeTrainingTime({
    strengthSeconds: strengthActive ? strengthSecondsRaw : 0,
    runningSeconds: runningActive ? stats.totalDurationS : 0,
  });

  return { ...agg, strengthActive, runningActive, isLoading: runLoading || workoutLoading };
}

// ---------------------------------------------------------------------------
// useTrainingLoadAlert — widget conditionnel (US META-19, garde-fou ACWR)
// ---------------------------------------------------------------------------

const ACUTE_WINDOW_DAYS = 7;
const CHRONIC_WINDOW_DAYS = 28;

export type TrainingLoadAlert = { show: boolean };

/**
 * Expose l'alerte de surcharge combinée (ACWR, widget conditionnel Tier 2, US META-19).
 *
 * Composition : `useWorkoutHistory()` + `useRunHistory()` (déjà chargées ailleurs sur le
 * dashboard, aucune nouvelle requête), filtrées par `finishedAt` sur les fenêtres 7 j / 28 j
 * glissantes (`useWindowStartKey`, même patron que `useTrainingTime`), puis délégation à
 * `computeAcwr` (règle pure, `@wellness/shared`).
 *
 * **Gating piliers** : nécessite `strength` ET `running` actifs — l'ACWR combine les deux, un
 * seul actif ne donnerait qu'une moitié du calcul (même patron que `useTrainingTime`). Tous les
 * hooks sous-jacents sont appelés inconditionnellement (règle des hooks React) ; le gating
 * n'intervient qu'au moment de retourner le résultat.
 */
export function useTrainingLoadAlert(): TrainingLoadAlert {
  const { settings } = useSettings();
  const activePillars = resolveActivePillars(settings?.activePillars);
  const strengthActive = activePillars.includes('strength');
  const runningActive = activePillars.includes('running');

  const { workouts } = useWorkoutHistory();
  const { runs } = useRunHistory();

  const acuteStartKey = useWindowStartKey(ACUTE_WINDOW_DAYS);
  const chronicStartKey = useWindowStartKey(CHRONIC_WINDOW_DAYS);

  if (!(strengthActive && runningActive)) {
    return { show: false };
  }

  const sessions = [
    ...workouts.map((w) => ({ rpe: w.rpe, durationSeconds: w.durationSeconds, finishedAt: w.finishedAt })),
    ...runs.map((r) => ({ rpe: r.rpe, durationSeconds: r.durationSeconds, finishedAt: r.finishedAt })),
  ];

  const byWindow = (startKey: string) =>
    sessions.filter((s) => s.finishedAt != null && localDayKey(new Date(s.finishedAt)) >= startKey);

  const result = computeAcwr({
    acuteSessions: byWindow(acuteStartKey),
    chronicSessions: byWindow(chronicStartKey),
  });

  return { show: result?.showAlert ?? false };
}

// ---------------------------------------------------------------------------
// useOvertrainingGuardAlert — widget conditionnel (US TRI-12, garde-fou tri-pilier)
// ---------------------------------------------------------------------------

/** Fenêtre de recherche du streak de charge — large mais bornée (le seuil d'alerte n'est que 6 j). */
const LOAD_STREAK_LOOKBACK_DAYS = 30;

/** Fenêtre du compte de jours en déficit — fixe, 7 j calendaires (spec R3). */
const DEFICIT_WINDOW_DAYS = 7;

export type OvertrainingGuardAlert = { show: boolean };

/**
 * Expose le garde-fou tri-pilier (charge sans repos + déficit persistant, US TRI-12).
 *
 * Composition : `useWorkoutHistory()` + `useRunHistory()` (déjà chargées ailleurs sur le
 * dashboard) agrégées en jours à charge non nulle (R1), passées à `computeStreak` (même primitive
 * que le streak d'activité, TRI-01, réutilisée sur un ensemble de jours différent) pour le streak
 * (R2). `useDailyTotals()` + `useNutritionSummary().target` (même source que
 * `useDeficitVolumeAlert`) donnent le compte de jours en déficit (R3). `computeOvertrainingGuard`
 * applique R4 (les deux signaux, jamais un seul).
 *
 * **Gating tri-pilier** : `strength`, `running` ET `nutrition` tous actifs — sans les trois, le
 * diagnostic n'est plus « global » (spec R5). Tous les hooks sous-jacents sont appelés
 * inconditionnellement (règle des hooks React) ; le gating n'intervient qu'au retour.
 */
export function useOvertrainingGuardAlert(): OvertrainingGuardAlert {
  const { settings } = useSettings();
  const activePillars = resolveActivePillars(settings?.activePillars);
  const strengthActive = activePillars.includes('strength');
  const runningActive = activePillars.includes('running');
  const nutritionActive = activePillars.includes('nutrition');

  const { workouts } = useWorkoutHistory();
  const { runs } = useRunHistory();
  const todayKey = useTodayKey();
  const loadLookbackKey = useWindowStartKey(LOAD_STREAK_LOOKBACK_DAYS);
  const deficitWindowKey = useWindowStartKey(DEFICIT_WINDOW_DAYS);
  const { totals } = useDailyTotals(deficitWindowKey);
  const { target } = useNutritionSummary();

  if (!(strengthActive && runningActive && nutritionActive)) {
    return { show: false };
  }

  const sessions = [
    ...workouts.map((w) => ({ rpe: w.rpe, durationSeconds: w.durationSeconds, finishedAt: w.finishedAt })),
    ...runs.map((r) => ({ rpe: r.rpe, durationSeconds: r.durationSeconds, finishedAt: r.finishedAt })),
  ].filter((s) => s.finishedAt != null && localDayKey(new Date(s.finishedAt)) >= loadLookbackKey);

  const loadByDay = new Map<string, number>();
  for (const s of sessions) {
    const dayKey = localDayKey(new Date(s.finishedAt as string));
    loadByDay.set(dayKey, (loadByDay.get(dayKey) ?? 0) + sessionLoad(s));
  }
  const chargeDays = new Set(
    Array.from(loadByDay.entries())
      .filter(([, load]) => load > 0)
      .map(([dayKey]) => dayKey),
  );
  const loadStreakDays = computeStreak(chargeDays, todayKey).current;

  const deficitDaysCount = countDeficitDaysInWindow(
    totals.map((t) => ({ kcal: t.kcal })),
    target ?? 0,
  );

  return computeOvertrainingGuard({ loadStreakDays, deficitDaysCount });
}

// ---------------------------------------------------------------------------
// useReadiness — widget transverse (US TRI-03, score de forme / readiness)
// ---------------------------------------------------------------------------

/** Fenêtre nutrition (spec R2) — fixe, 7 j calendaires, indépendante des fenêtres ACWR. */
const READINESS_NUTRITION_WINDOW_DAYS = 7;

/** Fenêtre bien-être (spec R3/D5) — 3 derniers jours renseignés, énergie + stress seulement. */
const READINESS_WELLBEING_WINDOW_DAYS = 3;

/**
 * Expose le score de forme transverse (US TRI-03) : verdict + détail des 3 composantes
 * (charge / nutrition / bien-être). **Dégradation par composante** (spec D2), pas de garde
 * tout-ou-rien comme `useTrainingLoadAlert`/`useOvertrainingGuardAlert` — un pilier inactif ou une
 * composante sans historique suffisant devient `unavailable`, elle ne bloque pas les autres.
 *
 * Composition : `computeAcwr` sur les séances des piliers actifs (R1), `averageIntake` sur les
 * jours loggés de la semaine comparée à `useNutritionSummary().target` (R2), `wellbeingAverages`
 * (énergie + stress seulement, D5) sur les 3 derniers jours de check-in (R3, `daily_wellbeing`,
 * US BIEN-01). Combinaison par `computeReadiness` (R4/R5, `@wellness/shared`). Tous les hooks
 * sous-jacents sont appelés inconditionnellement (règle des hooks React).
 */
export function useReadiness(): ReadinessResult {
  const { settings } = useSettings();
  const activePillars = resolveActivePillars(settings?.activePillars);
  const strengthActive = activePillars.includes('strength');
  const runningActive = activePillars.includes('running');
  const nutritionActive = activePillars.includes('nutrition');

  const { workouts } = useWorkoutHistory();
  const { runs } = useRunHistory();
  const acuteStartKey = useWindowStartKey(ACUTE_WINDOW_DAYS);
  const chronicStartKey = useWindowStartKey(CHRONIC_WINDOW_DAYS);

  const nutritionWindowKey = useWindowStartKey(READINESS_NUTRITION_WINDOW_DAYS);
  const { totals } = useDailyTotals(nutritionWindowKey);
  const { target } = useNutritionSummary();

  const todayKey = useTodayKey();
  const wellbeingWindowKey = useWindowStartKey(READINESS_WELLBEING_WINDOW_DAYS);
  const { rows: wellbeingRows } = useWellbeingRows(wellbeingWindowKey);

  // R1 — charge : séances des seuls piliers actifs (dégradation par pilier, contrairement au
  // gating tout-ou-rien de `useTrainingLoadAlert`).
  const sessions = [
    ...(strengthActive
      ? workouts.map((w) => ({
          rpe: w.rpe,
          durationSeconds: w.durationSeconds,
          finishedAt: w.finishedAt,
        }))
      : []),
    ...(runningActive
      ? runs.map((r) => ({ rpe: r.rpe, durationSeconds: r.durationSeconds, finishedAt: r.finishedAt }))
      : []),
  ];
  const byWindow = (startKey: string) =>
    sessions.filter((s) => s.finishedAt != null && localDayKey(new Date(s.finishedAt)) >= startKey);
  const acwr = computeAcwr({
    acuteSessions: byWindow(acuteStartKey),
    chronicSessions: byWindow(chronicStartKey),
  });
  const load = classifyLoadComponent(acwr);

  // R2 — nutrition : pilier inactif traité comme aucun jour loggé (même dégradation naturelle).
  const nutrition = classifyNutritionComponent({
    loggedDaysCount: nutritionActive ? totals.length : 0,
    avgKcal: averageIntake(totals).kcal,
    targetKcal: target ?? 0,
  });

  // R3/D5 — bien-être : transverse, jamais gardé par pilier (comme le widget lui-même).
  const wellbeingAvg = wellbeingAverages(wellbeingRows, READINESS_WELLBEING_WINDOW_DAYS, todayKey);
  const wellbeing = classifyWellbeingComponent({
    energy: wellbeingAvg.energy,
    stress: wellbeingAvg.stress,
  });

  return computeReadiness({ load, nutrition, wellbeing });
}

// ---------------------------------------------------------------------------
// useActivityLevelSuggestion — widget conditionnel (US RN-03, TDEE ↔ volume de course)
// ---------------------------------------------------------------------------

/** Fenêtre de fréquence (spec D1) — 14 j, distincte des fenêtres ACWR (7 j / 28 j). */
const ACTIVITY_LEVEL_WINDOW_DAYS = 14;

export type ActivityLevelSuggestion =
  | { show: false }
  | { show: true; current: ActivityLevel; suggested: ActivityLevel; runningDays: number };

/**
 * Expose la suggestion de niveau d'activité TDEE selon la fréquence de course réelle (US RN-03).
 * **Ne touche jamais** `dayCalorieBonus`/`trainingBonusMode` (RN-02) — cette US ajuste le socle
 * (`activityLevel`), RN-02 ajuste le jour ; les deux restent indépendantes (spec §0).
 *
 * Composition : `useRunHistory()` (déjà chargée ailleurs) filtrée aux 14 derniers jours
 * calendaires, jours distincts comptés via un `Set` de `localDayKey` (spec R1), puis
 * `suggestActivityLevel` (règle pure, `@wellness/shared`) contre le niveau déclaré
 * (`useNutritionProfile()`).
 *
 * **Gating registre** (`widgets.ts`) : `['running', 'nutrition']`, évalué en OU (candidat de
 * grille). Le véritable ET est appliqué **ici** : sans les deux piliers actifs, retour anticipé
 * `{ show: false }` — même patron que `useTrainingLoadAlert`. Tous les hooks sous-jacents sont
 * appelés inconditionnellement (règle des hooks React). **N'inspecte jamais** `manualCalories`
 * (spec R6/D3 — visible même en surcharge manuelle).
 */
export function useActivityLevelSuggestion(): ActivityLevelSuggestion {
  const { settings } = useSettings();
  const activePillars = resolveActivePillars(settings?.activePillars);
  const runningActive = activePillars.includes('running');
  const nutritionActive = activePillars.includes('nutrition');

  const { runs } = useRunHistory();
  const { nutritionProfile } = useNutritionProfile();
  const windowStartKey = useWindowStartKey(ACTIVITY_LEVEL_WINDOW_DAYS);

  if (!(runningActive && nutritionActive) || !nutritionProfile) {
    return { show: false };
  }

  const runningDays = new Set(
    runs
      .filter((r) => r.finishedAt != null && localDayKey(new Date(r.finishedAt)) >= windowStartKey)
      .map((r) => localDayKey(new Date(r.finishedAt as string))),
  ).size;

  const suggested = suggestActivityLevel({
    currentLevel: nutritionProfile.activityLevel,
    runningDaysInWindow: runningDays,
  });

  if (suggested == null) return { show: false };
  return { show: true, current: nutritionProfile.activityLevel, suggested, runningDays };
}

// ---------------------------------------------------------------------------
// useGoalAdherence — carte NUTR-10 (adhérence à l'objectif calorique)
// ---------------------------------------------------------------------------

export type GoalAdherence = {
  loggedDays: number;
  daysInTarget: number;
  pct: number;
  marginPct: number;
  hasTarget: boolean;
  isLoading: boolean;
};

/**
 * Adhérence à l'objectif calorique (NUTR-10) sur les `windowDays` derniers jours : part des jours
 * loggés dont les kcal tombent dans la fourchette ±marge% de l'**objectif effectif du jour** (base +
 * bonus jour de séance, mode Forfait/Auto). Réutilise le calcul d'objectif de base de
 * `useDayCalorieTarget` et les briques pures RN-01 (`computeEffectiveTargetForDay`), en batch sur la
 * fenêtre. Jours d'entraînement / dépense course déterminés depuis l'historique (déjà en mémoire).
 * Hooks appelés inconditionnellement.
 */
export function useGoalAdherence(windowDays: number): GoalAdherence {
  const today = useTodayDate();
  return useGoalAdherenceForRange(daysAgo(windowDays, today), null);
}

/**
 * Même calcul, sur une **fenêtre explicite** `[fromKey, toKey]` (bornes incluses ; `toKey = null`
 * signifie « jusqu'à aujourd'hui »).
 *
 * Extrait pour le bilan hebdomadaire (US BILAN-01, décision D6) : le bilan porte sur une **semaine
 * ISO close**, et une adhérence mesurée sur 7 jours glissants afficherait, sous un titre « semaine du
 * 20 au 26 juillet », un chiffre portant sur une autre période. Le corps est inchangé — seule la
 * borne est devenue un paramètre, plutôt que d'être dérivée d'un nombre de jours.
 */
export function useGoalAdherenceForRange(
  fromKey: string,
  toKey: string | null,
): GoalAdherence {
  const { nutritionProfile, isLoading: nutriLoading } = useNutritionProfile();
  const { profile, isLoading: profileLoading } = useProfile();
  const { latest, isLoading: weightLoading } = useLatestWeight();
  const { settings } = useSettings();
  const { totals: allTotals, isLoading: totalsLoading } = useDailyTotals(fromKey);
  // Borne haute : sans elle, un bilan de la semaine close inclurait les jours de la semaine en cours.
  const totals = toKey === null ? allTotals : allTotals.filter((d) => d.logDate <= toKey);
  const { workouts, isLoading: wLoading } = useWorkoutHistory();
  const { runs, isLoading: rLoading } = useRunHistory();

  const isLoading =
    nutriLoading || profileLoading || weightLoading || totalsLoading || wLoading || rLoading;

  // Objectif de base (indépendant du jour), même logique que useDayCalorieTarget.
  const objective = nutritionProfile?.objective ?? objectiveFromGoal(profile?.mainGoal ?? null);
  const age = profile?.birthDate ? computeAge(new Date(profile.birthDate)) : undefined;
  const tdeeValue = tdee({
    sex: profile?.sex ?? 'unspecified',
    weightKg: profile?.weightKg ?? undefined,
    heightCm: profile?.heightCm ?? undefined,
    age,
    activityLevel: nutritionProfile?.activityLevel ?? 'moderate',
  });
  const targetBase =
    tdeeValue != null && objective != null
      ? targetCalories(tdeeValue, objective, nutritionProfile?.manualCalories ?? null)
      : null;

  const mode: TrainingBonusMode = nutritionProfile?.trainingBonusMode ?? 'fixed';
  const fixedBonus = nutritionProfile?.trainingDayBonus ?? 0;
  const marginPct = nutritionProfile?.adherenceMarginPct ?? 10;
  const weightKg = latest?.weightKg ?? profile?.weightKg ?? null;
  const runningActive = resolveActivePillars(settings?.activePillars).includes('running');

  // Jours d'entraînement (muscu/course terminés) + dépense course, par jour local.
  const trainedDays = new Set<string>();
  for (const w of workouts) if (w.finishedAt) trainedDays.add(localDayKey(new Date(w.finishedAt)));
  for (const r of runs) if (r.finishedAt) trainedDays.add(localDayKey(new Date(r.finishedAt)));
  const runCaloriesByDay = new Map<string, number>();
  if (runningActive) {
    for (const r of runs) {
      if (!r.finishedAt) continue;
      const k = localDayKey(new Date(r.finishedAt));
      runCaloriesByDay.set(
        k,
        (runCaloriesByDay.get(k) ?? 0) +
          estimateRunCalories({
            distanceM: r.distanceM,
            durationSeconds: r.durationSeconds,
            weightKg,
          }),
      );
    }
  }

  const perDay = totals.map((d) => ({
    kcal: d.kcal,
    effectiveTarget:
      targetBase == null
        ? null
        : computeEffectiveTargetForDay({
            targetBase,
            mode,
            fixedBonus,
            isTrainingDay: trainedDays.has(d.logDate),
            runCaloriesToday: runCaloriesByDay.get(d.logDate) ?? 0,
          }),
  }));

  const { loggedDays, daysInTarget, pct } = computeGoalAdherence(perDay, marginPct);
  return { loggedDays, daysInTarget, pct, marginPct, hasTarget: targetBase != null, isLoading };
}

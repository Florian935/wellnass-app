/**
 * Repository de composition pour le tableau de bord (dashboard).
 *
 * Ce fichier compose surtout des hooks existants des autres repositories et des
 * utilitaires de `@wellness/shared` pour exposer des vues agrégées prêtes pour les
 * widgets du dashboard. Exception : `useMostRecentRecord` exécute une requête SQL
 * directe owner-scopée (dernier record muscu) faute de hook existant équivalent.
 *
 * Hooks exposés :
 *  - `useNextSession`      → widget 7.4 (prochaine séance / séance active)
 *  - `useNutritionSummary` → widget 7.5 (résumé nutritionnel du jour)
 *  - `useStreakData`        → widget 7.6 (série de jours actifs + pastilles semaine)
 *  - `useMostRecentRecord`  → widget 7.8 (dernier record battu, muscu ou course)
 *
 * Règles d'appel des hooks :
 *  - Tous les hooks sous-jacents sont appelés inconditionnellement (règle des hooks React).
 *  - `useProgramDetail` est appelé avec `program?.id ?? ''` : quand l'id est vide,
 *    la requête interne ne matche aucune ligne → `detail` est `null` (comportement
 *    confirmé dans program-repository.ts — la clause `WHERE p.id = ?` retourne 0 ligne).
 */

import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { useTranslation } from 'react-i18next';
import {
  activeDayKeys,
  computeAge,
  computeStreak,
  isTrainingDay as computeIsTrainingDay,
  localDayKey,
  objectiveFromGoal,
  targetCalories,
  tdee,
  trainingDayCalories,
  type DayActivity,
  type RecordDistanceKey,
  type RecordType,
} from '@wellness/shared';
import { useNutritionProfile } from './nutrition-repository';
import { useProfile } from './profile-repository';
import { useDailyTotals } from './journal-repository';
import { useActiveWorkout, useWorkoutHistory } from './workout-repository';
import { useRunHistory } from './run-repository';
import { useRunningRecords } from './running-record-repository';
import { useSettings } from './settings-repository';
import { useActiveProgram, useProgramDetail } from './program-repository';
import { useHasPlannedSession } from './planned-session-repository';
import { useAuthStore } from '@/stores/auth-store';
import { PILLARS } from '@wellness/shared';

// ---------------------------------------------------------------------------
// useNextSession — widget 7.4
// ---------------------------------------------------------------------------

/** État retourné par `useNextSession`. */
export type NextSessionState =
  | { state: 'active-workout'; workoutId: string; isLoading: boolean }
  | {
      state: 'has-session';
      session: {
        /** Id de la séance — pour `startWorkoutFromSession(id)`. */
        id: string;
        /** Nom de la séance (fallback : « Séance N » si null). */
        name: string;
        /** Position 0-based dans le programme (orderIndex de la séance). */
        orderIndex: number;
        /** Nombre d'exercices planifiés (plans.length). */
        exerciseCount: number;
        /** Nom du programme actif (pour le contexte affiché dans le widget). */
        programName: string;
      };
      isLoading: boolean;
    }
  | { state: 'no-program'; isLoading: boolean };

/**
 * Expose l'état de la prochaine action muscu pour le widget 7.4.
 *
 * Priorité :
 *  1. Une séance est en cours → `active-workout`.
 *  2. Un programme actif a des séances → `has-session` (séance au plus petit orderIndex).
 *  3. Aucun programme actif / programme vide → `no-program`.
 *
 * Tous les hooks sous-jacents sont appelés inconditionnellement.
 */
export function useNextSession(): NextSessionState {
  const { workout, isLoading: workoutLoading } = useActiveWorkout();
  const { program, isLoading: programLoading } = useActiveProgram('strength');
  // Appel inconditionnel : '' → detail null (requête retourne 0 ligne).
  const { detail, isLoading: detailLoading } = useProgramDetail(program?.id ?? '');

  const isLoading = workoutLoading || programLoading || detailLoading;

  // 1. Séance en cours
  if (workout != null) {
    return { state: 'active-workout', workoutId: workout.id, isLoading };
  }

  // 2. Programme actif avec séances — sessions sont triées par order_index (ORDER BY order_index dans la requête SQL)
  if (program != null && detail != null && detail.sessions.length > 0) {
    // La première séance dans le tableau est celle au plus petit orderIndex
    const first = detail.sessions[0]!;
    return {
      state: 'has-session',
      session: {
        id: first.id,
        // Fallback : « Séance N » (N = orderIndex + 1, affiché 1-based dans le widget)
        name: first.name ?? `Séance ${first.orderIndex + 1}`,
        orderIndex: first.orderIndex,
        exerciseCount: first.plans.length,
        programName: program.name,
      },
      isLoading,
    };
  }

  // 3. Pas de programme ou programme vide
  return { state: 'no-program', isLoading };
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

  const todayKey = localDayKey(new Date());

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
  /** Macronutriments consommés aujourd'hui en grammes (0 si aucune entrée). */
  macros: { p: number; g: number; l: number };
  /**
   * Vrai si un profil nutritionnel avec un objectif défini existe pour l'utilisateur.
   * Permet aux widgets de basculer entre vue « configurée » et vue « vide ».
   */
  hasProfile: boolean;
  isLoading: boolean;
};

/**
 * Expose le résumé nutritionnel du jour pour le widget 7.5.
 *
 * Composition de `useDailyTotals` (aujourd'hui), `useNutritionProfile` et
 * `useProfile`. Le calcul du TDEE et de l'objectif calorique reproduit
 * exactement le patron de `nutrition-stats.tsx`.
 */
export function useNutritionSummary(): NutritionSummary {
  const todayKey = localDayKey(new Date());

  const { totals, isLoading: totalsLoading } = useDailyTotals(todayKey);
  const { nutritionProfile, isLoading: nutritionLoading } = useNutritionProfile();
  const { profile, isLoading: profileLoading } = useProfile();
  const { isTrainingDay: trainedToday, isLoading: trainingLoading } = useIsTrainingDay(todayKey);

  const isLoading = totalsLoading || nutritionLoading || profileLoading || trainingLoading;

  // Totaux du jour (peut être absent = zéros)
  const todayTotal = totals.find((t) => t.logDate === todayKey);
  const kcal = todayTotal?.kcal ?? 0;
  const macros = {
    p: todayTotal?.proteinG ?? 0,
    g: todayTotal?.carbsG ?? 0,
    l: todayTotal?.fatG ?? 0,
  };

  // Calcul de l'objectif — même logique que nutrition-stats.tsx
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

  // Bonus jour d'entraînement (4.7) : appliqué seulement si jour de séance ET bonus > 0.
  const bonus = nutritionProfile?.trainingDayBonus ?? 0;
  const isTrainingDay = trainedToday && bonus > 0 && target != null;
  const trainingBonus = isTrainingDay ? bonus : 0;
  const effectiveTarget =
    target != null && isTrainingDay ? trainingDayCalories(target, bonus) : target;

  // Profil considéré « configuré » si un objectif nutritionnel explicite est posé
  const hasProfile = nutritionProfile?.objective != null;

  return { kcal, target, effectiveTarget, isTrainingDay, trainingBonus, macros, hasProfile, isLoading };
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
  isLoading: boolean;
};

/**
 * Expose la série de jours actifs et les pastilles de la semaine pour le widget 7.6.
 *
 * @param windowDays - Fenêtre d'analyse en jours (défaut : 30).
 *
 * Un jour est actif si au moins un pilier a été pratiqué :
 *  - Musculation : séance terminée (`finishedAt != null`).
 *  - Running : course terminée (`finishedAt != null`).
 *  - Nutrition : au moins 1 kcal journalisé.
 *
 * `last7` représente la semaine ISO courante (lundi → dimanche). Les jours futurs
 * de la semaine en cours sont inclus mais seront inévitablement inactifs.
 */
export function useStreakData(windowDays = 30): StreakData {
  const { workouts, isLoading: workoutsLoading } = useWorkoutHistory();
  const { runs, isLoading: runsLoading } = useRunHistory();

  // Fenêtre d'analyse
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - windowDays);
  const sinceKey = localDayKey(sinceDate);

  const { totals, isLoading: totalsLoading } = useDailyTotals(sinceKey);

  const isLoading = workoutsLoading || runsLoading || totalsLoading;

  const today = new Date();
  const todayKey = localDayKey(today);

  const { streak, last7 } = useMemo(() => {
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

    const activities = [...map.values()];
    const activeDays = activeDayKeys(activities);
    const streak = computeStreak(activeDays, todayKey);

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

    return { streak, last7 };
  }, [workouts, runs, totals, todayKey]);

  return {
    current: streak.current,
    activeToday: streak.activeToday,
    last7,
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
const SELECT_MOST_RECENT_STRENGTH_RECORD = `
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
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const userId = useAuthStore((s) => s.session?.user.id ?? '');

  const { settings } = useSettings();
  const activePillars = settings?.activePillars ?? [...PILLARS];
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

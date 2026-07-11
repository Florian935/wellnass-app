/**
 * Repository de composition pour le tableau de bord (dashboard).
 *
 * Ce fichier n'exécute AUCUNE requête SQL directe : il compose des hooks
 * existants des autres repositories et des utilitaires de `@wellness/shared`
 * pour exposer des vues agrégées prêtes pour les widgets du dashboard.
 *
 * Hooks exposés :
 *  - `useNextSession`      → widget 7.4 (prochaine séance / séance active)
 *  - `useNutritionSummary` → widget 7.5 (résumé nutritionnel du jour)
 *  - `useStreakData`        → widget 7.6 (série de jours actifs + pastilles semaine)
 *
 * Règles d'appel des hooks :
 *  - Tous les hooks sous-jacents sont appelés inconditionnellement (règle des hooks React).
 *  - `useProgramDetail` est appelé avec `program?.id ?? ''` : quand l'id est vide,
 *    la requête interne ne matche aucune ligne → `detail` est `null` (comportement
 *    confirmé dans program-repository.ts — la clause `WHERE p.id = ?` retourne 0 ligne).
 */

import { useMemo } from 'react';
import {
  activeDayKeys,
  computeAge,
  computeStreak,
  localDayKey,
  objectiveFromGoal,
  targetCalories,
  tdee,
  type DayActivity,
} from '@wellness/shared';
import { useNutritionProfile } from './nutrition-repository';
import { useProfile } from './profile-repository';
import { useDailyTotals } from './journal-repository';
import { useActiveWorkout, useWorkoutHistory } from './workout-repository';
import { useRunHistory } from './run-repository';
import { useActiveProgram, useProgramDetail } from './program-repository';

// ---------------------------------------------------------------------------
// useNextSession — widget 7.4
// ---------------------------------------------------------------------------

/** État retourné par `useNextSession`. */
export type NextSessionState =
  | { state: 'active-workout'; workoutId: string; isLoading: boolean }
  | {
      state: 'has-session';
      session: {
        /** Nom de la séance (fallback : « Séance N » si null). */
        name: string;
        /** Position 0-based dans le programme (orderIndex de la séance). */
        orderIndex: number;
        /** Nombre d'exercices planifiés (plans.length). */
        exerciseCount: number;
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
        // Fallback : « Séance N » (N = orderIndex + 1, affiché 1-based dans le widget)
        name: first.name ?? `Séance ${first.orderIndex + 1}`,
        orderIndex: first.orderIndex,
        exerciseCount: first.plans.length,
      },
      isLoading,
    };
  }

  // 3. Pas de programme ou programme vide
  return { state: 'no-program', isLoading };
}

// ---------------------------------------------------------------------------
// useNutritionSummary — widget 7.5
// ---------------------------------------------------------------------------

/** Résumé nutritionnel du jour retourné par `useNutritionSummary`. */
export type NutritionSummary = {
  /** Calories consommées aujourd'hui (0 si aucune entrée). */
  kcal: number;
  /**
   * Objectif calorique calculé (TDEE + delta objectif, ou override manuel).
   * `null` si le profil est incomplet (poids, taille, âge ou objectif manquants).
   *
   * NOTE MVP : le bonus des jours d'entraînement (`trainingDayBonus`) n'est pas
   * appliqué ici — son rattachement au planning sera câblé ultérieurement.
   */
  target: number | null;
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

  const isLoading = totalsLoading || nutritionLoading || profileLoading;

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

  // Profil considéré « configuré » si un objectif nutritionnel explicite est posé
  const hasProfile = nutritionProfile?.objective != null;

  return { kcal, target, macros, hasProfile, isLoading };
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

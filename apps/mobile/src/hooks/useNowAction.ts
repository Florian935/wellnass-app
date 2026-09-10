/**
 * US ACCUEIL-01 — assemble les faits de la journée et rend la décision de la carte « maintenant ».
 *
 * Ce hook ne décide rien : il **collecte**, et délègue le choix à `resolveNowAction`
 * (`@wellness/shared`), qui est pur et testé. La séparation n'est pas décorative — c'est ce qui
 * permet de vérifier la table de priorité sans monter un arbre React ni une base SQLite.
 *
 * ⚠️ **Tous les hooks sont appelés inconditionnellement**, y compris ceux dont la donnée n'est pas
 * utilisée (règle des hooks React, et React Compiler est actif sur ce dépôt).
 *
 * ⚠️ **Aucune lecture d'horloge directe** : l'heure vient de `useTodayDate()`, la seule source
 * réactive autorisée (voir la docstring de `useTodayKey`). Un `new Date().getHours()` ici gèlerait
 * l'heure au montage de l'accueil — et l'accueil ne se démonte jamais, faute d'`unmountOnBlur`.
 *
 * ── Ce que ce hook rend enfin visible ────────────────────────────────────────────────────────────
 * `useMealDeadline`, `useWeighInDeadline` et `useTodayWellbeing` existaient déjà et ne servaient
 * **qu'à programmer des notifications**. L'app savait donc, à l'heure près et par apprentissage,
 * ce qu'il restait à faire aujourd'hui — sans jamais le montrer à l'ouverture.
 */

import { useMemo } from 'react';
import {
  dayMoment,
  resolveNowAction,
  type DayTally,
  type NowAction,
  type TodayTraining,
} from '@wellness/shared';

import { useCurrentHour, useTodayKey, useWindowStartKey } from '@/hooks/useTodayKey';
import { useActiveWorkout, useWorkoutHistory } from '@/data/repositories/workout-repository';
import {
  useActiveRun,
  useRunHistory,
  useTodayRunSession,
} from '@/data/repositories/run-repository';
import { useTodaySession, useStreakData } from '@/data/repositories/dashboard-repository';
import { useNotificationPrefs } from '@/data/repositories/notification-repository';
import {
  useMealDeadline,
  useMealLoggedToday,
  useWeighInDeadline,
  useWeighInToday,
} from '@/data/repositories/reminder-habits-repository';
import {
  useTodayWellbeing,
  useWellbeingEntries,
} from '@/data/repositories/daily-wellbeing-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { resolveActivePillars } from '@wellness/shared';

/**
 * Fenêtre sur laquelle on considère que l'utilisateur « suit » son bien-être.
 *
 * ⚠️ Il n'existe **aucun réglage** `wellbeingEnabled` : BIEN-01 n'a pas d'interrupteur, la
 * fonctionnalité s'atteint par `/wellbeing`. On ne peut donc pas lire une intention déclarée — on
 * observe un usage. Une entrée dans les 30 derniers jours signifie que le geste fait partie des
 * habitudes ; sans cela, proposer un check-in serait réclamer un geste que l'utilisateur n'a
 * jamais choisi.
 */
const WELLBEING_HABIT_WINDOW_DAYS = 30;

/** Jour local d'un instant ISO UTC, pour compter ce qui a été terminé aujourd'hui. */
function isSameLocalDay(iso: string | null, todayKey: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` === todayKey;
}

export function useNowAction(): { action: NowAction; isLoading: boolean } {
  const todayKey = useTodayKey();
  // Heure COURANTE et non minuit : voir la docstring de useCurrentHour, ce hook existe pour ce
  // defaut precis.
  const hour = useCurrentHour();

  const { settings } = useSettings();
  const activePillars = resolveActivePillars(settings?.activePillars);
  const prefs = useNotificationPrefs();

  // ── Ce qui tourne ─────────────────────────────────────────────────────────
  const { workout, isLoading: workoutLoading } = useActiveWorkout();
  const { run: activeRun } = useActiveRun();

  // ── Ce qui est planifié aujourd'hui, LES DEUX piliers ─────────────────────
  const strength = useTodaySession('strength');
  const { session: runSession } = useTodayRunSession();

  // ── Les saisies dues ──────────────────────────────────────────────────────
  const mealDeadline = useMealDeadline(prefs);
  const { done: mealDone, isLoading: mealDoneLoading } = useMealLoggedToday();
  const weighInDeadline = useWeighInDeadline(prefs);
  const { done: weighInDone } = useWeighInToday();
  const { entry: wellbeing } = useTodayWellbeing();
  const wellbeingSince = useWindowStartKey(WELLBEING_HABIT_WINDOW_DAYS);
  const { entries: wellbeingHistory } = useWellbeingEntries(wellbeingSince);

  // ── Ce qui a été fait aujourd'hui ─────────────────────────────────────────
  const { workouts } = useWorkoutHistory();
  const { runs } = useRunHistory();
  const { current: streak } = useStreakData();

  const isLoading = workoutLoading || mealDoneLoading || strength.isLoading;

  const trainings = useMemo<TodayTraining[]>(() => {
    const out: TodayTraining[] = [];
    // Musculation : `useTodaySession` ne rend `today-session` que pour une occurrence encore
    // `planned` — une séance déjà faite ne réapparaît donc pas comme « à faire ».
    if (strength.state === 'today-session' && activePillars.includes('strength')) {
      const s = strength.session;
      out.push({
        pillar: 'strength',
        name: s.name?.trim() || '',
        scheduledTime: s.scheduledTime ?? null,
        // Le nombre d'exercices était disponible depuis le début et n'était pas transmis : la
        // carte n'affichait que le nom du programme. Défaut vu en recette le 10/09/2026.
        exerciseCount: s.exerciseCount,
        targetDistanceM: null,
        targetDurationSeconds: null,
        programName: s.programName,
        plannedSessionId: s.plannedSessionId,
        sessionId: s.sessionId,
      });
    }
    // Course : c'est le pilier que l'accueil livré ignorait complètement.
    if (runSession && activePillars.includes('running')) {
      out.push({
        pillar: 'running',
        name: runSession.name?.trim() || '',
        scheduledTime: runSession.scheduledTime ?? null,
        exerciseCount: null,
        // Mêmes cibles que la carte épinglée du hub course, pour que les deux écrans annoncent la
        // même séance dans les mêmes termes.
        targetDistanceM: runSession.targetDistanceM,
        targetDurationSeconds: runSession.targetDurationSeconds,
        programName: null,
        plannedSessionId: runSession.id,
        sessionId: runSession.id,
      });
    }
    return out;
  }, [strength, runSession, activePillars]);

  const tally = useMemo<DayTally>(
    () => ({
      strengthSessions: workouts.filter((w) => isSameLocalDay(w.finishedAt ?? null, todayKey)).length,
      runs: runs.filter((r) => isSameLocalDay(r.finishedAt ?? null, todayKey)).length,
      mealLogged: mealDone,
      streak,
    }),
    [workouts, runs, mealDone, streak, todayKey],
  );

  const action = useMemo(
    () =>
      resolveNowAction({
        hour,
        moment: dayMoment(hour),
        activeWorkoutId: workout?.id ?? null,
        hasActiveRun: activeRun != null,
        todayTrainings: trainings,
        // « Dû » = l'échéance (apprise ou réglée) est passée ET rien n'a été saisi. Sans la
        // seconde condition, la carte réclamerait un repas déjà enregistré.
        mealDue:
          activePillars.includes('nutrition') && !mealDone && hour >= mealDeadline.hour,
        mealDeadlineHour: mealDeadline.hour,
        weighInDue: !weighInDone && hour >= weighInDeadline.hour,
        wellbeingLogged: wellbeing != null,
        // Le check-in n'est proposé qu'à qui le pratique déjà — voir
        // `WELLBEING_HABIT_WINDOW_DAYS` : il n'y a pas de réglage à interroger, seulement un usage
        // à observer.
        wellbeingEnabled: wellbeingHistory.length > 0,
        tally,
      }),
    [
      hour,
      workout?.id,
      activeRun,
      trainings,
      activePillars,
      mealDone,
      mealDeadline.hour,
      weighInDone,
      weighInDeadline.hour,
      wellbeing,
      wellbeingHistory.length,
      tally,
    ],
  );

  return { action, isLoading };
}

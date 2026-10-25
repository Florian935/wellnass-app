/**
 * US DASH-01 (§4.1) — **les faits du moment** de l'accueil, rassemblés une seule fois.
 *
 * `resolveHomeMoment` (pur, testé) décide lequel des quatre moments s'applique ; ce hook ne fait que
 * lui apporter ce qu'il demande, et remonte à côté les quelques chiffres que la scène affiche. Le
 * même patron que `useNowAction` : **les hooks collectent, la brique décide, l'écran peint.**
 *
 * ⚠️ L'heure vient de `useCurrentHour` et le jour de `useTodayDate` : jamais `new Date()` dans le
 * corps d'un hook, sous peine de geler la valeur dans un slot mount-only de React Compiler (voir la
 * docstring de `useTodayKey`, et le bug qu'elle documente).
 *
 * ── US ACCUEIL-07 ────────────────────────────────────────────────────────────────────────────────
 * Le hook remonte aussi ce qu'il faut pour que la scène dise vrai :
 *  - **`coveredToday`** — un joker posé sur aujourd'hui, ou un jour de période « vie réelle » : la
 *    série n'est alors pas en jeu, « Il te reste 3 h pour la garder » serait faux ;
 *  - **`rescue`** — les vraies sorties quand elle l'est (marcher, noter une activité, le joker),
 *    choisies par `streakRescueOptions` ;
 *  - **`daysSinceLastActivity`** et **`firstDay`** — pour « Content de te revoir » et « Bienvenue ».
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  explainReadiness,
  localDateFromDayKey,
  localDayKey,
  resolveHomeMoment,
  startOfWeek,
  streakRescueOptions,
  timeLeftToday,
  type BriefFacts,
  type HomeMoment,
  type NowAction,
  type ReadinessResult,
  type ReadinessVerdict,
  type StreakRescueOption,
} from '@wellness/shared';
import {
  useDaysSinceLastActivity,
  useNutritionSummary,
  useProteinTarget,
  useReadiness,
  useStreakData,
} from '@/data/repositories/dashboard-repository';
import { useNearRecords } from '@/data/repositories/records-repository';
import { useRealLifeState } from '@/data/repositories/real-life-repository';
import { useRunHistory } from '@/data/repositories/run-repository';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';
import type { AskQuestion } from '@/components/ask/AskCard';
import { useTodayWellbeing } from '@/data/repositories/daily-wellbeing-repository';
import { useNotificationPrefs } from '@/data/repositories/notification-repository';
import { useJokerDays } from '@/data/repositories/streak-joker-repository';
import { useDailySteps, useStepGoal } from '@/data/repositories/daily-steps-repository';
import { useCurrentHour, useTodayDate, useTodayKey, useWindowStartKey } from '@/hooks/useTodayKey';

/**
 * Les pas sont « suivis » quand Health Connect en a écrit au moins une journée sur la semaine : sans
 * cela, une marche ne serait pas comptée, et la proposer pour sauver la série serait mentir.
 */
const STEPS_TRACKED_WINDOW_DAYS = 7;

export type HomeSceneFacts = {
  moment: HomeMoment;
  streak: number;
  /** Verdict du score de forme (TRI-03), `null` tant qu'aucune composante n'est calculable. */
  verdict: ReadinessVerdict | null;
  /** Le résultat complet — c'est lui que « Pourquoi ? » détaille (§6.1). */
  readiness: ReadinessResult;
  checkinDone: boolean;
  /**
   * Heures restantes avant minuit — la seule chose qui compte quand la série est en jeu.
   *
   * À l'heure près, comme le compte à rebours de la séance : l'app n'a pas d'horloge à la minute
   * (`useCurrentHour` est la seule source autorisée), et « il te reste environ 3 h » se lit aussi
   * bien que « 3 h 12 » sans faire re-rendre l'accueil soixante fois par heure.
   */
  hoursLeft: number;
  /** Aujourd'hui est déjà couvert pour la série : joker posé, ou jour de période « vie réelle ». */
  coveredToday: boolean;
  /** Les vraies sorties quand la série est en jeu, dans l'ordre d'affichage. */
  rescue: StreakRescueOption[];
  /** Jours depuis la dernière activité ; `null` sur un compte sans aucun historique. */
  daysSinceLastActivity: number | null;
  /** Aucun historique du tout : le tout premier jour (« Bienvenue »). */
  firstDay: boolean;
  isLoading: boolean;
};

/**
 * Les faits du **brief du matin** (§6.2), assemblés à partir de ce que l'accueil sait déjà.
 *
 * Séparé de `useHomeScene` pour ne monter ses requêtes (record à portée, protéines) que le matin :
 * le brief ne se rend qu'à ce moment-là, et l'accueil est l'écran le plus ouvert de l'app.
 */
export function useMorningBriefFacts(action: NowAction, verdict: ReadinessVerdict | null): BriefFacts {
  const { current: streak } = useStreakData();
  const { items: nearRecords } = useNearRecords(1);
  const { macros } = useNutritionSummary();
  const proteinTarget = useProteinTarget();
  const { inRealLifePeriod } = useRealLifeState();

  const near = nearRecords[0];
  return {
    verdict,
    todaySession:
      action.kind === 'session-today'
        ? { title: action.training.name, time: action.training.scheduledTime }
        : null,
    // Un record déjà égalé n'est pas « à portée » : il est atteint, la phrase n'aurait pas de sens.
    nearRecord:
      near && near.gapKind !== 'beaten'
        ? { exerciseName: near.exerciseName, gapKind: near.gapKind, gap: near.gap }
        : null,
    proteinGapG: proteinTarget != null ? Math.max(0, proteinTarget - macros.p) : null,
    streak,
    realLifeActive: inRealLifePeriod,
  };
}

export function useHomeScene(): HomeSceneFacts {
  const hour = useCurrentHour();
  const today = useTodayDate();
  const todayKey = useTodayKey();
  const { current: streak, activeToday, isLoading: streakLoading } = useStreakData();
  const { days: daysSinceLastActivity, isLoading: daysLoading } = useDaysSinceLastActivity();
  const { entry: checkin } = useTodayWellbeing();
  const prefs = useNotificationPrefs();
  const readiness = useReadiness();
  const { days: jokerDays } = useJokerDays();
  const { pausedDays } = useRealLifeState();
  const stepsSince = useWindowStartKey(STEPS_TRACKED_WINDOW_DAYS);
  const { rows: stepRows } = useDailySteps(stepsSince);
  const { goal: stepGoal } = useStepGoal();

  const coveredToday = jokerDays.includes(todayKey) || (pausedDays?.has(todayKey) ?? false);
  const rescue = useMemo(
    () =>
      streakRescueOptions({
        stepsTracked: stepRows.length > 0,
        steps: stepRows.find((r) => r.logDate === todayKey)?.steps ?? 0,
        stepGoal,
        jokerDays,
        todayKey,
      }),
    [stepRows, stepGoal, jokerDays, todayKey],
  );

  // Minuit + l'heure courante : la date de référence de la décision et du décompte.
  const now = useMemo(() => {
    const value = new Date(today);
    value.setHours(hour, 0, 0, 0);
    return value;
  }, [today, hour]);

  const moment = resolveHomeMoment({
    now,
    activeToday,
    streak,
    daysSinceLastActivity,
    checkinDoneToday: checkin !== null,
    coveredToday,
    reminderHour: prefs.streakDanger ? prefs.reminderHour : null,
  });

  return {
    moment,
    streak,
    verdict: readiness.show ? readiness.verdict : null,
    readiness,
    checkinDone: checkin !== null,
    hoursLeft: timeLeftToday(now).hours,
    coveredToday,
    rescue,
    daysSinceLastActivity,
    // Pendant la lecture, "aucun historique" ne veut encore rien dire : pas de « Bienvenue » éclair.
    firstDay: !daysLoading && daysSinceLastActivity === null,
    isLoading: streakLoading,
  };
}

/**
 * US DASH-01 (§7.3) — les **trois questions du moment**, avec leur réponse **déjà calculée**.
 *
 * C'est l'inversion qui fait toute la fonctionnalité : le client répond, le modèle ne fait que
 * formuler. Sans IA, sans réseau, sans consentement, ces trois réponses s'affichent telles quelles —
 * et aucun chiffre affiché ne sort jamais d'un modèle (R7).
 */
export function useAskQuestions(readiness: ReadinessResult): AskQuestion[] {
  const { t } = useTranslation();
  const { kcal, effectiveTarget, macros } = useNutritionSummary();
  const proteinTarget = useProteinTarget();
  const { workouts } = useWorkoutHistory();
  const { runs } = useRunHistory();
  const { last7 } = useStreakData();
  const todayKey = useTodayKey();

  return useMemo(() => {
    const weekStartKey = localDayKey(startOfWeek(localDateFromDayKey(todayKey)));
    const inWeek = (iso: string | null) => iso != null && localDayKey(new Date(iso)) >= weekStartKey;

    const verdict = readiness.show ? readiness.verdict : null;
    const remainingKcal = effectiveTarget != null ? Math.max(0, effectiveTarget - kcal) : null;
    const remainingProtein = proteinTarget != null ? Math.max(0, Math.round(proteinTarget - macros.p)) : null;

    return [
      {
        key: 'today',
        label: t('ask.questions.today'),
        answer: t(verdict ? `ask.answers.today${capitalize(verdict)}` : 'ask.answers.todayUnknown'),
        explanation: explainReadiness(readiness),
      },
      {
        key: 'eat',
        label: t('ask.questions.eat'),
        answer:
          remainingKcal != null && remainingProtein != null
            ? t('ask.answers.eatRemaining', { kcal: remainingKcal, protein: remainingProtein })
            : t('ask.answers.eatNoTarget'),
        explanation: null,
      },
      {
        key: 'week',
        label: t('ask.questions.week'),
        answer: t('ask.answers.week', {
          workouts: workouts.filter((w) => inWeek(w.finishedAt)).length,
          runs: runs.filter((r) => inWeek(r.finishedAt)).length,
          days: last7.filter((day) => day.active).length,
        }),
        explanation: null,
      },
    ];
    // La série n'entre pas dans les réponses : la scène la dit déjà, et la répéter ici la
    // transformerait en injonction.
  }, [t, readiness, effectiveTarget, kcal, proteinTarget, macros.p, workouts, runs, last7, todayKey]);
}

/** `rest` → `Rest` : la clé i18n de la réponse suit le verdict. */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

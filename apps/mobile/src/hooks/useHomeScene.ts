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
 */

import { useMemo } from 'react';
import {
  resolveHomeMoment,
  timeLeftToday,
  type BriefFacts,
  type HomeMoment,
  type NowAction,
  type ReadinessResult,
  type ReadinessVerdict,
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
import { useTodayWellbeing } from '@/data/repositories/daily-wellbeing-repository';
import { useNotificationPrefs } from '@/data/repositories/notification-repository';
import { useJokersRemaining } from '@/data/repositories/streak-joker-repository';
import { useCurrentHour, useTodayDate } from '@/hooks/useTodayKey';

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
  jokersRemaining: number;
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
  const { current: streak, activeToday, isLoading: streakLoading } = useStreakData();
  const { days: daysSinceLastActivity } = useDaysSinceLastActivity();
  const { entry: checkin } = useTodayWellbeing();
  const prefs = useNotificationPrefs();
  const readiness = useReadiness();
  const { remaining: jokersRemaining } = useJokersRemaining();

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
    reminderHour: prefs.streakDanger ? prefs.reminderHour : null,
  });

  return {
    moment,
    streak,
    verdict: readiness.show ? readiness.verdict : null,
    readiness,
    checkinDone: checkin !== null,
    hoursLeft: timeLeftToday(now).hours,
    jokersRemaining,
    isLoading: streakLoading,
  };
}

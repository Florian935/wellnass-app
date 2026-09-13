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
  type HomeMoment,
  type ReadinessVerdict,
} from '@wellness/shared';
import {
  useDaysSinceLastActivity,
  useReadiness,
  useStreakData,
} from '@/data/repositories/dashboard-repository';
import { useTodayWellbeing } from '@/data/repositories/daily-wellbeing-repository';
import { useNotificationPrefs } from '@/data/repositories/notification-repository';
import { useJokersRemaining } from '@/data/repositories/streak-joker-repository';
import { useCurrentHour, useTodayDate } from '@/hooks/useTodayKey';

export type HomeSceneFacts = {
  moment: HomeMoment;
  streak: number;
  /** Verdict du score de forme (TRI-03), `null` tant qu'aucune composante n'est calculable. */
  verdict: ReadinessVerdict | null;
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
    checkinDone: checkin !== null,
    hoursLeft: timeLeftToday(now).hours,
    jokersRemaining,
    isLoading: streakLoading,
  };
}

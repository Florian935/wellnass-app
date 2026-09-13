/**
 * US DASH-01 — le moment de l'accueil (spec §4.1).
 *
 * L'accueil ne montre pas la même scène à 7 h 42 et à 20 h 15, ni à quelqu'un qui revient après neuf
 * jours. Cette fonction décide lequel des quatre moments s'applique ; l'écran ne fait que le rendre.
 *
 * ── Ordre de priorité ────────────────────────────────────────────────────────────────────────────
 *   1. `comeback`        — le retour prime sur tout : après une absence, rappeler une série ou
 *                          demander un check-in serait exactement la culpabilité que R8 interdit.
 *   2. `evening-at-risk` — le soir, rien fait, une série à perdre.
 *   3. `morning`         — le matin, check-in pas encore fait.
 *   4. `day`             — tout le reste.
 */

import { EVENING_FROM_HOUR } from './day-moment';

export type HomeMoment = 'morning' | 'evening-at-risk' | 'comeback' | 'day';

export type HomeMomentInput = {
  /** Heure locale de l'appareil : les seuils portent sur l'heure que voit l'utilisateur. */
  now: Date;
  activeToday: boolean;
  /** Série courante (jours actifs consécutifs, jokers compris). */
  streak: number;
  /** Jours depuis la dernière activité ; `null` si aucun historique (compte neuf). */
  daysSinceLastActivity: number | null;
  checkinDoneToday: boolean;
  /** Heure du rappel « série en danger » (0-23), si l'utilisateur l'a réglée. */
  reminderHour?: number | null;
};

/** À partir de combien de jours sans activité l'accueil parle de retour. */
export const COMEBACK_AFTER_DAYS = 7;
/**
 * Le matin s'arrête à 11 h, comme la fenêtre du petit-déjeuner (`MEAL_HOUR_WINDOWS`) : au-delà, un
 * check-in « d'énergie ce matin » n'a plus de sens. Le soir, lui, reprend `EVENING_FROM_HOUR` (18 h)
 * de `day-moment` — ou l'heure de rappel si elle est plus tardive.
 */
export const MORNING_UNTIL_HOUR = 11;

export function resolveHomeMoment(input: HomeMomentInput): HomeMoment {
  const hour = input.now.getHours();

  if (
    !input.activeToday &&
    input.daysSinceLastActivity !== null &&
    input.daysSinceLastActivity >= COMEBACK_AFTER_DAYS
  ) {
    return 'comeback';
  }

  const eveningFrom = Math.max(EVENING_FROM_HOUR, input.reminderHour ?? EVENING_FROM_HOUR);
  if (!input.activeToday && input.streak >= 1 && hour >= eveningFrom) return 'evening-at-risk';

  if (hour < MORNING_UNTIL_HOUR && !input.checkinDoneToday) return 'morning';

  return 'day';
}

/** Temps restant avant minuit, heure locale — ce qu'il reste pour garder la série. */
export function timeLeftToday(now: Date): { hours: number; minutes: number } {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const totalMinutes = Math.max(0, Math.round((midnight.getTime() - now.getTime()) / 60_000));
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/**
 * Où en est l'heure prévue d'une séance (US HORAIRE-01) par rapport à l'heure courante.
 *
 * Granularité **l'heure**, délibérément : le seul hook d'horloge autorisé côté app est réactif à
 * l'heure pile (`useCurrentHour`). Une minuterie à la minute ferait re-rendre le hub — et
 * re-souscrire ses requêtes — soixante fois par heure pour gagner une précision que personne ne
 * lit sur un compte à rebours de séance.
 */
export type SessionCountdown =
  | { kind: 'in'; hours: number }
  | { kind: 'now' }
  | { kind: 'past'; hours: number };

/** `HH:MM[:SS]` → heure (0-23), ou `null` si la chaîne n'en est pas une. */
function parseHour(scheduledTime: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(:\d{2})?$/.exec(scheduledTime.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return hour;
}

export function countdownToSession(
  nowHour: number,
  scheduledTime: string | null | undefined,
): SessionCountdown | null {
  if (!scheduledTime) return null;
  const hour = parseHour(scheduledTime);
  if (hour === null) return null;
  const diff = hour - nowHour;
  if (diff === 0) return { kind: 'now' };
  return diff > 0 ? { kind: 'in', hours: diff } : { kind: 'past', hours: -diff };
}

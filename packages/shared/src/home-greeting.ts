/**
 * US ACCUEIL-07 — **la salutation et la phrase du jour** (constat 6 du 24/10/2026).
 *
 * L'accroche de l'accueil (`home-headline.ts`, ACCUEIL-02) dérivait de la même décision que la carte
 * « maintenant »… au point de la répéter mot pour mot : « Rien de prévu aujourd'hui » deux fois de
 * suite, « Ta journée est faite » deux fois de suite. Et ses clés n'avaient pas de `{{name}}` : le
 * prénom, pourtant demandé à l'inscription, n'apparaissait jamais.
 *
 * Deux lignes désormais, comme sur la toile validée le 25/10/2026 :
 *  1. **la salutation** — « Bonjour Florian », « Bon après-midi », « Bonsoir » ; « Content de te
 *     revoir » au retour, « Bienvenue » le premier jour ;
 *  2. **la phrase du jour** — dérivée de la même décision que la carte (elles ne peuvent pas se
 *     contredire), mais qui dit **autre chose** : le contexte (kcal restantes, compte à rebours),
 *     jamais le titre de la carte. Calculée, jamais d'IA.
 *
 * Ce module ne rend que des clés i18n et des nombres : la mise en forme appartient à l'écran.
 */

import { countdownToSession } from './dashboard-moment';
import { dayMoment } from './day-moment';
import type { NowAction } from './now-action';

export type GreetingKind = 'morning' | 'afternoon' | 'evening' | 'comeback' | 'welcome';

/** La salutation : l'heure, sauf au retour d'une absence et le tout premier jour. */
export function greetingKind(input: { hour: number; comeback: boolean; firstDay: boolean }): GreetingKind {
  if (input.comeback) return 'comeback';
  if (input.firstDay) return 'welcome';
  return dayMoment(input.hour);
}

export type DaySentence = { key: string; params: Record<string, number> };

export interface DaySentenceFacts {
  /** Heure locale (décimale admise). */
  hour: number;
  /** Kcal restantes sur la cible du jour, `null` sans cible. Négatif = cible dépassée. */
  kcalRemaining: number | null;
}

/** La phrase du jour, pour une décision donnée. */
export function daySentence(action: NowAction, facts: DaySentenceFacts): DaySentence {
  const kcal = facts.kcalRemaining;
  switch (action.kind) {
    case 'workout-active':
      return { key: 'home.sentence.workoutActive', params: {} };
    case 'run-active':
      return { key: 'home.sentence.runActive', params: {} };
    case 'session-today': {
      const countdown = countdownToSession(Math.floor(facts.hour), action.training.scheduledTime);
      if (countdown === null) return { key: 'home.sentence.session', params: {} };
      if (countdown.kind === 'now') return { key: 'home.sentence.sessionNow', params: {} };
      if (countdown.kind === 'in') {
        return { key: 'home.sentence.sessionIn', params: { count: countdown.hours } };
      }
      return { key: 'home.sentence.sessionLate', params: {} };
    }
    case 'meal-due':
      if (kcal === null) return { key: 'home.sentence.mealDue', params: {} };
      return kcal > 0
        ? { key: 'home.sentence.mealDueKcal', params: { kcal: Math.round(kcal) } }
        : { key: 'home.sentence.mealDueReached', params: {} };
    case 'weigh-in-due':
      return { key: 'home.sentence.weighIn', params: {} };
    case 'meal-next':
      return kcal !== null && kcal > 0
        ? { key: 'home.sentence.mealNextKcal', params: { kcal: Math.round(kcal) } }
        : { key: 'home.sentence.mealNext', params: {} };
    case 'wellbeing-due':
      return { key: 'home.sentence.wellbeing', params: {} };
    case 'meal-missed':
      return { key: 'home.sentence.mealMissed', params: {} };
    case 'day-done':
      return action.tally.strengthSessions + action.tally.runs > 0
        ? { key: 'home.sentence.dayDoneTrained', params: {} }
        : { key: 'home.sentence.dayDone', params: {} };
    case 'idle':
    default:
      if (action.kind === 'idle' && action.suggestion === 'program') {
        return { key: 'home.sentence.idleProgram', params: {} };
      }
      if (action.kind === 'idle' && action.suggestion === 'meal') {
        return { key: 'home.sentence.idleMeal', params: {} };
      }
      return { key: 'home.sentence.idleRest', params: {} };
  }
}

/** L'heure d'un geste du jour : 12,75 → « 12:45 », 8 → « 08:00 ». Bornée à la journée. */
export function clockLabel(hour: number): string {
  const safe = Number.isFinite(hour) ? Math.min(23.99, Math.max(0, hour)) : 0;
  let h = Math.floor(safe);
  let m = Math.round((safe - h) * 60);
  if (m === 60) {
    m = 0;
    h += 1;
  }
  return `${String(Math.min(h, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

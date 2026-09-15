/**
 * US ACCUEIL-02 puis DASH-01 — **l'accroche du jour**, la phrase que l'utilisateur lit en premier.
 *
 * Extraite de `HomeHeader` le 13/09/2026 : la scène de l'accueil (`HomeStage`) a remplacé l'en-tête,
 * mais la règle, elle, n'a pas changé — l'accroche dérive de **la même décision** que la carte
 * « maintenant », de sorte que les deux ne puissent pas se contredire, et elle **ne réclame rien
 * quand il n'y a rien à réclamer** (même exigence de ton que la carte « vie réelle » de VIE-01).
 */

import type { NowAction } from '@wellness/shared';

export function headlineKey(action: NowAction): { key: string; count?: number } {
  switch (action.kind) {
    case 'workout-active':
      return { key: 'home.headline.workoutActive' };
    case 'run-active':
      return { key: 'home.headline.runActive' };
    case 'session-today':
      return { key: 'home.headline.sessionToday' };
    case 'meal-due':
      return { key: `home.headline.meal.${action.meal}` };
    case 'weigh-in-due':
      return { key: 'home.headline.weighIn' };
    case 'wellbeing-due':
      return { key: 'home.headline.wellbeing' };
    case 'day-done':
      return { key: 'home.headline.dayDone' };
    case 'idle':
    default:
      return { key: `home.headline.idle.${action.kind === 'idle' ? action.moment : 'morning'}` };
  }
}

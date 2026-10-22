/**
 * US CIBLE-01 — le jeu de la recette (spec §14.1), décrit **une fois** pour les tests d'assemblage :
 * la parité Aujourd'hui ↔ historique, le planning repas, les chiffres attendus de la recette.
 *
 * Les jours sont relatifs à `TODAY` du harnais (`day-target-sources.ts`) ; la dépense retenue par jour
 * (bas des fourchettes) est celle que les fonctions pures donnent pour le profil A : séance de 60 min,
 * 12 séries, RPE 7 → 170 ; vélo 60 min modéré, 25 km → 500 ; course 8 km en 45 min, RPE 5 → 560.
 */

import { atLocal, shiftKey, TODAY, type Sources } from './day-target-sources';

export type Mode = 'fixed' | 'auto' | 'activities';
export const MODES: readonly Mode[] = ['fixed', 'auto', 'activities'];

/** J+n à partir d'aujourd'hui (`J(-5)` = J−5). */
export const J = (n: number): string => shiftKey(TODAY, n);

/** Les jours notés du jeu, et leurs kcal. */
export const CIBLE01_MEALS: readonly { logDate: string; kcal: number }[] = [
  { logDate: J(-10), kcal: 700 },
  { logDate: J(-6), kcal: 2650 },
  { logDate: J(-5), kcal: 2650 },
  { logDate: J(-4), kcal: 2300 },
  { logDate: J(-3), kcal: 2300 },
  { logDate: J(-2), kcal: 2300 },
  { logDate: J(-1), kcal: 2650 },
  { logDate: J(0), kcal: 2620 },
];

/** Le jeu dans un mode donné (forfait 300, socle « debout », profil A). */
export function cible01Sources(mode: Mode, overrides: Partial<Sources> = {}): Sources {
  return {
    nutrition: { trainingBonusMode: mode, trainingDayBonus: 300, sportFreeLevel: 'standing' },
    workouts: [{ finishedAt: atLocal(J(-6), 19), durationSeconds: 3600, rpe: 7 }],
    activities: [{ startedAt: atLocal(J(-5), 10), durationSeconds: 3600, rpe: 6, activityType: 'bike' }],
    runs: [{ finishedAt: atLocal(J(-1), 7, 45), distanceM: 8000, durationSeconds: 2700, rpe: 5 }],
    plannedSessions: [
      { date: J(-3), status: 'skipped' },
      { date: J(-2), status: 'planned' },
      { date: J(0), status: 'planned' },
      { date: J(1), status: 'planned' },
      { date: J(2), status: 'skipped' },
      { date: J(4), status: 'planned' },
    ],
    periods: [{ startedOn: J(4), endsOn: J(5) }],
    energyByDay: { [J(-6)]: 170, [J(-5)]: 500, [J(-1)]: 560 },
    dailyKcal: [...CIBLE01_MEALS],
    ...overrides,
  };
}

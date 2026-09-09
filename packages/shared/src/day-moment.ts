/**
 * US ACCUEIL-02 — le **moment de la journée**, et le repas qui va avec.
 *
 * Deux fonctions pures, et c'est tout le point du fichier : l'accueil doit pouvoir dire « ce qui
 * attend » le matin et « ce qui reste » le soir, sans qu'aucun composant ne se mette à lire
 * l'horloge lui-même. L'heure entre **par paramètre** (règle du dépôt, voir `useTodayKey` : lire
 * l'horloge dans un corps de composant la fige dans un slot mount-only de React Compiler).
 *
 * ⚠️ **`mealForHour` corrige un défaut réel de l'accueil livré** : le widget nutrition ouvrait
 * `/food-picker` avec `meal: 'breakfast'` **en dur**, à 20 h comme à 7 h. Personne ne saisit son
 * dîner dans le petit-déjeuner : le geste était donc systématiquement à reprendre.
 */

import { MEAL_TYPES, type MealType } from './food';

// ---------------------------------------------------------------------------
// Le moment de la journée
// ---------------------------------------------------------------------------

/**
 * Les trois moments qui changent ce que l'accueil doit dire.
 *
 * Volontairement **trois** et non cinq : chaque moment doit correspondre à une formulation
 * distincte de l'accroche, et au-delà de trois on écrit des variantes que personne ne distingue.
 *  - `morning` : la journée est devant — on annonce ce qui est prévu ;
 *  - `afternoon` : elle est en cours — on annonce ce qui avance ;
 *  - `evening` : elle se termine — on annonce ce qui reste, puis ce qui a été fait.
 */
export const DAY_MOMENTS = ['morning', 'afternoon', 'evening'] as const;
export type DayMoment = (typeof DAY_MOMENTS)[number];

/** Bascule matin → après-midi (heure locale, 0-23). */
export const AFTERNOON_FROM_HOUR = 12;
/** Bascule après-midi → soir. 18 h : l'heure à partir de laquelle « il te reste » a du sens. */
export const EVENING_FROM_HOUR = 18;

/**
 * Moment de la journée pour une heure locale donnée (0-23).
 *
 * Une heure hors bornes ou non finie retombe sur `morning` — jamais d'exception : cette fonction
 * alimente l'en-tête de l'écran le plus ouvert de l'app, elle ne doit pas pouvoir le faire tomber.
 */
export function dayMoment(hour: number): DayMoment {
  if (!Number.isFinite(hour)) return 'morning';
  const h = Math.floor(hour);
  if (h >= EVENING_FROM_HOUR && h <= 23) return 'evening';
  if (h >= AFTERNOON_FROM_HOUR) return 'afternoon';
  return 'morning';
}

// ---------------------------------------------------------------------------
// Le repas de l'heure courante
// ---------------------------------------------------------------------------

/**
 * Fenêtres horaires des repas, en heures locales `[début, fin[`.
 *
 * ⚠️ Ces bornes ne sont **pas** des rappels : le produit sait déjà apprendre l'heure à laquelle
 * l'utilisateur saisit ses repas (`resolveReminderDeadline`, NUTR-F1), et c'est cette heure apprise
 * qui déclenche une notification. Ici, il ne s'agit que de **présélectionner un repas** quand
 * l'utilisateur appuie sur « + Repas » : un défaut raisonnable, immédiatement corrigeable dans
 * l'écran d'ajout. D'où des bornes fixes et lisibles plutôt qu'un second mécanisme d'apprentissage.
 *
 * `snack` n'a pas de fenêtre : c'est le repli des heures que personne ne revendique (23 h-5 h).
 */
export const MEAL_HOUR_WINDOWS: ReadonlyArray<{ meal: MealType; from: number; to: number }> = [
  { meal: 'breakfast', from: 5, to: 11 },
  { meal: 'lunch', from: 11, to: 15 },
  // 15 h-18 h appartient à la collation : c'est l'heure du goûter, pas celle du dîner.
  { meal: 'snack', from: 15, to: 18 },
  { meal: 'dinner', from: 18, to: 23 },
];

/**
 * Le repas à présélectionner pour une heure locale donnée (0-23).
 *
 * Hors de toute fenêtre (23 h → 5 h) et pour toute entrée invalide → `snack`. C'est le repli
 * volontairement neutre : à 2 h du matin, proposer « petit-déjeuner » ou « dîner » serait un pari,
 * « collation » ne l'est pas.
 */
export function mealForHour(hour: number): MealType {
  if (!Number.isFinite(hour)) return 'snack';
  const h = Math.floor(hour);
  const found = MEAL_HOUR_WINDOWS.find((w) => h >= w.from && h < w.to);
  return found?.meal ?? 'snack';
}

/**
 * Garde-fou de cohérence : toute fenêtre déclarée doit désigner un repas connu de `MEAL_TYPES`.
 * Exporté pour que le test l'exerce sur la table réelle plutôt que sur une copie.
 */
export function mealWindowsAreKnown(): boolean {
  return MEAL_HOUR_WINDOWS.every((w) => (MEAL_TYPES as readonly string[]).includes(w.meal));
}

import { describe, expect, it } from 'vitest';
import {
  AFTERNOON_FROM_HOUR,
  DAY_MOMENTS,
  EVENING_FROM_HOUR,
  MEAL_HOUR_WINDOWS,
  dayMoment,
  mealForHour,
  mealWindowsAreKnown,
} from './day-moment';
import { MEAL_TYPES } from './food';

describe('dayMoment', () => {
  it('découpe la journée en trois moments', () => {
    expect(dayMoment(7)).toBe('morning');
    expect(dayMoment(11)).toBe('morning');
    expect(dayMoment(12)).toBe('afternoon');
    expect(dayMoment(17)).toBe('afternoon');
    expect(dayMoment(18)).toBe('evening');
    expect(dayMoment(23)).toBe('evening');
  });

  it('bascule exactement sur les bornes déclarées', () => {
    // Les constantes sont exportées pour que le test porte sur elles, et non sur des littéraux
    // recopiés : déplacer une borne sans mettre le test à jour ne doit pas passer inaperçu.
    expect(dayMoment(AFTERNOON_FROM_HOUR - 1)).toBe('morning');
    expect(dayMoment(AFTERNOON_FROM_HOUR)).toBe('afternoon');
    expect(dayMoment(EVENING_FROM_HOUR - 1)).toBe('afternoon');
    expect(dayMoment(EVENING_FROM_HOUR)).toBe('evening');
  });

  it('rend un moment connu pour les 24 heures, sans trou', () => {
    for (let h = 0; h <= 23; h += 1) {
      expect(DAY_MOMENTS).toContain(dayMoment(h));
    }
  });

  it('ne lève jamais sur une entrée absurde — l’accueil ne doit pas pouvoir tomber', () => {
    expect(dayMoment(Number.NaN)).toBe('morning');
    expect(dayMoment(Number.POSITIVE_INFINITY)).toBe('morning');
    expect(dayMoment(-4)).toBe('morning');
    expect(dayMoment(99)).toBe('afternoon'); // hors bornes hautes : ni soir, ni exception
    expect(dayMoment(7.9)).toBe('morning'); // heure fractionnaire tronquée
  });
});

describe('mealForHour', () => {
  it('présélectionne le repas de l’heure courante', () => {
    expect(mealForHour(7)).toBe('breakfast');
    expect(mealForHour(10)).toBe('breakfast');
    expect(mealForHour(12)).toBe('lunch');
    expect(mealForHour(14)).toBe('lunch');
    expect(mealForHour(16)).toBe('snack');
    expect(mealForHour(20)).toBe('dinner');
    expect(mealForHour(22)).toBe('dinner');
  });

  it('corrige le défaut qui a motivé la fonction : 20 h n’est pas le petit-déjeuner', () => {
    // Le widget nutrition de l'accueil ouvrait `/food-picker` avec `meal: 'breakfast'` EN DUR,
    // quelle que soit l'heure. C'est le geste que cette fonction rend juste.
    expect(mealForHour(20)).not.toBe('breakfast');
    expect(mealForHour(13)).not.toBe('breakfast');
  });

  it('retombe sur la collation aux heures que personne ne revendique', () => {
    // 23 h → 5 h : proposer « dîner » ou « petit-déjeuner » serait un pari ; « collation » non.
    expect(mealForHour(23)).toBe('snack');
    expect(mealForHour(2)).toBe('snack');
    expect(mealForHour(4)).toBe('snack');
    expect(mealForHour(Number.NaN)).toBe('snack');
  });

  it('rend un repas connu pour les 24 heures', () => {
    for (let h = 0; h <= 23; h += 1) {
      expect(MEAL_TYPES as readonly string[]).toContain(mealForHour(h));
    }
  });

  it('ne déclare que des repas existants, et des fenêtres qui ne se chevauchent pas', () => {
    expect(mealWindowsAreKnown()).toBe(true);
    const sorted = [...MEAL_HOUR_WINDOWS].sort((a, b) => a.from - b.from);
    for (let i = 1; i < sorted.length; i += 1) {
      // Une fenêtre qui empiète sur la suivante rendrait `mealForHour` dépendante de l'ordre de
      // déclaration de la table — donc de rien.
      expect(sorted[i]!.from).toBeGreaterThanOrEqual(sorted[i - 1]!.to);
    }
    for (const w of MEAL_HOUR_WINDOWS) expect(w.to).toBeGreaterThan(w.from);
  });
});

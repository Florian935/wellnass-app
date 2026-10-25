import { describe, expect, it } from 'vitest';
import { localDayKey } from './date';
import {
  DEFAULT_MEAL_HOURS,
  MEAL_DUE_WINDOW_HOURS,
  MEAL_LEARNING_MIN_DAYS,
  dueMeal,
  learnMealHours,
  mealsComplete,
  missedMeal,
  nextMeal,
  quarterHour,
  resolveMealSlots,
  type MealSample,
  type MealSlot,
} from './meal-slots';
import { DEFAULT_MEAL_CONFIG, type MealConfigItem } from './nutrition';

/** Horodatage ISO UTC construit depuis une heure LOCALE — indépendant du fuseau de la machine. */
function localIso(d: number, hour: number, minute = 0): string {
  return new Date(2026, 9, d, hour, minute, 0, 0).toISOString();
}
const key = (d: number) => localDayKey(new Date(2026, 9, d));
const TODAY = key(25);

/** Une saisie du repas `mealKey`, faite le jour qu'elle décrit. */
function entry(mealKey: string, d: number, hour: number, minute = 0): MealSample {
  return { mealKey, logDate: key(d), createdAt: localIso(d, hour, minute) };
}

/** `n` jours (du 10 au 10+n-1) où le repas est noté à la même heure. */
function days(mealKey: string, n: number, hour: number, minute = 0, from = 10): MealSample[] {
  return Array.from({ length: n }, (_, i) => entry(mealKey, from + i, hour, minute));
}

function slot(over: Partial<MealSlot>): MealSlot {
  return { key: 'lunch', label: null, hour: 12.5, learned: true, logged: false, ...over };
}

describe('quarterHour', () => {
  it('arrondit au quart d’heure le plus proche', () => {
    expect(quarterHour(8.1)).toBe(8);
    expect(quarterHour(8.13)).toBe(8.25);
    expect(quarterHour(12.6)).toBe(12.5);
    expect(quarterHour(19.9)).toBe(20);
  });
});

describe('learnMealHours', () => {
  it('apprend l’heure médiane de chaque repas, en heure locale', () => {
    const learned = learnMealHours([
      ...days('breakfast', 3, 7, 30),
      entry('breakfast', 13, 8, 30),
      entry('breakfast', 14, 9, 0),
    ]);
    // Médiane de 7:30, 7:30, 7:30, 8:30, 9:00 = 7:30.
    expect(learned.get('breakfast')).toEqual({ hour: 7.5, days: 5 });
  });

  it('ne garde que la PREMIÈRE saisie du repas dans la journée', () => {
    // Un déjeuner saisi en deux fois (12 h 30 puis 13 h 15) n'est qu'un déjeuner, à 12 h 30.
    const learned = learnMealHours([entry('lunch', 10, 13, 15), entry('lunch', 10, 12, 30)]);
    expect(learned.get('lunch')).toEqual({ hour: 12.5, days: 1 });
  });

  it('🔴 ignore une saisie rétroactive — elle n’apprend rien sur l’heure du repas', () => {
    const retro: MealSample = { mealKey: 'dinner', logDate: key(10), createdAt: localIso(11, 8) };
    expect(learnMealHours([retro]).has('dinner')).toBe(false);
  });

  it('ignore un horodatage illisible sans lever', () => {
    expect(learnMealHours([{ mealKey: 'lunch', logDate: key(10), createdAt: 'n/a' }]).size).toBe(0);
  });
});

describe('resolveMealSlots — les repas du jour', () => {
  const base = { todayKey: TODAY, meals: DEFAULT_MEAL_CONFIG, loggedToday: new Set<string>() };

  it('débutant (moins de 5 jours saisis) : les trois repas par défaut, sans la collation', () => {
    const slots = resolveMealSlots({ ...base, samples: days('lunch', 2, 12) });
    expect(slots.map((s) => [s.key, s.hour, s.learned])).toEqual([
      ['breakfast', DEFAULT_MEAL_HOURS.breakfast, false],
      ['lunch', DEFAULT_MEAL_HOURS.lunch, false],
      ['dinner', DEFAULT_MEAL_HOURS.dinner, false],
    ]);
  });

  it('habitué : seuls les repas notés plus d’un jour sur deux, à leur heure apprise', () => {
    const samples = [
      ...days('breakfast', 10, 7, 45),
      ...days('lunch', 10, 12, 50),
      ...days('dinner', 10, 20, 10),
      // Collation notée 3 jours sur 10 : ce n'est pas une habitude, on ne la réclame pas.
      ...days('snack', 3, 16),
    ];
    const slots = resolveMealSlots({ ...base, samples });
    expect(slots.map((s) => [s.key, s.hour, s.learned])).toEqual([
      ['breakfast', 7.75, true],
      ['lunch', 12.75, true],
      ['dinner', 20.25, true],
    ]);
  });

  it('🔴 un repas sauté une fois sur deux n’est pas réclamé (quelqu’un qui ne déjeune pas le matin)', () => {
    const samples = [...days('lunch', 10, 12), ...days('dinner', 10, 20), ...days('breakfast', 4, 8)];
    const slots = resolveMealSlots({ ...base, samples });
    expect(slots.map((s) => s.key)).toEqual(['lunch', 'dinner']);
  });

  it('aucun repas n’atteint l’habitude malgré l’historique : repli sur les repas par défaut', () => {
    // Six jours saisis, mais jamais le même repas plus de deux fois.
    const samples = [
      ...days('breakfast', 2, 8, 0, 10),
      ...days('lunch', 2, 12, 0, 12),
      ...days('dinner', 2, 20, 0, 14),
    ];
    expect(resolveMealSlots({ ...base, samples }).every((s) => !s.learned)).toBe(true);
  });

  it('n’apprend pas d’aujourd’hui : l’heure ne bouge pas pendant qu’on saisit', () => {
    const samples = [...days('lunch', 6, 12), entry('lunch', 25, 15)];
    const slots = resolveMealSlots({ ...base, samples, loggedToday: new Set(['lunch']) });
    expect(slots.find((s) => s.key === 'lunch')?.hour).toBe(12);
  });

  it('marque les repas déjà notés aujourd’hui', () => {
    const slots = resolveMealSlots({ ...base, samples: [], loggedToday: new Set(['breakfast']) });
    expect(slots.find((s) => s.key === 'breakfast')?.logged).toBe(true);
    expect(slots.find((s) => s.key === 'lunch')?.logged).toBe(false);
  });

  it('un repas noté aujourd’hui hors habitude apparaît, déjà fait (la collation du jour)', () => {
    const slots = resolveMealSlots({ ...base, samples: [], loggedToday: new Set(['snack']) });
    const snack = slots.find((s) => s.key === 'snack');
    expect(snack).toMatchObject({ logged: true, learned: false });
    // Rangée entre le déjeuner et le dîner : c'est l'heure d'une collation.
    expect(slots.map((s) => s.key)).toEqual(['breakfast', 'lunch', 'snack', 'dinner']);
  });

  it('repas personnalisés : la clé et le libellé de la configuration, jamais une clé inventée', () => {
    const meals: MealConfigItem[] = [
      { key: 'breakfast', label: null },
      { key: 'meal-2', label: 'Brunch' },
      { key: 'dinner', label: 'Souper' },
    ];
    const samples = [...days('meal-2', 8, 11, 30), ...days('dinner', 8, 19)];
    const slots = resolveMealSlots({ ...base, meals, samples });
    expect(slots.map((s) => [s.key, s.label, s.hour])).toEqual([
      ['meal-2', 'Brunch', 11.5],
      ['dinner', 'Souper', 19],
    ]);
  });

  it('ignore une clé absente de la configuration (repas supprimé depuis)', () => {
    const samples = [...days('lunch', 8, 12), ...days('old-meal', 8, 10)];
    expect(resolveMealSlots({ ...base, samples }).map((s) => s.key)).toEqual(['lunch']);
  });

  it('seuil d’apprentissage = 5 jours saisis', () => {
    expect(MEAL_LEARNING_MIN_DAYS).toBe(5);
    const four = resolveMealSlots({ ...base, samples: days('lunch', 4, 13) });
    expect(four.every((s) => !s.learned)).toBe(true);
    const five = resolveMealSlots({ ...base, samples: days('lunch', 5, 13) });
    expect(five).toEqual([slot({ key: 'lunch', hour: 13, learned: true })]);
  });
});

describe('le repas du moment', () => {
  const slots: MealSlot[] = [
    slot({ key: 'breakfast', hour: 8 }),
    slot({ key: 'lunch', hour: 12.5 }),
    slot({ key: 'dinner', hour: 19.5 }),
  ];

  it('dû = heure passée, pas noté, et dans la fenêtre de 3 h', () => {
    expect(MEAL_DUE_WINDOW_HOURS).toBe(3);
    expect(dueMeal(slots, 7)).toBeNull();
    expect(dueMeal(slots, 8)?.key).toBe('breakfast');
    expect(dueMeal(slots, 10.9)?.key).toBe('breakfast');
    expect(dueMeal(slots, 11)).toBeNull();
  });

  it('🔴 un repas noté n’éteint plus les suivants (le défaut « un repas = journée faite »)', () => {
    const breakfastDone = slots.map((s) => (s.key === 'breakfast' ? { ...s, logged: true } : s));
    expect(dueMeal(breakfastDone, 9)).toBeNull();
    expect(dueMeal(breakfastDone, 13)?.key).toBe('lunch');
    expect(dueMeal(breakfastDone, 20)?.key).toBe('dinner');
  });

  it('deux repas dus à la fois : le plus récent — on ne réclame pas un petit-déj à midi', () => {
    const early: MealSlot[] = [slot({ key: 'breakfast', hour: 10 }), slot({ key: 'lunch', hour: 12 })];
    expect(dueMeal(early, 12.5)?.key).toBe('lunch');
  });

  it('prochain = le premier repas pas encore arrivé', () => {
    expect(nextMeal(slots, 9)?.key).toBe('lunch');
    expect(nextMeal(slots, 20)).toBeNull();
  });

  it('manqué = fenêtre passée sans saisie, le plus ancien d’abord', () => {
    expect(missedMeal(slots, 10)).toBeNull();
    expect(missedMeal(slots, 15.5)?.key).toBe('breakfast');
  });

  it('journée complète côté assiette = chaque repas noté', () => {
    expect(mealsComplete(slots)).toBe(false);
    expect(mealsComplete(slots.map((s) => ({ ...s, logged: true })))).toBe(true);
    expect(mealsComplete([])).toBe(true);
  });
});

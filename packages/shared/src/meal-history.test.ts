import { describe, expect, it } from 'vitest';
import {
  foodIdentity,
  groupMealOccurrences,
  habitualMeals,
  mealSignature,
  normalizeFoodName,
  recentDistinctMeals,
  summarizeDayFoods,
  type MealHistoryRow,
} from './meal-history';

let seq = 0;
const row = (
  logDate: string,
  mealType: string,
  name: string,
  opts: Partial<MealHistoryRow> = {},
): MealHistoryRow => ({
  logDate,
  mealType,
  foodId: `f-${name}`,
  name,
  kcal: 100,
  orderIndex: seq++,
  ...opts,
});

/** Un petit-déjeuner type : skyr, flocons, banane. */
const skyr = (day: string, opts: Partial<MealHistoryRow> = {}) => [
  row(day, 'breakfast', 'Skyr', opts),
  row(day, 'breakfast', 'Flocons', opts),
  row(day, 'breakfast', 'Banane', opts),
];

describe('identité d’un aliment — NUTRI-UX03 R3', () => {
  it('normalise un nom : casse, accents, espaces', () => {
    expect(normalizeFoodName('  Crème   Fraîche ')).toBe('creme fraiche');
  });

  it('un aliment de la base se reconnaît à son id, un texte libre à son nom', () => {
    expect(foodIdentity({ foodId: 'f-1', name: 'Banane' })).toBe('id:f-1');
    expect(foodIdentity({ foodId: null, name: 'Crème brûlée' })).toBe('nom:creme brulee');
  });

  it('🔴 même ensemble d’aliments dans un autre ordre = même repas', () => {
    const a = [row('d', 'b', 'Skyr'), row('d', 'b', 'Banane')];
    const b = [row('d', 'b', 'Banane'), row('d', 'b', 'Skyr')];
    expect(mealSignature(a)).toBe(mealSignature(b));
  });

  it('🔴 les quantités ne comptent pas', () => {
    const a = [row('d', 'b', 'Skyr', { kcal: 95 })];
    const b = [row('d', 'b', 'Skyr', { kcal: 190 })];
    expect(mealSignature(a)).toBe(mealSignature(b));
  });

  it('un aliment de plus fait un autre repas', () => {
    expect(mealSignature(skyr('d'))).not.toBe(mealSignature(skyr('d').slice(0, 2)));
  });

  it('un doublon dans le même repas ne change pas l’ensemble', () => {
    const a = [row('d', 'b', 'Café'), row('d', 'b', 'Café')];
    expect(mealSignature(a)).toBe(mealSignature([row('d', 'b', 'Café')]));
  });

  it('le texte libre est comparé sans accents ni casse', () => {
    const a = [row('d', 'b', 'Crème', { foodId: null })];
    const b = [row('d', 'b', 'creme', { foodId: null })];
    expect(mealSignature(a)).toBe(mealSignature(b));
  });
});

describe('groupMealOccurrences', () => {
  it('regroupe par jour et par repas, du plus récent au plus ancien', () => {
    const occ = groupMealOccurrences([
      ...skyr('2026-09-22'),
      row('2026-09-24', 'lunch', 'Poulet'),
      ...skyr('2026-09-24'),
    ]);
    expect(occ.map((o) => o.dayKey)).toEqual(['2026-09-24', '2026-09-24', '2026-09-22']);
    expect(
      occ
        .filter((o) => o.dayKey === '2026-09-24')
        .map((o) => o.mealKey)
        .sort(),
    ).toEqual(['breakfast', 'lunch']);
  });

  it('garde l’ordre des entrées dans le repas et totalise les calories', () => {
    const [first] = groupMealOccurrences([
      row('d', 'lunch', 'Riz', { orderIndex: 2, kcal: 260 }),
      row('d', 'lunch', 'Poulet', { orderIndex: 1, kcal: 240 }),
    ]);
    expect(first!.items.map((i) => i.name)).toEqual(['Poulet', 'Riz']);
    expect(first!.kcal).toBe(500);
  });
});

describe('recentDistinctMeals — R3', () => {
  const occ = groupMealOccurrences([
    ...skyr('2026-09-24'),
    row('2026-09-23', 'breakfast', 'Tartines'),
    ...skyr('2026-09-22'),
    row('2026-09-21', 'breakfast', 'Omelette'),
    row('2026-09-20', 'breakfast', 'Porridge'),
    row('2026-09-24', 'lunch', 'Poulet'),
  ]);

  it('les trois plus récents DIFFÉRENTS, du plus récent au plus ancien', () => {
    const recent = recentDistinctMeals(occ, 'breakfast', { limit: 3 });
    expect(recent.map((r) => r.occurrence.dayKey)).toEqual(['2026-09-24', '2026-09-23', '2026-09-21']);
  });

  it('chaque ligne compte ses occurrences dans la fenêtre', () => {
    const recent = recentDistinctMeals(occ, 'breakfast', { limit: 3 });
    expect(recent.map((r) => r.count)).toEqual([2, 1, 1]);
  });

  it('ne mélange pas les repas', () => {
    expect(recentDistinctMeals(occ, 'lunch').map((r) => r.occurrence.items[0]!.name)).toEqual(['Poulet']);
    expect(recentDistinctMeals(occ, 'dinner')).toEqual([]);
  });

  it('trois par défaut', () => {
    expect(recentDistinctMeals(occ, 'breakfast')).toHaveLength(3);
  });
});

describe('habitualMeals — R9', () => {
  const occ = groupMealOccurrences([
    ...skyr('2026-09-24'),
    ...skyr('2026-09-22'),
    ...skyr('2026-09-20'),
    row('2026-09-23', 'breakfast', 'Tartines'),
    row('2026-09-19', 'breakfast', 'Tartines'),
    row('2026-09-21', 'breakfast', 'Omelette'),
  ]);

  it('🔴 un repas noté UNE seule fois n’est pas habituel', () => {
    const habits = habitualMeals(occ, 'breakfast');
    expect(habits.map((h) => h.last.items[0]!.name)).not.toContain('Omelette');
  });

  it('trié par nombre d’occurrences, puis par dernière date', () => {
    const habits = habitualMeals(occ, 'breakfast');
    expect(habits.map((h) => [h.last.items[0]!.name, h.count])).toEqual([
      ['Skyr', 3],
      ['Tartines', 2],
    ]);
  });

  it('la dernière occurrence porte les quantités à reprendre', () => {
    const [first] = habitualMeals(occ, 'breakfast');
    expect(first!.last.dayKey).toBe('2026-09-24');
  });

  it('à nombre égal, le plus récent d’abord', () => {
    const tie = groupMealOccurrences([
      row('2026-09-10', 'lunch', 'A'),
      row('2026-09-11', 'lunch', 'A'),
      row('2026-09-12', 'lunch', 'B'),
      row('2026-09-13', 'lunch', 'B'),
    ]);
    expect(habitualMeals(tie, 'lunch').map((h) => h.last.items[0]!.name)).toEqual(['B', 'A']);
  });

  it('borné par la limite', () => {
    expect(habitualMeals(occ, 'breakfast', { limit: 1 })).toHaveLength(1);
  });
});

describe('summarizeDayFoods — R8', () => {
  it('deux aliments par repas, dans l’ordre des repas configurés', () => {
    const parts = summarizeDayFoods(
      [
        row('d', 'dinner', 'Saumon'),
        row('d', 'breakfast', 'Skyr'),
        row('d', 'breakfast', 'Flocons'),
        row('d', 'breakfast', 'Banane'),
      ],
      ['breakfast', 'lunch', 'dinner'],
    );
    expect(parts).toEqual(['Skyr, Flocons', 'Saumon']);
  });

  it('un repas inconnu de la configuration passe en dernier', () => {
    const parts = summarizeDayFoods(
      [row('d', 'custom-1', 'Barre'), row('d', 'lunch', 'Poulet')],
      ['breakfast', 'lunch'],
    );
    expect(parts).toEqual(['Poulet', 'Barre']);
  });

  it('journée vide : rien', () => {
    expect(summarizeDayFoods([], ['breakfast'])).toEqual([]);
  });
});

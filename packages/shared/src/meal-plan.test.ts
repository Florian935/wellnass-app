import { describe, expect, it } from 'vitest';
import {
  dayTargetKcal,
  groupEntriesByMeal,
  portionFactor,
  sumPlannedDay,
  weekDayKeys,
  type PlannedMealEntry,
} from './meal-plan';
import { OTHER_MEAL_KEY } from './nutrition';

/** Entrée de planning minimale — seuls les champs utiles au test sont surchargés. */
function entry(over: Partial<PlannedMealEntry> = {}): PlannedMealEntry {
  return {
    id: 'e1',
    planDate: '2026-08-04',
    mealKey: 'lunch',
    orderIndex: 0,
    sourceType: 'recipe',
    recipeId: 'r1',
    templateId: null,
    servings: 1,
    label: 'Poulet riz',
    kcal: 500,
    proteinG: 40,
    carbsG: 55,
    fatG: 12,
    consumedAt: null,
    ...over,
  };
}

describe('portionFactor (R8)', () => {
  it('divise par le nombre de portions de la recette', () => {
    // 2 portions demandées sur une recette qui en produit 4 → la moitié des ingrédients.
    expect(portionFactor('recipe', 2, 4)).toBe(0.5);
  });

  it('rend 1 quand on planifie exactement le rendement de la recette', () => {
    expect(portionFactor('recipe', 4, 4)).toBe(1);
  });

  it('peut dépasser 1 (on cuisine plus que le rendement)', () => {
    expect(portionFactor('recipe', 8, 4)).toBe(2);
  });

  it('accepte une demi-portion', () => {
    expect(portionFactor('recipe', 1.5, 3)).toBe(0.5);
  });

  it('se garde de la division par zéro et des rendements absurdes', () => {
    // Une recette à 0 ou négative n'existe pas (CHECK servings >= 1), mais une donnée
    // corrompue ne doit pas produire Infinity ni NaN dans une liste de courses.
    expect(portionFactor('recipe', 2, 0)).toBe(2);
    expect(portionFactor('recipe', 2, -3)).toBe(2);
    expect(portionFactor('recipe', 2, null)).toBe(2);
  });

  it('ignore le rendement pour un repas type : le facteur est le multiplicateur brut', () => {
    // Un repas type n'a pas de notion de portions — il s'ajoute tel quel.
    expect(portionFactor('template', 1, 4)).toBe(1);
    expect(portionFactor('template', 2, null)).toBe(2);
  });
});

describe('sumPlannedDay', () => {
  it('somme les snapshots des entrées du jour', () => {
    const totals = sumPlannedDay([
      entry({ kcal: 420, proteinG: 12, carbsG: 60, fatG: 9 }),
      entry({ kcal: 760, proteinG: 55, carbsG: 80, fatG: 18 }),
    ]);
    expect(totals).toEqual({ kcal: 1180, proteinG: 67, carbsG: 140, fatG: 27 });
  });

  it('rend des zéros sur une journée vide', () => {
    expect(sumPlannedDay([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it('arrondit les kcal et garde une décimale sur les macros', () => {
    const totals = sumPlannedDay([entry({ kcal: 100, proteinG: 10.04, carbsG: 0, fatG: 0 })]);
    expect(totals.kcal).toBe(100);
    expect(totals.proteinG).toBe(10);
  });
});

describe('dayTargetKcal (R5)', () => {
  it('rend null sans profil nutritionnel — jamais 0', () => {
    // Afficher « / 0 kcal » ferait croire à un objectif atteint en permanence.
    expect(
      dayTargetKcal({
        targetKcal: null,
        trainingBonusKcal: 300,
        hasTrainingSession: true,
        trainingPillarsActive: true,
      }),
    ).toBeNull();
  });

  it('rend la cible nue un jour sans séance', () => {
    expect(
      dayTargetKcal({
        targetKcal: 2350,
        trainingBonusKcal: 300,
        hasTrainingSession: false,
        trainingPillarsActive: true,
      }),
    ).toBe(2350);
  });

  it('ajoute le bonus un jour de séance', () => {
    expect(
      dayTargetKcal({
        targetKcal: 2350,
        trainingBonusKcal: 300,
        hasTrainingSession: true,
        trainingPillarsActive: true,
      }),
    ).toBe(2650);
  });

  it("n'ajoute aucun bonus si les piliers d'entraînement sont inactifs (décision H)", () => {
    // Intégration opt-in : sans muscu ni course activée, le planning repas ne parle pas
    // d'entraînement du tout.
    expect(
      dayTargetKcal({
        targetKcal: 2350,
        trainingBonusKcal: 300,
        hasTrainingSession: true,
        trainingPillarsActive: false,
      }),
    ).toBe(2350);
  });

  it('ignore un bonus négatif', () => {
    expect(
      dayTargetKcal({
        targetKcal: 2350,
        trainingBonusKcal: -500,
        hasTrainingSession: true,
        trainingPillarsActive: true,
      }),
    ).toBe(2350);
  });
});

describe('groupEntriesByMeal (R4, R10)', () => {
  const config = [
    { key: 'breakfast', label: null },
    { key: 'lunch', label: null },
    { key: 'dinner', label: null },
  ];

  it('respecte l’ordre de la config, repas vides compris', () => {
    const groups = groupEntriesByMeal([entry({ mealKey: 'dinner' })], config);
    expect(groups.map((g) => g.key)).toEqual(['breakfast', 'lunch', 'dinner']);
    expect(groups[1]!.entries).toHaveLength(0);
    expect(groups[2]!.entries).toHaveLength(1);
  });

  it('trie les entrées d’un même repas par order_index', () => {
    const groups = groupEntriesByMeal(
      [
        entry({ id: 'b', mealKey: 'lunch', orderIndex: 2 }),
        entry({ id: 'a', mealKey: 'lunch', orderIndex: 1 }),
      ],
      config,
    );
    expect(groups[1]!.entries.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('range une clé inconnue dans le bucket « Autre » plutôt que de la perdre (R10)', () => {
    // Cas réel : l'utilisateur supprime « Collation » de ses réglages après avoir planifié.
    const groups = groupEntriesByMeal([entry({ mealKey: 'snack' })], config);
    const other = groups.find((g) => g.key === OTHER_MEAL_KEY);
    expect(other?.entries).toHaveLength(1);
    expect(groups.at(-1)!.key).toBe(OTHER_MEAL_KEY);
  });

  it("n'ajoute pas de bucket « Autre » quand tout est reconnu", () => {
    const groups = groupEntriesByMeal([entry({ mealKey: 'lunch' })], config);
    expect(groups.some((g) => g.key === OTHER_MEAL_KEY)).toBe(false);
  });

  it('verse les orphelines dans le repas « other » de la config plutôt que d’en créer un second', () => {
    // Config qui contient déjà un repas nommé `other`, ET une entrée dont le repas a disparu :
    // les deux doivent se retrouver dans le même bucket.
    const groups = groupEntriesByMeal(
      [entry({ id: 'orphan', mealKey: 'snack' }), entry({ id: 'legit', mealKey: OTHER_MEAL_KEY })],
      [
        { key: 'lunch', label: null },
        { key: OTHER_MEAL_KEY, label: 'Extra' },
      ],
    );
    expect(groups.filter((g) => g.key === OTHER_MEAL_KEY)).toHaveLength(1);
    expect(groups.find((g) => g.key === OTHER_MEAL_KEY)!.entries.map((e) => e.id)).toEqual([
      'legit',
      'orphan',
    ]);
  });

  it('conserve un repas nommé « other » dans la config sans le dupliquer', () => {
    const groups = groupEntriesByMeal([entry({ mealKey: OTHER_MEAL_KEY })], [
      { key: 'lunch', label: null },
      { key: OTHER_MEAL_KEY, label: 'Extra' },
    ]);
    expect(groups.filter((g) => g.key === OTHER_MEAL_KEY)).toHaveLength(1);
    expect(groups.find((g) => g.key === OTHER_MEAL_KEY)!.entries).toHaveLength(1);
  });
});

describe('weekDayKeys', () => {
  it('rend 7 clés consécutives à partir du lundi', () => {
    expect(weekDayKeys('2026-08-03')).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
      '2026-08-09',
    ]);
  });

  it('franchit un changement de mois sans décalage', () => {
    expect(weekDayKeys('2026-08-31')).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ]);
  });

  it('franchit un 29 février', () => {
    // 2028 est bissextile : la semaine du 28/02 doit contenir le 29.
    expect(weekDayKeys('2028-02-28')).toContain('2028-02-29');
  });

  it('franchit un changement d’année', () => {
    expect(weekDayKeys('2026-12-28').at(-1)).toBe('2027-01-03');
  });
});

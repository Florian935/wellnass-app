import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_LEVELS,
  DIET_RESTRICTIONS,
  NUTRITION_OBJECTIVES,
  activityFactor,
  activityLevelFromRunningFrequency,
  activityLevelSchema,
  basalMetabolicRate,
  caloriesFromMacros,
  computeEffectiveTargetForDay,
  computeGoalAdherence,
  computeJournalCompletion,
  dayCalorieBonus,
  defaultMacroRatios,
  macroGramsFromCalories,
  macroRatiosFromGrams,
  nutritionObjectiveSchema,
  nutritionProfileRowSchema,
  objectiveCalorieDelta,
  objectiveFromGoal,
  OTHER_MEAL_KEY,
  resolveMealConfig,
  resolveMealSplit,
  suggestActivityLevel,
  targetCalories,
  tdee,
  trainingDayCalories,
} from './nutrition';

describe('enums', () => {
  it('expose les objectifs, niveaux et restrictions attendus', () => {
    expect(NUTRITION_OBJECTIVES).toEqual(['bulk', 'cut', 'maintain', 'weightloss']);
    expect(ACTIVITY_LEVELS).toEqual(['sedentary', 'light', 'moderate', 'active', 'very_active']);
    expect(DIET_RESTRICTIONS).toContain('vegan');
  });

  it('rejette les valeurs inconnues', () => {
    expect(nutritionObjectiveSchema.safeParse('recomp').success).toBe(false);
    expect(activityLevelSchema.safeParse('lazy').success).toBe(false);
  });
});

describe('objectiveFromGoal', () => {
  it('dérive l’objectif nutritionnel de l’objectif d’entraînement', () => {
    expect(objectiveFromGoal('muscle')).toBe('bulk');
    expect(objectiveFromGoal('weightloss')).toBe('weightloss');
    expect(objectiveFromGoal('performance')).toBe('maintain');
    expect(objectiveFromGoal('health')).toBe('maintain');
    expect(objectiveFromGoal(null)).toBe('maintain');
  });
});

describe('objectiveCalorieDelta', () => {
  it('applique les deltas de chaque objectif', () => {
    expect(objectiveCalorieDelta('bulk')).toBe(300);
    expect(objectiveCalorieDelta('cut')).toBe(-400);
    expect(objectiveCalorieDelta('weightloss')).toBe(-250);
    expect(objectiveCalorieDelta('maintain')).toBe(0);
  });
});

describe('activityFactor', () => {
  it('mappe chaque niveau à son multiplicateur', () => {
    expect(activityFactor('sedentary')).toBe(1.2);
    expect(activityFactor('light')).toBe(1.375);
    expect(activityFactor('moderate')).toBe(1.55);
    expect(activityFactor('active')).toBe(1.725);
    expect(activityFactor('very_active')).toBe(1.9);
  });
});

describe('activityLevelFromRunningFrequency (US RN-03, spec R2)', () => {
  it('0 jour sur 14 → sedentary', () => {
    expect(activityLevelFromRunningFrequency(0)).toBe('sedentary');
  });

  it('3 jours sur 14 (1,5 j/sem) → light', () => {
    expect(activityLevelFromRunningFrequency(3)).toBe('light');
  });

  it('4 jours sur 14 (2 j/sem pile) → light (borne haute incluse)', () => {
    expect(activityLevelFromRunningFrequency(4)).toBe('light');
  });

  it('7 jours sur 14 (3,5 j/sem) → moderate', () => {
    expect(activityLevelFromRunningFrequency(7)).toBe('moderate');
  });

  it('10 jours sur 14 (5 j/sem pile) → moderate (borne haute incluse)', () => {
    expect(activityLevelFromRunningFrequency(10)).toBe('moderate');
  });

  it('11 jours sur 14 (5,5 j/sem) → active', () => {
    expect(activityLevelFromRunningFrequency(11)).toBe('active');
  });

  it('14 jours sur 14 (7 j/sem, tous les jours) → active, jamais very_active (spec D4)', () => {
    expect(activityLevelFromRunningFrequency(14)).toBe('active');
  });
});

describe('suggestActivityLevel (US RN-03, spec R3/R4)', () => {
  it('palier suggéré identique au palier déclaré → null (rien à afficher)', () => {
    expect(
      suggestActivityLevel({ currentLevel: 'sedentary', runningDaysInWindow: 0 }),
    ).toBeNull();
    expect(
      suggestActivityLevel({ currentLevel: 'moderate', runningDaysInWindow: 7 }),
    ).toBeNull();
  });

  it('suggestion à la hausse quand la fréquence réelle dépasse le palier déclaré', () => {
    expect(
      suggestActivityLevel({ currentLevel: 'sedentary', runningDaysInWindow: 12 }),
    ).toBe('active');
  });

  it('suggestion à la baisse quand la fréquence réelle est sous le palier déclaré (spec D2, bidirectionnel)', () => {
    expect(
      suggestActivityLevel({ currentLevel: 'active', runningDaysInWindow: 0 }),
    ).toBe('sedentary');
  });
});

describe('basalMetabolicRate (Mifflin-St Jeor)', () => {
  it('calcule le BMR homme', () => {
    expect(basalMetabolicRate({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 })).toBe(1780);
  });

  it('calcule le BMR femme', () => {
    expect(basalMetabolicRate({ sex: 'female', weightKg: 60, heightCm: 165, age: 30 })).toBe(
      1320.25,
    );
  });

  it('utilise la moyenne des deux formules si sexe non précisé', () => {
    const input = { weightKg: 80, heightCm: 180, age: 30 } as const;
    const male = basalMetabolicRate({ ...input, sex: 'male' });
    const female = basalMetabolicRate({ ...input, sex: 'female' });
    expect(basalMetabolicRate({ ...input, sex: 'unspecified' })).toBe((male + female) / 2);
  });
});

describe('tdee', () => {
  it('multiplie le BMR par le facteur d’activité (arrondi)', () => {
    expect(
      tdee({ sex: 'male', weightKg: 80, heightCm: 180, age: 30, activityLevel: 'moderate' }),
    ).toBe(2759);
  });

  it.each([
    ['poids manquant', { heightCm: 180, age: 30 }],
    ['taille manquante', { weightKg: 80, age: 30 }],
    ['âge manquant', { weightKg: 80, heightCm: 180 }],
    ['poids nul', { weightKg: 0, heightCm: 180, age: 30 }],
    ['valeur négative', { weightKg: -5, heightCm: 180, age: 30 }],
  ])('renvoie null quand %s', (_label, partial) => {
    expect(tdee({ ...partial, activityLevel: 'moderate' })).toBeNull();
  });
});

describe('targetCalories', () => {
  it('applique le delta de l’objectif au TDEE', () => {
    expect(targetCalories(2500, 'bulk')).toBe(2800);
    expect(targetCalories(2500, 'cut')).toBe(2100);
    expect(targetCalories(2500, 'maintain')).toBe(2500);
  });

  it('laisse primer la surcharge manuelle', () => {
    expect(targetCalories(2500, 'cut', 3000)).toBe(3000);
  });

  it('ignore une surcharge nulle ou négative', () => {
    expect(targetCalories(2500, 'maintain', 0)).toBe(2500);
    expect(targetCalories(2500, 'maintain', -100)).toBe(2500);
  });

  it('ne descend jamais sous zéro', () => {
    expect(targetCalories(100, 'cut')).toBe(0);
  });
});

describe('trainingDayCalories', () => {
  it('ajoute le bonus les jours de séance', () => {
    expect(trainingDayCalories(2500, 200)).toBe(2700);
  });

  it('ignore un bonus négatif', () => {
    expect(trainingDayCalories(2500, -50)).toBe(2500);
  });
});

describe('dayCalorieBonus', () => {
  it('fixed : forfait les jours de séance, 0 sinon', () => {
    expect(dayCalorieBonus({ mode: 'fixed', isTrainingDay: true, fixedBonus: 300, runCaloriesToday: 999 })).toBe(300);
    expect(dayCalorieBonus({ mode: 'fixed', isTrainingDay: false, fixedBonus: 300, runCaloriesToday: 999 })).toBe(0);
    expect(dayCalorieBonus({ mode: 'fixed', isTrainingDay: true, fixedBonus: 0, runCaloriesToday: 999 })).toBe(0);
  });
  it('auto : dépense course si course terminée', () => {
    expect(dayCalorieBonus({ mode: 'auto', isTrainingDay: true, fixedBonus: 300, runCaloriesToday: 450 })).toBe(450);
  });
  it('auto : repli forfait si jour de séance sans course', () => {
    expect(dayCalorieBonus({ mode: 'auto', isTrainingDay: true, fixedBonus: 300, runCaloriesToday: 0 })).toBe(300);
  });
  it('auto : 0 si aucune activité', () => {
    expect(dayCalorieBonus({ mode: 'auto', isTrainingDay: false, fixedBonus: 300, runCaloriesToday: 0 })).toBe(0);
  });
});

describe('macros', () => {
  it('fournit les ratios par défaut par objectif (somme 100)', () => {
    for (const objective of NUTRITION_OBJECTIVES) {
      const r = defaultMacroRatios(objective);
      expect(r.protein + r.carbs + r.fat).toBe(100);
    }
    expect(defaultMacroRatios('bulk')).toEqual({ protein: 30, carbs: 45, fat: 25 });
    expect(defaultMacroRatios('cut')).toEqual({ protein: 40, carbs: 35, fat: 25 });
    expect(defaultMacroRatios('weightloss')).toEqual({ protein: 40, carbs: 35, fat: 25 });
    expect(defaultMacroRatios('maintain')).toEqual({ protein: 25, carbs: 50, fat: 25 });
  });

  it('convertit calories + ratios en grammes', () => {
    expect(macroGramsFromCalories(2000, { protein: 25, carbs: 50, fat: 25 })).toEqual({
      protein: 125,
      carbs: 250,
      fat: 56,
    });
  });

  it('calcule les calories d’une répartition en grammes', () => {
    expect(caloriesFromMacros({ protein: 125, carbs: 250, fat: 56 })).toBe(2004);
  });

  it('dérive les ratios depuis les grammes (les grammes priment)', () => {
    const ratios = macroRatiosFromGrams({ protein: 150, carbs: 200, fat: 60 });
    expect(ratios.protein + ratios.carbs + ratios.fat).toBeGreaterThanOrEqual(99);
    expect(ratios.protein + ratios.carbs + ratios.fat).toBeLessThanOrEqual(101);
  });

  it('renvoie 0/0/0 pour des grammes nuls (pas de division par zéro)', () => {
    expect(macroRatiosFromGrams({ protein: 0, carbs: 0, fat: 0 })).toEqual({
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });
});

describe('nutritionProfileRowSchema', () => {
  const base = {
    id: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    createdAt: '2026-07-06T10:00:00Z',
    updatedAt: '2026-07-06T10:00:00Z',
    deletedAt: null,
  };

  it('valide une ligne minimale et applique les valeurs par défaut', () => {
    const parsed = nutritionProfileRowSchema.parse(base);
    expect(parsed.objective).toBeNull();
    expect(parsed.activityLevel).toBe('moderate');
    expect(parsed.restrictions).toEqual([]);
    expect(parsed.trainingDayBonus).toBe(0);
  });

  it('rejette un objectif invalide', () => {
    expect(nutritionProfileRowSchema.safeParse({ ...base, objective: 'recomp' }).success).toBe(
      false,
    );
  });

  it('accepte restrictions et macros manuelles', () => {
    const parsed = nutritionProfileRowSchema.parse({
      ...base,
      objective: 'cut',
      restrictions: ['vegan', 'gluten_free'],
      manualProteinG: 180,
      manualCarbsG: 150,
      manualFatG: 60,
    });
    expect(parsed.restrictions).toEqual(['vegan', 'gluten_free']);
    expect(parsed.manualProteinG).toBe(180);
  });

  describe('trainingBonusMode', () => {
    it('défaut fixed', () => {
      expect(nutritionProfileRowSchema.parse(base).trainingBonusMode).toBe('fixed');
    });
    it('accepte auto', () => {
      expect(nutritionProfileRowSchema.parse({ ...base, trainingBonusMode: 'auto' }).trainingBonusMode).toBe('auto');
    });
  });

  describe('adherenceMarginPct', () => {
    it('défaut 10', () => {
      expect(nutritionProfileRowSchema.parse(base).adherenceMarginPct).toBe(10);
    });
    it('rejette hors bornes (0)', () => {
      expect(nutritionProfileRowSchema.safeParse({ ...base, adherenceMarginPct: 0 }).success).toBe(false);
    });
  });
});

describe('meal config (4.15)', () => {
  it('renvoie les 4 repas par défaut si null/vide', () => {
    expect(resolveMealConfig(null).map((m) => m.key)).toEqual([
      'breakfast', 'lunch', 'dinner', 'snack',
    ]);
    expect(resolveMealConfig([])).toHaveLength(4);
  });
  it('renvoie la config custom si présente', () => {
    const custom = [
      { key: 'breakfast', label: 'Matin' },
      { key: 'custom-1', label: 'Pré-workout' },
    ];
    expect(resolveMealConfig(custom)).toEqual(custom);
  });
  it('valide le champ meals sur la ligne', () => {
    const parsed = nutritionProfileRowSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      createdAt: '2026-07-07T10:00:00Z',
      updatedAt: '2026-07-07T10:00:00Z',
      deletedAt: null,
      meals: [{ key: 'breakfast', label: 'Petit-déj' }],
    });
    expect(parsed.meals?.[0]?.label).toBe('Petit-déj');
  });
});

describe('resolveMealSplit (US NUTR-16)', () => {
  const defaultMeals = resolveMealConfig(null); // breakfast/lunch/dinner/snack, label null

  it('4 repas à totaux égaux → 25 % chacun, somme des parts = 100', () => {
    const totals = [
      { mealKey: 'breakfast', kcal: 700 },
      { mealKey: 'lunch', kcal: 700 },
      { mealKey: 'dinner', kcal: 700 },
      { mealKey: 'snack', kcal: 700 },
    ];
    const rows = resolveMealSplit(totals, defaultMeals, 7);
    expect(rows.map((r) => r.pct)).toEqual([25, 25, 25, 25]);
    expect(rows.reduce((sum, r) => sum + r.pct, 0)).toBe(100);
  });

  it("un repas configuré sans aucune entrée dans la fenêtre est absent (pas une ligne à 0 %)", () => {
    const totals = [
      { mealKey: 'breakfast', kcal: 1000 },
      { mealKey: 'dinner', kcal: 1000 },
    ];
    const rows = resolveMealSplit(totals, defaultMeals, 7);
    expect(rows.map((r) => r.mealKey)).toEqual(['breakfast', 'dinner']);
  });

  it("des totaux sous une clé absente de configuredMeals rejoignent le bucket 'other', toujours en dernier (R3/R4)", () => {
    const totals = [
      { mealKey: 'dinner', kcal: 600 },
      { mealKey: 'deleted-meal-xyz', kcal: 200 },
      { mealKey: 'breakfast', kcal: 400 },
    ];
    const rows = resolveMealSplit(totals, defaultMeals, 7);
    expect(rows.map((r) => r.mealKey)).toEqual(['breakfast', 'dinner', OTHER_MEAL_KEY]);
    expect(rows.at(-1)?.label).toBeNull();
  });

  it('respecte l’ordre de configuredMeals, pas un tri par part décroissante (R4)', () => {
    const totals = [
      { mealKey: 'snack', kcal: 900 }, // le plus gros, mais dernier dans configuredMeals
      { mealKey: 'breakfast', kcal: 100 },
    ];
    const rows = resolveMealSplit(totals, defaultMeals, 7);
    expect(rows.map((r) => r.mealKey)).toEqual(['breakfast', 'snack']);
  });

  it('loggedDays = 0 → [] (pas de division par zéro, R5)', () => {
    expect(resolveMealSplit([{ mealKey: 'breakfast', kcal: 500 }], defaultMeals, 0)).toEqual([]);
  });

  it('aucun total → [] (R5)', () => {
    expect(resolveMealSplit([], defaultMeals, 7)).toEqual([]);
  });

  it('propage le label personnalisé d’un repas configuré tel quel (résolution i18n laissée à l’UI)', () => {
    const customMeals = [{ key: 'breakfast', label: 'Brunch' }, ...defaultMeals.slice(1)];
    const rows = resolveMealSplit([{ mealKey: 'breakfast', kcal: 500 }], customMeals, 7);
    expect(rows[0]?.label).toBe('Brunch');
  });

  it('moyenne kcal/jour = total du repas / jours renseignés (pas la longueur de la fenêtre)', () => {
    const rows = resolveMealSplit([{ mealKey: 'breakfast', kcal: 1050 }], defaultMeals, 3);
    expect(rows[0]?.avgKcalPerDay).toBe(350);
  });
});

describe('computeEffectiveTargetForDay', () => {
  it('base seule hors jour de séance', () => {
    expect(
      computeEffectiveTargetForDay({ targetBase: 2000, mode: 'fixed', fixedBonus: 300, isTrainingDay: false, runCaloriesToday: 0 }),
    ).toBe(2000);
  });
  it('base + forfait un jour de séance (mode fixed)', () => {
    expect(
      computeEffectiveTargetForDay({ targetBase: 2000, mode: 'fixed', fixedBonus: 300, isTrainingDay: true, runCaloriesToday: 0 }),
    ).toBe(2300);
  });
  it('base + dépense course (mode auto)', () => {
    expect(
      computeEffectiveTargetForDay({ targetBase: 2000, mode: 'auto', fixedBonus: 300, isTrainingDay: true, runCaloriesToday: 450 }),
    ).toBe(2450);
  });
});

describe('computeGoalAdherence', () => {
  it('compte les jours dans la fourchette ±marge', () => {
    const r = computeGoalAdherence(
      [
        { kcal: 2000, effectiveTarget: 2000 }, // exact → in
        { kcal: 2180, effectiveTarget: 2000 }, // +9 % → in
        { kcal: 2300, effectiveTarget: 2000 }, // +15 % → out
      ],
      10,
    );
    expect(r).toEqual({ loggedDays: 3, daysInTarget: 2, pct: 67 });
  });
  it('ignore les jours effectiveTarget null (profil incomplet)', () => {
    const r = computeGoalAdherence(
      [
        { kcal: 2000, effectiveTarget: null },
        { kcal: 2000, effectiveTarget: 2000 },
      ],
      10,
    );
    expect(r).toEqual({ loggedDays: 1, daysInTarget: 1, pct: 100 });
  });
  it('aucun jour loggé → pct 0 sans division par zéro', () => {
    expect(computeGoalAdherence([], 10)).toEqual({ loggedDays: 0, daysInTarget: 0, pct: 0 });
  });
});

describe('computeJournalCompletion', () => {
  const today = new Date(2026, 6, 16); // 16/07/2026 local ; fenêtre 7 j = [09/07 … 15/07]
  it('fenêtre pleine : loggés / window', () => {
    const r = computeJournalCompletion({
      loggedDayKeys: ['2026-07-10', '2026-07-12', '2026-07-15'],
      firstEntryDayKey: '2026-07-01',
      windowDays: 7,
      today,
    });
    expect(r).toEqual({ loggedDays: 3, effectiveWindow: 7, pct: 43 });
  });
  it('borne ancienneté : dénominateur = jours depuis la 1ère entrée', () => {
    const r = computeJournalCompletion({
      loggedDayKeys: ['2026-07-14', '2026-07-15'],
      firstEntryDayKey: '2026-07-14',
      windowDays: 30,
      today, // [14/07 … 15/07] = 2 jours
    });
    expect(r).toEqual({ loggedDays: 2, effectiveWindow: 2, pct: 100 });
  });
  it("aujourd'hui exclu : 1ère entrée = aujourd'hui → rien de loggable", () => {
    const r = computeJournalCompletion({
      loggedDayKeys: ['2026-07-16'],
      firstEntryDayKey: '2026-07-16',
      windowDays: 7,
      today,
    });
    expect(r).toEqual({ loggedDays: 0, effectiveWindow: 0, pct: 0 });
  });
  it("aujourd'hui exclu du numérateur même avec historique ancien", () => {
    // 15/07 compte, 16/07 (aujourd'hui) exclu ; fenêtre pleine 7 j
    const r = computeJournalCompletion({
      loggedDayKeys: ['2026-07-15', '2026-07-16'],
      firstEntryDayKey: '2026-07-01',
      windowDays: 7,
      today,
    });
    expect(r).toEqual({ loggedDays: 1, effectiveWindow: 7, pct: 14 });
  });
  it('aucune entrée → tout à 0', () => {
    expect(
      computeJournalCompletion({ loggedDayKeys: [], firstEntryDayKey: null, windowDays: 7, today }),
    ).toEqual({ loggedDays: 0, effectiveWindow: 0, pct: 0 });
  });
});

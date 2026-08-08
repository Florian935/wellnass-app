import { describe, expect, it } from 'vitest';

import {
  HIGH_VOLUME_MEDIAN_FACTOR,
  MIN_DAYS_PER_GROUP,
  PROTEIN_PER_SERVING_G_PER_KG,
  computeAdherenceByDayType,
  computeEnergyByDayType,
  computeProteinDistribution,
  findLowFuelDays,
  type CrossDay,
} from './training-nutrition-cross';
import { DEFAULT_MEAL_CONFIG, OTHER_MEAL_KEY } from './nutrition';

/** Un jour, par défaut journalisé, de repos, sans volume. */
function day(over: Partial<CrossDay> = {}): CrossDay {
  return {
    dayKey: '2026-08-01',
    kcal: 2000,
    effectiveTarget: 2000,
    isTrainingDay: false,
    strengthVolume: 0,
    ...over,
  };
}

/** N jours d'un même type, avec des clés distinctes. */
function days(n: number, over: Partial<CrossDay> = {}): CrossDay[] {
  return Array.from({ length: n }, (_, i) =>
    day({ dayKey: `2026-08-${String(i + 1).padStart(2, '0')}`, ...over }),
  );
}

describe('constantes', () => {
  it('expose les trois seuils, nommés et calibrables', () => {
    expect(MIN_DAYS_PER_GROUP).toBe(3);
    expect(HIGH_VOLUME_MEDIAN_FACTOR).toBe(1.25);
    expect(PROTEIN_PER_SERVING_G_PER_KG).toBe(0.3);
  });
});

// ---------------------------------------------------------------------------
// MN-20
// ---------------------------------------------------------------------------

describe('computeEnergyByDayType — 🔴 le seuil est PAR GROUPE (R3)', () => {
  it('rend null sans aucun jour', () => {
    expect(computeEnergyByDayType([])).toBeNull();
  });

  it('🔴 rend null avec 3 jours de séance mais seulement 2 de repos', () => {
    // 5 jours au total : `if (days.length < MIN)` passerait. C'est l'erreur que ce test attrape.
    const input = [...days(3, { isTrainingDay: true }), ...days(2)];
    expect(computeEnergyByDayType(input)).toBeNull();
  });

  it('rend null avec 2 de séance et 12 de repos', () => {
    const input = [...days(2, { isTrainingDay: true }), ...days(12)];
    expect(computeEnergyByDayType(input)).toBeNull();
  });

  it('calcule à 3 et 3 — borne inclusive', () => {
    const input = [...days(3, { isTrainingDay: true }), ...days(3)];
    const out = computeEnergyByDayType(input)!;
    expect(out.trainingDays).toBe(3);
    expect(out.restDays).toBe(3);
  });
});

describe('computeEnergyByDayType — l’écart', () => {
  const base = (trainingKcal: number, restKcal: number) => [
    ...days(3, { isTrainingDay: true, kcal: trainingKcal }),
    ...days(3, { kcal: restKcal }),
  ];

  it('rend un écart positif quand on mange plus les jours de séance', () => {
    const out = computeEnergyByDayType(base(2480, 2160))!;
    expect(out.deltaKcal).toBe(320);
    expect(out.trainingAvgKcal).toBe(2480);
    expect(out.restAvgKcal).toBe(2160);
  });

  it('🔴 rend un écart NÉGATIF sans le plafonner — c’est une information', () => {
    const out = computeEnergyByDayType(base(1900, 2300))!;
    expect(out.deltaKcal).toBe(-400);
  });

  it('rend 0 quand on mange pareil', () => {
    expect(computeEnergyByDayType(base(2200, 2200))!.deltaKcal).toBe(0);
  });

  it('moyenne bien sur des valeurs différentes', () => {
    const input = [
      day({ dayKey: 'a', isTrainingDay: true, kcal: 2000 }),
      day({ dayKey: 'b', isTrainingDay: true, kcal: 2200 }),
      day({ dayKey: 'c', isTrainingDay: true, kcal: 2400 }),
      ...days(3, { kcal: 2000 }),
    ];
    expect(computeEnergyByDayType(input)!.trainingAvgKcal).toBe(2200);
  });
});

describe('computeEnergyByDayType — 🔴 « non journalisé » n’est pas « 0 kcal » (R4)', () => {
  it('exclut les jours non journalisés des moyennes ET des compteurs', () => {
    const input = [
      ...days(3, { isTrainingDay: true, kcal: 2400 }),
      day({ dayKey: 'x', isTrainingDay: true, kcal: null }),
      ...days(3, { kcal: 2000 }),
    ];
    const out = computeEnergyByDayType(input)!;
    // 4 jours de séance existent, mais 3 seulement sont journalisés.
    expect(out.trainingDays).toBe(3);
    expect(out.trainingAvgKcal).toBe(2400);
  });

  it('🔴 un jour à 0 kcal COMPTE — il a été journalisé', () => {
    // La distinction qui fausserait tous les dénominateurs si on la ratait.
    const input = [
      ...days(2, { isTrainingDay: true, kcal: 3000 }),
      day({ dayKey: 'zero', isTrainingDay: true, kcal: 0 }),
      ...days(3, { kcal: 2000 }),
    ];
    const out = computeEnergyByDayType(input)!;
    expect(out.trainingDays).toBe(3);
    expect(out.trainingAvgKcal).toBe(2000);
  });

  it('rend null quand le seuil n’est atteint qu’en comptant les non journalisés', () => {
    const input = [
      ...days(2, { isTrainingDay: true }),
      day({ dayKey: 'x', isTrainingDay: true, kcal: null }),
      ...days(3),
    ];
    expect(computeEnergyByDayType(input)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// MN-16
// ---------------------------------------------------------------------------

describe('computeAdherenceByDayType — 🔴 la marge appartient à l’utilisateur (D2)', () => {
  /** 3 jours de séance à 2 200 pour une cible de 2 000 (+10 %), 3 de repos dans la cible. */
  const input = [
    ...days(3, { isTrainingDay: true, kcal: 2200, effectiveTarget: 2000 }),
    ...days(3, { kcal: 2000, effectiveTarget: 2000 }),
  ];

  it('rend un taux DIFFÉRENT selon la marge passée', () => {
    // Le test de D2 : les mêmes jours, deux marges, deux résultats. Si le module figeait sa propre
    // constante, ces deux appels rendraient la même chose.
    const wide = computeAdherenceByDayType(input, 10)!;
    const tight = computeAdherenceByDayType(input, 5)!;
    expect(wide.trainingPct).toBe(100);
    expect(tight.trainingPct).toBe(0);
    expect(wide.trainingPct).not.toBe(tight.trainingPct);
  });

  it('rend la marge effectivement utilisée — la carte doit l’afficher (R2)', () => {
    expect(computeAdherenceByDayType(input, 7)!.marginPct).toBe(7);
  });

  it('applique le seuil par groupe', () => {
    const short = [...days(3, { isTrainingDay: true }), ...days(2)];
    expect(computeAdherenceByDayType(short, 10)).toBeNull();
  });

  it('écarte les jours sans cible — convention de computeGoalAdherence, pas une nouvelle', () => {
    const withoutTarget = [
      ...days(3, { isTrainingDay: true, effectiveTarget: null }),
      ...days(3),
    ];
    expect(computeAdherenceByDayType(withoutTarget, 10)).toBeNull();
  });

  it('écarte les jours non journalisés', () => {
    const input2 = [
      ...days(2, { isTrainingDay: true }),
      day({ dayKey: 'x', isTrainingDay: true, kcal: null }),
      ...days(3),
    ];
    expect(computeAdherenceByDayType(input2, 10)).toBeNull();
  });

  it('compare bien les deux groupes', () => {
    const mixed = [
      ...days(3, { isTrainingDay: true, kcal: 3000, effectiveTarget: 2000 }),
      ...days(3, { kcal: 2000, effectiveTarget: 2000 }),
    ];
    const out = computeAdherenceByDayType(mixed, 10)!;
    expect(out.trainingPct).toBe(0);
    expect(out.restPct).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// MN-15
// ---------------------------------------------------------------------------

describe('findLowFuelDays — le volume se mesure contre soi-même (D3)', () => {
  it('rend [] sans aucun jour à volume', () => {
    expect(findLowFuelDays(days(5))).toEqual([]);
  });

  it('rend [] quand le volume est parfaitement régulier — ce n’est pas un défaut', () => {
    const input = days(5, { strengthVolume: 10000, kcal: 1500, effectiveTarget: 2500 });
    expect(findLowFuelDays(input)).toEqual([]);
  });

  it('signale un jour très au-dessus de la médiane avec un apport bas', () => {
    const input = [
      ...days(4, { strengthVolume: 10000 }),
      day({ dayKey: 'gros', strengthVolume: 20000, kcal: 1780, effectiveTarget: 2600 }),
    ];
    const out = findLowFuelDays(input);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ dayKey: 'gros', strengthVolume: 20000, kcal: 1780 });
  });

  it('ne signale PAS un gros volume avec un apport correct', () => {
    const input = [
      ...days(4, { strengthVolume: 10000 }),
      day({ dayKey: 'gros', strengthVolume: 20000, kcal: 2800, effectiveTarget: 2600 }),
    ];
    expect(findLowFuelDays(input)).toEqual([]);
  });

  it('🔴 un jour de COURSE n’est jamais un gros volume — l’asymétrie est délibérée (D1)', () => {
    // `isTrainingDay` est vrai (c'est un jour d'entraînement pour MN-20/MN-16), mais le volume muscu
    // est nul. Une relecture pourrait « corriger » par symétrie apparente : ce test l'en empêche.
    const input = [
      ...days(4, { strengthVolume: 10000 }),
      day({ dayKey: 'course', isTrainingDay: true, strengthVolume: 0, kcal: 1200, effectiveTarget: 2600 }),
    ];
    expect(findLowFuelDays(input).map((d) => d.dayKey)).not.toContain('course');
  });

  it('ne signale pas un jour de gros volume NON journalisé', () => {
    // On ne sait pas ce qui a été mangé ; l'accuser d'un apport bas serait inventer une donnée.
    const input = [
      ...days(4, { strengthVolume: 10000 }),
      day({ dayKey: 'gros', strengthVolume: 20000, kcal: null, effectiveTarget: 2600 }),
    ];
    expect(findLowFuelDays(input)).toEqual([]);
  });

  it('ne signale pas un jour sans cible exploitable', () => {
    const input = [
      ...days(4, { strengthVolume: 10000 }),
      day({ dayKey: 'gros', strengthVolume: 20000, kcal: 1200, effectiveTarget: null }),
    ];
    expect(findLowFuelDays(input)).toEqual([]);
  });

  it('trie du plus gros volume au plus petit', () => {
    const input = [
      ...days(4, { strengthVolume: 10000 }),
      day({ dayKey: 'moyen', strengthVolume: 18000, kcal: 1500, effectiveTarget: 2600 }),
      day({ dayKey: 'enorme', strengthVolume: 26000, kcal: 1500, effectiveTarget: 2600 }),
    ];
    expect(findLowFuelDays(input).map((d) => d.dayKey)).toEqual(['enorme', 'moyen']);
  });

  it('départage deux jours de volume ÉGAL par la date — sortie déterministe', () => {
    // Sans ce départage, deux rendus successifs pourraient intervertir deux lignes identiques à
    // l'écran : un scintillement sans cause apparente.
    const input = [
      ...days(4, { strengthVolume: 10000 }),
      day({ dayKey: '2026-08-20', strengthVolume: 20000, kcal: 1500, effectiveTarget: 2600 }),
      day({ dayKey: '2026-08-12', strengthVolume: 20000, kcal: 1500, effectiveTarget: 2600 }),
    ];
    expect(findLowFuelDays(input).map((d) => d.dayKey)).toEqual(['2026-08-12', '2026-08-20']);
  });

  it('utilise la MÉDIANE, qu’une séance exceptionnelle ne doit pas tirer', () => {
    // Médiane de [10k, 10k, 10k, 10k, 100k] = 10 000 → seuil 12 500. Le jour à 15 000 est signalé.
    // Avec une MOYENNE (28 000), son seuil serait 35 000 et il ne le serait pas.
    const input = [
      ...days(4, { strengthVolume: 10000 }),
      day({ dayKey: 'exceptionnel', strengthVolume: 100000, kcal: 3000, effectiveTarget: 2600 }),
      day({ dayKey: 'gros', strengthVolume: 15000, kcal: 1500, effectiveTarget: 2600 }),
    ];
    expect(findLowFuelDays(input).map((d) => d.dayKey)).toContain('gros');
  });
});

// ---------------------------------------------------------------------------
// MN-10
// ---------------------------------------------------------------------------

describe('computeProteinDistribution — 🔴 sans poids, rien n’est calculable (D4)', () => {
  const meals = [
    { mealKey: 'breakfast', proteinG: 18 },
    { mealKey: 'lunch', proteinG: 42 },
  ];

  it('rend null sans pesée — aucune valeur neutre n’existe', () => {
    expect(
      computeProteinDistribution({
        mealProtein: meals,
        configuredMeals: DEFAULT_MEAL_CONFIG,
        bodyWeightKg: null,
      }),
    ).toBeNull();
  });

  it('rend null sur un poids absurde', () => {
    for (const w of [0, -70, Number.NaN]) {
      expect(
        computeProteinDistribution({
          mealProtein: meals,
          configuredMeals: DEFAULT_MEAL_CONFIG,
          bodyWeightKg: w,
        }),
      ).toBeNull();
    }
  });

  it('rend null sans aucun repas', () => {
    expect(
      computeProteinDistribution({
        mealProtein: [],
        configuredMeals: DEFAULT_MEAL_CONFIG,
        bodyWeightKg: 74,
      }),
    ).toBeNull();
  });
});

describe('computeProteinDistribution — la répartition (R6)', () => {
  const run = (mealProtein: { mealKey: string; proteinG: number }[], bodyWeightKg = 74) =>
    computeProteinDistribution({
      mealProtein,
      configuredMeals: DEFAULT_MEAL_CONFIG,
      bodyWeightKg,
    });

  it('🔴 distingue « tout au dîner » de « quatre prises » à total ÉGAL', () => {
    // C'est toute la raison d'être de cette analyse : « 130 g » ne dit rien du fractionnement.
    const oneMeal = run([{ mealKey: 'dinner', proteinG: 130 }])!;
    const fourMeals = run([
      { mealKey: 'breakfast', proteinG: 30 },
      { mealKey: 'lunch', proteinG: 35 },
      { mealKey: 'snack', proteinG: 30 },
      { mealKey: 'dinner', proteinG: 35 },
    ])!;
    expect(oneMeal.totalProteinG).toBe(fourMeals.totalProteinG);
    expect(oneMeal.servingsAtReference).toBe(1);
    expect(fourMeals.servingsAtReference).toBe(4);
  });

  it('rend le repère en grammes, pour qu’il soit vérifiable', () => {
    // 0,3 × 74 = 22,2 → 22 g affichés.
    expect(run([{ mealKey: 'lunch', proteinG: 40 }])!.referenceG).toBe(22);
  });

  it('compte une prise PILE au repère — borne inclusive', () => {
    const out = run([{ mealKey: 'lunch', proteinG: 22.2 }])!;
    expect(out.servingsAtReference).toBe(1);
  });

  it('ne compte pas une prise sous le repère', () => {
    const out = run([
      { mealKey: 'breakfast', proteinG: 18 },
      { mealKey: 'lunch', proteinG: 42 },
    ])!;
    expect(out.servingsAtReference).toBe(1);
    expect(out.servings.find((s) => s.mealKey === 'breakfast')!.reachesReference).toBe(false);
  });

  it('suit l’ordre des repas configurés — jamais un tri par quantité', () => {
    const out = run([
      { mealKey: 'dinner', proteinG: 58 },
      { mealKey: 'breakfast', proteinG: 18 },
    ])!;
    const order = DEFAULT_MEAL_CONFIG.map((m) => m.key);
    const got = out.servings.map((s) => s.mealKey);
    expect(got).toEqual(order.filter((k) => got.includes(k)));
  });

  it('range un repas hors configuration en « autre », EN DERNIER (convention NUTR-16)', () => {
    const out = run([
      { mealKey: 'breakfast', proteinG: 30 },
      { mealKey: 'gouter-perso', proteinG: 25 },
    ])!;
    expect(out.servings.at(-1)!.mealKey).toBe(OTHER_MEAL_KEY);
    expect(out.servings.at(-1)!.label).toBeNull();
  });

  it('agrège plusieurs clés inconnues dans le même bucket « autre »', () => {
    const out = run([
      { mealKey: 'a', proteinG: 12 },
      { mealKey: 'b', proteinG: 13 },
    ])!;
    expect(out.servings).toHaveLength(1);
    expect(out.servings[0]).toMatchObject({ mealKey: OTHER_MEAL_KEY, proteinG: 25 });
  });

  it('ignore une valeur de protéines absurde sans perdre les autres', () => {
    const out = run([
      { mealKey: 'lunch', proteinG: 40 },
      { mealKey: 'dinner', proteinG: Number.NaN },
    ])!;
    expect(out.servings.map((s) => s.mealKey)).toEqual(['lunch']);
  });

  it('rend null si aucune valeur n’est exploitable', () => {
    expect(run([{ mealKey: 'lunch', proteinG: 0 }])).toBeNull();
  });

  it('rend un total cohérent avec la somme des prises', () => {
    const out = run([
      { mealKey: 'breakfast', proteinG: 18 },
      { mealKey: 'lunch', proteinG: 42 },
      { mealKey: 'dinner', proteinG: 58 },
    ])!;
    expect(out.totalProteinG).toBe(118);
  });

  it('s’adapte au poids : plus lourd, repère plus haut', () => {
    const light = run([{ mealKey: 'lunch', proteinG: 25 }], 70)!;
    const heavy = run([{ mealKey: 'lunch', proteinG: 25 }], 100)!;
    expect(light.servingsAtReference).toBe(1);
    expect(heavy.servingsAtReference).toBe(0);
  });
});

/**
 * Planning repas de la semaine (`app/meal-plan/index.tsx`, US REPAS-01) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier (117 instructions). C'est un écran d'**intention** : il ne doit
 * **jamais** écrire dans le journal alimentaire (règle R1). Seul « J'ai mangé ça » crée des
 * `food_entries`, et l'action est réversible (R2/R3). Tout le reste découle de là.
 *
 * Les décisions vérifiées, dans l'ordre de ce qu'elles coûtent si elles cassent :
 *
 *  1. **L'objectif calorique est calculé JOUR PAR JOUR.** Une semaine peut mêler des jours en
 *     période « vie réelle » (objectif au maintien, R4) et des jours normaux : une cible unique
 *     alignerait toute la semaine sur le premier cas rencontré.
 *  2. **Le bonus d'entraînement est un FORFAIT, jamais le mode `auto`.** Ce mode dérive le bonus de
 *     la dépense d'une course **déjà enregistrée** — une notion qui n'existe pas pour un jour futur,
 *     qui est tout l'objet d'un planning.
 *  3. **Sans pilier d'entraînement actif, le planning ne parle pas d'entraînement** (décision H).
 *  4. **Une recette est ajoutée AU PRORATA des portions** (R8) : ses macros portent la totalité du
 *     rendement. Un repas type, lui, n'a pas cette notion (décision D1).
 *  5. **Dupliquer n'est proposé que si la semaine source a du contenu.** Sans cette garde, l'appel
 *     « réussissait » en ne copiant rien, sans le moindre retour — arbitrage Florian du 04/08/2026.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import MealPlanScreen from '../index';
import {
  consumePlannedEntry,
  duplicateWeek,
  planRecipe,
  planTemplate,
  removePlannedEntry,
  undoConsumedEntry,
  useWeekMealPlan,
  useWeekMealPlanCount,
} from '@/data/repositories/meal-plan-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { useRealLifePeriods } from '@/data/repositories/real-life-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { useWeekPlan } from '@/data/repositories/planned-session-repository';
import { useRecipes } from '@/data/repositories/recipe-repository';
import { useMealTemplates } from '@/data/repositories/meal-template-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/meal-plan-repository', () => ({
  useWeekMealPlan: jest.fn(() => ({ entries: [] })),
  useWeekMealPlanCount: jest.fn(() => ({ count: 0 })),
  planRecipe: jest.fn(),
  planTemplate: jest.fn(),
  consumePlannedEntry: jest.fn(),
  undoConsumedEntry: jest.fn(),
  removePlannedEntry: jest.fn(),
  duplicateWeek: jest.fn(),
}));
jest.mock('@/data/repositories/nutrition-repository', () => ({
  useNutritionProfile: jest.fn(() => ({ nutritionProfile: null })),
}));
jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: jest.fn(() => ({ profile: null })),
}));
jest.mock('@/data/repositories/real-life-repository', () => ({
  useRealLifePeriods: jest.fn(() => ({ periods: [] })),
}));
jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: jest.fn(() => ({ settings: null })),
}));
jest.mock('@/data/repositories/planned-session-repository', () => ({
  useWeekPlan: jest.fn(() => ({ items: [] })),
}));
jest.mock('@/data/repositories/recipe-repository', () => ({ useRecipes: jest.fn(() => ({ recipes: [] })) }));
jest.mock('@/data/repositories/meal-template-repository', () => ({
  useMealTemplates: jest.fn(() => ({ templates: [] })),
}));

/**
 * La carte-jour a ses propres tests : sonde qui expose ce que l'écran lui passe — la cible du jour,
 * le bonus appliqué — et rend les quatre actions pour pouvoir les déclencher.
 */
jest.mock('@/components/nutrition/MealPlanDayCard', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    MealPlanDayCard: ({
      dayKey,
      dayLabel,
      isToday,
      entries,
      targetKcal,
      trainingBonusKcal,
      onAdd,
      onConsume,
      onUndoConsume,
      onRemove,
    }: {
      dayKey: string;
      dayLabel: string;
      isToday: boolean;
      entries: { id: string; consumedAt: string | null }[];
      targetKcal: number | null;
      trainingBonusKcal: number;
      onAdd: (m: string) => void;
      onConsume: (e: { id: string }) => void;
      onUndoConsume: (e: { id: string }) => void;
      onRemove: (e: { id: string }) => void;
    }) => (
      <View>
        <Text>
          jour:{dayKey}:{dayLabel}:{String(targetKcal)}:{trainingBonusKcal}:
          {isToday ? 'today' : '-'}:{entries.length}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`ajouter-${dayKey}`} onPress={() => onAdd('lunch')}>
          <Text>ajouter</Text>
        </Pressable>
        {entries.map((e) => (
          <View key={e.id}>
            <Pressable accessibilityRole="button" accessibilityLabel={`manger-${e.id}`} onPress={() => onConsume(e)}>
              <Text>manger</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`annuler-${e.id}`} onPress={() => onUndoConsume(e)}>
              <Text>annuler</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`retirer-${e.id}`} onPress={() => onRemove(e)}>
              <Text>retirer</Text>
            </Pressable>
          </View>
        ))}
      </View>
    ),
  };
});

jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/ScreenHeader', () => {
  const { Text } = require('react-native');
  return { ScreenHeader: ({ title }: { title: string }) => <Text>{title}</Text> };
});
jest.mock('@/components/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      label,
      onPress,
      disabled,
    }: {
      label: string;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
      >
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#fffaf2',
      surface: '#fffaf2',
      border: '#ece0cd',
      borderStrong: '#d9c8b0',
      accent: '#c0562f',
      accentText: '#ffffff',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockPlan = useWeekMealPlan as jest.Mock;
const mockCount = useWeekMealPlanCount as jest.Mock;
const mockPlanRecipe = planRecipe as jest.Mock;
const mockPlanTemplate = planTemplate as jest.Mock;
const mockConsume = consumePlannedEntry as jest.Mock;
const mockUndo = undoConsumedEntry as jest.Mock;
const mockRemove = removePlannedEntry as jest.Mock;
const mockDuplicate = duplicateWeek as jest.Mock;
const mockNutritionProfile = useNutritionProfile as jest.Mock;
const mockProfile = useProfile as jest.Mock;
const mockRealLife = useRealLifePeriods as jest.Mock;
const mockSettings = useSettings as jest.Mock;
const mockSessions = useWeekPlan as jest.Mock;
const mockRecipes = useRecipes as jest.Mock;
const mockTemplates = useMealTemplates as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

/** Semaine du lundi 10/08/2026, « aujourd'hui » mercredi 12/08. */
const LUNDI = '2026-08-10';
const AUJOURDHUI = '2026-08-12';

/** Profil complet : sans lui, `tdee` renvoie `null` et aucune cible n'est calculable. */
const PROFIL = {
  sex: 'male' as const,
  weightKg: 80,
  heightCm: 180,
  birthDate: '1990-01-01',
  mainGoal: 'health' as const,
};

const entree = (overrides: Record<string, unknown> = {}) => ({
  id: 'pe-1',
  planDate: AUJOURDHUI,
  mealKey: 'lunch',
  orderIndex: 0,
  sourceType: 'recipe' as const,
  recipeId: 'r-1',
  templateId: null,
  servings: 1,
  label: 'Curry',
  kcal: 500,
  proteinG: 25,
  carbsG: 50,
  fatG: 20,
  consumedAt: null,
  ...overrides,
});

const recette = {
  id: 'r-1',
  name: 'Curry',
  servings: 4,
  totalKcal: 2000,
  totalProteinG: 100,
  totalCarbsG: 200,
  totalFatG: 80,
};

const modele = { id: 'tpl-1', name: 'Petit-déj type', itemCount: 3, totalKcal: 450 };

const afficher = async ({
  entries = [] as unknown[],
  countPrecedente = 0,
}: { entries?: unknown[]; countPrecedente?: number } = {}) => {
  mockPlan.mockReturnValue({ entries });
  mockCount.mockReturnValue({ count: countPrecedente });
  await render(<MealPlanScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

/** Ce que la carte-jour a reçu pour `dayKey`, décomposé. */
const carte = (dayKey: string) => {
  const texte = screen.getByText(new RegExp(`^jour:${dayKey}:`)).children.join('');
  const [, , label, cible, bonus, aujourdhui, nb] = texte.split(':');
  return { label, cible, bonus: Number(bonus), aujourdhui, nb: Number(nb) };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date(`${AUJOURDHUI}T10:00:00`));
  mockUseRouter.mockReturnValue({ push });
  mockNutritionProfile.mockReturnValue({ nutritionProfile: null });
  mockProfile.mockReturnValue({ profile: null });
  mockRealLife.mockReturnValue({ periods: [] });
  mockSettings.mockReturnValue({ settings: { activePillars: ['strength', 'nutrition'] } });
  mockSessions.mockReturnValue({ items: [] });
  mockRecipes.mockReturnValue({ recipes: [] });
  mockTemplates.mockReturnValue({ templates: [] });
  mockPlanRecipe.mockResolvedValue(undefined);
  mockPlanTemplate.mockResolvedValue(undefined);
  mockDuplicate.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Semaine affichée
// ---------------------------------------------------------------------------

describe('semaine affichée', () => {
  it('ouvre sur la semaine courante, sept jours du lundi au dimanche', async () => {
    await afficher();

    expect(screen.getByText('mealPlan.week.current')).toBeTruthy();
    expect(carte(LUNDI).label).toBe('common.weekday.mon 10');
    expect(carte('2026-08-16').label).toBe('common.weekday.sun 16');
  });

  it('🔴 la semaine SUIVANTE est nommée, les autres non', async () => {
    await afficher();

    await taper(screen.getByLabelText('mealPlan.week.nextA11y'));
    // « Semaine prochaine » est le cas d'usage principal d'un planning repas : le nommer évite de
    // relire les dates pour savoir où l'on est.
    expect(screen.getByText('mealPlan.week.next')).toBeTruthy();

    await taper(screen.getByLabelText('mealPlan.week.nextA11y'));
    // Au-delà, seule la plage de dates fait sens : « dans deux semaines » ne se lit pas mieux.
    expect(screen.queryByText(/mealPlan\.week\.(current|next)$/)).toBeNull();
  });

  it('les flèches déplacent la semaine de sept jours et rechargent le plan', async () => {
    await afficher();

    await taper(screen.getByLabelText('mealPlan.week.nextA11y'));
    expect(mockPlan).toHaveBeenLastCalledWith('2026-08-17');

    await taper(screen.getByLabelText('mealPlan.week.previousA11y'));
    await taper(screen.getByLabelText('mealPlan.week.previousA11y'));
    expect(mockPlan).toHaveBeenLastCalledWith('2026-08-03');
  });

  it('le jour courant est marqué', async () => {
    await afficher();

    expect(carte(AUJOURDHUI).aujourdhui).toBe('today');
    expect(carte(LUNDI).aujourdhui).toBe('-');
  });

  it('les entrées sont réparties sur LEUR jour', async () => {
    await afficher({
      entries: [
        entree({ id: 'a', planDate: AUJOURDHUI }),
        entree({ id: 'b', planDate: AUJOURDHUI }),
        entree({ id: 'c', planDate: LUNDI }),
      ],
    });

    expect(carte(AUJOURDHUI).nb).toBe(2);
    expect(carte(LUNDI).nb).toBe(1);
    expect(carte('2026-08-16').nb).toBe(0);
  });

  it('une semaine vide est annoncée, sans masquer les sept jours', async () => {
    await afficher();

    // Les cases restent : ce sont elles qu'on vient remplir.
    expect(screen.getByText('mealPlan.empty.title')).toBeTruthy();
    expect(carte(LUNDI).nb).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Objectif calorique
// ---------------------------------------------------------------------------

describe('objectif calorique du jour', () => {
  it('sans profil calculable, aucune cible n’est inventée', async () => {
    await afficher();

    // `tdee` renvoie `null` sans poids ni taille : afficher une cible arbitraire donnerait un
    // budget que rien ne justifie.
    expect(carte(LUNDI).cible).toBe('null');
  });

  it('avec un profil, chaque jour reçoit sa cible', async () => {
    mockProfile.mockReturnValue({ profile: PROFIL });
    await afficher();

    expect(Number(carte(LUNDI).cible)).toBeGreaterThan(1000);
  });

  it('🔴 la cible est calculée JOUR PAR JOUR : « vie réelle » n’aligne pas la semaine', async () => {
    mockProfile.mockReturnValue({ profile: { ...PROFIL, mainGoal: 'weightloss' } });
    // Période « vie réelle » sur le seul mercredi.
    mockRealLife.mockReturnValue({
      periods: [{ id: 'rl', startedOn: AUJOURDHUI, endsOn: AUJOURDHUI }],
    });
    await afficher();

    // R4 : objectif au maintien pendant la période, donc STRICTEMENT plus haut qu'un jour de
    // déficit. Une cible unique aurait aligné toute la semaine sur le premier cas rencontré.
    expect(Number(carte(AUJOURDHUI).cible)).toBeGreaterThan(Number(carte(LUNDI).cible));
  });

  it('🔴 un jour de séance reçoit le FORFAIT, pas une dépense estimée', async () => {
    mockProfile.mockReturnValue({ profile: PROFIL });
    mockNutritionProfile.mockReturnValue({ nutritionProfile: { trainingDayBonus: 300 } });
    mockSessions.mockReturnValue({ items: [{ scheduledDate: AUJOURDHUI }] });
    await afficher();

    // Le mode `auto` de RN-02 dérive le bonus d'une course DÉJÀ enregistrée — une notion qui
    // n'existe pas pour un jour futur, qui est tout l'objet d'un planning.
    expect(carte(AUJOURDHUI).bonus).toBe(300);
    expect(Number(carte(AUJOURDHUI).cible) - Number(carte(LUNDI).cible)).toBe(300);
  });

  it('🔴 sans pilier d’entraînement actif, AUCUN bonus (décision H)', async () => {
    mockProfile.mockReturnValue({ profile: PROFIL });
    mockNutritionProfile.mockReturnValue({ nutritionProfile: { trainingDayBonus: 300 } });
    mockSessions.mockReturnValue({ items: [{ scheduledDate: AUJOURDHUI }] });
    mockSettings.mockReturnValue({ settings: { activePillars: ['nutrition'] } });
    await afficher();

    // L'intégration inter-piliers ne s'impose jamais : qui n'utilise que la nutrition ne doit pas
    // voir son budget bouger à cause d'une séance qu'il ne suit pas.
    expect(carte(AUJOURDHUI).bonus).toBe(0);
    expect(carte(AUJOURDHUI).cible).toBe(carte(LUNDI).cible);
  });

  it('🔴 un bonus NÉGATIF est ramené à zéro', async () => {
    mockProfile.mockReturnValue({ profile: PROFIL });
    mockNutritionProfile.mockReturnValue({ nutritionProfile: { trainingDayBonus: -200 } });
    mockSessions.mockReturnValue({ items: [{ scheduledDate: AUJOURDHUI }] });
    await afficher();

    // Une donnée aberrante ne doit pas produire un budget de jour de séance INFÉRIEUR à un jour
    // de repos — l'utilisateur verrait sa cible baisser en s'entraînant.
    expect(carte(AUJOURDHUI).bonus).toBe(0);
    expect(carte(AUJOURDHUI).cible).toBe(carte(LUNDI).cible);
  });

  it('un jour sans séance n’a pas de bonus', async () => {
    mockProfile.mockReturnValue({ profile: PROFIL });
    mockNutritionProfile.mockReturnValue({ nutritionProfile: { trainingDayBonus: 300 } });
    mockSessions.mockReturnValue({ items: [{ scheduledDate: AUJOURDHUI }] });
    await afficher();

    expect(carte(LUNDI).bonus).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Actions sur une entrée
// ---------------------------------------------------------------------------

describe('actions sur une entrée', () => {
  it('🔴 « j’ai mangé ça » est la SEULE action qui touche au journal', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getByLabelText('manger-pe-1'));

    // Règle R1 : cet écran est une intention. Planifier n'écrit rien dans le journal ; seule
    // cette action crée des `food_entries`.
    expect(mockConsume).toHaveBeenCalledWith('pe-1');
  });

  it('🔴 l’action est RÉVERSIBLE (R2/R3)', async () => {
    await afficher({ entries: [entree({ consumedAt: '2026-08-12T12:30:00.000Z' })] });

    await taper(screen.getByLabelText('annuler-pe-1'));

    // Sans annulation, une erreur de manipulation laisserait des calories fantômes dans le journal,
    // à supprimer à la main depuis un autre écran.
    expect(mockUndo).toHaveBeenCalledWith('pe-1');
  });

  it('retirer une entrée planifiée ne passe pas par le journal', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getByLabelText('retirer-pe-1'));

    expect(mockRemove).toHaveBeenCalledWith('pe-1');
    expect(mockConsume).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Duplication de la semaine
// ---------------------------------------------------------------------------

describe('duplication', () => {
  it('🔴 rien à dupliquer : une EXPLICATION, pas un bouton inerte', async () => {
    await afficher({ countPrecedente: 0 });

    // Arbitrage Florian du 04/08/2026 : sans cette garde, l'appel « réussissait » en ne copiant
    // rien, sans le moindre retour. Un bouton grisé sans explication est pire qu'un bouton absent.
    expect(screen.queryByLabelText('mealPlan.duplicateWeek.action')).toBeNull();
    expect(screen.getByText('mealPlan.duplicateWeek.emptySource')).toBeTruthy();
  });

  it('semaine précédente remplie : le bouton apparaît et copie dans le bon sens', async () => {
    await afficher({ countPrecedente: 5 });

    await taper(screen.getByLabelText('mealPlan.duplicateWeek.action'));

    // Source → destination : inverser écraserait la semaine qu'on vient de composer.
    expect(mockDuplicate).toHaveBeenCalledWith('2026-08-03', LUNDI);
  });

  it('🔴 c’est la semaine précédant celle AFFICHÉE qui est consultée', async () => {
    await afficher({ countPrecedente: 5 });

    await taper(screen.getByLabelText('mealPlan.week.nextA11y'));

    // En naviguant, la « semaine précédente » change : consulter toujours celle d'aujourd'hui
    // proposerait de dupliquer une semaine sans rapport avec ce qu'on regarde.
    expect(mockCount).toHaveBeenLastCalledWith(LUNDI);
  });
});

// ---------------------------------------------------------------------------
// Liste de courses
// ---------------------------------------------------------------------------

describe('liste de courses', () => {
  it('🔴 aucun bouton tant que la semaine est vide', async () => {
    await afficher();

    // Générer une liste de courses vide n'a aucun sens.
    expect(screen.queryByLabelText('mealPlan.shopping.open')).toBeNull();
  });

  it('la liste s’ouvre SUR la semaine affichée', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getByLabelText('mealPlan.shopping.open'));

    // Sans le paramètre, la liste porterait toujours sur la semaine courante — et l'utilisateur
    // ferait ses courses pour la mauvaise.
    expect(push).toHaveBeenCalledWith(`/meal-plan/shopping?week=${LUNDI}`);
  });
});

// ---------------------------------------------------------------------------
// Feuille d'ajout
// ---------------------------------------------------------------------------

describe('feuille d’ajout', () => {
  const ouvrir = async () => {
    await taper(screen.getByLabelText(`ajouter-${AUJOURDHUI}`));
  };

  it('s’ouvre sur l’onglet recettes, avec le repas visé dans le titre', async () => {
    mockRecipes.mockReturnValue({ recipes: [recette] });
    await afficher();

    await ouvrir();

    // Le repas visé est la seule chose qui distingue deux ouvertures successives : sans lui, on
    // ne sait pas si l'on ajoute au déjeuner ou au dîner.
    expect(screen.getByText('mealPlan.add.title:{"meal":"journal.meals.lunch"}')).toBeTruthy();
    expect(screen.getByText('Curry')).toBeTruthy();
  });

  it('🔴 rien ne peut être ajouté tant que RIEN n’est sélectionné', async () => {
    mockRecipes.mockReturnValue({ recipes: [recette] });
    await afficher();
    await ouvrir();

    expect(
      screen.getByLabelText('mealPlan.add.confirm:{"kcal":0}').props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('🔴 une recette est prévisualisée AU PRORATA des portions (R8)', async () => {
    mockRecipes.mockReturnValue({ recipes: [recette] });
    await afficher();
    await ouvrir();

    await taper(screen.getByText('Curry'));
    // 2000 kcal pour 4 parts → 500 la part.
    expect(screen.getByLabelText('mealPlan.add.confirm:{"kcal":500}')).toBeTruthy();

    await taper(screen.getByLabelText('mealPlan.add.servingsPlus'));
    expect(screen.getByLabelText('mealPlan.add.confirm:{"kcal":1000}')).toBeTruthy();
  });

  it('🔴 les portions ne descendent jamais sous 1', async () => {
    mockRecipes.mockReturnValue({ recipes: [recette] });
    await afficher();
    await ouvrir();
    await taper(screen.getByText('Curry'));

    await taper(screen.getByLabelText('mealPlan.add.servingsMinus'));
    await taper(screen.getByLabelText('mealPlan.add.servingsMinus'));

    // Planifier zéro portion d'un plat est une ligne qui n'apporte rien et fausse les totaux.
    expect(screen.getByLabelText('mealPlan.add.confirm:{"kcal":500}')).toBeTruthy();
  });

  it('confirmer planifie la recette sur le JOUR et le REPAS visés', async () => {
    mockRecipes.mockReturnValue({ recipes: [recette] });
    await afficher();
    await ouvrir();
    await taper(screen.getByText('Curry'));
    await taper(screen.getByLabelText('mealPlan.add.servingsPlus'));
    await taper(screen.getByLabelText('mealPlan.add.confirm:{"kcal":1000}'));

    expect(mockPlanRecipe).toHaveBeenCalledWith(AUJOURDHUI, 'lunch', 'r-1', 2);
  });

  it('🔴 un repas type n’a PAS de portions (décision D1)', async () => {
    mockTemplates.mockReturnValue({ templates: [modele] });
    await afficher();
    await ouvrir();
    await taper(screen.getByLabelText('mealPlan.add.templates'));
    await taper(screen.getByText('Petit-déj type'));

    // Un repas type est une composition figée : « 2 portions de petit-déjeuner type » ne veut rien
    // dire, et le stepper suggérerait une mise à l'échelle que le modèle ne porte pas.
    expect(screen.queryByLabelText('mealPlan.add.servingsPlus')).toBeNull();
    expect(screen.getByLabelText('mealPlan.add.confirm:{"kcal":450}')).toBeTruthy();
  });

  it('confirmer un repas type le planifie sans portion', async () => {
    mockTemplates.mockReturnValue({ templates: [modele] });
    await afficher();
    await ouvrir();
    await taper(screen.getByLabelText('mealPlan.add.templates'));
    await taper(screen.getByText('Petit-déj type'));
    await taper(screen.getByLabelText('mealPlan.add.confirm:{"kcal":450}'));

    expect(mockPlanTemplate).toHaveBeenCalledWith(AUJOURDHUI, 'lunch', 'tpl-1');
  });

  it('🔴 changer d’onglet RÉINITIALISE la sélection', async () => {
    mockRecipes.mockReturnValue({ recipes: [recette] });
    mockTemplates.mockReturnValue({ templates: [modele] });
    await afficher();
    await ouvrir();
    await taper(screen.getByText('Curry'));

    await taper(screen.getByLabelText('mealPlan.add.templates'));

    // Sans cette remise à zéro, l'identifiant d'une recette resterait sélectionné sous l'onglet
    // « repas types » : on planifierait un modèle avec l'identifiant d'une recette.
    expect(
      screen.getByLabelText('mealPlan.add.confirm:{"kcal":0}').props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('chaque onglet vide a SON message', async () => {
    await afficher();
    await ouvrir();

    expect(screen.getByText('mealPlan.add.noRecipe')).toBeTruthy();
    await taper(screen.getByLabelText('mealPlan.add.templates'));
    expect(screen.getByText('mealPlan.add.noTemplate')).toBeTruthy();
  });
});

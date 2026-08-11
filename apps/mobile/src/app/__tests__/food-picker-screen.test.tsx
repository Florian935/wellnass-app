/**
 * Sélecteur d'aliment (`app/food-picker.tsx`) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier (117 instructions), et **il porte un défaut déjà constaté en
 * recette device** (01/08/2026) : ouvert en lien direct `wellness://food-picker`, sans paramètre
 * `date`, il écrivait des entrées rattachées à **aucune journée** — sans erreur, comptées par le
 * bandeau « N aliments ajoutés », et invisibles dans tous les journaux. Le repli sur *aujourd'hui*
 * est le correctif ; ce fichier est le test qui l'empêche de repartir.
 *
 * Les autres décisions vérifiées :
 *
 *  1. **Deux modes dans un seul écran.** En mode `recipe`, on compose une recette : pas d'ajout
 *     rapide, pas de scan, pas d'onglets « récents / recettes / modèles », et on **quitte** après
 *     l'ajout. En mode `journal`, on enchaîne les ajouts sans quitter (4.16).
 *  2. **La déduplication OpenFoodFacts par code-barres.** Sans elle, chaque import recrée une ligne
 *     `foods` : la base de l'utilisateur se remplit de doublons du même produit, et ses « récents »
 *     deviennent illisibles.
 *  3. **Seuls les aliments de l'utilisateur sont modifiables** (`custom` / `openfoodfacts`).
 *     Proposer « supprimer » sur une ligne CIQUAL offrirait une action qui échouera côté RLS.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import FoodPickerScreen from '../food-picker';
import {
  deleteFood,
  findFoodByBarcode,
  importOpenFoodFactsFood,
  toggleFoodFavorite,
  useFavoriteFoods,
  useFoods,
  useRecentFoods,
} from '@/data/repositories/food-repository';
import { addFoodEntry } from '@/data/repositories/journal-repository';
import { addRecipeIngredient, useRecipes } from '@/data/repositories/recipe-repository';
import { applyTemplate, useMealTemplates } from '@/data/repositories/meal-template-repository';
import { searchOpenFoodFacts } from '@/lib/openfoodfacts';
import { useTodayKey } from '@/hooks/useTodayKey';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/food-repository', () => ({
  useFoods: jest.fn(() => ({ foods: [] })),
  useFavoriteFoods: jest.fn(() => ({ foods: [] })),
  useRecentFoods: jest.fn(() => ({ foods: [] })),
  findFoodByBarcode: jest.fn(),
  importOpenFoodFactsFood: jest.fn(),
  toggleFoodFavorite: jest.fn(),
  deleteFood: jest.fn(),
  // Fonction PURE reprise telle quelle : la stubber ne prouverait que l'appel, et c'est elle qui
  // décide si une ligne peut être modifiée.
  isEditableFood: (source: string) => source === 'custom' || source === 'openfoodfacts',
}));
jest.mock('@/data/repositories/journal-repository', () => ({ addFoodEntry: jest.fn() }));
jest.mock('@/data/repositories/recipe-repository', () => ({
  useRecipes: jest.fn(() => ({ recipes: [] })),
  addRecipeIngredient: jest.fn(),
}));
jest.mock('@/data/repositories/meal-template-repository', () => ({
  useMealTemplates: jest.fn(() => ({ templates: [] })),
  applyTemplate: jest.fn(),
}));
jest.mock('@/lib/openfoodfacts', () => ({ searchOpenFoodFacts: jest.fn() }));
jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: jest.fn(() => '2026-08-12') }));

/** Le panneau de quantité a ses propres tests : sonde, avec un bouton de confirmation à 150 g. */
jest.mock('@/components/QuantityPanel', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    QuantityPanel: ({
      target,
      onCancel,
      onConfirm,
    }: {
      target: { name: string };
      onCancel: () => void;
      onConfirm: (g: number) => void;
    }) => (
      <View>
        <Text>quantite:{target.name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="confirmer-150" onPress={() => onConfirm(150)}>
          <Text>confirmer</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="annuler-quantite" onPress={onCancel}>
          <Text>annuler</Text>
        </Pressable>
      </View>
    ),
  };
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
jest.mock('@/components/TextField', () => {
  const { TextInput } = require('react-native');
  return {
    TextField: ({
      label,
      value,
      onChangeText,
    }: {
      label: string;
      value: string;
      onChangeText: (v: string) => void;
    }) => <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} />,
  };
});
jest.mock('@/components/Segment', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Segment: <T,>({
      options,
      value,
      onChange,
      label,
    }: {
      options: readonly T[];
      value: T;
      onChange: (v: T) => void;
      label: (o: T) => string;
    }) =>
      options.map((o) => (
        <Pressable
          key={String(o)}
          accessibilityRole="button"
          accessibilityLabel={`onglet-${String(o)}`}
          accessibilityState={{ selected: o === value }}
          onPress={() => onChange(o)}
        >
          <Text>{label(o)}</Text>
        </Pressable>
      )),
  };
});

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
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
      accent: '#c0562f',
      success: '#7c8a5b',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockFoods = useFoods as jest.Mock;
const mockFavorites = useFavoriteFoods as jest.Mock;
const mockRecent = useRecentFoods as jest.Mock;
const mockFindByBarcode = findFoodByBarcode as jest.Mock;
const mockImportOff = importOpenFoodFactsFood as jest.Mock;
const mockToggleFavorite = toggleFoodFavorite as jest.Mock;
const mockDeleteFood = deleteFood as jest.Mock;
const mockAddEntry = addFoodEntry as jest.Mock;
const mockRecipes = useRecipes as jest.Mock;
const mockAddIngredient = addRecipeIngredient as jest.Mock;
const mockTemplates = useMealTemplates as jest.Mock;
const mockApplyTemplate = applyTemplate as jest.Mock;
const mockSearchOff = searchOpenFoodFacts as jest.Mock;
const mockToday = useTodayKey as jest.Mock;
const mockParams = useLocalSearchParams as unknown as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();
const back = jest.fn();

const aliment = (overrides: Record<string, unknown> = {}) => ({
  id: 'f-1',
  name: 'Banane',
  category: 'fruits',
  source: 'ciqual',
  kcalPer100g: 89,
  proteinPer100g: 1.1,
  carbsPer100g: 22.8,
  sugarsPer100g: 12.2,
  fatPer100g: 0.3,
  saturatedFatPer100g: 0.1,
  fiberPer100g: 2.6,
  portions: [],
  micronutrients: {},
  isFavorite: false,
  ...overrides,
});

const afficher = async ({
  params = { date: '2026-08-10', meal: 'lunch' } as Record<string, string>,
  foods = [aliment()] as unknown[],
} = {}) => {
  mockParams.mockReturnValue(params);
  mockFoods.mockReturnValue({ foods });
  await render(<FoodPickerScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const saisir = async (label: string, valeur: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText(label), valeur);
  });
};

let boutonsAlerte: { text?: string; style?: string; onPress?: () => void }[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  boutonsAlerte = [];
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, boutons) => {
    boutonsAlerte = (boutons ?? []) as typeof boutonsAlerte;
  });
  mockUseRouter.mockReturnValue({ push, back });
  mockToday.mockReturnValue('2026-08-12');
  mockFavorites.mockReturnValue({ foods: [] });
  mockRecent.mockReturnValue({ foods: [] });
  mockRecipes.mockReturnValue({ recipes: [] });
  mockTemplates.mockReturnValue({ templates: [] });
  mockAddEntry.mockResolvedValue(undefined);
  mockAddIngredient.mockResolvedValue(undefined);
  mockApplyTemplate.mockResolvedValue(undefined);
  mockImportOff.mockResolvedValue('f-off');
  mockFindByBarcode.mockResolvedValue(null);
  mockSearchOff.mockResolvedValue([]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Le défaut du lien direct
// ---------------------------------------------------------------------------

describe('paramètres d’entrée', () => {
  it('🔴 sans `date`, l’entrée est rattachée à AUJOURD’HUI, jamais à rien', async () => {
    await afficher({ params: {} });

    await taper(screen.getByText('Banane'));
    await taper(screen.getByLabelText('confirmer-150'));

    // Défaut de recette device du 01/08/2026 : `wellness://food-picker` ouvert en lien direct
    // écrivait des entrées rattachées à aucune journée — sans erreur, comptées par le bandeau, et
    // invisibles dans tous les journaux. Un écran qui accuse réception d'un enregistrement fantôme
    // est pire qu'un écran qui échoue.
    expect(mockAddEntry).toHaveBeenCalledWith('2026-08-12', expect.anything(), expect.anything());
  });

  it('🔴 sans `meal`, l’entrée tombe au petit-déjeuner, pas dans un repas vide', async () => {
    await afficher({ params: { date: '2026-08-10' } });

    await taper(screen.getByText('Banane'));
    await taper(screen.getByLabelText('confirmer-150'));

    // Une `mealType` vide produirait une entrée orpheline dès sa création — le journal la
    // remonterait dans « Autres » alors que l'utilisateur n'a rien fait de spécial.
    expect(mockAddEntry).toHaveBeenCalledWith('2026-08-10', 'breakfast', expect.anything());
  });

  it('les paramètres fournis sont respectés', async () => {
    await afficher({ params: { date: '2026-08-10', meal: 'dinner' } });

    await taper(screen.getByText('Banane'));
    await taper(screen.getByLabelText('confirmer-150'));

    expect(mockAddEntry).toHaveBeenCalledWith('2026-08-10', 'dinner', expect.anything());
  });
});

// ---------------------------------------------------------------------------
// Ajout d'un aliment
// ---------------------------------------------------------------------------

describe('ajout depuis la liste', () => {
  it('🔴 le snapshot est MIS À L’ÉCHELLE de la quantité', async () => {
    await afficher({ foods: [aliment({ kcalPer100g: 100, proteinPer100g: 10 })] });

    await taper(screen.getByText('Banane'));
    await taper(screen.getByLabelText('confirmer-150'));

    // Les valeurs sont pour 100 g en base ; l'entrée journalise ce qui a été mangé. Sans mise à
    // l'échelle, 150 g de banane compteraient pour 100 g — durablement, puisque le snapshot est figé.
    expect(mockAddEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ foodId: 'f-1', quantityG: 150, kcal: 150, proteinG: 15 }),
    );
  });

  it('🔴 le compteur cumule les ajouts SANS quitter l’écran', async () => {
    await afficher();

    await taper(screen.getByText('Banane'));
    await taper(screen.getByLabelText('confirmer-150'));

    // 4.16 : on compose un repas en plusieurs aliments. Refermer après chaque ajout obligerait à
    // rouvrir le picker autant de fois qu'il y a d'aliments.
    expect(screen.getByText('journal.addedCount:{"count":1}')).toBeTruthy();
    expect(back).not.toHaveBeenCalled();

    await taper(screen.getByText('Banane'));
    await taper(screen.getByLabelText('confirmer-150'));
    expect(screen.getByText('journal.addedCount:{"count":2}')).toBeTruthy();
  });

  it('« terminé » referme l’écran', async () => {
    await afficher();

    await taper(screen.getByText('Banane'));
    await taper(screen.getByLabelText('confirmer-150'));
    await taper(screen.getByText('journal.done'));

    expect(back).toHaveBeenCalled();
  });

  it('aucun bandeau tant que rien n’a été ajouté', async () => {
    await afficher();

    expect(screen.queryByText(/addedCount/)).toBeNull();
  });

  it('annuler la quantité revient à la liste sans écrire', async () => {
    await afficher();

    await taper(screen.getByText('Banane'));
    await taper(screen.getByLabelText('annuler-quantite'));

    expect(mockAddEntry).not.toHaveBeenCalled();
    expect(screen.getByText('Banane')).toBeTruthy();
  });

  it('mettre en favori n’ajoute rien au journal', async () => {
    await afficher();

    await taper(screen.getAllByLabelText('favorite')[0]!);

    // L'étoile est dans la ligne : sans `hitSlop` et gestion propre, elle déclencherait aussi la
    // sélection de l'aliment et ouvrirait le panneau de quantité.
    expect(mockToggleFavorite).toHaveBeenCalledWith('f-1');
    expect(screen.queryByText(/^quantite:/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Onglets
// ---------------------------------------------------------------------------

describe('onglets', () => {
  it('la recherche n’est offerte que sur « tous »', async () => {
    await afficher();
    expect(screen.getByLabelText('journal.searchFood')).toBeTruthy();

    await taper(screen.getByLabelText('onglet-favorites'));

    // Favoris et récents sont des listes courtes et déjà filtrées : un champ de recherche y
    // suggérerait un corpus qui n'existe pas.
    expect(screen.queryByLabelText('journal.searchFood')).toBeNull();
  });

  it('chaque onglet lit SA source', async () => {
    mockFavorites.mockReturnValue({ foods: [aliment({ id: 'fav', name: 'Favori' })] });
    mockRecent.mockReturnValue({ foods: [aliment({ id: 'rec', name: 'Récent' })] });
    await afficher();

    await taper(screen.getByLabelText('onglet-favorites'));
    expect(screen.getByText('Favori')).toBeTruthy();

    await taper(screen.getByLabelText('onglet-recent'));
    expect(screen.getByText('Récent')).toBeTruthy();
  });

  it('🔴 « récents » vide a son PROPRE message', async () => {
    await afficher();

    await taper(screen.getByLabelText('onglet-recent'));

    // « Aucun aliment » sur l'onglet récents serait faux : la base en contient des milliers, c'est
    // l'historique de l'utilisateur qui est vide.
    expect(screen.getByText('journal.noRecent')).toBeTruthy();
  });

  it('la recherche filtre la base UNIQUEMENT sur l’onglet « tous »', async () => {
    await afficher();

    await saisir('journal.searchFood', 'banane');
    expect(mockFoods).toHaveBeenLastCalledWith('banane');

    await taper(screen.getByLabelText('onglet-favorites'));

    // Sinon les favoris seraient silencieusement filtrés par un terme saisi dans un autre onglet.
    expect(mockFoods).toHaveBeenLastCalledWith(undefined);
  });
});

// ---------------------------------------------------------------------------
// OpenFoodFacts
// ---------------------------------------------------------------------------

describe('OpenFoodFacts', () => {
  it('🔴 la recherche distante n’est proposée qu’à partir de DEUX caractères', async () => {
    await afficher();

    await saisir('journal.searchFood', 'b');
    expect(screen.queryByText(/searchOff/)).toBeNull();

    await saisir('journal.searchFood', 'ba');
    // Une requête réseau sur une lettre renverrait des milliers de produits sans rapport, et
    // partirait à chaque frappe.
    expect(screen.getByText('journal.searchOff:{"term":"ba"}')).toBeTruthy();
  });

  it('🔴 un produit DÉJÀ en base est réutilisé, jamais réimporté', async () => {
    mockSearchOff.mockResolvedValue([
      { name: 'Yaourt', barcode: '123', kcalPer100g: 60, proteinPer100g: 4 },
    ]);
    mockFindByBarcode.mockResolvedValue(aliment({ id: 'deja-la', name: 'Yaourt (base)' }));
    await afficher();

    await saisir('journal.searchFood', 'yaourt');
    await taper(screen.getByLabelText('journal.searchOff:{"term":"yaourt"}'));
    await taper(screen.getByText('Yaourt'));

    // Sans cette dédup, chaque import recrée une ligne `foods` : la base de l'utilisateur se
    // remplit de doublons du même produit et ses « récents » deviennent illisibles.
    expect(mockImportOff).not.toHaveBeenCalled();
    expect(screen.getByText('quantite:Yaourt (base)')).toBeTruthy();
  });

  it('un produit inconnu est importé une fois', async () => {
    mockSearchOff.mockResolvedValue([
      { name: 'Yaourt', barcode: '123', kcalPer100g: 60, proteinPer100g: 4 },
    ]);
    await afficher();

    await saisir('journal.searchFood', 'yaourt');
    await taper(screen.getByLabelText('journal.searchOff:{"term":"yaourt"}'));
    await taper(screen.getByText('Yaourt'));

    expect(mockImportOff).toHaveBeenCalledWith(expect.objectContaining({ barcode: '123' }));
    expect(screen.getByText('quantite:Yaourt')).toBeTruthy();
  });

  it('🔴 un produit SANS code-barres ne déclenche aucune recherche de doublon', async () => {
    mockSearchOff.mockResolvedValue([{ name: 'Vrac', barcode: null, kcalPer100g: 300 }]);
    await afficher();

    await saisir('journal.searchFood', 'vrac');
    await taper(screen.getByLabelText('journal.searchOff:{"term":"vrac"}'));
    await taper(screen.getByText('Vrac'));

    // Chercher par `null` remonterait le premier produit sans code-barres de la base — un aliment
    // sans rapport, proposé à la place de celui qu'on vient de choisir.
    expect(mockFindByBarcode).not.toHaveBeenCalled();
    expect(mockImportOff).toHaveBeenCalled();
  });

  it('une recherche distante sans résultat le dit', async () => {
    await afficher();

    await saisir('journal.searchFood', 'zzzz');
    await taper(screen.getByLabelText('journal.searchOff:{"term":"zzzz"}'));

    expect(screen.getByText('journal.offNone')).toBeTruthy();
  });

  it('🔴 modifier la recherche EFFACE les résultats distants précédents', async () => {
    mockSearchOff.mockResolvedValue([{ name: 'Yaourt', barcode: '1', kcalPer100g: 60 }]);
    await afficher();

    await saisir('journal.searchFood', 'yaourt');
    await taper(screen.getByLabelText('journal.searchOff:{"term":"yaourt"}'));
    expect(screen.getByText('Yaourt')).toBeTruthy();

    await saisir('journal.searchFood', 'pomme');

    // Sinon les résultats de « yaourt » resteraient affichés sous une recherche « pomme » : on
    // ajouterait le mauvais produit en croyant lire la bonne liste.
    expect(screen.queryByText('Yaourt')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Aliments modifiables
// ---------------------------------------------------------------------------

describe('menu d’un aliment', () => {
  it('🔴 un aliment CIQUAL n’offre aucun menu', async () => {
    await afficher({ foods: [aliment({ source: 'ciqual' })] });

    await act(async () => {
      fireEvent(screen.getByText('Banane'), 'longPress');
    });

    // Proposer « supprimer » sur une ligne de la base publique offrirait une action que la RLS
    // refusera — un échec silencieux, du point de vue de l'utilisateur.
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it.each(['custom', 'openfoodfacts'])('un aliment %s offre modifier et supprimer', async (source) => {
    await afficher({ foods: [aliment({ source })] });

    await act(async () => {
      fireEvent(screen.getByText('Banane'), 'longPress');
    });

    expect(boutonsAlerte.map((b) => b.text)).toEqual(
      expect.arrayContaining(['food.edit', 'food.delete']),
    );
  });

  it('modifier ouvre l’éditeur SUR cet aliment', async () => {
    await afficher({ foods: [aliment({ source: 'custom' })] });

    await act(async () => {
      fireEvent(screen.getByText('Banane'), 'longPress');
    });
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'food.edit')?.onPress?.();
    });

    expect(push).toHaveBeenCalledWith({ pathname: '/food-custom', params: { foodId: 'f-1' } });
  });

  it('🔴 supprimer demande une SECONDE confirmation', async () => {
    await afficher({ foods: [aliment({ source: 'custom' })] });

    await act(async () => {
      fireEvent(screen.getByText('Banane'), 'longPress');
    });
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'food.delete')?.onPress?.();
    });

    // Le menu long-press est déclenché par un geste involontaire courant : la première pression
    // sur « Supprimer » ne peut pas être la dernière.
    expect(mockDeleteFood).not.toHaveBeenCalled();

    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'food.delete')?.onPress?.();
    });
    expect(mockDeleteFood).toHaveBeenCalledWith('f-1');
  });
});

// ---------------------------------------------------------------------------
// Ajout rapide
// ---------------------------------------------------------------------------

describe('ajout rapide', () => {
  it('🔴 sans calories, l’ajout est impossible', async () => {
    await afficher();

    await taper(screen.getByLabelText('journal.quickAdd'));

    // Une entrée à 0 kcal ne compte nulle part : elle n'ajouterait qu'une ligne au journal.
    expect(screen.getByLabelText('journal.add').props.accessibilityState.disabled).toBe(true);
  });

  it('🔴 un nom vide retombe sur « ajout rapide »', async () => {
    await afficher();

    await taper(screen.getByLabelText('journal.quickAdd'));
    await saisir('nutrition.calories.title (nutrition.kcal)', '450');
    await taper(screen.getByLabelText('journal.add'));

    // Une ligne sans nom dans le journal est inidentifiable le lendemain.
    expect(mockAddEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ name: 'journal.quickAdd', quantityG: null, kcal: 450 }),
    );
  });

  it('les macros saisies sont enregistrées, les négatives ramenées à zéro', async () => {
    await afficher();

    await taper(screen.getByLabelText('journal.quickAdd'));
    await saisir('nutrition.calories.title (nutrition.kcal)', '450');
    await saisir('nutrition.macros.protein (g)', '30');
    await saisir('nutrition.macros.fat (g)', '-5');
    await taper(screen.getByLabelText('journal.add'));

    expect(mockAddEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ proteinG: 30, fatG: 0 }),
    );
  });

  it('annuler revient à la liste', async () => {
    await afficher();

    await taper(screen.getByLabelText('journal.quickAdd'));
    await taper(screen.getByLabelText('common.cancel'));

    expect(screen.getByText('Banane')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Recettes et modèles de repas
// ---------------------------------------------------------------------------

describe('recettes et modèles', () => {
  const recette = {
    id: 'r-1',
    name: 'Curry',
    servings: 4,
    totalKcal: 2000,
    totalProteinG: 100,
    totalCarbsG: 200,
    totalFatG: 80,
  };

  it('🔴 une recette affiche ses valeurs PAR PART, pas au total', async () => {
    mockRecipes.mockReturnValue({ recipes: [recette] });
    await afficher();

    await taper(screen.getByLabelText('onglet-recipes'));

    // 2000 kcal affichés pour un curry de quatre parts ferait renoncer à le journaliser.
    expect(screen.getByText('500 nutrition.kcal / recipes.serving')).toBeTruthy();
  });

  it('🔴 ajouter N parts multiplie les valeurs d’UNE part', async () => {
    mockRecipes.mockReturnValue({ recipes: [recette] });
    await afficher();

    await taper(screen.getByLabelText('onglet-recipes'));
    await taper(screen.getByText('Curry'));
    await saisir('recipes.servingsToAdd', '2');
    await taper(screen.getByLabelText('journal.add'));

    expect(mockAddEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ foodId: null, name: 'Curry', quantityG: null, kcal: 1000 }),
    );
  });

  it('🔴 zéro part ne peut pas être ajouté', async () => {
    mockRecipes.mockReturnValue({ recipes: [recette] });
    await afficher();

    await taper(screen.getByLabelText('onglet-recipes'));
    await taper(screen.getByText('Curry'));
    await saisir('recipes.servingsToAdd', '0');

    expect(screen.getByLabelText('journal.add').props.accessibilityState.disabled).toBe(true);
  });

  it('🔴 appliquer un modèle de repas QUITTE l’écran', async () => {
    mockTemplates.mockReturnValue({
      templates: [{ id: 'tpl-1', name: 'Petit-déj type', totalKcal: 450, itemCount: 3 }],
    });
    await afficher();

    await taper(screen.getByLabelText('onglet-templates'));
    await taper(screen.getByText('Petit-déj type'));

    // Un modèle ajoute plusieurs aliments d'un coup : rester sur le picker après ça inviterait à
    // l'appliquer une seconde fois sans s'en rendre compte.
    expect(mockApplyTemplate).toHaveBeenCalledWith('tpl-1', '2026-08-10', 'lunch');
    expect(back).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Mode « composition de recette »
// ---------------------------------------------------------------------------

describe('mode recette', () => {
  const enModeRecette = { mode: 'recipe', recipeId: 'r-9' };

  it('🔴 l’ingrédient va dans la RECETTE, et l’écran se ferme', async () => {
    await afficher({ params: enModeRecette });

    await taper(screen.getByText('Banane'));
    await taper(screen.getByLabelText('confirmer-150'));

    // On compose une recette, pas une journée : l'écrire dans le journal ajouterait chaque
    // ingrédient aux calories du jour.
    expect(mockAddIngredient).toHaveBeenCalledWith('r-9', expect.objectContaining({ quantityG: 150 }));
    expect(mockAddEntry).not.toHaveBeenCalled();
    expect(back).toHaveBeenCalled();
  });

  it('🔴 ni ajout rapide, ni scan, ni liste rapide en mode recette', async () => {
    await afficher({ params: enModeRecette });

    // Ces trois entrées écrivent dans le journal du jour : elles n'ont pas de sens ici, et une
    // seule pression suffirait à polluer la journée.
    expect(screen.queryByLabelText('journal.quickAdd')).toBeNull();
    expect(screen.queryByLabelText('scan.title')).toBeNull();
    expect(screen.queryByLabelText('quickList.title')).toBeNull();
    expect(screen.getByLabelText('journal.createFood')).toBeTruthy();
  });

  it('🔴 seuls deux onglets, pas de recette DANS une recette', async () => {
    await afficher({ params: enModeRecette });

    expect(screen.getByLabelText('onglet-all')).toBeTruthy();
    expect(screen.getByLabelText('onglet-favorites')).toBeTruthy();
    // Imbriquer une recette dans une recette demanderait de résoudre une composition récursive
    // que le modèle de données ne porte pas.
    expect(screen.queryByLabelText('onglet-recipes')).toBeNull();
    expect(screen.queryByLabelText('onglet-templates')).toBeNull();
  });

  it('aucun compteur d’ajouts en mode recette', async () => {
    await afficher({ params: enModeRecette });

    await taper(screen.getByText('Banane'));
    await taper(screen.getByLabelText('confirmer-150'));

    // L'écran est déjà fermé : un bandeau ne serait jamais vu.
    expect(screen.queryByText(/addedCount/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Raccourcis du pied d'écran
// ---------------------------------------------------------------------------

describe('raccourcis', () => {
  it.each([
    ['scan.title', '/food-scan'],
    ['quickList.title', '/meal-quick-entry'],
  ])('%s transmet le jour et le repas', async (label, pathname) => {
    await afficher();

    await taper(screen.getByLabelText(label));

    // Sans ces paramètres, un code-barres scanné atterrirait au petit-déjeuner d'aujourd'hui —
    // exactement le défaut du lien direct, par un autre chemin.
    expect(push).toHaveBeenCalledWith({
      pathname,
      params: { date: '2026-08-10', meal: 'lunch' },
    });
  });

  it('créer un aliment ouvre l’éditeur vierge', async () => {
    await afficher();

    await taper(screen.getByLabelText('journal.createFood'));

    expect(push).toHaveBeenCalledWith('/food-custom');
  });
});

/**
 * Création / édition d'un aliment personnel (`app/food-custom.tsx`) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier (81 instructions). Ce qu'il écrit est une **densité pour 100 g**,
 * réutilisée ensuite par toutes les pesées : une erreur ici ne se voit pas sur l'écran, elle se voit
 * des semaines plus tard dans des totaux faux, sans qu'on sache d'où ils viennent.
 *
 *  1. **Un aliment sans calories n'a pas de sens.** Le nom et les kcal sont requis ; le reste est
 *     facultatif, et un champ vide vaut **« non renseigné » (`null`)**, jamais `0`. « 0 g de
 *     protéines » est une affirmation ; ne rien savoir n'en est pas une.
 *  2. **Les valeurs négatives ou illisibles sont refusées, pas corrigées.** `parse` renvoie `null`
 *     hors de `[0, +∞[` : écrire `NaN` en base contaminerait chaque total où l'aliment apparaît.
 *  3. **Le même écran crée et modifie.** Avec `?foodId=`, il pré-remplit puis appelle `updateFood`
 *     au lieu de `addCustomFood` — se tromper de branche dupliquerait l'aliment à chaque correction.
 *  4. **Les micronutriments s'ouvrent d'eux-mêmes quand il y en a.** Un aliment OpenFoodFacts
 *     importé en porte souvent ; les laisser repliés les rendrait invisibles à la relecture.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import FoodCustomScreen from '../food-custom';
import { addCustomFood, getFood, updateFood } from '@/data/repositories/food-repository';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/food-repository', () => ({
  getFood: jest.fn(),
  addCustomFood: jest.fn(),
  updateFood: jest.fn(),
}));

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
      accentText: '#ffffff',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockGetFood = getFood as jest.Mock;
const mockAdd = addCustomFood as jest.Mock;
const mockUpdate = updateFood as jest.Mock;
const mockParams = useLocalSearchParams as unknown as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const back = jest.fn();

/** Libellés des champs, tels que le composant les compose. */
const CHAMP = {
  nom: 'journal.name',
  kcal: 'nutrition.calories.title (nutrition.kcal)',
  proteines: 'nutrition.macros.protein (g)',
  glucides: 'nutrition.macros.carbs (g)',
  lipides: 'nutrition.macros.fat (g)',
  sucres: 'food.custom.sugars (g)',
  satures: 'food.custom.saturatedFat (g)',
  fibres: 'food.custom.fiber (g)',
  sodium: 'nutrition.micros.labels.sodium_mg (nutrition.micros.units.mg)',
  vitamineD: 'nutrition.micros.labels.vitamin_d_ug (nutrition.micros.units.ug)',
} as const;

const alimentExistant = (overrides: Record<string, unknown> = {}) => ({
  id: 'f-1',
  name: 'Ma purée maison',
  category: 'starchy' as const,
  kcalPer100g: 120,
  proteinPer100g: 3,
  carbsPer100g: 18,
  sugarsPer100g: 2,
  fatPer100g: 4,
  saturatedFatPer100g: 1,
  fiberPer100g: 2,
  micronutrients: {},
  ...overrides,
});

const afficher = async (params: Record<string, string> = {}) => {
  mockParams.mockReturnValue(params);
  await render(<FoodCustomScreen />);
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

/** Remplit le minimum requis (nom + calories) puis enregistre. */
const remplirEtEnregistrer = async (
  champs: Partial<Record<keyof typeof CHAMP, string>> = {},
  bouton = 'food.custom.save',
) => {
  await saisir(CHAMP.nom, champs.nom ?? 'Ma purée');
  await saisir(CHAMP.kcal, champs.kcal ?? '120');
  for (const [cle, valeur] of Object.entries(champs)) {
    if (cle === 'nom' || cle === 'kcal') continue;
    await saisir(CHAMP[cle as keyof typeof CHAMP], valeur);
  }
  await taper(screen.getByLabelText(bouton));
};

/** L'objet réellement transmis au repository. */
const ecrit = (mock: jest.Mock) => mock.mock.calls[0]!.at(-1) as Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ back });
  mockGetFood.mockResolvedValue(null);
  mockAdd.mockResolvedValue('f-neuf');
  mockUpdate.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('validation', () => {
  it('🔴 sans nom ni calories, l’enregistrement est impossible', async () => {
    await afficher();

    expect(
      screen.getByLabelText('food.custom.save').props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('🔴 un nom seul ne suffit pas', async () => {
    await afficher();

    await saisir(CHAMP.nom, 'Ma purée');

    // Un aliment sans densité calorique ne sert à rien : il apparaîtrait dans les listes et
    // n'ajouterait jamais rien au journal.
    expect(
      screen.getByLabelText('food.custom.save').props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('🔴 des calories seules non plus', async () => {
    await afficher();

    await saisir(CHAMP.kcal, '120');

    expect(
      screen.getByLabelText('food.custom.save').props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('🔴 un nom fait d’espaces est refusé', async () => {
    await afficher();

    await saisir(CHAMP.nom, '   ');
    await saisir(CHAMP.kcal, '120');

    expect(
      screen.getByLabelText('food.custom.save').props.accessibilityState.disabled,
    ).toBe(true);
  });

  it.each(['0', '-50', 'abc', ''])('🔴 des calories « %s » sont refusées', async (valeur) => {
    await afficher();

    await saisir(CHAMP.nom, 'Ma purée');
    await saisir(CHAMP.kcal, valeur);

    // `> 0` : un aliment à 0 kcal fausserait toute journée où il apparaît, sans jamais le montrer.
    expect(
      screen.getByLabelText('food.custom.save').props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('nom et calories suffisent', async () => {
    await afficher();

    await saisir(CHAMP.nom, 'Ma purée');
    await saisir(CHAMP.kcal, '120');

    expect(
      screen.getByLabelText('food.custom.save').props.accessibilityState.disabled,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

describe('création', () => {
  it('enregistre les macros saisies', async () => {
    await afficher();

    await remplirEtEnregistrer({ proteines: '3', glucides: '18', lipides: '4' });

    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(ecrit(mockAdd)).toMatchObject({
      name: 'Ma purée',
      kcalPer100g: 120,
      proteinPer100g: 3,
      carbsPer100g: 18,
      fatPer100g: 4,
    });
  });

  it('🔴 un champ VIDE vaut « non renseigné », jamais zéro', async () => {
    await afficher();

    await remplirEtEnregistrer({ proteines: '3' });

    // « 0 g de lipides » est une affirmation ; ne rien savoir n'en est pas une. Le `null` est ce
    // qui permet à l'affichage de dire « — » plutôt que d'inventer.
    expect(ecrit(mockAdd)).toMatchObject({
      proteinPer100g: 3,
      carbsPer100g: null,
      fatPer100g: null,
      sugarsPer100g: null,
      saturatedFatPer100g: null,
      fiberPer100g: null,
    });
  });

  it('🔴 une valeur NÉGATIVE est rejetée, pas ramenée à zéro', async () => {
    await afficher();

    await remplirEtEnregistrer({ proteines: '-5' });

    // La ramener à 0 masquerait la faute de frappe ; `null` laisse le champ visiblement vide au
    // prochain passage.
    expect(ecrit(mockAdd)).toMatchObject({ proteinPer100g: null });
  });

  it('🔴 une valeur ILLISIBLE ne devient pas `NaN`', async () => {
    await afficher();

    await remplirEtEnregistrer({ glucides: 'douze' });

    // `NaN` en base contaminerait chaque total où l'aliment apparaît, et resterait invisible
    // jusqu'à ce qu'un écran affiche « NaN kcal ».
    expect(ecrit(mockAdd)).toMatchObject({ carbsPer100g: null });
  });

  it('la virgule décimale est acceptée', async () => {
    await afficher();

    await remplirEtEnregistrer({ lipides: '4,5' });

    // Le pavé décimal FR produit une virgule : la refuser rendrait la moitié des saisies fausses.
    expect(ecrit(mockAdd)).toMatchObject({ fatPer100g: 4.5 });
  });

  it('🔴 un ZÉRO explicite, lui, est conservé', async () => {
    await afficher();

    await remplirEtEnregistrer({ lipides: '0' });

    // Distinction essentielle avec le champ vide : « 0 g de lipides » est une information réelle
    // pour un fruit ou une boisson.
    expect(ecrit(mockAdd)).toMatchObject({ fatPer100g: 0 });
  });

  it('la catégorie par défaut est « autre »', async () => {
    await afficher();

    await remplirEtEnregistrer();

    // Forcer un choix sur un formulaire déjà long ferait abandonner ; « autre » est honnête.
    expect(ecrit(mockAdd)).toMatchObject({ category: 'other' });
  });

  it('choisir une catégorie la transmet, et l’annonce comme sélectionnée', async () => {
    await afficher();

    await taper(screen.getByLabelText('food.categories.fruits'));
    expect(
      screen.getByLabelText('food.categories.fruits').props.accessibilityState.selected,
    ).toBe(true);

    await remplirEtEnregistrer();
    expect(ecrit(mockAdd)).toMatchObject({ category: 'fruits' });
  });

  it('l’écran se referme après l’enregistrement', async () => {
    await afficher();

    await remplirEtEnregistrer();

    expect(back).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Micronutriments
// ---------------------------------------------------------------------------

describe('micronutriments', () => {
  it('🔴 la section est REPLIÉE par défaut sur un aliment neuf', async () => {
    await afficher();

    // Onze champs facultatifs dépliés d'office donneraient un formulaire décourageant pour un
    // besoin qui concerne une minorité de saisies.
    expect(screen.queryByLabelText(CHAMP.sodium)).toBeNull();
  });

  it('elle s’ouvre au tap', async () => {
    await afficher();

    await taper(screen.getByText('nutrition.micros.title'));

    expect(screen.getByLabelText(CHAMP.sodium)).toBeTruthy();
  });

  it('🔴 seuls les micros RENSEIGNÉS sont enregistrés', async () => {
    await afficher();

    await taper(screen.getByText('nutrition.micros.title'));
    await remplirEtEnregistrer({ sodium: '450' });

    // Écrire les onze clés à zéro rendrait tout aliment « complet » et masquerait, à l'affichage,
    // la différence entre « aucun sodium » et « sodium inconnu ».
    expect(ecrit(mockAdd).micronutrients).toEqual({ sodium_mg: 450 });
  });

  it('aucun micro renseigné donne un objet vide, pas des `null`', async () => {
    await afficher();

    await remplirEtEnregistrer();

    expect(ecrit(mockAdd).micronutrients).toEqual({});
  });

  it('🔴 un micro négatif est ignoré', async () => {
    await afficher();

    await taper(screen.getByText('nutrition.micros.title'));
    await remplirEtEnregistrer({ sodium: '-3' });

    expect(ecrit(mockAdd).micronutrients).toEqual({});
  });

  it('les vitamines en microgrammes sont saisies dans leur unité', async () => {
    await afficher();

    await taper(screen.getByText('nutrition.micros.title'));
    await remplirEtEnregistrer({ vitamineD: '2,5' });

    // L'unité est dans le libellé : sans elle, 2,5 mg de vitamine D — mille fois la dose — passerait
    // pour une saisie normale.
    expect(ecrit(mockAdd).micronutrients).toEqual({ vitamin_d_ug: 2.5 });
  });
});

// ---------------------------------------------------------------------------
// Édition
// ---------------------------------------------------------------------------

describe('édition', () => {
  it('🔴 avec `foodId`, l’aliment est PRÉ-REMPLI', async () => {
    mockGetFood.mockResolvedValue(alimentExistant());
    await afficher({ foodId: 'f-1' });

    // Un formulaire vierge en mode édition obligerait à tout ressaisir — et effacerait ce qui
    // n'aurait pas été retapé.
    expect(screen.getByLabelText(CHAMP.nom).props.value).toBe('Ma purée maison');
    expect(screen.getByLabelText(CHAMP.kcal).props.value).toBe('120');
    expect(
      screen.getByLabelText('food.categories.starchy').props.accessibilityState.selected,
    ).toBe(true);
  });

  it('🔴 un champ absent en base reste VIDE, pas « null »', async () => {
    mockGetFood.mockResolvedValue(alimentExistant({ fiberPer100g: null }));
    await afficher({ foodId: 'f-1' });

    // `numToField` : afficher la chaîne « null » dans un champ de saisie la ferait enregistrer
    // telle quelle au prochain passage.
    expect(screen.getByLabelText(CHAMP.fibres).props.value).toBe('');
  });

  it('🔴 les micros existants OUVRENT la section', async () => {
    mockGetFood.mockResolvedValue(alimentExistant({ micronutrients: { sodium_mg: 450 } }));
    await afficher({ foodId: 'f-1' });

    // Un aliment OpenFoodFacts importé en porte souvent : repliés, ils seraient invisibles à la
    // relecture, et l'utilisateur croirait qu'ils manquent.
    expect(screen.getByLabelText(CHAMP.sodium).props.value).toBe('450');
  });

  it('sans micro, la section reste repliée même en édition', async () => {
    mockGetFood.mockResolvedValue(alimentExistant());
    await afficher({ foodId: 'f-1' });

    expect(screen.queryByLabelText(CHAMP.sodium)).toBeNull();
  });

  it('🔴 enregistrer MET À JOUR, ne crée pas un doublon', async () => {
    mockGetFood.mockResolvedValue(alimentExistant());
    await afficher({ foodId: 'f-1' });

    await taper(screen.getByLabelText('food.custom.update'));

    // Se tromper de branche dupliquerait l'aliment à chaque correction, et les anciennes entrées
    // de journal continueraient de pointer vers la version d'avant.
    expect(mockUpdate).toHaveBeenCalledWith('f-1', expect.objectContaining({ kcalPer100g: 120 }));
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('le libellé du bouton dit ce qu’il fait', async () => {
    mockGetFood.mockResolvedValue(alimentExistant());
    await afficher({ foodId: 'f-1' });

    expect(screen.getByLabelText('food.custom.update')).toBeTruthy();
    expect(screen.queryByLabelText('food.custom.save')).toBeNull();
  });

  it('🔴 un aliment INTROUVABLE laisse le formulaire vierge, sans planter', async () => {
    mockGetFood.mockResolvedValue(null);
    await afficher({ foodId: 'f-absent' });

    // Aliment supprimé depuis un autre appareil : l'écran reste utilisable plutôt que de tomber
    // sur un `food.name` indéfini.
    expect(screen.getByLabelText(CHAMP.nom).props.value).toBe('');
    expect(
      screen.getByLabelText('food.custom.update').props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('la modification d’un champ prime sur la valeur chargée', async () => {
    mockGetFood.mockResolvedValue(alimentExistant());
    await afficher({ foodId: 'f-1' });

    await saisir(CHAMP.kcal, '200');
    await taper(screen.getByLabelText('food.custom.update'));

    expect(mockUpdate).toHaveBeenCalledWith('f-1', expect.objectContaining({ kcalPer100g: 200 }));
  });
});

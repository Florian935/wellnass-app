/**
 * Journal alimentaire (`app/(tabs)/nutrition.tsx`) — le **vrai** écran, monté.
 *
 * Le plus gros écran restant à **0 %** (188 instructions) et le plus manipulé de l'app : c'est ici
 * qu'on saisit plusieurs fois par jour. Ce qui est vérifié porte sur ce que l'écran **décide**, pas
 * sur ce qu'il affiche :
 *
 *  1. **Le jour affiché suit « aujourd'hui » UNIQUEMENT si on y était.** À minuit, ou au retour de
 *     veille, `useTodayKey` change : écraser une navigation délibérée vers le 5 août ramènerait
 *     l'utilisateur à aujourd'hui pendant qu'il saisit un repas passé.
 *  2. **Les entrées ORPHELINES ne sont jamais perdues.** Supprimer un repas de la config laisse ses
 *     entrées avec une `mealType` qui n'existe plus : elles remontent dans « Autres », d'où on peut
 *     les réaffecter. Sans cette section, elles disparaîtraient de l'écran en restant en base — et
 *     compteraient quand même dans les totaux, ce qui rend le journal incompréhensible.
 *  3. **La modification d'une quantité recalcule le snapshot** (règle de trois, `rescaleEntryNutrition`).
 *     Les macros sont figées à la saisie ; les recalculer à l'affichage ferait bouger l'historique
 *     quand la base CIQUAL est mise à jour.
 *  4. **Deux types d'entrée, deux formulaires** : avec grammes → on édite les grammes ; sans
 *     (ajout rapide, recette) → on édite directement kcal et macros. Proposer les grammes sur un
 *     ajout rapide demanderait une densité qui n'existe pas.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import NutritionScreen from '../nutrition';
import {
  copyMeal,
  duplicateDay,
  moveEntry,
  reassignEntryMeal,
  removeEntry,
  updateEntry,
  useDayEntries,
} from '@/data/repositories/journal-repository';
import { saveMealAsTemplate } from '@/data/repositories/meal-template-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useDayCalorieTarget } from '@/data/repositories/dashboard-repository';
import { useRealLifePeriods } from '@/data/repositories/real-life-repository';
import { useRecentFoods } from '@/data/repositories/food-repository';
import { useTodayKey } from '@/hooks/useTodayKey';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/journal-repository', () => ({
  useDayEntries: jest.fn(() => ({ entries: [] })),
  removeEntry: jest.fn(),
  updateEntry: jest.fn(),
  moveEntry: jest.fn(),
  reassignEntryMeal: jest.fn(),
  duplicateDay: jest.fn(),
  copyMeal: jest.fn(),
}));
jest.mock('@/data/repositories/meal-template-repository', () => ({
  saveMealAsTemplate: jest.fn(),
}));
jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: jest.fn(() => ({ profile: null })),
}));
jest.mock('@/data/repositories/nutrition-repository', () => ({
  useNutritionProfile: jest.fn(() => ({ nutritionProfile: null })),
}));
jest.mock('@/data/repositories/dashboard-repository', () => ({
  useDayCalorieTarget: jest.fn(),
}));
jest.mock('@/data/repositories/real-life-repository', () => ({
  useRealLifePeriods: jest.fn(() => ({ periods: [] })),
}));
jest.mock('@/data/repositories/food-repository', () => ({
  useRecentFoods: jest.fn(() => ({ foods: [] })),
}));
jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: jest.fn() }));
jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));

/** Le balayage n'est pas rejouable hors device : on rend directement la ligne ET ses actions. */
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({
      children,
      renderRightActions,
    }: {
      children: React.ReactNode;
      renderRightActions: () => React.ReactNode;
    }) => (
      <View>
        {children}
        {renderRightActions()}
      </View>
    ),
  };
});

jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/ScreenHeader', () => {
  const { Text, View } = require('react-native');
  return {
    ScreenHeader: ({ title, action }: { title: string; action?: React.ReactNode }) => (
      <View>
        <Text>{title}</Text>
        {action}
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
jest.mock('@/components/MicronutrientDetails', () => ({ MicronutrientDetails: () => null }));
jest.mock('@/components/nutrition/DayBalanceCard', () => {
  const { Text } = require('react-native');
  return {
    DayBalanceCard: ({ consumed, target }: { consumed: number; target: number | null }) => (
      <Text>bilan:{consumed}/{String(target)}</Text>
    ),
  };
});
jest.mock('@/components/nutrition/MacroTriple', () => {
  const { Text } = require('react-native');
  return {
    MacroTriple: ({ targets }: { targets: { protein: number } | null }) => (
      <Text>macros:{targets ? String(targets.protein) : 'aucune'}</Text>
    ),
  };
});
jest.mock('@/components/nutrition/MicroCoverageGrid', () => {
  const { Text } = require('react-native');
  return {
    MicroCoverageGrid: ({ cells }: { cells: { key: string; value: string }[] }) => (
      <Text>micros:{cells.map((c) => `${c.key}=${c.value}`).join(',')}</Text>
    ),
  };
});
jest.mock('@/components/nutrition/MacroSuggestionCard', () => {
  const { Text } = require('react-native');
  return { MacroSuggestionCard: () => <Text>suggestion</Text> };
});

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

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
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      borderStrong: '#d9c8b0',
      track: '#ece0cd',
      panel: '#33291f',
      panelText: '#ffffff',
      accent: '#c0562f',
      danger: '#b23b2e',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockEntries = useDayEntries as jest.Mock;
const mockRemove = removeEntry as jest.Mock;
const mockUpdate = updateEntry as jest.Mock;
const mockMove = moveEntry as jest.Mock;
const mockReassign = reassignEntryMeal as jest.Mock;
const mockDuplicateDay = duplicateDay as jest.Mock;
const mockCopyMeal = copyMeal as jest.Mock;
const mockSaveTemplate = saveMealAsTemplate as jest.Mock;
const mockProfile = useProfile as jest.Mock;
const mockNutritionProfile = useNutritionProfile as jest.Mock;
const mockTarget = useDayCalorieTarget as jest.Mock;
const mockRealLife = useRealLifePeriods as jest.Mock;
const mockRecent = useRecentFoods as jest.Mock;
const mockToday = useTodayKey as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

const AUJOURDHUI = '2026-08-12';

const entree = (overrides: Record<string, unknown> = {}) => ({
  id: 'e-1',
  mealType: 'breakfast',
  foodId: 'f-1',
  name: 'Banane',
  quantityG: 100,
  kcal: 90,
  proteinG: 1,
  carbsG: 23,
  fatG: 0,
  micronutrients: {},
  createdAt: '2026-08-12T07:30:00.000Z',
  ...overrides,
});

const afficher = async ({
  entries = [] as unknown[],
  aujourdhui = AUJOURDHUI,
}: { entries?: unknown[]; aujourdhui?: string } = {}) => {
  mockToday.mockReturnValue(aujourdhui);
  mockEntries.mockReturnValue({ entries });
  await render(<NutritionScreen />);
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

/** Ouvre le détail d'une entrée par un appui simple sur sa ligne. */
const ouvrirDetail = async (nom: string) => {
  await taper(screen.getByText(nom));
};

let boutonsAlerte: { text?: string; style?: string; onPress?: () => void }[] = [];
let titreAlerte: string | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  // L'écran compare le jour affiché à `new Date()` pour décider du libellé « Aujourd'hui » :
  // sans horloge figée, le test change de verdict chaque jour.
  jest.useFakeTimers();
  jest.setSystemTime(new Date(`${AUJOURDHUI}T10:00:00`));
  boutonsAlerte = [];
  titreAlerte = undefined;
  jest.spyOn(Alert, 'alert').mockImplementation((titre, _m, boutons) => {
    titreAlerte = titre;
    boutonsAlerte = (boutons ?? []) as typeof boutonsAlerte;
  });
  mockUseRouter.mockReturnValue({ push });
  mockProfile.mockReturnValue({ profile: null });
  mockNutritionProfile.mockReturnValue({ nutritionProfile: null });
  mockRealLife.mockReturnValue({ periods: [] });
  mockRecent.mockReturnValue({ foods: [] });
  mockTarget.mockReturnValue({
    effectiveTarget: 2000,
    trainingBonus: 0,
    bonusSource: 'none',
    isTrainingDay: false,
    isLoading: false,
  });
  mockDuplicateDay.mockResolvedValue(3);
  mockCopyMeal.mockResolvedValue(2);
  mockSaveTemplate.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Navigation par jour
// ---------------------------------------------------------------------------

describe('navigation par jour', () => {
  it('ouvre sur aujourd’hui, avec la date en sous-titre', async () => {
    await afficher();

    // Le libellé « Aujourd'hui » seul ne dit pas quel jour on est — la date reste utile pour se
    // repérer quand on revient d'une navigation dans l'historique.
    expect(screen.getByText('journal.today')).toBeTruthy();
    expect(mockEntries).toHaveBeenCalledWith(AUJOURDHUI);
  });

  it('les flèches changent le jour interrogé', async () => {
    await afficher();

    await taper(screen.getByLabelText('journal.prevDay'));
    expect(mockEntries).toHaveBeenLastCalledWith('2026-08-11');

    await taper(screen.getByLabelText('journal.nextDay'));
    await taper(screen.getByLabelText('journal.nextDay'));
    expect(mockEntries).toHaveBeenLastCalledWith('2026-08-13');
  });

  it('🔴 la veille franchit correctement un début de mois', async () => {
    await afficher({ aujourdhui: '2026-08-01' });

    await taper(screen.getByLabelText('journal.prevDay'));

    // Arithmétique sur les composants de date, jamais sur la chaîne : « 2026-08-00 » n'existe pas.
    expect(mockEntries).toHaveBeenLastCalledWith('2026-07-31');
  });

  it('un jour passé n’affiche plus « aujourd’hui »', async () => {
    await afficher();

    await taper(screen.getByLabelText('journal.prevDay'));

    expect(screen.queryByText('journal.today')).toBeNull();
  });

  it('🔴 le passage de minuit NE déplace PAS un jour choisi délibérément', async () => {
    await afficher();
    await taper(screen.getByLabelText('journal.prevDay'));
    expect(mockEntries).toHaveBeenLastCalledWith('2026-08-11');

    // Minuit passe pendant que l'utilisateur saisit un repas de la veille.
    mockToday.mockReturnValue('2026-08-13');
    await act(async () => {
      await screen.rerender(<NutritionScreen />);
    });

    // Le ramener à aujourd'hui effacerait sa navigation sous ses doigts, au milieu d'une saisie.
    expect(mockEntries).toHaveBeenLastCalledWith('2026-08-11');
  });

  it('🔴 mais il SUIT le jour courant si on était resté sur « aujourd’hui »', async () => {
    await afficher();

    mockToday.mockReturnValue('2026-08-13');
    await act(async () => {
      await screen.rerender(<NutritionScreen />);
    });

    // Sans ce suivi, l'app rouverte au petit-déjeuner ajouterait les aliments à la veille.
    expect(mockEntries).toHaveBeenLastCalledWith('2026-08-13');
  });
});

// ---------------------------------------------------------------------------
// Journée vide
// ---------------------------------------------------------------------------

describe('journée vide', () => {
  it('propose « copier hier » et « ajouter », sans cartes de repas', async () => {
    await afficher({ entries: [] });

    expect(screen.getByLabelText('journal.copyDayYesterday')).toBeTruthy();
    // Cinq cartes pointillées identiques par-dessus l'état vide ne donnent aucun repère de plus.
    expect(screen.queryByText('journal.meals.breakfast')).toBeNull();
  });

  it('copier hier copie le jour PRÉCÉDENT vers le jour affiché', async () => {
    await afficher({ entries: [] });

    await taper(screen.getByLabelText('journal.copyDayYesterday'));

    expect(mockDuplicateDay).toHaveBeenCalledWith('2026-08-11', AUJOURDHUI);
  });

  it('🔴 copier une veille VIDE le dit au lieu de ne rien faire', async () => {
    mockDuplicateDay.mockResolvedValue(0);
    await afficher({ entries: [] });

    await taper(screen.getByLabelText('journal.copyDayYesterday'));

    // Un bouton qui ne produit rien et ne dit rien se lit comme un bug.
    expect(titreAlerte).toBe('journal.copyDayYesterday');
  });

  it('🔴 aucune suggestion de macro sur une journée vide', async () => {
    await afficher({ entries: [] });

    // « Il te manque 160 g de protéines » sur une journée vide n'est qu'une paraphrase de
    // l'objectif, pas un conseil.
    expect(screen.queryByText('suggestion')).toBeNull();
  });

  it('la suggestion apparaît dès qu’il y a des entrées, aujourd’hui', async () => {
    await afficher({ entries: [entree()] });

    expect(screen.getByText('suggestion')).toBeTruthy();
  });

  it('🔴 mais jamais sur un jour PASSÉ', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getByLabelText('journal.prevDay'));

    // Conseiller quoi manger pour combler un manque d'avant-hier n'a aucun sens.
    expect(screen.queryByText('suggestion')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Repas et entrées
// ---------------------------------------------------------------------------

describe('repas', () => {
  it('un repas vide propose l’ajout, sans total', async () => {
    await afficher({ entries: [entree({ mealType: 'lunch' })] });

    // Le petit-déjeuner est vide : carte pointillée, il n'y a rien à totaliser.
    expect(screen.getByLabelText('journal.meals.breakfast · journal.addFood')).toBeTruthy();
  });

  it('chaque entrée affiche ses propres calories', async () => {
    await afficher({
      entries: [
        entree({ id: 'a', name: 'Banane', kcal: 90 }),
        entree({ id: 'b', name: 'Pain', kcal: 210 }),
      ],
    });

    expect(screen.getByText('90 nutrition.kcal')).toBeTruthy();
    expect(screen.getByText('210 nutrition.kcal')).toBeTruthy();
  });

  it('ajouter depuis un repas ouvre le sélecteur SUR ce repas et ce jour', async () => {
    await afficher({ entries: [entree({ mealType: 'lunch' })] });

    await taper(screen.getByLabelText('journal.meals.breakfast · journal.addFood'));

    // Sans les deux paramètres, l'aliment atterrirait au petit-déjeuner d'aujourd'hui quel que
    // soit le repas et le jour d'où l'on vient.
    expect(push).toHaveBeenCalledWith({
      pathname: '/food-picker',
      params: { date: AUJOURDHUI, meal: 'breakfast' },
    });
  });

  it('🔴 les entrées ORPHELINES remontent dans « Autres »', async () => {
    await afficher({
      entries: [entree({ id: 'orp', mealType: 'custom-supprime', name: 'Reste de pizza' })],
    });

    // Sans cette section, l'entrée disparaîtrait de l'écran tout en restant en base — et
    // continuerait de compter dans les totaux, ce qui rend le journal incompréhensible.
    expect(screen.getByText('journal.meals.other')).toBeTruthy();
    expect(screen.getByText('Reste de pizza')).toBeTruthy();
  });

  it('🔴 la section « Autres » ne propose PAS d’ajout', async () => {
    await afficher({ entries: [entree({ mealType: 'custom-supprime' })] });

    // On ne crée rien dans un repas qui n'existe plus : on en sort, par réaffectation.
    const ajouts = screen.queryAllByText('journal.addFood');
    expect(ajouts).toHaveLength(0);
  });

  it('le menu du repas est replié par défaut', async () => {
    await afficher({ entries: [entree()] });

    expect(screen.queryByText('journal.copyYesterday')).toBeNull();
    expect(
      screen.getByLabelText('journal.mealMenu:{"meal":"journal.meals.breakfast"}').props
        .accessibilityState.expanded,
    ).toBe(false);
  });

  it('copier le repas d’hier vise le MÊME repas, la veille', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getByLabelText('journal.mealMenu:{"meal":"journal.meals.breakfast"}'));
    await taper(screen.getByText('journal.copyYesterday'));

    expect(mockCopyMeal).toHaveBeenCalledWith('2026-08-11', 'breakfast', AUJOURDHUI);
  });

  it('🔴 un repas d’hier vide le dit', async () => {
    mockCopyMeal.mockResolvedValue(0);
    await afficher({ entries: [entree()] });

    await taper(screen.getByLabelText('journal.mealMenu:{"meal":"journal.meals.breakfast"}'));
    await taper(screen.getByText('journal.copyYesterday'));

    expect(titreAlerte).toBe('journal.meals.breakfast');
  });

  it('enregistrer comme modèle transmet les entrées du repas', async () => {
    await afficher({ entries: [entree({ name: 'Banane', quantityG: 120, kcal: 108 })] });

    await taper(screen.getByLabelText('journal.mealMenu:{"meal":"journal.meals.breakfast"}'));
    await taper(screen.getByText('journal.saveMeal'));

    expect(mockSaveTemplate).toHaveBeenCalledWith('journal.meals.breakfast', [
      expect.objectContaining({ name: 'Banane', quantityG: 120, kcal: 108 }),
    ]);
  });
});

// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------

describe('suppression', () => {
  it('🔴 demande confirmation en NOMMANT l’aliment', async () => {
    await afficher({ entries: [entree({ name: 'Banane' })] });

    await taper(screen.getAllByLabelText('journal.delete')[0]!);

    // Le nom est le seul repère quand cinq lignes se ressemblent dans un même repas.
    expect(titreAlerte).toBe('Banane');
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('confirmer supprime', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getAllByLabelText('journal.delete')[0]!);
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'journal.delete')?.onPress?.();
    });

    expect(mockRemove).toHaveBeenCalledWith('e-1');
  });

  it('annuler ne supprime rien', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getAllByLabelText('journal.delete')[0]!);
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'common.cancel')?.onPress?.();
    });

    expect(mockRemove).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Détail d'une entrée
// ---------------------------------------------------------------------------

describe('détail d’une entrée', () => {
  it('un appui ouvre le détail en CONSULTATION', async () => {
    await afficher({ entries: [entree()] });

    await ouvrirDetail('Banane');

    // Consultation par défaut : ouvrir en édition ferait surgir un clavier à chaque coup d'œil.
    expect(screen.getByLabelText('journal.detail.edit')).toBeTruthy();
    expect(screen.queryByLabelText('journal.grams')).toBeNull();
  });

  it('le balayage « modifier » ouvre DIRECTEMENT en édition', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);

    // C'est tout l'intérêt du geste : deux appuis de moins pour corriger une quantité.
    expect(screen.getByLabelText('journal.grams')).toBeTruthy();
  });

  it('🔴 modifier la quantité RECALCULE le snapshot par règle de trois', async () => {
    await afficher({
      entries: [entree({ quantityG: 100, kcal: 90, proteinG: 1, carbsG: 23, fatG: 0 })],
    });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);
    await saisir('journal.grams', '150');
    await taper(screen.getByLabelText('journal.detail.save'));

    // Les macros sont FIGÉES à la saisie : les recalculer à l'affichage ferait bouger l'historique
    // à chaque mise à jour de la base CIQUAL.
    expect(mockUpdate).toHaveBeenCalledWith(
      'e-1',
      expect.objectContaining({ quantityG: 150, kcal: 135, carbsG: 35 }),
    );
  });

  it('🔴 une quantité à zéro ne peut pas être enregistrée', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);
    await saisir('journal.grams', '0');

    // Enregistrer 0 g créerait une entrée à 0 kcal que rien ne distingue d'un bug de saisie ; la
    // suppression est le geste prévu pour ça.
    expect(screen.getByLabelText('journal.detail.save').props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('🔴 une entrée SANS quantité s’édite en kcal et macros, pas en grammes', async () => {
    await afficher({
      entries: [entree({ quantityG: null, name: 'Resto', kcal: 700 })],
    });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);

    // Un ajout rapide n'a pas de densité : proposer des grammes demanderait une information
    // qui n'a jamais été saisie.
    expect(screen.queryByLabelText('journal.grams')).toBeNull();
    expect(screen.getByLabelText('journal.detail.calories')).toBeTruthy();
    expect(screen.getByLabelText('journal.name')).toBeTruthy();
  });

  it('l’édition libre enregistre le nom et les macros saisis', async () => {
    await afficher({ entries: [entree({ quantityG: null, name: 'Resto', kcal: 700 })] });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);
    await saisir('journal.detail.calories', '850');
    await saisir('journal.name', 'Resto italien');
    await taper(screen.getByLabelText('journal.detail.save'));

    expect(mockUpdate).toHaveBeenCalledWith(
      'e-1',
      expect.objectContaining({ quantityG: null, name: 'Resto italien', kcal: 850 }),
    );
  });

  it('🔴 un nom vidé retombe sur l’ancien', async () => {
    await afficher({ entries: [entree({ quantityG: null, name: 'Resto' })] });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);
    await saisir('journal.name', '   ');
    await taper(screen.getByLabelText('journal.detail.save'));

    // Une ligne sans nom dans le journal est inidentifiable : mieux vaut l'ancien que rien.
    expect(mockUpdate).toHaveBeenCalledWith('e-1', expect.objectContaining({ name: 'Resto' }));
  });

  it('🔴 les macros négatives ou illisibles sont ramenées à zéro', async () => {
    await afficher({ entries: [entree({ quantityG: null })] });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);
    await saisir('journal.detail.calories', '500');
    await saisir(`nutrition.macros.protein (g)`, '-12');
    await taper(screen.getByLabelText('journal.detail.save'));

    // `Math.max(0, …)` : une macro négative fausserait tous les totaux du jour en silence.
    expect(mockUpdate).toHaveBeenCalledWith('e-1', expect.objectContaining({ proteinG: 0 }));
  });

  it('la virgule décimale est acceptée', async () => {
    await afficher({ entries: [entree({ quantityG: 100, kcal: 100 })] });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);
    await saisir('journal.grams', '12,6');
    await taper(screen.getByLabelText('journal.detail.save'));

    // Le pavé décimal FR produit une virgule : la refuser rendrait la saisie impossible.
    expect(mockUpdate).toHaveBeenCalledWith('e-1', expect.objectContaining({ quantityG: 13 }));
  });

  it('annuler l’édition ne modifie rien', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getAllByLabelText('journal.swipeEdit')[0]!);
    await saisir('journal.grams', '999');
    await taper(screen.getByLabelText('common.cancel'));

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('journal.grams')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Réaffectation et réordonnancement
// ---------------------------------------------------------------------------

describe('réaffectation', () => {
  it('🔴 le repas COURANT n’est pas proposé comme cible', async () => {
    await afficher({ entries: [entree({ mealType: 'breakfast' })] });

    await ouvrirDetail('Banane');

    // « Déplacer vers le petit-déjeuner » depuis le petit-déjeuner est une action sans effet.
    expect(
      screen.queryByLabelText('journal.detail.moveToMeal:{"meal":"journal.meals.breakfast"}'),
    ).toBeNull();
    expect(
      screen.getByLabelText('journal.detail.moveToMeal:{"meal":"journal.meals.lunch"}'),
    ).toBeTruthy();
  });

  it('réaffecter écrit et ferme le détail', async () => {
    await afficher({ entries: [entree()] });

    await ouvrirDetail('Banane');
    await taper(
      screen.getByLabelText('journal.detail.moveToMeal:{"meal":"journal.meals.lunch"}'),
    );

    expect(mockReassign).toHaveBeenCalledWith('e-1', 'lunch');
    expect(screen.queryByLabelText('journal.detail.close')).toBeNull();
  });

  it('🔴 une entrée ORPHELINE peut être récupérée vers un vrai repas', async () => {
    await afficher({ entries: [entree({ mealType: 'custom-supprime' })] });

    await ouvrirDetail('Banane');

    // C'est la seule sortie pour une entrée dont le repas a disparu.
    expect(
      screen.getByLabelText('journal.detail.moveToMeal:{"meal":"journal.meals.breakfast"}'),
    ).toBeTruthy();
  });

  it('🔴 la PREMIÈRE entrée d’un repas ne peut pas monter', async () => {
    await afficher({
      entries: [entree({ id: 'a', name: 'Banane' }), entree({ id: 'b', name: 'Pomme' })],
    });

    await ouvrirDetail('Banane');

    // Le bouton reste affiché mais inerte : le retirer ferait sauter la mise en page selon la
    // position de l'entrée dans son repas.
    expect(screen.getByLabelText('journal.detail.moveUp').props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('la seconde entrée peut monter', async () => {
    await afficher({
      entries: [entree({ id: 'a', name: 'Banane' }), entree({ id: 'b', name: 'Pomme' })],
    });

    await ouvrirDetail('Pomme');
    await taper(screen.getByLabelText('journal.detail.moveUp'));

    expect(mockMove).toHaveBeenCalledWith('b', 'up');
  });

  it('🔴 une entrée SEULE dans son repas n’offre aucun réordonnancement', async () => {
    await afficher({ entries: [entree()] });

    await ouvrirDetail('Banane');

    expect(screen.queryByLabelText('journal.detail.moveUp')).toBeNull();
  });

  it('🔴 le voisinage se calcule DANS le repas, pas dans la journée', async () => {
    await afficher({
      entries: [
        entree({ id: 'a', mealType: 'breakfast', name: 'Banane' }),
        entree({ id: 'b', mealType: 'lunch', name: 'Poulet' }),
      ],
    });

    await ouvrirDetail('Poulet');

    // Sinon « Poulet » se croirait deuxième et proposerait de monter — au-dessus d'une entrée
    // d'un autre repas, ce qui ne veut rien dire.
    expect(screen.queryByLabelText('journal.detail.moveUp')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Objectifs et macros cibles
// ---------------------------------------------------------------------------

describe('objectif du jour', () => {
  it('🔴 les macros MANUELLES priment sur les calculées', async () => {
    mockNutritionProfile.mockReturnValue({
      nutritionProfile: {
        objective: 'maintain',
        manualProteinG: 180,
        manualCarbsG: 200,
        manualFatG: 60,
      },
    });
    await afficher({ entries: [entree()] });

    expect(screen.getByText('macros:180')).toBeTruthy();
  });

  it('sans profil complet, aucune cible macro n’est inventée', async () => {
    mockTarget.mockReturnValue({
      effectiveTarget: null,
      trainingBonus: 0,
      bonusSource: 'none',
      isTrainingDay: false,
      isLoading: false,
    });
    await afficher({ entries: [entree()] });

    expect(screen.getByText('macros:aucune')).toBeTruthy();
  });

  it('🔴 l’objectif du jour est demandé pour le jour AFFICHÉ, pas pour aujourd’hui', async () => {
    await afficher({ entries: [entree()] });

    await taper(screen.getByLabelText('journal.prevDay'));

    // Cet écran navigue dans l'historique : une cible rétroactive doit refléter ce qui était
    // demandé ce jour-là, bonus de séance compris.
    expect(mockTarget).toHaveBeenLastCalledWith('2026-08-11');
  });

  it('le bilan additionne les calories des entrées', async () => {
    await afficher({
      entries: [entree({ id: 'a', kcal: 90 }), entree({ id: 'b', kcal: 410 })],
    });

    expect(screen.getByText('bilan:500/2000')).toBeTruthy();
  });

  it('🔴 le badge « jour de séance » ne s’affiche pas pendant le CHARGEMENT', async () => {
    mockTarget.mockReturnValue({
      effectiveTarget: 2300,
      trainingBonus: 300,
      bonusSource: 'forfait',
      isTrainingDay: true,
      isLoading: true,
    });
    await afficher({ entries: [entree()] });

    // Un badge transitoire qui apparaît puis disparaît est pire qu'un badge tardif : il fait
    // douter de la valeur affichée à côté.
    expect(screen.getByText('bilan:90/2300')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Micronutriments suivis
// ---------------------------------------------------------------------------

describe('micronutriments suivis', () => {
  it('aucune grille tant qu’aucun micro n’est suivi', async () => {
    await afficher({ entries: [entree()] });

    // Le suivi micro est opt-in : afficher une grille vide imposerait la fonctionnalité.
    expect(screen.queryByText(/^micros:/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Accès
// ---------------------------------------------------------------------------

describe('accès depuis l’en-tête', () => {
  it.each([
    ['stats.title', '/nutrition-stats'],
    ['nutrition.title', '/nutrition-profile'],
  ])('%s ouvre %s', async (label, route) => {
    await afficher();

    await taper(screen.getByLabelText(label));
    expect(push).toHaveBeenCalledWith(route);
  });

  it('le planning repas est accessible depuis le journal', async () => {
    await afficher();

    await taper(screen.getByLabelText('mealPlan.title'));

    // Arbitrage du 04/08/2026 : rangé dans un sous-menu, il ne serait jamais adopté.
    expect(push).toHaveBeenCalledWith('/meal-plan');
  });
});

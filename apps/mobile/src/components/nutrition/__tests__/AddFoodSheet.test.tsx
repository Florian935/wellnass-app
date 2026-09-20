/**
 * Feuille d'ajout à 3 modes (US NUTRI-UX01, R2.1 → R2.4).
 *
 * C'est l'écran du geste fait cinq fois par jour, mille fois par an. Ce que ces tests
 * verrouillent est exactement ce que l'ancien sélecteur ne faisait pas :
 *  1. **Trois modes**, pas neuf entrées de même poids.
 *  2. La liste ouvre sur **les habitudes**, pas sur la base alphabétique.
 *  3. Le **budget reste à l'écran** pendant toute la saisie.
 *  4. Le **« + » ajoute la quantité habituelle** — un aliment connu se journalise en un tap.
 *  5. La recherche mélange **aliments, recettes et repas types** dans une seule liste.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { AddFoodSheet } from '../AddFoodSheet';
import {
  useCatalogSearch,
  useHabitFoods,
  useRecentFoodIds,
} from '@/data/repositories/food-catalog-repository';
import { getFood } from '@/data/repositories/food-repository';
import { addFoodEntry } from '@/data/repositories/journal-repository';
import { applyTemplate } from '@/data/repositories/meal-template-repository';
import { useRecipes } from '@/data/repositories/recipe-repository';

// Préfixé `mock` : Jest hisse les `jest.mock()` avant les constantes, et n'autorise l'accès
// qu'aux variables portant ce préfixe.
const mockPush = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/hooks/useDebounced', () => ({ useDebounced: (v: unknown) => v }));
jest.mock('@/data/repositories/food-catalog-repository', () => ({
  useHabitFoods: jest.fn(() => ({ entries: [], isLoading: false })),
  useCatalogSearch: jest.fn(() => ({ entries: [], isLoading: false })),
  useRecentFoodIds: jest.fn(() => []),
  SEARCH_RESULT_LIMIT: 40,
}));
jest.mock('@/data/repositories/food-repository', () => ({
  getFood: jest.fn(),
  // Par défaut la bibliothèque est là : ces tests portent sur le geste d'ajout, pas sur la panne.
  // Le cas « base absente » a ses propres tests dans `LibraryNotice.test.tsx`.
  useLibraryPresence: jest.fn(() => ({ count: 3244, isLoading: false, isEmpty: false })),
}));
jest.mock('@/data/repositories/journal-repository', () => ({ addFoodEntry: jest.fn() }));
jest.mock('@/data/repositories/meal-template-repository', () => ({ applyTemplate: jest.fn() }));
jest.mock('@/data/repositories/recipe-repository', () => ({ useRecipes: jest.fn(() => ({ recipes: [] })) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
    i18n: { language: 'fr' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const mockHabits = useHabitFoods as jest.Mock;
const mockSearch = useCatalogSearch as jest.Mock;
const mockRecents = useRecentFoodIds as jest.Mock;
const mockGetFood = getFood as jest.Mock;
const mockAddEntry = addFoodEntry as jest.Mock;
const mockApplyTemplate = applyTemplate as jest.Mock;
const mockRecipes = useRecipes as jest.Mock;

const JOUR = '2026-09-10';

const aliment = (over: Record<string, unknown> = {}) => ({
  id: 'f1',
  name: 'Blanc de poulet',
  kind: 'food' as const,
  kcal: 212,
  defaultGrams: 150,
  fromHistory: true,
  category: 'meat',
  count: null,
  ...over,
});

const afficher = async ({
  habits = [] as unknown[],
  results = [] as unknown[],
  kcalRemaining = 570 as number | null,
} = {}) => {
  mockHabits.mockReturnValue({ entries: habits, isLoading: false });
  mockSearch.mockReturnValue({ entries: results, isLoading: false });
  await render(
    <AddFoodSheet
      visible
      date={JOUR}
      mealKey="lunch"
      mealLabel="Déjeuner"
      kcalRemaining={kcalRemaining}
      proteinRemaining={42}
      consumedRatio={0.72}
      onClose={jest.fn()}
    />,
  );
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRecents.mockReturnValue([]);
  mockRecipes.mockReturnValue({ recipes: [] });
});

describe('R2.1 — les trois modes', () => {
  it('expose Rechercher, Scanner et Texte libre', async () => {
    await afficher();

    expect(screen.getByText('journal.addSheet.modes.search')).toBeTruthy();
    expect(screen.getByText('journal.addSheet.modes.scan')).toBeTruthy();
    expect(screen.getByText('journal.addSheet.modes.text')).toBeTruthy();
  });

  it('le scan emmène sur l’écran caméra AVEC le jour et le repas visés', async () => {
    await afficher();

    await taper(screen.getByText('journal.addSheet.modes.scan'));

    // Sans les deux paramètres, le produit scanné retomberait sur le repas de l'heure — ce qui
    // est le bon repli, mais pas ce que l'utilisateur a demandé en ouvrant depuis le dîner.
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/food-scan',
      params: { date: JOUR, meal: 'lunch' },
    });
  });

  it('le texte libre emmène sur la saisie par liste', async () => {
    await afficher();

    await taper(screen.getByText('journal.addSheet.modes.text'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/meal-quick-entry',
      params: { date: JOUR, meal: 'lunch' },
    });
  });
});

describe('R2.4 — le budget ne quitte pas l’écran', () => {
  it('affiche ce qu’il reste, en calories et en protéines', async () => {
    await afficher();

    expect(
      screen.getByText('journal.addSheet.remainingValue:{"kcal":570,"protein":42}'),
    ).toBeTruthy();
  });

  it('se tait quand aucun objectif n’est défini', async () => {
    await afficher({ kcalRemaining: null });

    expect(screen.queryByText('journal.addSheet.remainingLabel')).toBeNull();
  });
});

describe('R2.2 — la liste ouvre sur les habitudes', () => {
  it('montre les habitudes tant qu’on ne cherche rien', async () => {
    await afficher({ habits: [aliment()] });

    expect(screen.getByText('journal.addSheet.habits')).toBeTruthy();
    expect(screen.getByText('Blanc de poulet')).toBeTruthy();
  });

  it('annonce la quantité habituelle plutôt qu’un poids générique', async () => {
    await afficher({ habits: [aliment()] });

    expect(screen.getByText('journal.addSheet.usualQuantity:{"grams":150}')).toBeTruthy();
  });

  it('bascule sur les résultats dès qu’un terme est saisi', async () => {
    await afficher({ habits: [aliment()], results: [aliment({ id: 'f2', name: 'Riz' })] });

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('journal.addSheet.searchLabel'), 'riz');
    });

    expect(screen.getByText('journal.addSheet.results')).toBeTruthy();
    expect(screen.getByText('Riz')).toBeTruthy();
  });
});

describe('R2.3 — une seule liste pour les trois familles', () => {
  it('affiche recettes et repas types à côté des aliments', async () => {
    await afficher({
      habits: [
        aliment(),
        aliment({ id: 'r1', name: 'Bowl poulet', kind: 'recipe', count: 2, fromHistory: false }),
        aliment({ id: 't1', name: 'Mon déjeuner', kind: 'template', count: 4, fromHistory: false }),
      ],
    });

    expect(screen.getByText('journal.addSheet.recipeMeta:{"count":2}')).toBeTruthy();
    expect(screen.getByText('journal.addSheet.templateMeta:{"count":4}')).toBeTruthy();
  });
});

describe('R2.5 — le « + » ajoute en un tap', () => {
  it('journalise un aliment avec sa quantité habituelle', async () => {
    mockGetFood.mockResolvedValue({
      id: 'f1',
      name: 'Blanc de poulet',
      kcalPer100g: 141,
      proteinPer100g: 30,
      carbsPer100g: 0,
      fatPer100g: 2,
      micronutrients: {},
    });
    await afficher({ habits: [aliment()] });

    await taper(screen.getByLabelText('journal.addSheet.addA11y:{"name":"Blanc de poulet"}'));

    expect(mockAddEntry).toHaveBeenCalledWith(
      JOUR,
      'lunch',
      expect.objectContaining({ foodId: 'f1', quantityG: 150 }),
    );
  });

  it('applique un repas type sans passer par la quantité', async () => {
    await afficher({
      habits: [aliment({ id: 't1', name: 'Mon déjeuner', kind: 'template', count: 4 })],
    });

    await taper(screen.getByLabelText('journal.addSheet.addA11y:{"name":"Mon déjeuner"}'));

    expect(mockApplyTemplate).toHaveBeenCalledWith('t1', JOUR, 'lunch');
  });

  it('🔴 une recette introuvable n’écrit RIEN plutôt qu’une ligne vide', async () => {
    mockRecipes.mockReturnValue({ recipes: [] });
    await afficher({
      habits: [aliment({ id: 'r1', name: 'Bowl poulet', kind: 'recipe', count: 2 })],
    });

    await taper(screen.getByLabelText('journal.addSheet.addA11y:{"name":"Bowl poulet"}'));

    expect(mockAddEntry).not.toHaveBeenCalled();
  });
});

describe('états vides', () => {
  it('invite à chercher quand il n’y a pas encore d’habitude', async () => {
    await afficher();

    expect(screen.getByText('journal.addSheet.noHabit')).toBeTruthy();
  });

  it('propose de créer l’aliment quand la recherche ne rend rien', async () => {
    await afficher({ results: [] });

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('journal.addSheet.searchLabel'), 'zzz');
    });

    expect(screen.getByText('journal.addSheet.noResult')).toBeTruthy();
  });
});

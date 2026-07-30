/**
 * nutrition-meals-hydration.test.tsx — régression du 30/07/2026.
 *
 * **Le bug.** L'écran initialisait son formulaire avec
 * `useState(() => resolveMealConfig(nutritionProfile?.meals))`. L'initialiseur ne s'exécute
 * qu'au **premier** rendu, or `useNutritionProfile` lit SQLite de façon asynchrone et renvoie
 * `null` en attendant. Résultat : le formulaire restait figé sur les 4 repas par défaut, même
 * une fois la vraie configuration arrivée — et « Enregistrer » l'écrasait silencieusement.
 * Les entrées de journal rattachées aux repas ainsi perdus basculaient dans « Autres ».
 *
 * Ces tests reproduisent la séquence exacte : chargement, puis arrivée de la config.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import NutritionMealsScreen from '../nutrition-meals';

const mockUpsert = jest.fn().mockResolvedValue(undefined);
let mockProfileState: { nutritionProfile: unknown; isLoading: boolean } = {
  nutritionProfile: null,
  isLoading: true,
};

jest.mock('@/data/repositories/nutrition-repository', () => ({
  useNutritionProfile: () => mockProfileState,
  upsertNutritionProfile: (...args: unknown[]) => mockUpsert(...args),
}));

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const CUSTOM_MEALS = [
  { key: 'breakfast', label: null },
  { key: 'lunch', label: null },
  { key: 'dinner', label: null },
  { key: 'custom-1', label: 'Encas test' },
];

beforeEach(() => {
  mockUpsert.mockClear();
  mockProfileState = { nutritionProfile: null, isLoading: true };
});

describe('NutritionMealsScreen — hydratation de la configuration', () => {
  it('n’affiche pas le formulaire tant que la config n’est pas chargée', async () => {
    const { queryByText } = await render(<NutritionMealsScreen />);
    // Le texte d'aide n'apparaît qu'avec le formulaire.
    expect(queryByText('meals.hint')).toBeNull();
  });

  it('affiche la config réelle une fois qu’elle arrive, pas les repas par défaut', async () => {
    const view = await render(<NutritionMealsScreen />);

    // La requête locale se résout : la vraie config arrive après le premier rendu.
    mockProfileState = { nutritionProfile: { meals: CUSTOM_MEALS }, isLoading: false };
    view.rerender(<NutritionMealsScreen />);

    await waitFor(() => expect(view.queryByText('meals.hint')).not.toBeNull());
    // C'est ce champ que l'ancienne version perdait.
    expect(view.getByDisplayValue('Encas test')).toBeTruthy();
  });

  it('n’écrit rien tant que la config n’est pas chargée', async () => {
    const { queryByText } = await render(<NutritionMealsScreen />);
    // Aucun bouton n'est rendu pendant le chargement : il n'y a aucun moyen de déclencher
    // l'écrasement, ce qui est précisément la garantie recherchée.
    expect(queryByText('meals.done')).toBeNull();
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

/**
 * Carte d'hydratation (US NUTRI-UX01, R5.2).
 *
 * Ce qui est vérifié ici, et pourquoi :
 *  1. **Un tap = un verre**, avec le volume réglé — c'est tout l'argument qui a fait ouvrir
 *     l'hydratation en V1 contre la spec §8 : le seul geste du pilier qui ne demande ni
 *     recherche, ni pesée, ni calcul.
 *  2. **« Annuler » défait le dernier geste**, et n'apparaît pas quand il n'y a rien à défaire.
 *  3. Le **dépassement n'est pas une faute** : la carte ne bascule pas en alerte.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { HydrationCard } from '../HydrationCard';
import { addWater, removeLastWater, useDayWater } from '@/data/repositories/water-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';

jest.mock('@/data/repositories/water-repository', () => ({
  useDayWater: jest.fn(() => ({ totalMl: 0, isLoading: false })),
  addWater: jest.fn(),
  removeLastWater: jest.fn(),
}));
jest.mock('@/data/repositories/nutrition-repository', () => ({
  useNutritionProfile: jest.fn(() => ({ nutritionProfile: null })),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
// `initReactI18next` doit rester exporté : la carte tire `useTheme` → `settings-repository`
// → `src/i18n`, qui appelle `i18n.use(initReactI18next)` au chargement du module.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
    i18n: { language: 'fr' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const mockWater = useDayWater as jest.Mock;
const mockProfile = useNutritionProfile as jest.Mock;
const mockAdd = addWater as jest.Mock;
const mockRemove = removeLastWater as jest.Mock;

const JOUR = '2026-09-10';

const afficher = async ({
  totalMl = 0,
  profil = null as Record<string, unknown> | null,
} = {}) => {
  mockWater.mockReturnValue({ totalMl, isLoading: false });
  mockProfile.mockReturnValue({ nutritionProfile: profil });
  await render(<HydrationCard day={JOUR} />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ajout', () => {
  it('un seul tap ajoute un verre au jour affiché', async () => {
    await afficher();

    await taper(screen.getByLabelText('hydration.add:{"ml":250}'));

    expect(mockAdd).toHaveBeenCalledWith(JOUR, 250);
  });

  it('respecte le volume de verre réglé par l’utilisateur', async () => {
    await afficher({ profil: { glassSizeMl: 330 } });

    await taper(screen.getByLabelText('hydration.add:{"ml":330}'));

    expect(mockAdd).toHaveBeenCalledWith(JOUR, 330);
  });
});

describe('annulation', () => {
  it('🔴 rien à annuler quand la journée est vide', async () => {
    await afficher({ totalMl: 0 });

    // Un bouton qui ne peut rien faire est pire qu'un bouton absent : il promet une action.
    expect(screen.queryByLabelText('hydration.undo')).toBeNull();
  });

  it('défait le dernier verre, pas un total', async () => {
    await afficher({ totalMl: 500 });

    await taper(screen.getByLabelText('hydration.undo'));

    // Le repository retire la dernière LIGNE : c'est ce qui rend le volume exact, y compris si
    // les verres n'ont pas tous la même taille.
    expect(mockRemove).toHaveBeenCalledWith(JOUR);
  });
});

describe('affichage', () => {
  it('montre le total et l’objectif en litres', async () => {
    await afficher({ totalMl: 1250 });

    expect(screen.getByText('hydration.amount:{"current":"1,3","target":"2"}')).toBeTruthy();
  });

  it('annonce les verres bus pour les lecteurs d’écran', async () => {
    await afficher({ totalMl: 750 });

    expect(screen.getByLabelText('hydration.a11y:{"glasses":3,"target":8}')).toBeTruthy();
  });

  it('🔴 dépasser l’objectif n’est pas traité comme une faute', async () => {
    await afficher({ totalMl: 3000 });

    // Aucune alerte, aucun rouge : la carte affiche le dépassement et continue — même doctrine
    // que le dépassement calorique du bilan du jour.
    expect(screen.getByText('hydration.amount:{"current":"3","target":"2"}')).toBeTruthy();
    expect(screen.getByLabelText('hydration.add:{"ml":250}')).toBeTruthy();
  });

  it('suit un objectif personnalisé', async () => {
    await afficher({ totalMl: 1000, profil: { waterTargetMl: 3000 } });

    expect(screen.getByText('hydration.amount:{"current":"1","target":"3"}')).toBeTruthy();
  });
});

/**
 * Carte de suggestion pour combler un macro (`components/nutrition/MacroSuggestionCard`, NUTR-F2).
 *
 * Composant à **0 %** avant ce fichier. Le tri des aliments vit dans `@wellness/shared`
 * (`macro-suggestion.ts`, testé là-bas) : ce qui se joue ici, ce sont les **conditions d'affichage**
 * et l'écriture au journal.
 *
 * La règle qui compte, décision D6 : **la carte disparaît si le budget calorique est épuisé.**
 * Suggérer d'ajouter des protéines à quelqu'un qui a déjà dépassé ses calories ne serait pas un
 * conseil imparfait, ce serait un mauvais conseil — et il apparaîtrait exactement le jour où il
 * fait le plus de dégâts.
 *
 * Les fonctions pures de `@wellness/shared` tournent pour de vrai : les mocker ici masquerait un
 * mauvais branchement, ce qui est précisément ce qu'on cherche à vérifier.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { MacroSuggestionCard } from '../MacroSuggestionCard';
import { addFoodEntry } from '@/data/repositories/journal-repository';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/journal-repository', () => ({
  addFoodEntry: jest.fn(),
}));

jest.mock('@/components/Card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

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
      background: '#f7eede',
      border: '#ece0cd',
      accent: '#c0562f',
      danger: '#b23b2e',
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    // Le vrai contrat : un nombre affiché passe par un formateur **localisé**, jamais par un
    // `String()` brut — c'est ce qui produisait « +41.2 g » dans une app francophone.
    formatAxisNumber: (v: number) => (Number.isInteger(v) ? String(v) : String(v).replace('.', ',')),
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockAdd = addFoodEntry as jest.Mock;

/** Un aliment du vivier de suggestions. */
const aliment = (overrides: Record<string, unknown> = {}) => ({
  id: 'poulet',
  name: 'Blanc de poulet',
  kcalPer100g: 165,
  proteinPer100g: 31,
  carbsPer100g: 0,
  fatPer100g: 3.6,
  ...overrides,
});

/** Props par défaut : objectif protéines nettement manqué, budget calorique confortable. */
const props = (overrides: Record<string, unknown> = {}) =>
  ({
    day: '2026-08-09',
    mealType: 'dinner',
    consumed: { protein: 80, carbs: 200, fat: 60 },
    targets: { protein: 150, carbs: 220, fat: 70 },
    kcalRemaining: 1000,
    candidates: [aliment()],
    recentIds: [],
    ...overrides,
  }) as unknown as Parameters<typeof MacroSuggestionCard>[0];

const afficher = (o: Record<string, unknown> = {}) =>
  render(<MacroSuggestionCard {...props(o)} />);

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAdd.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Conditions d'affichage (D6)
// ---------------------------------------------------------------------------

describe('conditions d’affichage', () => {
  it('🔴 aucun objectif défini → AUCUNE carte', async () => {
    const vue = await afficher({ targets: null });

    // Sans cible, « il te manque » n'a pas de sens : on ne peut pas manquer ce qui n'est pas visé.
    expect(vue.toJSON()).toBeNull();
  });

  it('🔴 budget calorique ÉPUISÉ → aucune carte', async () => {
    const vue = await afficher({ kcalRemaining: 0 });

    // D6 : suggérer d'ajouter des protéines à quelqu'un qui a atteint ses calories ne serait pas
    // un conseil imparfait, ce serait un mauvais conseil — et il apparaîtrait le jour où il fait
    // le plus de dégâts.
    expect(vue.toJSON()).toBeNull();
  });

  it('🔴 budget calorique DÉPASSÉ → aucune carte non plus', async () => {
    const vue = await afficher({ kcalRemaining: -120 });

    expect(vue.toJSON()).toBeNull();
  });

  it('🔴 budget calorique inconnu → aucune carte', async () => {
    const vue = await afficher({ kcalRemaining: null });

    // `null` n'est pas « il en reste » : conseiller sans connaître le budget revient à conseiller
    // à l'aveugle.
    expect(vue.toJSON()).toBeNull();
  });

  it('🔴 aucun macro suffisamment en retard → aucune carte', async () => {
    const vue = await afficher({
      consumed: { protein: 149, carbs: 219, fat: 69 },
      targets: { protein: 150, carbs: 220, fat: 70 },
    });

    // Proposer d'ajouter 1 g de protéines transformerait un journal en injonction permanente.
    expect(vue.toJSON()).toBeNull();
  });

  it('objectif manqué et budget disponible → la carte s’affiche', async () => {
    await afficher();

    expect(screen.getByText('suggestion.title')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Contenu
// ---------------------------------------------------------------------------

describe('contenu', () => {
  it('🔴 l’écart est porté par le TEXTE, avec un nombre entier', async () => {
    await afficher();

    // 150 − 80 = 70 g. L'écart n'est jamais signalé par la seule couleur, et un « 70,4 g » de
    // protéines manquantes donnerait une fausse impression de précision.
    expect(screen.getByText(/suggestion\.missing.*"count":70/)).toBeTruthy();
  });

  it('propose l’aliment, sa quantité et son prix calorique', async () => {
    await afficher();

    expect(screen.getByText('Blanc de poulet')).toBeTruthy();
    // Un conseil qui cache son prix calorique est un conseil partiel.
    expect(screen.getByText(/suggestion\.quantity.*kcal/)).toBeTruthy();
  });

  it('🔴 affiche CE QUE la portion apporte du macro visé', async () => {
    await afficher();

    // Depuis que la suggestion est une portion et non plus « de quoi combler tout l'écart »,
    // l'omettre laisserait croire qu'une portion suffit à atteindre la cible du jour.
    expect(screen.getByText(/macroG/)).toBeTruthy();
  });

  it('🔴 le nombre de grammes du macro passe par le formateur LOCALISÉ', async () => {
    await afficher();

    // Interpolé tel quel par i18next (un `String()` brut), il ressortirait « +41.2 g » au milieu
    // d'une app qui écrit « 76,0 kg » partout ailleurs.
    expect(screen.queryByText(/macroG":"\d+\.\d/)).toBeNull();
  });

  it('🔴 la limite de la suggestion est AFFICHÉE, pas masquée', async () => {
    await afficher();

    // Aucun aliment n'est étiqueté régime ou allergène en base : le taire ferait passer une
    // suggestion pour une recommandation validée.
    expect(screen.getByText('suggestion.dietDisclaimer')).toBeTruthy();
  });

  it('🔴 aucun candidat → on dit POURQUOI, on ne laisse pas une carte vide', async () => {
    await afficher({ candidates: [] });

    // Sans explication, l'absence de suggestion se lit comme un bug.
    expect(screen.getByText('suggestion.noCandidate')).toBeTruthy();
  });

  it('🔴 un candidat trop cher en calories ne remplit pas la carte de rien', async () => {
    await afficher({
      kcalRemaining: 30,
      candidates: [aliment({ kcalPer100g: 900, proteinPer100g: 5 })],
    });

    // Le budget est respecté par le tri : la carte reste affichée (le budget est positif) mais dit
    // qu'elle n'a rien à proposer, au lieu de conseiller un dépassement.
    expect(screen.getByText('suggestion.noCandidate')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Choix du macro
// ---------------------------------------------------------------------------

describe('choix du macro', () => {
  it('les trois macros sont proposés en onglets', async () => {
    await afficher();

    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('🔴 le macro le plus en retard est sélectionné par défaut', async () => {
    await afficher();

    // Le défaut doit être celui qui compte : obliger l'utilisateur à choisir à chaque ouverture
    // annulerait l'intérêt d'une suggestion.
    const onglet = screen.getByLabelText(/a11yMacroTab.*protein/);
    expect(onglet.props.accessibilityState).toMatchObject({ selected: true });
  });

  it('🔴 l’utilisateur peut viser un AUTRE macro (D1)', async () => {
    await afficher({
      consumed: { protein: 80, carbs: 100, fat: 60 },
      targets: { protein: 150, carbs: 220, fat: 70 },
    });

    await taper(screen.getByLabelText(/a11yMacroTab.*fat/));

    // La dérogation prime sur le calcul : quelqu'un qui sait ce qu'il veut ne doit pas être
    // renvoyé au macro que l'app a choisi.
    expect(screen.getByLabelText(/a11yMacroTab.*fat/).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Ajout au journal
// ---------------------------------------------------------------------------

describe('ajout au journal', () => {
  it('🔴 écrit dans le BON jour et le BON repas', async () => {
    await afficher();

    await taper(screen.getByLabelText(/suggestion\.a11yAdd/));

    // Une suggestion ajoutée au mauvais repas est plus pénible à corriger qu'une saisie manuelle.
    expect(mockAdd).toHaveBeenCalledWith('2026-08-09', 'dinner', expect.any(Object));
  });

  it('🔴 les macros écrits sont ceux de la PORTION, pas ceux des 100 g', async () => {
    await afficher();

    await taper(screen.getByLabelText(/suggestion\.a11yAdd/));

    const entree = mockAdd.mock.calls[0]?.[2];
    // Écrire les valeurs des 100 g gonflerait le journal d'un facteur qui dépend de la portion —
    // une erreur invisible dans le total du jour.
    expect(entree.proteinG).toBeCloseTo((31 * entree.quantityG) / 100, 1);
    expect(entree.fatG).toBeCloseTo((3.6 * entree.quantityG) / 100, 1);
  });

  it('un macro absent de la fiche compte pour zéro, pas pour NaN', async () => {
    await afficher({
      candidates: [aliment({ carbsPer100g: null, fatPer100g: null })],
    });

    await taper(screen.getByLabelText(/suggestion\.a11yAdd/));

    const entree = mockAdd.mock.calls[0]?.[2];
    expect(entree.carbsG).toBe(0);
    expect(entree.fatG).toBe(0);
  });

  it('🔴 un échec d’écriture est ANNONCÉ', async () => {
    mockAdd.mockRejectedValue(new Error('hors ligne'));
    await afficher();

    await taper(screen.getByLabelText(/suggestion\.a11yAdd/));

    // Sans message, l'utilisateur croit avoir ajouté l'aliment et découvre le trou en relisant son
    // total du soir.
    expect(screen.getByText('suggestion.addError')).toBeTruthy();
  });

  it('🔴 après un échec, on peut réessayer', async () => {
    mockAdd.mockRejectedValueOnce(new Error('hors ligne'));
    await afficher();

    await taper(screen.getByLabelText(/suggestion\.a11yAdd/));
    await taper(screen.getByLabelText(/suggestion\.a11yAdd/));

    // Le drapeau d'occupation doit être relâché dans tous les cas, sinon toutes les suggestions
    // restent inertes jusqu'au prochain rendu du journal.
    expect(mockAdd).toHaveBeenCalledTimes(2);
  });
});

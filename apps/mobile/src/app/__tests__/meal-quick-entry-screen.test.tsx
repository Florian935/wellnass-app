/**
 * Saisie rapide d'un repas en texte libre (`app/meal-quick-entry.tsx`) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier (66 instructions), et **il portait le défaut du lien direct** :
 * `params.date ?? ''` écrivait des entrées rattachées à **aucune journée** — le correctif appliqué
 * à `food-picker` le 01/08/2026 n'avait pas suivi ici. Corrigé le 14/08/2026, en même temps que
 * `food-scan`, qui portait la même ligne.
 *
 * Le reste tient à la nature de l'écran : **on y devine**. `parseMealText` et `bestMatchIndex` sont
 * des heuristiques (pures, testées dans `@wellness/shared` et reprises telles quelles ici). Ce qui
 * compte alors, c'est ce que l'écran fait de leurs **échecs** :
 *
 *  1. **Une ligne non reconnue est MONTRÉE, jamais ignorée** — avec son texte d'origine. La faire
 *     disparaître laisserait croire que tout a été ajouté.
 *  2. **Rien n'est écrit sans relecture.** L'analyse remplit un tableau modifiable ; le bouton
 *     d'ajout annonce **combien** de lignes vont partir. Écrire directement ferait entrer des
 *     approximations dans le journal sans qu'on les ait vues.
 *  3. **Les grammes sont déduits de l'unité et des portions de l'aliment** (« 2 tranches » ≠
 *     « 2 g »), avec un repli explicite quand l'aliment n'a pas la portion nommée.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import MealQuickEntryScreen from '../meal-quick-entry';
import { useFoods } from '@/data/repositories/food-repository';
import { addFoodEntry } from '@/data/repositories/journal-repository';
import { useTodayKey } from '@/hooks/useTodayKey';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/food-repository', () => ({ useFoods: jest.fn(() => ({ foods: [] })) }));
jest.mock('@/data/repositories/journal-repository', () => ({ addFoodEntry: jest.fn() }));
jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: jest.fn(() => '2026-08-14') }));

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
      danger: '#b23b2e',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockFoods = useFoods as jest.Mock;
const mockAddEntry = addFoodEntry as jest.Mock;
const mockToday = useTodayKey as jest.Mock;
const mockParams = useLocalSearchParams as unknown as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const back = jest.fn();

const aliment = (overrides: Record<string, unknown> = {}) => ({
  id: 'f-1',
  name: 'Banane',
  category: 'fruits',
  source: 'ciqual',
  kcalPer100g: 100,
  proteinPer100g: 10,
  carbsPer100g: 20,
  sugarsPer100g: null,
  fatPer100g: 5,
  saturatedFatPer100g: null,
  fiberPer100g: null,
  portions: [] as { labelFr: string; labelEn: string; grams: number }[],
  micronutrients: {},
  isFavorite: false,
  ...overrides,
});

const afficher = async ({
  foods = [aliment()] as unknown[],
  params = { date: '2026-08-10', meal: 'lunch' } as Record<string, string>,
} = {}) => {
  mockFoods.mockReturnValue({ foods });
  mockParams.mockReturnValue(params);
  await render(<MealQuickEntryScreen />);
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

/** Saisit le texte puis lance l'analyse. */
const analyser = async (texte: string) => {
  await saisir('quickList.label', texte);
  await taper(screen.getByLabelText('quickList.analyze'));
};

/** Ce qui a été écrit au journal, par appel. */
const entrees = () => mockAddEntry.mock.calls.map((c) => c[2] as Record<string, unknown>);

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ back });
  mockToday.mockReturnValue('2026-08-14');
  mockAddEntry.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Paramètres d'entrée
// ---------------------------------------------------------------------------

describe('paramètres d’entrée', () => {
  it('🔴 sans `date`, l’entrée est rattachée à AUJOURD’HUI, jamais à rien', async () => {
    await afficher({ params: {} });

    await analyser('100 g de banane');
    await taper(screen.getByLabelText(/quickList\.addCount/));

    // `?? ''` écrivait des lignes rattachées à aucune journée : sans erreur, comptées par le
    // bouton « ajouter N », et invisibles dans tous les journaux. Même défaut que `food-picker`,
    // corrigé le 01/08/2026 — le correctif n'avait pas suivi ici.
    expect(mockAddEntry).toHaveBeenCalledWith('2026-08-14', 'breakfast', expect.anything());
  });

  it('les paramètres fournis sont respectés', async () => {
    await afficher({ params: { date: '2026-08-10', meal: 'dinner' } });

    await analyser('100 g de banane');
    await taper(screen.getByLabelText(/quickList\.addCount/));

    expect(mockAddEntry).toHaveBeenCalledWith('2026-08-10', 'dinner', expect.anything());
  });
});

// ---------------------------------------------------------------------------
// Analyse
// ---------------------------------------------------------------------------

describe('analyse', () => {
  it('🔴 rien ne peut être analysé tant que le champ est vide', async () => {
    await afficher();

    expect(
      screen.getByLabelText('quickList.analyze').props.accessibilityState.disabled,
    ).toBe(true);

    await saisir('quickList.label', '   ');
    expect(
      screen.getByLabelText('quickList.analyze').props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('🔴 aucun tableau de relecture AVANT l’analyse', async () => {
    await afficher();

    await saisir('quickList.label', '100 g de banane');

    // Analyser est un geste : afficher des résultats à la frappe ferait clignoter la liste à
    // chaque lettre, sur un champ multiligne.
    expect(screen.queryByText('quickList.review')).toBeNull();
  });

  it('🔴 un texte fait de SÉPARATEURS seuls le dit', async () => {
    await afficher();

    // `,,,` passe le garde de saisie (non vide après `trim`) mais ne produit aucun segment.
    await analyser(',,,');

    // Distinct de « aucune correspondance » : ici, rien n'a même été découpé. Sans ce message,
    // l'écran ne répondrait simplement pas à l'appui sur « analyser ».
    expect(screen.getByText('quickList.nothing')).toBeTruthy();
    expect(screen.queryByText('quickList.review')).toBeNull();
  });

  it('un mot inconnu produit bien une ligne, marquée non reconnue', async () => {
    await afficher({ foods: [aliment({ name: 'Banane' })] });

    await analyser('...');

    // La frontière est là : dès qu'un segment existe, il est montré — quitte à dire qu'on ne
    // l'a pas reconnu.
    expect(screen.getByText('quickList.unmatched')).toBeTruthy();
  });

  it('une ligne reconnue affiche l’aliment et ses calories', async () => {
    await afficher({ foods: [aliment({ name: 'Banane', kcalPer100g: 100 })] });

    await analyser('120 g de banane');

    expect(screen.getByText('Banane')).toBeTruthy();
    expect(screen.getByLabelText('journal.grams').props.value).toBe('120');
    expect(screen.getByText('120 nutrition.kcal')).toBeTruthy();
  });

  it('🔴 une ligne NON reconnue est montrée avec son texte d’origine', async () => {
    await afficher({ foods: [aliment({ name: 'Banane' })] });

    await analyser('200 g de tofu fumé');

    // La faire disparaître laisserait croire que tout a été ajouté — et l'utilisateur ne saurait
    // pas quoi ressaisir.
    expect(screen.getByText('quickList.unmatched')).toBeTruthy();
    expect(screen.getByText(/tofu fumé/)).toBeTruthy();
  });

  it('🔴 une ligne non reconnue n’a PAS de champ de grammes', async () => {
    await afficher({ foods: [aliment({ name: 'Banane' })] });

    await analyser('200 g de tofu fumé');

    // Saisir une quantité pour un aliment inconnu ne mènerait à rien : il n'y a pas de densité
    // à multiplier.
    expect(screen.queryByLabelText('journal.grams')).toBeNull();
  });

  it('🔴 le bouton d’ajout n’apparaît QUE s’il y a au moins une correspondance', async () => {
    await afficher({ foods: [aliment({ name: 'Banane' })] });

    await analyser('200 g de tofu fumé');

    // « Ajouter 0 aliment » serait un bouton qui ne fait rien.
    expect(screen.queryByLabelText(/quickList\.addCount/)).toBeNull();
  });

  it('le bouton annonce COMBIEN de lignes vont partir', async () => {
    await afficher({ foods: [aliment({ name: 'Banane' }), aliment({ id: 'f-2', name: 'Pomme' })] });

    await analyser('100 g de banane\n150 g de pomme');

    // C'est la dernière information avant une écriture multiple : sans elle, on ne sait pas si la
    // ligne non reconnue a été comptée.
    expect(screen.getByLabelText('quickList.addCount:{"count":2}')).toBeTruthy();
  });

  it('🔴 les lignes non reconnues ne sont PAS comptées', async () => {
    await afficher({ foods: [aliment({ name: 'Banane' })] });

    await analyser('100 g de banane\n200 g de tofu fumé');

    expect(screen.getByLabelText('quickList.addCount:{"count":1}')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Quantités déduites
// ---------------------------------------------------------------------------

describe('quantités déduites', () => {
  it('une quantité en grammes est reprise telle quelle', async () => {
    await afficher();

    await analyser('120 g de banane');

    expect(screen.getByLabelText('journal.grams').props.value).toBe('120');
  });

  it('🔴 une unité NOMMÉE utilise la portion de l’aliment', async () => {
    await afficher({
      foods: [
        aliment({
          name: 'Pain',
          portions: [{ labelFr: '1 tranche', labelEn: '1 slice', grams: 30 }],
        }),
      ],
    });

    await analyser('2 tranches de pain');

    // 2 × 30 g. Sans cette résolution, « 2 tranches » vaudrait 2 g — une erreur d'un facteur 30
    // qui passerait inaperçue dans un total de journée.
    expect(screen.getByLabelText('journal.grams').props.value).toBe('60');
  });

  it('🔴 sans portion nommée, un REPLI générique par unité', async () => {
    await afficher({ foods: [aliment({ name: 'Pain', portions: [] })] });

    await analyser('2 tranches de pain');

    // L'aliment ne connaît pas « tranche » : plutôt que d'abandonner la ligne, on prend la valeur
    // générique de l'unité — approximatif, mais relu et corrigeable avant l'écriture.
    const grammes = Number(screen.getByLabelText('journal.grams').props.value);
    expect(grammes).toBeGreaterThan(2);
  });

  it('🔴 sans unité, la PREMIÈRE portion de l’aliment sert de référence', async () => {
    await afficher({
      foods: [
        aliment({
          name: 'Banane',
          portions: [{ labelFr: '1 banane', labelEn: '1 banana', grams: 120 }],
        }),
      ],
    });

    await analyser('2 bananes');

    // « 1 banane = 120 g » est la donnée la plus fidèle dont on dispose ; retomber sur 100 g
    // ignorerait une information que l'aliment porte déjà.
    expect(screen.getByLabelText('journal.grams').props.value).toBe('240');
  });

  it('la quantité reste modifiable avant l’écriture', async () => {
    await afficher();

    await analyser('120 g de banane');
    await saisir('journal.grams', '200');

    // Le tableau est là pour ça : l'heuristique propose, l'utilisateur tranche.
    expect(screen.getByText('200 nutrition.kcal')).toBeTruthy();
  });

  it('retirer une ligne la sort du compte', async () => {
    await afficher({ foods: [aliment({ name: 'Banane' }), aliment({ id: 'f-2', name: 'Pomme' })] });

    await analyser('100 g de banane\n150 g de pomme');
    await taper(screen.getAllByLabelText('journal.delete')[0]!);

    expect(screen.getByLabelText('quickList.addCount:{"count":1}')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

describe('écriture', () => {
  it('🔴 le snapshot est MIS À L’ÉCHELLE des grammes relus', async () => {
    await afficher({
      foods: [aliment({ kcalPer100g: 100, proteinPer100g: 10, carbsPer100g: 20, fatPer100g: 5 })],
    });

    await analyser('120 g de banane');
    await saisir('journal.grams', '200');
    await taper(screen.getByLabelText(/quickList\.addCount/));

    expect(entrees()[0]).toMatchObject({
      foodId: 'f-1',
      quantityG: 200,
      kcal: 200,
      proteinG: 20,
      carbsG: 40,
      fatG: 10,
    });
  });

  it('🔴 une ligne à ZÉRO gramme n’est pas écrite', async () => {
    await afficher();

    await analyser('120 g de banane');
    await saisir('journal.grams', '0');
    await taper(screen.getByLabelText(/quickList\.addCount/));

    // Une entrée à 0 g n'ajoute rien au journal et le remplit d'une ligne vide, que l'utilisateur
    // devra supprimer à la main.
    expect(mockAddEntry).not.toHaveBeenCalled();
  });

  it('🔴 une ligne à zéro n’empêche PAS les autres de partir', async () => {
    await afficher({ foods: [aliment({ name: 'Banane' }), aliment({ id: 'f-2', name: 'Pomme' })] });

    await analyser('100 g de banane\n150 g de pomme');
    // Deux champs portent le même libellé : c'est le rang qui les distingue, ici la première ligne.
    await act(async () => {
      fireEvent.changeText(screen.getAllByLabelText('journal.grams')[0]!, '0');
    });
    await taper(screen.getByLabelText(/quickList\.addCount/));

    // `continue` et non un abandon : la relecture porte ligne par ligne, et une saisie ratée ne
    // doit pas faire perdre les autres.
    expect(mockAddEntry).toHaveBeenCalledTimes(1);
  });

  it('les lignes non reconnues sont ignorées à l’écriture', async () => {
    await afficher({ foods: [aliment({ name: 'Banane' })] });

    await analyser('100 g de banane\n200 g de tofu fumé');
    await taper(screen.getByLabelText(/quickList\.addCount/));

    expect(mockAddEntry).toHaveBeenCalledTimes(1);
    expect(entrees()[0]).toMatchObject({ name: 'Banane' });
  });

  it('l’écran se referme une fois tout écrit', async () => {
    await afficher();

    await analyser('120 g de banane');
    await taper(screen.getByLabelText(/quickList\.addCount/));

    expect(back).toHaveBeenCalled();
  });

  it('la virgule décimale est acceptée dans les grammes relus', async () => {
    await afficher();

    await analyser('120 g de banane');
    await saisir('journal.grams', '12,6');
    await taper(screen.getByLabelText(/quickList\.addCount/));

    expect(entrees()[0]).toMatchObject({ quantityG: 13 });
  });
});

/**
 * Liste de courses (`app/meal-plan/shopping.tsx`, US REPAS-01) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier (68 instructions). Sa particularité : **on s'en sert debout dans
 * un magasin**, une main sur le chariot. Tout ce qui est testé ici découle de ça.
 *
 *  1. **La liste est FIGÉE à la génération** (décision D5). Elle ne bouge pas pendant qu'on est au
 *     rayon, et les cases cochées survivent à la fermeture de l'app. La régénérer est un geste
 *     explicite qui **annonce la perte des cases cochées avant de la provoquer** — et qui compte
 *     combien on en perd (critère de recette 16).
 *  2. **Cocher un rayon entier est gratuit, le DÉcocher est confirmé** (décision D13). Cocher se
 *     rattrape d'un geste ; dé-cocher efface un travail de magasin qu'on ne peut pas reconstituer
 *     de mémoire.
 *  3. **La liste dit ce qu'elle ne sait pas** (R12) : les entrées de planning dont aucun ingrédient
 *     n'a pu être résolu sont annoncées, plutôt que de sous-estimer les courses en silence.
 *  4. **L'ordre des rayons est celui du PARCOURS de magasin**, pas l'ordre alphabétique ni celui de
 *     la base. Un rayon absent est sauté sans laisser de trou.
 */
import React from 'react';
import { Alert, Share } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ShoppingListScreen from '../shopping';
import {
  generateShoppingList,
  regenerateShoppingList,
  toggleAisle,
  toggleShoppingItem,
  useActiveShoppingList,
  useShoppingListItems,
} from '@/data/repositories/shopping-list-repository';
import { useLocalSearchParams } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/shopping-list-repository', () => ({
  useActiveShoppingList: jest.fn(() => ({ list: null, isLoading: false })),
  useShoppingListItems: jest.fn(() => ({ items: [] })),
  generateShoppingList: jest.fn(),
  regenerateShoppingList: jest.fn(),
  toggleShoppingItem: jest.fn(),
  toggleAisle: jest.fn(),
}));

jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/ScreenHeader', () => {
  const { Text, View } = require('react-native');
  return {
    ScreenHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
      <View>
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
      </View>
    ),
  };
});
jest.mock('@/components/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});

jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn(() => ({})) }));

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
      surface: '#fffaf2',
      border: '#ece0cd',
      borderStrong: '#d9c8b0',
      accent: '#c0562f',
      success: '#7c8a5b',
      warnText: '#8a6a1f',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockList = useActiveShoppingList as jest.Mock;
const mockItems = useShoppingListItems as jest.Mock;
const mockGenerate = generateShoppingList as jest.Mock;
const mockRegenerate = regenerateShoppingList as jest.Mock;
const mockToggleItem = toggleShoppingItem as jest.Mock;
const mockToggleAisle = toggleAisle as jest.Mock;
const mockParams = useLocalSearchParams as unknown as jest.Mock;

/** Semaine du lundi 10/08/2026, « aujourd'hui » mercredi 12/08. */
const LUNDI = '2026-08-10';

const liste = (overrides: Record<string, unknown> = {}) => ({
  id: 'sl-1',
  weekStartDate: LUNDI,
  generatedAt: '2026-08-10T09:00:00.000Z',
  unresolvedCount: 0,
  plannedCount: 12,
  ...overrides,
});

const article = (overrides: Record<string, unknown> = {}) => ({
  id: 'it-1',
  foodId: 'f-1',
  name: 'Tomate',
  category: 'vegetables' as const,
  quantityG: 500,
  unquantifiedCount: 0,
  checked: false,
  orderIndex: 0,
  ...overrides,
});

const afficher = async ({
  list = liste() as Record<string, unknown> | null,
  items = [] as unknown[],
  week = LUNDI as string | undefined,
} = {}) => {
  mockParams.mockReturnValue(week === undefined ? {} : { week });
  mockList.mockReturnValue({ list, isLoading: false });
  mockItems.mockReturnValue({ items });
  await render(<ShoppingListScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

let boutonsAlerte: { text?: string; style?: string; onPress?: () => void }[] = [];
let titreAlerte: string | undefined;
let corpsAlerte: string | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-08-12T10:00:00'));
  boutonsAlerte = [];
  titreAlerte = undefined;
  corpsAlerte = undefined;
  jest.spyOn(Alert, 'alert').mockImplementation((titre, corps, boutons) => {
    titreAlerte = titre;
    corpsAlerte = corps;
    boutonsAlerte = (boutons ?? []) as typeof boutonsAlerte;
  });
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
  mockGenerate.mockResolvedValue(undefined);
  mockRegenerate.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Semaine visée
// ---------------------------------------------------------------------------

describe('semaine visée', () => {
  it('lit la semaine passée en paramètre', async () => {
    await afficher({ week: '2026-08-17' });

    expect(mockList).toHaveBeenCalledWith('2026-08-17');
    expect(screen.getByText('mealPlan.week.range:{"from":"17/8","to":"23/8"}')).toBeTruthy();
  });

  it('🔴 une route ouverte NUE retombe sur la semaine courante', async () => {
    await afficher({ week: undefined });

    // Lien direct ou restauration d'état : sans repli, l'écran afficherait un vide inexplicable
    // au lieu de la liste de la semaine en cours.
    expect(mockList).toHaveBeenCalledWith(LUNDI);
  });
});

// ---------------------------------------------------------------------------
// Aucune liste
// ---------------------------------------------------------------------------

describe('aucune liste générée', () => {
  it('propose de la générer, et rien d’autre', async () => {
    await afficher({ list: null });

    expect(screen.getByText('mealPlan.shopping.empty.title')).toBeTruthy();
    // Ni partage ni régénération : il n'y a rien à partager, et rien à régénérer.
    expect(screen.queryByLabelText('mealPlan.shopping.share')).toBeNull();
    expect(screen.queryByLabelText('mealPlan.shopping.regenerate.action')).toBeNull();
  });

  it('générer vise la semaine affichée', async () => {
    await afficher({ list: null, week: '2026-08-17' });

    await taper(screen.getByLabelText('mealPlan.shopping.generate'));

    expect(mockGenerate).toHaveBeenCalledWith('2026-08-17');
  });
});

// ---------------------------------------------------------------------------
// Résumé
// ---------------------------------------------------------------------------

describe('résumé', () => {
  it('annonce le nombre de repas couverts et d’articles', async () => {
    await afficher({ list: liste({ plannedCount: 12 }), items: [article(), article({ id: 'b' })] });

    expect(screen.getByText('mealPlan.shopping.summary:{"meals":12,"items":2}')).toBeTruthy();
  });

  it('🔴 les entrées NON RÉSOLUES sont annoncées (R12)', async () => {
    await afficher({ list: liste({ unresolvedCount: 3 }), items: [article()] });

    // Sans cet avertissement, la liste sous-estimerait les courses en silence : on rentrerait du
    // magasin en croyant avoir tout, avec trois repas impossibles à cuisiner.
    expect(screen.getByText('mealPlan.shopping.unresolved:{"count":3}')).toBeTruthy();
  });

  it('rien à signaler quand tout est résolu', async () => {
    await afficher({ items: [article()] });

    expect(screen.queryByText(/unresolved/)).toBeNull();
  });

  it('une liste générée mais VIDE le dit', async () => {
    await afficher({ items: [] });

    // Distinct de « aucune liste » : ici la génération a eu lieu et n'a rien trouvé.
    expect(screen.getByText('mealPlan.shopping.noItems')).toBeTruthy();
    expect(screen.queryByLabelText('mealPlan.shopping.share')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Rayons
// ---------------------------------------------------------------------------

describe('rayons', () => {
  it('🔴 l’ordre est celui du PARCOURS de magasin, pas celui des données', async () => {
    await afficher({
      items: [
        article({ id: 'a', name: 'Lait', category: 'dairy' }),
        article({ id: 'b', name: 'Tomate', category: 'vegetables' }),
        article({ id: 'c', name: 'Poulet', category: 'meat' }),
      ],
    });

    // `AISLE_ORDER` est pure (`@wellness/shared`), prise telle quelle : légumes → viande →
    // crémerie. Trier par nom ferait traverser le magasin trois fois.
    const rayons = screen
      .getAllByText(/^food\.categories\./)
      .map((n) => n.children.join(''));
    expect(rayons).toEqual([
      'food.categories.vegetables',
      'food.categories.meat',
      'food.categories.dairy',
    ]);
  });

  it('un rayon sans article est SAUTÉ, pas affiché vide', async () => {
    await afficher({ items: [article({ category: 'fish' })] });

    expect(screen.getAllByText(/^food\.categories\./)).toHaveLength(1);
  });

  it('l’en-tête compte les articles cochés du rayon', async () => {
    await afficher({
      items: [
        article({ id: 'a', checked: true }),
        article({ id: 'b', checked: false }),
        article({ id: 'c', checked: false }),
      ],
    });

    // « 1/3 » : la progression du rayon se lit sans compter les cases une à une.
    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('🔴 cocher un rayon entier ne demande AUCUNE confirmation', async () => {
    await afficher({ items: [article({ id: 'a' }), article({ id: 'b' })] });

    await taper(
      screen.getByLabelText(
        'mealPlan.shopping.aisle.a11y:{"aisle":"food.categories.vegetables","checked":0,"total":2}',
      ),
    );

    // Décision D13 : cocher se rattrape d'un geste. Une confirmation ici serait un obstacle sur
    // l'action la plus fréquente de l'écran.
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockToggleAisle).toHaveBeenCalledWith('sl-1', 'vegetables', true);
  });

  it('🔴 COMPLÉTER un rayon partiellement coché ne demande rien non plus', async () => {
    await afficher({ items: [article({ id: 'a', checked: true }), article({ id: 'b' })] });

    await taper(
      screen.getByLabelText(
        'mealPlan.shopping.aisle.a11y:{"aisle":"food.categories.vegetables","checked":1,"total":2}',
      ),
    );

    // `check-rest` : c'est le cas courant en fin de rayon, et il ne détruit rien.
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockToggleAisle).toHaveBeenCalledWith('sl-1', 'vegetables', true);
  });

  it('🔴 DÉ-cocher un rayon entier est CONFIRMÉ, en nommant le rayon', async () => {
    await afficher({
      items: [article({ id: 'a', checked: true }), article({ id: 'b', checked: true })],
    });

    await taper(
      screen.getByLabelText(
        'mealPlan.shopping.aisle.a11y:{"aisle":"food.categories.vegetables","checked":2,"total":2}',
      ),
    );

    // Ce geste efface un travail de magasin qu'on ne peut pas reconstituer de mémoire : quels
    // articles avait-on déjà pris ?
    expect(titreAlerte).toBe('mealPlan.shopping.aisle.uncheckTitle');
    expect(corpsAlerte).toContain('"aisle":"food.categories.vegetables"');
    expect(mockToggleAisle).not.toHaveBeenCalled();
  });

  it('confirmer le dé-cochage l’applique', async () => {
    await afficher({ items: [article({ checked: true })] });

    await taper(screen.getByLabelText(/aisle\.a11y/));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'mealPlan.shopping.aisle.uncheckConfirm')?.onPress?.();
    });

    expect(mockToggleAisle).toHaveBeenCalledWith('sl-1', 'vegetables', false);
  });

  it('annuler le dé-cochage ne touche à rien', async () => {
    await afficher({ items: [article({ checked: true })] });

    await taper(screen.getByLabelText(/aisle\.a11y/));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'common.cancel')?.onPress?.();
    });

    expect(mockToggleAisle).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

describe('articles', () => {
  it('🔴 un article est une CASE À COCHER pour les lecteurs d’écran', async () => {
    await afficher({ items: [article({ name: 'Tomate', checked: true })] });

    // `accessibilityRole="checkbox"` + `state.checked` : un simple bouton n'annoncerait pas si
    // l'article est déjà pris — l'information la plus utile de l'écran.
    const item = screen.getByLabelText(/^Tomate/);
    expect(item.props.accessibilityRole).toBe('checkbox');
    expect(item.props.accessibilityState.checked).toBe(true);
  });

  it('un appui bascule l’état de l’article', async () => {
    await afficher({ items: [article({ id: 'it-9', checked: false })] });

    await taper(screen.getByLabelText(/^Tomate/));

    expect(mockToggleItem).toHaveBeenCalledWith('it-9', true);
  });

  it('un article coché se décoche', async () => {
    await afficher({ items: [article({ id: 'it-9', checked: true })] });

    await taper(screen.getByLabelText(/^Tomate/));

    expect(mockToggleItem).toHaveBeenCalledWith('it-9', false);
  });

  it('la quantité est annoncée avec le nom', async () => {
    await afficher({ items: [article({ name: 'Tomate', quantityG: 500 })] });

    // Un lecteur d'écran doit dire « Tomate, 500 g » d'un bloc : deux nœuds séparés feraient
    // perdre l'association au rayon suivant.
    expect(
      screen.getByLabelText('Tomate, mealPlan.shopping.quantity:{"grams":500}'),
    ).toBeTruthy();
  });

  it('🔴 un ingrédient SANS quantité le dit au lieu d’afficher 0 g', async () => {
    await afficher({ items: [article({ quantityG: null, unquantifiedCount: 2 })] });

    // « 0 g de sel » ferait croire qu'il n'en faut pas. La recette n'en donne simplement pas la
    // quantité.
    expect(screen.getByText('mealPlan.shopping.noQuantity')).toBeTruthy();
  });

  it('🔴 une quantité PARTIELLE est signalée comme telle', async () => {
    await afficher({ items: [article({ quantityG: 500, unquantifiedCount: 2 })] });

    // 500 g connus + deux usages sans quantité : afficher « 500 g » tout court sous-estimerait,
    // et c'est précisément l'erreur qu'on ne veut pas commettre en silence.
    expect(
      screen.getByText(
        'mealPlan.shopping.quantity:{"grams":500} mealPlan.shopping.plusUnquantified:{"count":2}',
      ),
    ).toBeTruthy();
  });

  it('un article sans quantité NI usage non quantifié n’affiche rien', async () => {
    await afficher({ items: [article({ name: 'Sel', quantityG: null, unquantifiedCount: 0 })] });

    expect(screen.getByLabelText('Sel')).toBeTruthy();
    expect(screen.queryByText(/noQuantity/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Régénération
// ---------------------------------------------------------------------------

describe('régénération', () => {
  it('🔴 elle COMPTE les cases qu’on va perdre', async () => {
    await afficher({
      items: [
        article({ id: 'a', checked: true }),
        article({ id: 'b', checked: true }),
        article({ id: 'c', checked: false }),
      ],
    });

    await taper(screen.getByLabelText('mealPlan.shopping.regenerate.action'));

    // Critère de recette 16 : annoncer la perte AVANT de la provoquer, et la chiffrer — « tu vas
    // perdre 2 cases » n'est pas la même décision que « tu vas perdre 40 cases ».
    expect(corpsAlerte).toBe('mealPlan.shopping.regenerate.bodyChecked:{"count":2}');
    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  it('sans case cochée, le message est neutre', async () => {
    await afficher({ items: [article({ checked: false })] });

    await taper(screen.getByLabelText('mealPlan.shopping.regenerate.action'));

    // Rien à perdre : dramatiser banaliserait l'avertissement du cas précédent.
    expect(corpsAlerte).toBe('mealPlan.shopping.regenerate.body');
  });

  it('confirmer régénère la semaine affichée', async () => {
    await afficher({ items: [article()], week: '2026-08-17' });

    await taper(screen.getByLabelText('mealPlan.shopping.regenerate.action'));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'mealPlan.shopping.regenerate.confirm')?.onPress?.();
    });

    expect(mockRegenerate).toHaveBeenCalledWith('2026-08-17');
  });

  it('annuler ne régénère rien', async () => {
    await afficher({ items: [article()] });

    await taper(screen.getByLabelText('mealPlan.shopping.regenerate.action'));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'common.cancel')?.onPress?.();
    });

    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  it('la confirmation est en style destructif', async () => {
    await afficher({ items: [article({ checked: true })] });

    await taper(screen.getByLabelText('mealPlan.shopping.regenerate.action'));

    expect(
      boutonsAlerte.find((b) => b.text === 'mealPlan.shopping.regenerate.confirm')?.style,
    ).toBe('destructive');
  });
});

// ---------------------------------------------------------------------------
// Partage
// ---------------------------------------------------------------------------

describe('partage', () => {
  it('🔴 le texte partagé est GROUPÉ par rayon, quantités comprises', async () => {
    await afficher({
      items: [
        article({ id: 'a', name: 'Tomate', category: 'vegetables', quantityG: 500 }),
        article({ id: 'b', name: 'Poulet', category: 'meat', quantityG: 800 }),
      ],
    });

    await taper(screen.getByLabelText('mealPlan.shopping.share'));

    // C'est la liste qu'on envoie à quelqu'un qui fait les courses à notre place : à plat, sans
    // rayons, elle lui fait traverser le magasin autant de fois qu'il y a d'articles.
    // `formatShoppingListText` met les rayons en capitales — c'est ce qui les distingue des
    // articles dans un message texte, sans mise en forme disponible.
    const texte = (Share.share as jest.Mock).mock.calls[0]![0].message as string;
    expect(texte).toContain('FOOD.CATEGORIES.VEGETABLES');
    expect(texte).toContain('FOOD.CATEGORIES.MEAT');
    expect(texte).toContain('Tomate');
    expect(texte).toContain('mealPlan.shopping.quantity:{"grams":500}');
    expect(texte.indexOf('Tomate')).toBeLessThan(texte.indexOf('Poulet'));
  });

  it('🔴 un partage ANNULÉ ne casse rien', async () => {
    (Share.share as jest.Mock).mockRejectedValue(new Error('annulé'));
    await afficher({ items: [article()] });

    await taper(screen.getByLabelText('mealPlan.shopping.share'));

    // Annuler une feuille de partage est le geste le plus banal du monde : une exception non
    // capturée y laisserait un indicateur bloqué, sur un écran qu'on utilise debout.
    expect(screen.getByLabelText('mealPlan.shopping.share')).toBeTruthy();
  });
});

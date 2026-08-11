/**
 * Grille de widgets réordonnable (`components/widgets/SortableWidgetGrid`, US UX-04).
 *
 * Composant à **0 %** avant ce fichier — le plus gros de `src/components`. Le glisser-déposer
 * lui-même n'est pas rejouable hors device (il dépend de `react-native-gesture-handler` et de la
 * géométrie réelle) : **c'est de la recette**, et c'est assumé au §6. Ce qui est testable ici, et
 * qui ne l'était pas du tout, c'est tout le reste — et le reste porte deux choses qui cassent en
 * silence :
 *
 *  1. **Le placement absolu de chaque case.** `left`, `top`, `width`, `height` sont calculés à la
 *     main depuis (`col`, `row`) et l'empreinte de la taille. Une erreur d'un `gap` ne plante rien :
 *     elle décale la grille, et personne ne sait dire de combien.
 *  2. **Les deux boutons de chaque case.** Ils portent des libellés d'accessibilité **dynamiques**
 *     (« masquer » / « afficher », et la forme suivante du cycle) — sur une grille de six widgets
 *     identiques, ce sont les seuls repères d'un lecteur d'écran.
 */
import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { SortableWidgetGrid } from '../SortableWidgetGrid';
import type { WidgetLayoutEntry } from '@wellness/shared';

// ---------------------------------------------------------------------------
// Mocks — geste et animation, non rejouables hors device
// ---------------------------------------------------------------------------

jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const chain = () => builder;
  const builder: Record<string, unknown> = {};
  for (const m of ['activateAfterLongPress', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) {
    builder[m] = chain;
  }
  return {
    Gesture: { Pan: () => builder },
    GestureDetector: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
    runOnJS: (fn: unknown) => fn,
  };
});

jest.mock('@/components/widgets/widget-identity', () => {
  const { View } = require('react-native');
  return {
    WidgetIdentityProvider: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
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
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      accent: '#c0562f',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const COL_W = 100;
const GAP = 10;

const handlers = () => ({
  onMoveToCell: jest.fn(),
  onToggleVisible: jest.fn(),
  onCycleSize: jest.fn(),
});

const entree = (overrides: Partial<WidgetLayoutEntry> = {}): WidgetLayoutEntry =>
  ({
    id: 'streak',
    col: 0,
    row: 0,
    size: 'small',
    visible: true,
    ...overrides,
  }) as WidgetLayoutEntry;

async function afficher(items: WidgetLayoutEntry[]) {
  const h = handlers();
  await render(
    <SortableWidgetGrid
      items={items}
      colW={COL_W}
      gap={GAP}
      renderWidget={(id) => <Text>contenu-{id}</Text>}
      {...h}
    />,
  );
  return h;
}

/** Style aplati d'un nœud, quel que soit l'imbrication des tableaux de styles. */
const styleDe = (node: { props: { style?: unknown } }): Record<string, number> =>
  Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean)) as Record<string, number>;

/** La case (`Animated.View`) qui contient le widget donné. */
const caseDe = (id: string) => screen.getByText(`contenu-${id}`).parent!.parent!.parent!;

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

describe('placement', () => {
  it('la première case est à l’origine', async () => {
    await afficher([entree()]);

    expect(styleDe(caseDe('streak'))).toMatchObject({ left: 0, top: 0 });
  });

  it('🔴 la seconde colonne est décalée d’une colonne ET d’une gouttière', async () => {
    await afficher([entree({ id: 'steps', col: 1 })]);

    // Oublier le `gap` ne plante rien : la grille se décale, et personne ne sait dire de combien.
    expect(styleDe(caseDe('steps'))).toMatchObject({ left: COL_W + GAP });
  });

  it('la seconde rangée est décalée verticalement de la même façon', async () => {
    await afficher([entree({ id: 'steps', row: 1 })]);

    expect(styleDe(caseDe('steps'))).toMatchObject({ top: COL_W + GAP });
  });

  it('🔴 un widget « small » occupe UNE case', async () => {
    await afficher([entree({ size: 'small' })]);

    expect(styleDe(caseDe('streak'))).toMatchObject({ width: COL_W, height: COL_W });
  });

  it('🔴 un widget « wide » occupe DEUX colonnes, gouttière comprise', async () => {
    await afficher([entree({ size: 'wide' })]);

    // 2 colonnes + 1 gouttière : compter `2 × colW` laisserait un trou de 10 px à droite de chaque
    // widget large, sur toute la grille.
    expect(styleDe(caseDe('streak'))).toMatchObject({ width: 2 * COL_W + GAP, height: COL_W });
  });

  it('🔴 un widget « large » occupe deux colonnes ET deux rangées', async () => {
    await afficher([entree({ size: 'large' })]);

    expect(styleDe(caseDe('streak'))).toMatchObject({
      width: 2 * COL_W + GAP,
      height: 2 * COL_W + GAP,
    });
  });

  it('rend chaque widget de la liste', async () => {
    await afficher([entree(), entree({ id: 'steps', col: 1 })]);

    expect(screen.getByText('contenu-streak')).toBeTruthy();
    expect(screen.getByText('contenu-steps')).toBeTruthy();
  });

  it('une grille vide ne rend aucune case', async () => {
    await afficher([]);

    expect(screen.queryByText(/contenu-/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Visibilité
// ---------------------------------------------------------------------------

describe('visibilité', () => {
  it('🔴 un widget masqué reste AFFICHÉ dans la grille d’édition, estompé et étiqueté', async () => {
    await afficher([entree({ visible: false })]);

    // Le retirer de la grille d'édition le rendrait impossible à réafficher : c'est là, et
    // seulement là, qu'on peut le remettre.
    expect(screen.getByText('contenu-streak')).toBeTruthy();
    expect(screen.getByText('home.customize.hiddenBadge')).toBeTruthy();
    expect(styleDe(caseDe('streak')).opacity).toBe(0.5);
  });

  it('aucun badge sur un widget visible', async () => {
    await afficher([entree({ visible: true })]);

    expect(screen.queryByText('home.customize.hiddenBadge')).toBeNull();
  });

  it('🔴 le libellé du bouton dit l’ACTION, pas l’état', async () => {
    await afficher([entree({ visible: true })]);

    // Sur une grille de six widgets identiques, ce libellé est le seul repère d'un lecteur
    // d'écran — et « visible » ne dit pas ce qu'un tap va faire.
    expect(screen.getByLabelText('home.customize.hide')).toBeTruthy();
    expect(screen.queryByLabelText('home.customize.show')).toBeNull();
  });

  it('le libellé s’inverse sur un widget masqué', async () => {
    await afficher([entree({ visible: false })]);

    expect(screen.getByLabelText('home.customize.show')).toBeTruthy();
  });

  it('bascule la visibilité du bon widget', async () => {
    const h = await afficher([entree(), entree({ id: 'steps', col: 1 })]);

    await taper(screen.getAllByLabelText('home.customize.hide')[1]!);

    expect(h.onToggleVisible).toHaveBeenCalledWith('steps');
  });
});

// ---------------------------------------------------------------------------
// Cycle de forme
// ---------------------------------------------------------------------------

describe('cycle de forme', () => {
  it.each([
    ['small', 'shapeSmall'],
    ['wide', 'shapeWide'],
    ['large', 'shapeLarge'],
  ] as const)('🔴 la forme %s est ANNONCÉE dans le libellé', async (size, cle) => {
    await afficher([entree({ size })]);

    // Trois icônes qui se ressemblent : sans le libellé, un lecteur d'écran annonce trois fois
    // « bouton » et l'utilisateur ne sait pas dans quelle forme il est.
    expect(screen.getByLabelText(`widgets.customize.shapeCycle:{"shape":"widgets.customize.${cle}"}`)).toBeTruthy();
  });

  it('fait cycler la forme du bon widget', async () => {
    const h = await afficher([entree(), entree({ id: 'steps', col: 1 })]);

    await taper(screen.getAllByLabelText(/shapeCycle/)[1]!);

    expect(h.onCycleSize).toHaveBeenCalledWith('steps');
  });
});

// ---------------------------------------------------------------------------
// Affordance de déplacement
// ---------------------------------------------------------------------------

describe('affordance de déplacement', () => {
  it('🔴 la poignée ne capte AUCUN tap', async () => {
    await afficher([entree()]);

    // US UX-04 : la poignée signale que la carte se déplace, mais le geste reste porté par toute
    // la carte — capter le tap réduirait la zone de préhension à 18 px.
    // Deux boutons par case (œil + forme), et rien de plus : la poignée n'en est pas un.
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});

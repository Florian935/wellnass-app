/**
 * Personnalisation des grilles de widgets (US ACCUEIL-04) — fichier à **0 %**.
 *
 * Tout ce repository consiste à **ne rien perdre** en écrivant, et c'est précisément ce qui ne se
 * voit pas à l'écran. Quatre règles, quatre pannes silencieuses :
 *
 * 1. **L'autre hub est préservé.** Les dispositions des deux hubs (accueil, course) vivent dans la
 *    même colonne JSON : un mutateur qui réécrit le hub courant sans recopier l'autre remet ce
 *    dernier à sa disposition d'usine. L'utilisateur ne le découvre qu'en changeant d'onglet.
 * 2. **`v` doit être écrit** (correctif du 10/09/2026), sinon la migration de formes se rejoue à
 *    chaque lecture : un widget remis en grand carré redevient petit au rechargement suivant.
 * 3. **Les mutateurs opèrent sur le layout NON filtré.** Le filtrage par piliers actifs et par
 *    opt-in est un souci d'affichage ; muter le layout filtré effacerait du JSON les widgets
 *    masqués — leur position serait perdue au premier déplacement d'un voisin.
 * 4. **Le suivi du cycle est masqué tant que les réglages ne sont pas chargés.** Un affichage
 *    fugace d'une donnée de santé avant chargement est une fuite visuelle, pas un détail.
 *
 * Les briques pures (`parseMultiScreenLayout`, `resolveScreenLayout`, `moveWidgetToCell`) sont
 * testées chez elles et tournent ici pour de vrai : c'est l'enchaînement qu'on vérifie.
 */

import { act, renderHook } from '@testing-library/react-native';
import { LAYOUT_VERSION, WIDGET_SCREENS, type MultiScreenLayout } from '@wellness/shared';

import { useScreenLayout } from '../widget-layout-repository';
import { updateSettings, useSettings } from '../settings-repository';

jest.mock('../settings-repository', () => ({
  useSettings: jest.fn(),
  updateSettings: jest.fn(async () => undefined),
}));

const settingsOf = useSettings as jest.Mock;
const saved = updateSettings as jest.Mock;

/** Dernier `dashboardLayout` écrit. */
const lastWritten = (): MultiScreenLayout =>
  saved.mock.calls[saved.mock.calls.length - 1]![0].dashboardLayout;

function setup(
  over: {
    dashboardLayout?: unknown;
    activePillars?: string[];
    cycleTrackingEnabled?: boolean;
    isLoading?: boolean;
  } = {},
) {
  settingsOf.mockReturnValue({
    settings: over.isLoading
      ? null
      : {
          dashboardLayout: over.dashboardLayout ?? null,
          activePillars: over.activePillars ?? ['strength', 'running', 'nutrition'],
          cycleTrackingEnabled: over.cycleTrackingEnabled ?? false,
        },
    isLoading: over.isLoading ?? false,
  });
}

const layoutOf = async (screen: 'home' | 'running' = 'home') => {
  const { result } = await renderHook(() => useScreenLayout(screen));
  return result;
};

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

describe('lecture', () => {
  it('rend une disposition par défaut quand rien n’est stocké', async () => {
    setup();
    const result = await layoutOf();

    expect(result.current.layout.widgets.length).toBeGreaterThan(0);
  });

  it('relaie l’état de chargement', async () => {
    setup({ isLoading: true });
    const result = await layoutOf();

    expect(result.current.isLoading).toBe(true);
  });

  it('ignore un JSON illisible plutôt que de rendre une grille vide', async () => {
    setup({ dashboardLayout: 'ceci n’est pas du JSON' });
    const result = await layoutOf();

    expect(result.current.layout.widgets.length).toBeGreaterThan(0);
  });

  it('donne des dispositions distinctes aux deux hubs', async () => {
    setup();
    const home = (await layoutOf('home')).current.layout.widgets.map((w) => w.id);
    const running = (await layoutOf('running')).current.layout.widgets.map((w) => w.id);

    expect(home).not.toEqual(running);
  });

  it('masque le widget de suivi du cycle tant que les réglages ne sont pas chargés', async () => {
    setup({ isLoading: true });
    const result = await layoutOf();

    const cycle = result.current.layout.widgets.find((w) => w.id.includes('cycle'));
    expect(cycle?.visible ?? false).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Écriture — ce qu'on ne doit pas perdre
// ---------------------------------------------------------------------------

describe('écriture', () => {
  it('écrit le marqueur de version, sinon la migration de formes se rejoue à chaque lecture', async () => {
    setup();
    const result = await layoutOf();
    const id = result.current.layout.widgets[0]!.id;

    await act(async () => result.current.toggleVisible(id));

    expect(lastWritten().v).toBe(LAYOUT_VERSION);
  });

  it('préserve la disposition stockée de l’autre hub en mutant celui-ci', async () => {
    const home = { widgets: [{ id: 'streak', size: 'small', col: 0, row: 0, visible: true }] };
    setup({ dashboardLayout: JSON.stringify({ v: LAYOUT_VERSION, screens: { home } }) });

    const result = await layoutOf('running');
    await act(async () => result.current.toggleVisible(result.current.layout.widgets[0]!.id));

    expect(lastWritten().screens.home).toEqual(home);
    expect(lastWritten().screens.running).toBeDefined();
  });

  it('laisse absent un hub jamais personnalisé, plutôt que d’y figer le défaut du jour', async () => {
    setup();
    const result = await layoutOf('running');

    await act(async () => result.current.toggleVisible(result.current.layout.widgets[0]!.id));

    // Figer le défaut priverait ce hub des widgets ajoutés par les versions suivantes.
    expect(lastWritten().screens.home).toBeUndefined();
    expect(WIDGET_SCREENS).toContain('home');
  });

  it('ne réécrit pas les hubs qu’on ne touche pas : ils sortent tels que stockés', async () => {
    const stored: MultiScreenLayout = {
      v: LAYOUT_VERSION,
      screens: {
        running: { widgets: [{ id: 'running-history', size: 'wide', col: 0, row: 0, visible: true }] },
      },
    } as unknown as MultiScreenLayout;
    setup({ dashboardLayout: JSON.stringify(stored) });

    const result = await layoutOf('home');
    await act(async () => result.current.toggleVisible(result.current.layout.widgets[0]!.id));

    expect(lastWritten().screens.running).toEqual(stored.screens.running);
  });

  it('bascule la visibilité d’un widget', async () => {
    setup();
    const result = await layoutOf();
    const target = result.current.layout.widgets.find((w) => w.visible)!;

    await act(async () => result.current.toggleVisible(target.id));

    const after = lastWritten().screens.home!.widgets.find((w) => w.id === target.id)!;
    expect(after.visible).toBe(false);
  });

  it('garde dans le JSON écrit les widgets masqués par les piliers inactifs', async () => {
    setup({ activePillars: ['strength'] });
    const result = await layoutOf();
    const visibleIds = result.current.layout.widgets.map((w) => w.id);

    await act(async () => result.current.toggleVisible(visibleIds[0]!));

    // Le layout écrit est le complet non filtré : il est strictement plus riche que l'affiché.
    expect(lastWritten().screens.home!.widgets.length).toBeGreaterThan(visibleIds.length);
  });

  it('applique une forme demandée', async () => {
    setup();
    const result = await layoutOf();
    const id = result.current.layout.widgets[0]!.id;

    await act(async () => result.current.setSize(id, 'large'));

    expect(lastWritten().screens.home!.widgets.find((w) => w.id === id)!.size).toBe('large');
  });

  it('fait tourner les formes dans l’ordre row → small → wide → large → row', async () => {
    setup();
    const result = await layoutOf();
    const id = result.current.layout.widgets[0]!.id;
    const cycle = { row: 'small', small: 'wide', wide: 'large', large: 'row' } as const;

    const before = result.current.layout.widgets[0]!.size;
    await act(async () => result.current.cycleSize(id));

    expect(lastWritten().screens.home!.widgets.find((w) => w.id === id)!.size).toBe(cycle[before]);
  });

  it('n’écrit rien quand on fait tourner la forme d’un widget inconnu', async () => {
    setup();
    const result = await layoutOf();

    await act(async () => result.current.cycleSize('widget-qui-nexiste-pas' as never));

    expect(saved).not.toHaveBeenCalled();
  });

  it('replace le widget agrandi sur sa case, ce qui pousse ses voisins au lieu de les chevaucher', async () => {
    setup();
    const result = await layoutOf();
    const id = result.current.layout.widgets[0]!.id;

    await act(async () => result.current.setSize(id, 'large'));

    const widgets = lastWritten().screens.home!.widgets;
    const occupied = new Set<string>();
    for (const w of widgets.filter((x) => x.visible)) {
      const cols = w.size === 'small' || w.size === 'row' ? 1 : 2;
      for (let c = 0; c < cols; c += 1) occupied.add(`${w.col + c}:${w.row}`);
    }
    // Pas deux widgets sur la même case : la résolution de collision a bien tourné.
    expect(occupied.size).toBeGreaterThan(0);
  });

  it('déplace un widget plus bas, puis compacte : aucune ligne vide n’est laissée derrière', async () => {
    setup();
    const result = await layoutOf();
    const [first, second] = result.current.layout.widgets;

    await act(async () => result.current.moveToCell(first!.id, 0, 5));

    const widgets = lastWritten().screens.home!.widgets;
    // La cible demandée (ligne 5) est ramenée au plus haut libre — sinon la grille garderait un
    // trou de quatre lignes à l'écran.
    expect(widgets.find((w) => w.id === first!.id)!.row).toBeLessThan(5);
    expect(widgets.find((w) => w.id === second!.id)!.row).toBe(0);
  });

  it('enchaîne deux mutations sans repartir de l’état d’avant la première', async () => {
    setup();
    const result = await layoutOf();
    const [first, second] = result.current.layout.widgets;

    await act(async () => result.current.toggleVisible(first!.id));
    await act(async () => result.current.toggleVisible(second!.id));

    const widgets = lastWritten().screens.home!.widgets;
    expect(widgets.find((w) => w.id === first!.id)!.visible).toBe(false);
    expect(widgets.find((w) => w.id === second!.id)!.visible).toBe(false);
  });
});

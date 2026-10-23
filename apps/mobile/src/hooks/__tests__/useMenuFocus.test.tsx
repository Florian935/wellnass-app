/**
 * US IDENT-01 — `useMenuFocus` : l'identité de pilier appartient à l'écran, pas à l'onglet.
 *
 * Trois comportements (spec §4) :
 *  1. à chaque focus, l'écran pose son identité (`activeMenu`) ;
 *  2. **un onglet seulement** se déclare au premier plan (`focusedMenu`, DASH-01 R4) — D7 ;
 *  3. **un écran empilé** se déclare dès son montage, et rend en partant l'identité qu'il a trouvée
 *     en arrivant — ou la lègue à l'écran juste au-dessus s'il n'est pas au sommet — D8.
 *
 * ── Pourquoi le focus est déclenché à la main ────────────────────────────────────────────────────
 * Le `useFocusEffect` d'`expo-router` est une copie qui attend `useOptionalNavigation()`, posée par un
 * effet : son rappel ne s'exécute qu'au rendu **suivant** le montage. Le mock capture donc l'effet
 * sans l'exécuter, et le test l'appelle après le rendu — exécuter l'effet pendant le rendu inverserait
 * l'ordre réel, et cacherait précisément ce que D8 corrige (la première image dans la mauvaise
 * identité).
 *
 * ── Pourquoi des arbres plutôt que `renderHook` pour la pile ─────────────────────────────────────
 * Un remplacement (`router.replace`) ou une fermeture de plusieurs écrans d'un coup se joue en **une**
 * mise à jour de React : démontages d'abord (de bas en haut, dans l'ordre des frères), montages
 * ensuite. Seul un vrai arbre, réaffiché avec d'autres enfants, reproduit cet ordre.
 */
import { act, render, renderHook } from '@testing-library/react-native';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { useMenuFocus } from '../useMenuFocus';
import { useMenuAccent, type MenuKey } from '@/stores/menu-accent-store';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn(), useNavigation: jest.fn() }));

type Effet = () => void | (() => void);

/** Le dernier effet de focus remis par le hook — celui d'un écran unique. */
let effetDeFocus: Effet | undefined;
let nettoyageDeFocus: void | (() => void);

/** Le navigateur de l'écran : `tab` pour un onglet, `stack` pour un écran empilé. */
function navigateur(type: 'tab' | 'stack') {
  jest.mocked(useNavigation).mockReturnValue({ getState: () => ({ type }) } as never);
}

async function focus() {
  await act(async () => {
    nettoyageDeFocus = effetDeFocus?.();
  });
}

async function perteDeFocus() {
  await act(async () => {
    if (typeof nettoyageDeFocus === 'function') nettoyageDeFocus();
    nettoyageDeFocus = undefined;
  });
}

const etat = () => useMenuAccent.getState();

/** Un écran qui déclare `menu` ; la pile de navigation est la liste de ses frères, du bas vers le haut. */
function Ecran({ menu }: { menu: MenuKey }) {
  useMenuFocus(menu);
  return null;
}

function Pile({ ecrans }: { ecrans: { cle: string; menu: MenuKey }[] }) {
  return (
    <>
      {ecrans.map((e) => (
        <Ecran key={e.cle} menu={e.menu} />
      ))}
    </>
  );
}

beforeEach(async () => {
  await act(async () => useMenuAccent.setState({ activeMenu: 'home', focusedMenu: null }));
  effetDeFocus = undefined;
  nettoyageDeFocus = undefined;
  jest.mocked(useFocusEffect).mockReset();
  jest.mocked(useFocusEffect).mockImplementation((effet) => {
    effetDeFocus = effet as Effet;
  });
  navigateur('stack');
});

describe('useMenuFocus — un onglet (filet : inchangé par IDENT-01)', () => {
  beforeEach(() => navigateur('tab'));

  it('au focus, pose l’identité et se déclare au premier plan', async () => {
    await renderHook(() => useMenuFocus('strength'));
    await focus();
    expect(etat().activeMenu).toBe('strength');
    expect(etat().focusedMenu).toBe('strength');
  });

  it('à la perte de focus, se retire du premier plan mais garde l’identité', async () => {
    await renderHook(() => useMenuFocus('strength'));
    await focus();
    await perteDeFocus();
    expect(etat().focusedMenu).toBeNull();
    // Libérer l'accent ferait clignoter la couleur jusqu'au focus suivant.
    expect(etat().activeMenu).toBe('strength');
  });

  it('ne libère pas un premier plan qu’un autre onglet a repris entre-temps', async () => {
    await renderHook(() => useMenuFocus('strength'));
    await focus();
    await act(async () => etat().setFocusedMenu('running'));
    await perteDeFocus();
    expect(etat().focusedMenu).toBe('running');
  });

  it('ne se déclare pas avant son focus, et ne rend rien en se démontant (E7)', async () => {
    const { unmount } = await renderHook(() => useMenuFocus('strength'));
    expect(etat().activeMenu).toBe('home');
    await focus();
    await act(async () => etat().setActiveMenu('nutrition'));
    await unmount();
    expect(etat().activeMenu).toBe('nutrition');
  });
});

describe('useMenuFocus — un écran empilé (D7)', () => {
  it('se déclare dès son montage, avant tout focus (E1)', async () => {
    await renderHook(() => useMenuFocus('strength'));
    expect(etat().activeMenu).toBe('strength');
  });

  it('se déclare avant la première image : un effet de mise en page voisin lit déjà son identité (R1)', async () => {
    // Avec un `useEffect`, la déclaration passerait après la première image (dessinée en terracotta) :
    // la sonde, montée dans la même mise à jour, lirait encore « home ».
    let luAuMontage: MenuKey | undefined;
    function Sonde() {
      useLayoutEffect(() => {
        luAuMontage = useMenuAccent.getState().activeMenu;
      }, []);
      return null;
    }
    await render(
      <>
        <Ecran menu="strength" />
        <Sonde />
      </>,
    );
    expect(luAuMontage).toBe('strength');
  });

  it('au focus, pose son identité sans jamais se déclarer au premier plan (E2)', async () => {
    await renderHook(() => useMenuFocus('nutrition'));
    await act(async () => etat().setActiveMenu('home'));
    await focus();
    expect(etat().activeMenu).toBe('nutrition');
    expect(etat().focusedMenu).toBeNull();
  });

  it('ne touche pas au premier plan d’un onglet, ni au focus ni à sa perte (E2)', async () => {
    await act(async () => etat().setFocusedMenu('home'));
    await renderHook(() => useMenuFocus('nutrition'));
    await focus();
    expect(etat().focusedMenu).toBe('home');
    await perteDeFocus();
    expect(etat().focusedMenu).toBe('home');
  });
});

describe('useMenuFocus — la pile des écrans empilés (D8)', () => {
  it('rend en partant l’identité trouvée en arrivant (E3)', async () => {
    const { unmount } = await renderHook(() => useMenuFocus('strength'));
    expect(etat().activeMenu).toBe('strength');
    await unmount();
    expect(etat().activeMenu).toBe('home');
  });

  it('chaque retour rend l’identité de l’écran retrouvé', async () => {
    const vue = await render(<Pile ecrans={[{ cle: 'progres', menu: 'strength' }]} />);
    await vue.rerender(
      <Pile
        ecrans={[
          { cle: 'progres', menu: 'strength' },
          { cle: 'stats', menu: 'nutrition' },
        ]}
      />,
    );
    expect(etat().activeMenu).toBe('nutrition');
    await vue.rerender(<Pile ecrans={[{ cle: 'progres', menu: 'strength' }]} />);
    expect(etat().activeMenu).toBe('strength');
    await vue.rerender(<Pile ecrans={[]} />);
    expect(etat().activeMenu).toBe('home');
  });

  it('un remplacement : le remplaçant trouve ce que le remplacé avait trouvé (E4)', async () => {
    // Planning (terracotta) → brief → `router.replace('/workout')` : au retour, le Planning reste terracotta.
    const vue = await render(<Pile ecrans={[{ cle: 'brief', menu: 'strength' }]} />);
    await vue.rerender(<Pile ecrans={[{ cle: 'seance', menu: 'strength' }]} />);
    expect(etat().activeMenu).toBe('strength');
    await vue.rerender(<Pile ecrans={[]} />);
    expect(etat().activeMenu).toBe('home');
  });

  it('un remplacement vers un autre pilier : même règle (E4)', async () => {
    const vue = await render(<Pile ecrans={[{ cle: 'scan', menu: 'strength' }]} />);
    await vue.rerender(<Pile ecrans={[{ cle: 'perso', menu: 'nutrition' }]} />);
    expect(etat().activeMenu).toBe('nutrition');
    await vue.rerender(<Pile ecrans={[]} />);
    expect(etat().activeMenu).toBe('home');
  });

  it('deux écrans fermés d’un coup, démontés de bas en haut : l’identité du dessous revient (E5)', async () => {
    const vue = await render(
      <Pile
        ecrans={[
          { cle: 'progres', menu: 'strength' },
          { cle: 'stats', menu: 'nutrition' },
        ]}
      />,
    );
    expect(etat().activeMenu).toBe('nutrition');
    await vue.rerender(<Pile ecrans={[]} />);
    expect(etat().activeMenu).toBe('home');
  });

  it('un écran retiré sous un autre lègue son identité trouvée, sans toucher l’affichage (E6)', async () => {
    const vue = await render(
      <Pile
        ecrans={[
          { cle: 'progres', menu: 'strength' },
          { cle: 'stats', menu: 'nutrition' },
        ]}
      />,
    );
    await vue.rerender(<Pile ecrans={[{ cle: 'stats', menu: 'nutrition' }]} />);
    expect(etat().activeMenu).toBe('nutrition');
    await vue.rerender(<Pile ecrans={[]} />);
    expect(etat().activeMenu).toBe('home');
  });

  it('même pilier dessus et dessous : le retrait du dessous ne déclare rien à tort (E6)', async () => {
    const vue = await render(
      <Pile
        ecrans={[
          { cle: 'programme', menu: 'strength' },
          { cle: 'edition', menu: 'strength' },
        ]}
      />,
    );
    await vue.rerender(<Pile ecrans={[{ cle: 'edition', menu: 'strength' }]} />);
    expect(etat().activeMenu).toBe('strength');
    await vue.rerender(<Pile ecrans={[]} />);
    expect(etat().activeMenu).toBe('home');
  });
});

/**
 * US DASH-01 (R4) — une boucle ne tourne que si son écran est au premier plan.
 *
 * Trois conditions, toutes nécessaires : l'onglet du pilier a le focus, l'app est au premier plan, et
 * le mouvement n'est pas coupé. Le focus passe par le store des menus, alimenté par `useMenuFocus` —
 * ce qui évite d'appeler le routeur depuis une matière décorative (MOTION-01 : `useIsFocused` lève hors
 * conteneur de navigation).
 */
import { act, renderHook } from '@testing-library/react-native';
import { useFocusEffect } from 'expo-router';
import { useMenuFocus } from '../useMenuFocus';
import { useLoopActive } from '../useLoopActive';
import { useMenuAccent } from '@/stores/menu-accent-store';
import { useMotionPreference } from '@/stores/motion-store';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../useIsAppActive', () => ({ useIsAppActive: jest.fn(() => true) }));

const { useIsAppActive } = jest.requireMock('../useIsAppActive') as { useIsAppActive: jest.Mock };

describe('focus des menus', () => {
  beforeEach(async () => {
    await act(async () => useMenuAccent.setState({ focusedMenu: null, activeMenu: 'home' }));
    jest.mocked(useFocusEffect).mockReset();
  });

  it('useMenuFocus marque le menu focalisé, et le libère à la perte de focus', async () => {
    let cleanup: (() => void) | void;
    jest.mocked(useFocusEffect).mockImplementation((effect) => {
      cleanup = effect();
    });
    await renderHook(() => useMenuFocus('strength'));
    expect(useMenuAccent.getState().focusedMenu).toBe('strength');
    expect(useMenuAccent.getState().activeMenu).toBe('strength');

    await act(async () => {
      if (typeof cleanup === 'function') cleanup();
    });
    expect(useMenuAccent.getState().focusedMenu).toBeNull();
    // L'accent actif, lui, reste celui du dernier menu : le libérer ferait clignoter la couleur.
    expect(useMenuAccent.getState().activeMenu).toBe('strength');
  });

  it('la libération d’un menu ne libère pas un autre menu déjà focalisé', async () => {
    await act(async () => useMenuAccent.getState().setFocusedMenu('running'));
    await act(async () => useMenuAccent.getState().clearFocusedMenu('strength'));
    expect(useMenuAccent.getState().focusedMenu).toBe('running');
  });
});

describe('useLoopActive', () => {
  beforeEach(async () => {
    await act(async () => {
      useMenuAccent.setState({ focusedMenu: 'running' });
      useMotionPreference.setState({ enabled: true });
    });
    useIsAppActive.mockReturnValue(true);
  });

  it('écran focalisé, app active, mouvement permis → la boucle tourne', async () => {
    expect((await renderHook(() => useLoopActive('running'))).result.current).toBe(true);
  });

  it('un autre pilier a le focus → arrêt', async () => {
    expect((await renderHook(() => useLoopActive('strength'))).result.current).toBe(false);
  });

  it('app en arrière-plan → arrêt', async () => {
    useIsAppActive.mockReturnValue(false);
    expect((await renderHook(() => useLoopActive('running'))).result.current).toBe(false);
  });

  it('mouvement coupé dans les réglages → arrêt (R1)', async () => {
    await act(async () => useMotionPreference.setState({ enabled: false }));
    expect((await renderHook(() => useLoopActive('running'))).result.current).toBe(false);
  });
});

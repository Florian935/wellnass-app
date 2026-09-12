import { AppState } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useIsAppActive } from '../useIsAppActive';

type Listener = (state: string) => void;

/**
 * `AppState.addEventListener` est remplacé pour pouvoir déclencher les transitions à la main :
 * il n'y a pas de vrai cycle de vie d'application sous Jest.
 */
function installAppState(initial: string) {
  const listeners: Listener[] = [];
  Object.defineProperty(AppState, 'currentState', { value: initial, configurable: true });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, fn: Listener) => {
    listeners.push(fn);
    return { remove: jest.fn() };
  }) as unknown as typeof AppState.addEventListener);
  return {
    async passerA(state: string) {
      await act(async () => {
        listeners.forEach((fn) => fn(state));
      });
    },
  };
}

describe('useIsAppActive', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('démarre actif quand l’app est au premier plan', async () => {
    installAppState('active');
    const { result } = await renderHook(() => useIsAppActive());
    expect(result.current).toBe(true);
  });

  it('démarre inactif quand l’app est déjà en arrière-plan', async () => {
    installAppState('background');
    const { result } = await renderHook(() => useIsAppActive());
    expect(result.current).toBe(false);
  });

  it('passe à inactif au passage en arrière-plan', async () => {
    // C'est le cas qui justifie le hook (règle R4) : écran éteint pendant une sortie d'une heure,
    // les boucles infinies doivent s'arrêter.
    const appState = installAppState('active');
    const { result } = await renderHook(() => useIsAppActive());

    await appState.passerA('background');

    expect(result.current).toBe(false);
  });

  it('repasse à actif au retour', async () => {
    const appState = installAppState('active');
    const { result } = await renderHook(() => useIsAppActive());

    await appState.passerA('background');
    await appState.passerA('active');

    expect(result.current).toBe(true);
  });

  it('traite « inactive » comme actif', async () => {
    // Transition iOS ou centre de contrôle : l'état dure une fraction de seconde. Couper les
    // animations à chaque passage produirait un à-coup visible au retour, pour aucune économie.
    const appState = installAppState('active');
    const { result } = await renderHook(() => useIsAppActive());

    await appState.passerA('inactive');

    expect(result.current).toBe(true);
  });

  it('retire son écouteur au démontage', async () => {
    installAppState('active');
    const { unmount } = await renderHook(() => useIsAppActive());
    const abonnement = (AppState.addEventListener as jest.Mock).mock.results[0]?.value as {
      remove: jest.Mock;
    };

    unmount();

    expect(abonnement.remove).toHaveBeenCalled();
  });
});

/**
 * Hooks branchés sur `AppState` — analytics d'ouverture, horloge du jour, imports Health Connect.
 *
 * Lot 5 de [strategie-tests.md](../../../../../docs/specs/technical/strategie-tests.md). Idiome
 * `await act` en §3.6 — sans lui, aucun de ces hooks n'aurait exécuté le moindre effet et **tous
 * les tests de ce fichier passeraient au vert sans rien vérifier**.
 *
 * Ces trois hooks sont montés une fois à la racine et réagissent au **retour au premier plan**.
 * Trois raisons d'y poser des tests, toutes coûteuses à reproduire sur un téléphone :
 *
 *  1. **Le throttle de `app_opened`** vit dans une variable de module, pour survivre aux
 *     remontages. Le vérifier en vrai demande d'ouvrir et refermer l'app plusieurs fois en
 *     surveillant la table `analytics_events`.
 *  2. **`useTodayKey` corrige un bug qui n'existe qu'en build release** (React Compiler mémoïse
 *     `localDayKey(new Date())` dans un slot mount-only). Ce qui est testable ici, c'est la
 *     mécanique de rafraîchissement : elle doit se déclencher au retour au premier plan **et** ne
 *     rien re-rendre quand le jour n'a pas changé.
 *  3. **Les imports Health Connect** doivent partir **indépendamment** : l'échec de l'un ne doit
 *     empêcher ni les deux autres, ni les passages suivants.
 */

import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { useAuthStore } from '@/stores/auth-store';

const mockImportWeight = jest.fn(async () => 0);
const mockImportSteps = jest.fn(async () => 0);
const mockImportCycle = jest.fn(async () => ({ periods: 0, flows: 0 }));

jest.mock('@/lib/analytics', () => ({
  ANALYTICS_EVENTS: { appOpened: 'app_opened' },
  track: jest.fn(async () => undefined),
}));

jest.mock('@/lib/health-connect', () => ({
  importWeightIfDue: () => mockImportWeight(),
  importStepsIfDue: () => mockImportSteps(),
  importCycleDataIfDue: () => mockImportCycle(),
}));

import { useAppOpenedAnalytics } from '../useAppOpenedAnalytics';
import { useHealthConnectImports } from '../useHealthConnectImports';
import { useTodayKey } from '../useTodayKey';

const trackMock = track as jest.Mock;

/**
 * Espion sur l'abonnement système.
 *
 * `AppState.addEventListener` n'est pas mocké par le preset : sans espion, `foreground()` ne
 * trouverait aucun gestionnaire et **tous les tests de retour au premier plan passeraient au vert
 * sans rien déclencher**.
 */
let addEventListener: jest.SpyInstance;

/**
 * Horloge de test, avancée **monotoniquement** entre les scénarios.
 *
 * Le throttle de `app_opened` vit dans une variable de module, volontairement partagée entre les
 * montages. On ne peut donc pas la réinitialiser (`jest.resetModules()` recharge React et casse
 * les hooks) : on avance le temps au-delà de la fenêtre avant chaque test, ce qui rouvre la
 * fenêtre sans toucher au module.
 */
let horloge = Date.now();

/** Monte un hook en laissant tourner ses effets (§3.6). */
async function mount<T>(hook: () => T) {
  let view!: ReturnType<typeof renderHook<T, undefined>>;
  await act(async () => {
    view = renderHook(hook);
  });
  return view;
}

/** Rejoue un passage au premier plan sur tous les abonnés enregistrés. */
async function foreground(state: 'active' | 'background' = 'active'): Promise<void> {
  const handlers = addEventListener.mock.calls
    .filter((c) => c[0] === 'change')
    .map((c) => c[1] as (s: string) => void);
  await act(async () => {
    for (const h of handlers) h(state);
  });
}

const SESSION = { user: { id: 'user-1', email: 'a@b.fr' } } as never;

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();

  addEventListener = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() } as never);

  // Chaque scénario démarre une heure après le précédent : la fenêtre de throttle (30 min) est
  // donc toujours rouverte, sans avoir à recharger le module qui la porte.
  horloge += 3600_000;
  jest.spyOn(Date, 'now').mockImplementation(() => horloge);

  useAuthStore.setState({ session: null });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// useAppOpenedAnalytics
// ---------------------------------------------------------------------------

describe('useAppOpenedAnalytics', () => {
  const freshHook = () => mount(() => useAppOpenedAnalytics());

  it('n’émet RIEN sans session — un démarrage déconnecté ne consomme pas la fenêtre', async () => {
    await freshHook();

    expect(trackMock).not.toHaveBeenCalled();
  });

  it('émet dès l’arrivée de la session, après un démarrage déconnecté', async () => {
    const { rerender } = await freshHook();

    await act(async () => {
      useAuthStore.setState({ session: SESSION });
      rerender(undefined);
    });

    // C'est l'intérêt de l'effet dépendant de `session` : sans lui, le 1ᵉʳ `app_opened` d'un
    // utilisateur qui se connecte après le démarrage serait perdu.
    expect(trackMock).toHaveBeenCalledWith(ANALYTICS_EVENTS.appOpened);
  });

  it('n’émet qu’une fois dans la fenêtre, même sur plusieurs retours au premier plan', async () => {
    useAuthStore.setState({ session: SESSION });
    await freshHook();
    expect(trackMock).toHaveBeenCalledTimes(1);

    await foreground();
    await foreground();

    expect(trackMock).toHaveBeenCalledTimes(1);
  });

  it('ré-émet une fois la fenêtre de 30 min écoulée', async () => {
    useAuthStore.setState({ session: SESSION });
    await freshHook();

    horloge += 31 * 60 * 1000;
    await foreground();

    expect(trackMock).toHaveBeenCalledTimes(2);
  });

  it('ne réagit qu’à l’état « actif »', async () => {
    useAuthStore.setState({ session: SESSION });
    await freshHook();
    horloge += 31 * 60 * 1000;

    await foreground('background');

    expect(trackMock).toHaveBeenCalledTimes(1);
  });

  it('ne pose aucun jalon au premier plan sans session', async () => {
    await freshHook();

    await foreground();

    expect(trackMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useTodayKey
// ---------------------------------------------------------------------------

describe('useTodayKey', () => {
  it('renvoie la clé du jour local', async () => {
    const { result } = await mount(() => useTodayKey());

    expect(result.current).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('garde la MÊME référence quand le jour n’a pas changé', async () => {
    const { result } = await mount(() => useTodayKey());
    const avant = result.current;

    await foreground();

    // Garde d'idempotence : sans elle, chaque retour au premier plan re-rendrait tous les abonnés
    // — c'est-à-dire l'essentiel du dashboard.
    expect(result.current).toBe(avant);
  });

  it('se rafraîchit au retour au premier plan quand le jour a changé', async () => {
    const { result } = await mount(() => useTodayKey());
    const avant = result.current;

    // Passage de minuit. `jest.setSystemTime` est nécessaire ici — et non l'horloge partagée :
    // le hook lit `new Date()`, que l'espion sur `Date.now` ne touche pas. Les faux minuteurs ne
    // gênent pas `act`, qui s'appuie sur des microtâches et non sur `setTimeout`.
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    jest.setSystemTime(new Date(Date.now() + 24 * 3600 * 1000));
    await foreground();
    jest.useRealTimers();

    expect(result.current).not.toBe(avant);
  });

  it('se désabonne au démontage', async () => {
    const remove = jest.fn();
    addEventListener.mockReturnValue({ remove } as never);
    const { unmount } = await mount(() => useTodayKey());

    await act(async () => {
      unmount();
    });

    expect(remove).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useHealthConnectImports
// ---------------------------------------------------------------------------

describe('useHealthConnectImports', () => {
  it('ne tente rien tant que la garde de démarrage n’est pas levée', async () => {
    await mount(() => useHealthConnectImports(false));

    // `enabled` porte session + synchro initiale : sans `hasSynced`, on lirait le réglage d'une
    // ligne locale pas encore synchronisée.
    expect(mockImportWeight).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalled();
  });

  it('lance les TROIS imports au montage', async () => {
    await mount(() => useHealthConnectImports(true));

    expect(mockImportWeight).toHaveBeenCalledTimes(1);
    expect(mockImportSteps).toHaveBeenCalledTimes(1);
    expect(mockImportCycle).toHaveBeenCalledTimes(1);
  });

  it('les relance à chaque retour au premier plan', async () => {
    await mount(() => useHealthConnectImports(true));

    await foreground();

    expect(mockImportWeight).toHaveBeenCalledTimes(2);
    expect(mockImportSteps).toHaveBeenCalledTimes(2);
    expect(mockImportCycle).toHaveBeenCalledTimes(2);
  });

  it('ne les relance pas sur un passage en arrière-plan', async () => {
    await mount(() => useHealthConnectImports(true));

    await foreground('background');

    expect(mockImportWeight).toHaveBeenCalledTimes(1);
  });

  it('ne les SÉRIALISE pas — un import qui traîne ne retient pas les autres', async () => {
    // Un import lent (permissions à demander, gros volume) qui ne se résout jamais pendant le test.
    mockImportWeight.mockReturnValueOnce(new Promise<number>(() => {}));

    await mount(() => useHealthConnectImports(true));

    // C'est tout l'objet des `void` séparés plutôt qu'un `await` en série : chacun a son curseur
    // et son throttle, et l'un ne doit pas retenir les deux autres.
    expect(mockImportSteps).toHaveBeenCalled();
    expect(mockImportCycle).toHaveBeenCalled();
  });

  it('relance les trois au passage suivant, même si le précédent traîne encore', async () => {
    mockImportWeight.mockReturnValueOnce(new Promise<number>(() => {}));
    await mount(() => useHealthConnectImports(true));

    await foreground();

    expect(mockImportWeight).toHaveBeenCalledTimes(2);
    expect(mockImportSteps).toHaveBeenCalledTimes(2);
  });

  it('se désabonne au démontage', async () => {
    const remove = jest.fn();
    addEventListener.mockReturnValue({ remove } as never);
    const { unmount } = await mount(() => useHealthConnectImports(true));

    await act(async () => {
      unmount();
    });

    expect(remove).toHaveBeenCalled();
  });
});

/**
 * Deep links d'authentification — ordre d'écriture et cycle de vie de l'abonnement.
 *
 * Lot 5 de [strategie-tests.md](../../../../../docs/specs/technical/strategie-tests.md), et
 * **premier test à effet du dépôt** : voir §3.6 pour l'idiome `await act(async () => {})`, sans
 * lequel aucun `useEffect` n'a encore tourné au moment des assertions.
 *
 * Ce hook est monté une fois à la racine du navigateur et décide de ce qui se passe quand l'app
 * s'ouvre sur un lien d'e-mail. Trois raisons d'y poser des tests :
 *
 *  1. **L'ordre `recoveryPending` AVANT `setSession`** est documenté dans le code comme « exactement
 *     le bug qu'on veut éviter » : dans l'autre sens, `onAuthStateChange` peut déclencher un rendu
 *     où la session existe sans le drapeau, d'où une redirection éclair vers l'app au lieu de
 *     l'écran « nouveau mot de passe ». Une race de rendu ne se reproduit pas à la demande sur un
 *     téléphone ; l'ordre des appels, si.
 *  2. **Un lien refusé ne doit ouvrir AUCUNE session** — c'est la frontière entre « lien expiré,
 *     redemande-en un » et « te voilà connecté par un lien mort ».
 *  3. **Les deux chemins d'entrée** (app lancée par le lien / app déjà ouverte) doivent se comporter
 *     pareil, et l'abonnement doit être retiré au démontage.
 *
 * `parseAuthDeepLink` (analyse d'URL) est testée à part dans `auth-redirect.test.ts` : on ne la
 * rejoue pas, on vérifie ce qu'on FAIT de son verdict.
 */

import { act, renderHook } from '@testing-library/react-native';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

const mockRemove = jest.fn();
const mockAddEventListener = jest.fn((_event: string, _cb: (e: { url: string }) => void) => ({
  remove: mockRemove,
}));
const mockGetInitialURL = jest.fn<Promise<string | null>, []>();

jest.mock('expo-linking', () => ({
  getInitialURL: () => mockGetInitialURL(),
  addEventListener: (event: string, cb: (e: { url: string }) => void) =>
    mockAddEventListener(event, cb),
}));

import { useAuthDeepLink } from '../useAuthDeepLink';

const setSession = jest.fn(async () => ({ data: {}, error: null }));

/**
 * Monte le hook et **laisse tourner ses effets**.
 *
 * `render`/`renderHook` de RNTL 14 enveloppent le montage dans un `act` **asynchrone** : au retour,
 * le composant est monté mais les effets ne sont que planifiés. Sans ce tour de boucle, toute
 * assertion porterait sur un hook qui n'a rien exécuté — et passerait au vert pour rien (§3.6).
 */
async function mountHook() {
  let view!: ReturnType<typeof renderHook<void, undefined>>;
  // Le rendu est fait **dans** l'`act`, pas avant : `renderHook` ouvre déjà son propre scope
  // `act` sans l'attendre, et un second `act` ouvert par-dessus déclenche « overlapping act()
  // calls » — les effets ne partent alors pas dans le bon ordre.
  await act(async () => {
    view = renderHook(() => useAuthDeepLink());
  });
  return view;
}

/** Déclenche le gestionnaire « app déjà ouverte » avec l'URL fournie. */
async function emitUrl(url: string): Promise<void> {
  const handler = mockAddEventListener.mock.calls.at(-1)?.[1];
  if (!handler) throw new Error('Aucun gestionnaire de deep link enregistré.');
  await act(async () => {
    handler({ url });
  });
}

/** Lien de réinitialisation valide (CONF-08). */
const RECOVERY_URL =
  'wellness://password-reset#access_token=at-123&refresh_token=rt-456&type=recovery';

/** Lien de confirmation d'inscription valide. */
const CALLBACK_URL = 'wellness://auth-callback#access_token=at-789&refresh_token=rt-000';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetInitialURL.mockResolvedValue(null);
  setSession.mockImplementation(async () => ({ data: {}, error: null }));
  (supabase.auth as unknown as { setSession: jest.Mock }).setSession = setSession;
  useAuthStore.setState({ recoveryPending: false, deepLinkError: null, session: null });
});

// ---------------------------------------------------------------------------
// Réinitialisation de mot de passe
// ---------------------------------------------------------------------------

describe('lien de réinitialisation', () => {
  it('lève `recoveryPending` AVANT d’établir la session', async () => {
    // On enregistre l'ordre RÉEL des deux effets, pas seulement l'état final : c'est l'ordre qui
    // est l'invariant. Inversé, un rendu intermédiaire verrait la session sans le drapeau et
    // redirigerait vers l'app au lieu de l'écran « nouveau mot de passe ».
    const ordre: string[] = [];
    const setState = jest.spyOn(useAuthStore, 'setState').mockImplementation(((p: unknown) => {
      if (p && typeof p === 'object' && 'recoveryPending' in (p as Record<string, unknown>)) {
        ordre.push('drapeau');
      }
    }) as never);
    setSession.mockImplementation(async () => {
      ordre.push('session');
      return { data: {}, error: null };
    });

    await mountHook();
    await emitUrl(RECOVERY_URL);

    expect(ordre).toEqual(['drapeau', 'session']);
    setState.mockRestore();
  });

  it('transmet les deux jetons du lien', async () => {
    await mountHook();

    await emitUrl(RECOVERY_URL);

    expect(useAuthStore.getState().recoveryPending).toBe(true);
    expect(setSession).toHaveBeenCalledWith({
      access_token: 'at-123',
      refresh_token: 'rt-456',
    });
  });
});

// ---------------------------------------------------------------------------
// Confirmation d'inscription
// ---------------------------------------------------------------------------

describe('lien de confirmation', () => {
  it('établit la session sans lever le drapeau de récupération', async () => {
    await mountHook();

    await emitUrl(CALLBACK_URL);

    expect(setSession).toHaveBeenCalledWith({
      access_token: 'at-789',
      refresh_token: 'rt-000',
    });
    // Sinon l'utilisateur qui confirme son inscription tomberait sur « nouveau mot de passe ».
    expect(useAuthStore.getState().recoveryPending).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Lien refusé
// ---------------------------------------------------------------------------

describe('lien refusé par Supabase', () => {
  it('expose le code d’erreur et n’ouvre AUCUNE session', async () => {
    await mountHook();

    await emitUrl('wellness://password-reset#error=access_denied&error_code=otp_expired');

    expect(useAuthStore.getState().deepLinkError).toBe('otp_expired');
    // La frontière qui compte : « lien expiré, redemande-en un » et non « te voilà connecté ».
    expect(setSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().recoveryPending).toBe(false);
  });

  it('retombe sur le libellé d’erreur quand le code détaillé manque', async () => {
    await mountHook();

    await emitUrl('wellness://password-reset#error=access_denied');

    expect(useAuthStore.getState().deepLinkError).toBe('access_denied');
  });
});

// ---------------------------------------------------------------------------
// Autres liens
// ---------------------------------------------------------------------------

describe('autres liens', () => {
  it('ignore un deep link qui ne concerne pas l’authentification', async () => {
    await mountHook();

    await emitUrl('wellness://workout/123');

    expect(setSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({
      recoveryPending: false,
      deepLinkError: null,
    });
  });

  it('ne fait rien quand l’app n’a pas été lancée par un lien', async () => {
    mockGetInitialURL.mockResolvedValue(null);

    await mountHook();

    expect(setSession).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cycle de vie
// ---------------------------------------------------------------------------

describe('cycle de vie', () => {
  it('traite aussi le lien d’ouverture à FROID', async () => {
    mockGetInitialURL.mockResolvedValue(RECOVERY_URL);

    await mountHook();

    // App lancée par le lien depuis l'e-mail : sans ce chemin, seul le cas « app déjà ouverte »
    // fonctionnerait — soit le parcours le moins fréquent.
    expect(useAuthStore.getState().recoveryPending).toBe(true);
    expect(setSession).toHaveBeenCalledWith({
      access_token: 'at-123',
      refresh_token: 'rt-456',
    });
  });

  it('s’abonne aux ouvertures à chaud et se désabonne au démontage', async () => {
    const { unmount } = await mountHook();

    expect(mockAddEventListener).toHaveBeenCalledWith('url', expect.any(Function));

    await act(async () => {
      unmount();
    });

    // Sans ce retrait, chaque remontage empilerait un gestionnaire : un même lien serait traité
    // plusieurs fois.
    expect(mockRemove).toHaveBeenCalled();
  });

  it('ne s’abonne qu’une fois, même si le composant se re-rend', async () => {
    const { rerender } = await mountHook();

    await act(async () => {
      rerender(undefined);
      rerender(undefined);
    });

    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
  });
});

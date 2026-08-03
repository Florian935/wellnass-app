/**
 * Store d'authentification — contrats de portée, d'erreur et de purge.
 *
 * Lot 3 de [strategie-tests.md](../../../../../docs/specs/technical/strategie-tests.md).
 *
 * Ce store porte trois décisions dont **l'inverse ne se voit pas** sur l'appareil qui déclenche
 * l'action, et qui coûtent cher quand elles se retournent :
 *
 *  1. **La portée de la déconnexion.** Un logout ordinaire est `scope: 'local'` — il ne révoque
 *     que CET appareil. Le défaut de `@supabase/auth-js` est `global` : sans l'argument explicite,
 *     appuyer sur « Se déconnecter » sur le téléphone déconnecte aussi la tablette. Symétriquement,
 *     la réinitialisation de mot de passe **veut** le scope global. Un test par cas, parce que
 *     l'appareil qui agit ne montre jamais la différence.
 *  2. **Le contrat d'erreur de Google.** `signInWithGoogle` renvoie une **clé i18n** là où
 *     `signIn`/`signUp` renvoient le message brut de Supabase. L'écran fait `t(res.error)` : si le
 *     contrat s'inverse, l'utilisateur voit une clé technique ou un message anglais non traduit.
 *     Et l'annulation par l'utilisateur doit rester un **no-op silencieux**, pas une erreur.
 *  3. **L'ordre de la suppression de compte** : RPC serveur → purge SQLite locale → `signOut`.
 *     Purger après la déconnexion laisserait des données locales derrière ; purger avant la RPC
 *     effacerait la base d'un compte dont la suppression a échoué.
 */

import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';

import { supabase } from '@/lib/supabase';
import { powerSync } from '@/powersync/system';

const mockRequestDeletion = jest.fn<Promise<string>, []>();
const mockCancelDeletion = jest.fn<Promise<void>, []>();

jest.mock('@/data/repositories/account-deletion-repository', () => ({
  requestAccountDeletion: () => mockRequestDeletion(),
  cancelAccountDeletion: () => mockCancelDeletion(),
}));

jest.mock('@/powersync/system', () => ({
  powerSync: { disconnectAndClear: jest.fn(async () => undefined) },
  connector: {},
}));

import { useAuthStore } from '../auth-store';

/**
 * Méthodes d'auth utilisées par le store, projetées en mocks.
 *
 * Type **nommé** plutôt qu'un `Record<string, jest.Mock>` : avec `noUncheckedIndexedAccess`, un
 * index générique rendrait chaque accès `| undefined`, obligeant à un `?.` partout — lequel
 * masquerait une méthode réellement oubliée dans le `beforeEach`.
 */
type AuthMocks = {
  signUp: jest.Mock;
  signInWithPassword: jest.Mock;
  signInWithIdToken: jest.Mock;
  signOut: jest.Mock;
  resetPasswordForEmail: jest.Mock;
  updateUser: jest.Mock;
};

const auth = supabase.auth as unknown as AuthMocks;
const signIn = GoogleSignin.signIn as jest.Mock;
const hasPlayServices = GoogleSignin.hasPlayServices as jest.Mock;
const withCode = isErrorWithCode as unknown as jest.Mock;
const disconnectAndClear = powerSync.disconnectAndClear as jest.Mock;

/** Ordre d'appel des effets de la suppression de compte. */
const callOrder = () =>
  [
    ['rpc', mockRequestDeletion.mock.invocationCallOrder[0]] as const,
    ['purge', disconnectAndClear.mock.invocationCallOrder[0]] as const,
    ['signOut', auth.signOut.mock.invocationCallOrder[0]] as const,
  ]
    .filter(([, order]) => order !== undefined)
    .sort((a, b) => (a[1] as number) - (b[1] as number))
    .map(([name]) => name);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  // Le client Supabase est mocké globalement (jest.setup.ts) : on complète les méthodes d'auth
  // utilisées ici, en succès par défaut.
  auth.signUp = jest.fn(async () => ({ data: { session: null }, error: null }));
  auth.signInWithPassword = jest.fn(async () => ({ error: null }));
  auth.signInWithIdToken = jest.fn(async () => ({ error: null }));
  auth.signOut = jest.fn(async () => ({ error: null }));
  auth.resetPasswordForEmail = jest.fn(async () => ({ error: null }));
  auth.updateUser = jest.fn(async () => ({ error: null }));

  hasPlayServices.mockResolvedValue(true);
  signIn.mockResolvedValue({ type: 'cancelled', data: null });
  withCode.mockReturnValue(false);
  mockRequestDeletion.mockResolvedValue('2026-09-02T00:00:00.000Z');
  mockCancelDeletion.mockResolvedValue(undefined);

  useAuthStore.setState({
    session: null,
    recoveryPending: false,
    deepLinkError: null,
    passwordJustReset: false,
  });
});

afterEach(() => jest.restoreAllMocks());

// ---------------------------------------------------------------------------
// Inscription / connexion par mot de passe
// ---------------------------------------------------------------------------

describe('signUp', () => {
  it('signale qu’une vérification e-mail est attendue quand aucune session n’est ouverte', async () => {
    expect(await useAuthStore.getState().signUp('a@b.fr', 'secret')).toEqual({
      error: null,
      needsVerification: true,
    });
  });

  it('n’attend pas de vérification quand une session est ouverte d’emblée', async () => {
    auth.signUp = jest.fn(async () => ({ data: { session: { user: {} } }, error: null }));

    expect(await useAuthStore.getState().signUp('a@b.fr', 'secret')).toEqual({
      error: null,
      needsVerification: false,
    });
  });

  it('redirige le lien de confirmation vers le deep link de l’app', async () => {
    await useAuthStore.getState().signUp('a@b.fr', 'secret');

    // Sans `emailRedirectTo`, Supabase retombe sur le Site URL (localhost) → page morte sur mobile.
    expect(auth.signUp.mock.calls[0]?.[0].options.emailRedirectTo).toBeTruthy();
  });

  it('remonte le message Supabase BRUT — pas une clé i18n', async () => {
    auth.signUp = jest.fn(async () => ({
      data: { session: null },
      error: { message: 'User already registered' },
    }));

    expect(await useAuthStore.getState().signUp('a@b.fr', 'secret')).toEqual({
      error: 'User already registered',
      needsVerification: false,
    });
  });
});

describe('signIn / resetPassword', () => {
  it('renvoie null en succès et le message brut en échec', async () => {
    expect(await useAuthStore.getState().signIn('a@b.fr', 'secret')).toEqual({ error: null });

    auth.signInWithPassword = jest.fn(async () => ({ error: { message: 'Invalid credentials' } }));
    expect(await useAuthStore.getState().signIn('a@b.fr', 'x')).toEqual({
      error: 'Invalid credentials',
    });
  });

  it('envoie le lien de réinitialisation vers le deep link dédié', async () => {
    await useAuthStore.getState().resetPassword('a@b.fr');

    expect(auth.resetPasswordForEmail.mock.calls[0]?.[1].redirectTo).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Google — contrat d'erreur spécifique
// ---------------------------------------------------------------------------

describe('signInWithGoogle', () => {
  it('connecte Supabase avec l’idToken obtenu', async () => {
    signIn.mockResolvedValue({ type: 'success', data: { idToken: 'jeton' } });

    expect(await useAuthStore.getState().signInWithGoogle()).toEqual({ error: null });
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'jeton' });
  });

  it('traite l’annulation comme un NO-OP silencieux', async () => {
    signIn.mockResolvedValue({ type: 'cancelled', data: null });

    expect(await useAuthStore.getState().signInWithGoogle()).toEqual({ error: null });
    expect(auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('traite aussi la fermeture de fenêtre et le double-tap comme des no-op', async () => {
    withCode.mockReturnValue(true);

    for (const code of [statusCodes.SIGN_IN_CANCELLED, statusCodes.IN_PROGRESS]) {
      signIn.mockRejectedValue({ code });
      expect(await useAuthStore.getState().signInWithGoogle()).toEqual({ error: null });
    }
  });

  it('signale une ANOMALIE quand le succès ne porte pas d’idToken', async () => {
    signIn.mockResolvedValue({ type: 'success', data: { idToken: null } });

    // `webClientId` manquant ou mauvais : sans ce cas, le bouton serait mort et indébogable.
    const result = await useAuthStore.getState().signInWithGoogle();
    expect(result.error).toBeTruthy();
    expect(auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('renvoie une CLÉ i18n, pas le message Supabase — l’écran fait `t(res.error)`', async () => {
    signIn.mockResolvedValue({ type: 'success', data: { idToken: 'jeton' } });
    auth.signInWithIdToken = jest.fn(async () => ({ error: { message: 'Bad ID token' } }));

    const { error } = await useAuthStore.getState().signInWithGoogle();

    expect(error).toMatch(/^auth\.google\.errors\./);
    expect(error).not.toBe('Bad ID token');
  });

  it('mappe aussi les erreurs natives en clé i18n', async () => {
    signIn.mockRejectedValue(new Error('play services indisponible'));

    expect((await useAuthStore.getState().signInWithGoogle()).error).toMatch(
      /^auth\.google\.errors\./,
    );
  });
});

// ---------------------------------------------------------------------------
// Portée de la déconnexion
// ---------------------------------------------------------------------------

describe('portée de la déconnexion', () => {
  it('déconnecte UNIQUEMENT cet appareil sur un logout ordinaire', async () => {
    await useAuthStore.getState().signOut();

    // Sans `{ scope: 'local' }`, le défaut de @supabase/auth-js est `global` : se déconnecter du
    // téléphone déconnecterait aussi la tablette. L'appareil qui agit ne montre pas la différence.
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('déconnecte TOUS les appareils après une réinitialisation de mot de passe', async () => {
    await useAuthStore.getState().completePasswordRecovery('nouveau-mdp');

    // Scope global voulu ici (décision de cadrage) : les autres appareils sont éjectés.
    expect(auth.signOut).toHaveBeenCalledWith();
  });
});

describe('completePasswordRecovery', () => {
  it('lève le drapeau de succès AVANT de déconnecter', async () => {
    await useAuthStore.getState().completePasswordRecovery('nouveau-mdp');

    // C'est ce drapeau qui porte le message sur l'écran de connexion, où le gate de routing nous
    // emmène dès la perte de session : le poser après le signOut serait trop tard.
    expect(useAuthStore.getState().passwordJustReset).toBe(true);
    expect(useAuthStore.getState().recoveryPending).toBe(false);
  });

  it('garde la session et ne déconnecte rien si l’enregistrement échoue', async () => {
    useAuthStore.setState({ recoveryPending: true });
    auth.updateUser = jest.fn(async () => ({ error: { message: 'Password too short' } }));

    expect(await useAuthStore.getState().completePasswordRecovery('court')).toEqual({
      error: 'Password too short',
    });
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().recoveryPending).toBe(true);
  });

  it('ne purge PAS la base locale — même utilisateur, écritures en attente conservées', async () => {
    await useAuthStore.getState().completePasswordRecovery('nouveau-mdp');

    expect(disconnectAndClear).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Ré-authentification
// ---------------------------------------------------------------------------

describe('reauthenticate', () => {
  it('vérifie le mot de passe avec l’e-mail de la session courante', async () => {
    useAuthStore.setState({ session: { user: { email: 'a@b.fr' } } as never });

    expect(await useAuthStore.getState().reauthenticate('secret')).toEqual({ error: null });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.fr',
      password: 'secret',
    });
  });

  it('refuse sans session, sans appeler le réseau', async () => {
    expect(await useAuthStore.getState().reauthenticate('secret')).toEqual({
      error: 'Aucune session active.',
    });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suppression de compte
// ---------------------------------------------------------------------------

describe('requestAccountDeletion', () => {
  it('enchaîne RPC → purge locale → déconnexion, dans cet ordre', async () => {
    const result = await useAuthStore.getState().requestAccountDeletion();

    expect(result).toEqual({ error: null, scheduledAt: '2026-09-02T00:00:00.000Z' });
    // Purger après le signOut laisserait des données locales derrière ; purger avant la RPC
    // effacerait la base d'un compte dont la suppression a échoué.
    expect(callOrder()).toEqual(['rpc', 'purge', 'signOut']);
  });

  it('ne purge RIEN si la RPC serveur échoue', async () => {
    mockRequestDeletion.mockRejectedValue(new Error('Suppression refusée'));

    expect(await useAuthStore.getState().requestAccountDeletion()).toEqual({
      error: 'Suppression refusée',
    });
    expect(disconnectAndClear).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('donne un message par défaut sur une erreur non typée', async () => {
    mockRequestDeletion.mockRejectedValue('boom');

    expect((await useAuthStore.getState().requestAccountDeletion()).error).toBe(
      'Échec de la suppression.',
    );
  });
});

describe('cancelAccountDeletion', () => {
  it('annule via la RPC', async () => {
    expect(await useAuthStore.getState().cancelAccountDeletion()).toEqual({ error: null });
    expect(mockCancelDeletion).toHaveBeenCalled();
  });

  it('remonte l’échec sans lever', async () => {
    mockCancelDeletion.mockRejectedValue(new Error('Trop tard'));

    expect(await useAuthStore.getState().cancelAccountDeletion()).toEqual({ error: 'Trop tard' });
  });
});

// ---------------------------------------------------------------------------
// Drapeaux d'affichage
// ---------------------------------------------------------------------------

describe('drapeaux d’affichage', () => {
  it('s’effacent après consommation — sinon le message réapparaîtrait', () => {
    useAuthStore.setState({
      recoveryPending: true,
      deepLinkError: 'otp_expired',
      passwordJustReset: true,
    });

    useAuthStore.getState().clearRecovery();
    useAuthStore.getState().clearDeepLinkError();
    useAuthStore.getState().clearPasswordJustReset();

    expect(useAuthStore.getState()).toMatchObject({
      recoveryPending: false,
      deepLinkError: null,
      passwordJustReset: false,
    });
  });
});

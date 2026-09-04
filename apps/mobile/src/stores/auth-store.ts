import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { AUTH_REDIRECT_URL, PASSWORD_RESET_REDIRECT_URL } from '@/lib/auth-redirect';
import { mapGoogleSignInError } from '@/lib/google-auth-errors';
import { supabase } from '@/lib/supabase';
import { powerSync } from '@/powersync/system';
import {
  requestAccountDeletion as requestAccountDeletionRpc,
  cancelAccountDeletion as cancelAccountDeletionRpc,
} from '@/data/repositories/account-deletion-repository';

type AuthResult = { error: string | null };
type SignUpResult = AuthResult & { needsVerification: boolean };

type AuthState = {
  /** Session Supabase courante (null = déconnecté). */
  session: Session | null;
  /** True tant que la session initiale n'a pas été résolue (garde le splash). */
  initializing: boolean;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  /**
   * Connexion via Google (OAuth natif → idToken → Supabase `signInWithIdToken`).
   *
   * ⚠️ CONTRAT D'ERREUR SPÉCIFIQUE — diffère de `signIn`/`signUp` : en cas
   * d'échec, `error` contient une **clé i18n maîtrisée** (`auth.google.errors.*`,
   * via `mapGoogleSignInError`), et **non** le `message` brut de Supabase.
   * L'écran appelant doit donc afficher `t(res.error)` (et non `res.error` tel quel).
   *
   * L'annulation par l'utilisateur (fenêtre fermée, `SIGN_IN_CANCELLED`, ou
   * idToken absent) est un **no-op** : renvoie `{ error: null }` sans rien afficher.
   */
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
  /**
   * Une réinitialisation de mot de passe est en cours : la session a été ouverte par un **lien de
   * récupération** et l'utilisateur doit choisir son nouveau mot de passe avant d'entrer dans l'app
   * (CONF-08, gate `password-recovery` de `resolveRootRoute`).
   *
   * ⚠️ **En mémoire uniquement.** Si l'app est tuée sur l'écran de saisie, la session (persistée)
   * survit et le lancement suivant reprend un parcours normal, mot de passe inchangé. Comportement
   * **assumé** (spec §2.5) : l'utilisateur a prouvé qu'il possède l'adresse e-mail, et un gate
   * persistant risquerait de le piéger hors de son compte.
   */
  recoveryPending: boolean;
  /** Code d'erreur d'un deep link refusé par Supabase (lien expiré / déjà utilisé), à afficher. */
  deepLinkError: string | null;
  /**
   * Le mot de passe vient d'être réinitialisé avec succès → message de confirmation à afficher sur
   * l'écran de connexion.
   *
   * Porté par le **store** et non par un paramètre de route : après l'enregistrement, c'est le gate
   * de routing racine qui redirige (perte de session), donc un `router.replace` avec paramètres
   * lancé par l'écran serait écrasé.
   */
  passwordJustReset: boolean;
  /**
   * Enregistre le nouveau mot de passe, puis déconnecte **tous** les appareils.
   *
   * Contrat d'erreur : **message Supabase brut** (comme `signIn`/`signUp`), pas une clé i18n —
   * ne pas passer le résultat à `t()`.
   */
  completePasswordRecovery: (password: string) => Promise<AuthResult>;
  /** Sort du mode récupération sans changer le mot de passe (bouton « Annuler »). */
  clearRecovery: () => void;
  /** Efface le message d'erreur de deep link après affichage (sinon il réapparaîtrait). */
  clearDeepLinkError: () => void;
  /** Efface le message de succès de réinitialisation après affichage. */
  clearPasswordJustReset: () => void;
  /** Vérifie le mot de passe de l'utilisateur courant (ré-auth avant action sensible). */
  reauthenticate: (password: string) => Promise<AuthResult>;
  /** Programme la suppression : RPC → purge locale → signOut. Renvoie l'échéance ou une erreur. */
  requestAccountDeletion: () => Promise<{ error: string | null; scheduledAt?: string }>;
  /** Annule la suppression pending. */
  cancelAccountDeletion: () => Promise<AuthResult>;
};

export const useAuthStore = create<AuthState>(() => ({
  session: null,
  initializing: true,
  recoveryPending: false,
  deepLinkError: null,
  passwordJustReset: false,
  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Redirige le lien de confirmation vers le deep link de l'app (pas le Site URL localhost).
      options: { emailRedirectTo: AUTH_REDIRECT_URL },
    });
    if (error) {
      return { error: error.message, needsVerification: false };
    }
    // Si la confirmation email est active, aucune session n'est ouverte immédiatement.
    return { error: null, needsVerification: data.session === null };
  },
  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  },
  signInWithGoogle: async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      // v16.1.2 : signIn() renvoie { type: 'success', data: User } | { type: 'cancelled', data: null }.
      // Vraie annulation utilisateur (fenêtre fermée) → no-op silencieux.
      if (response.type !== 'success') return { error: null };
      const idToken = response.data.idToken;
      if (!idToken) {
        // Succès mais pas de token = anomalie (webClientId manquant/mauvais), PAS une
        // annulation → message d'erreur (et non un bouton mort indébogable).
        console.warn('[auth] Google sign-in réussi sans idToken (webClientId manquant ?)'); // traçabilité (spec §2.5)
        return { error: mapGoogleSignInError({}) }; // → clé générique auth.google.errors.generic
      }
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
      if (error) {
        console.warn('[auth] signInWithIdToken échec:', error.message); // traçabilité (spec §2.5)
        return { error: mapGoogleSignInError(error) };
      }
      return { error: null };
    } catch (err) {
      // Annulation utilisateur (fermeture) ou double-tap (connexion déjà en cours) → no-op, pas de message.
      if (
        isErrorWithCode(err) &&
        (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === statusCodes.IN_PROGRESS)
      ) {
        return { error: null };
      }
      console.warn('[auth] Google Sign-In échec:', err); // traçabilité (spec §2.5)
      return { error: mapGoogleSignInError(err) };
    }
  },
  signOut: async () => {
    // Déconnexion ordinaire (bouton Réglages) = **scope local** : ne révoque que la session de CET
    // appareil. Sans argument, `@supabase/auth-js` utilise le scope `global` (défaut) qui déconnecte
    // TOUS les appareils de l'utilisateur — inattendu pour un simple logout (la doc de la lib le
    // recommande elle-même). Le scope global reste voulu ailleurs : reset MDP (`completePasswordRecovery`)
    // et suppression de compte — non modifiés.
    await supabase.auth.signOut({ scope: 'local' });
  },
  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Sans redirectTo, Supabase retombe sur le Site URL du projet (http://localhost:3000) →
      // page morte sur mobile. Le deep link dédié permet aussi de reconnaître le flux au retour.
      redirectTo: PASSWORD_RESET_REDIRECT_URL,
    });
    return { error: error?.message ?? null };
  },
  completePasswordRecovery: async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    // Échec → on reste sur l'écran, session conservée, l'utilisateur peut réessayer.
    if (error) return { error: error.message };

    // `passwordJustReset` est levé AVANT le signOut : c'est lui qui portera le message de succès sur
    // l'écran de connexion, où le gate de routing nous emmène dès la perte de session.
    useAuthStore.setState({ recoveryPending: false, passwordJustReset: true });
    // `signOut()` sans argument utilise le scope **global** (défaut de @supabase/auth-js) : il révoque
    // les refresh tokens de TOUS les appareils et efface la session locale (SIGNED_OUT émis). C'est
    // exactement la décision de cadrage (autres appareils éjectés + retour à la connexion) en un seul
    // appel — ne PAS passer { scope: 'local' } ici.
    // Pas de powerSync.disconnectAndClear() : même utilisateur, on garde la base locale et les
    // écritures en attente de synchro (contraste volontaire avec requestAccountDeletion).
    await supabase.auth.signOut();
    return { error: null };
  },
  clearRecovery: () => useAuthStore.setState({ recoveryPending: false }),
  clearDeepLinkError: () => useAuthStore.setState({ deepLinkError: null }),
  clearPasswordJustReset: () => useAuthStore.setState({ passwordJustReset: false }),
  reauthenticate: async (password) => {
    const email = useAuthStore.getState().session?.user.email;
    if (!email) return { error: 'Aucune session active.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  },
  requestAccountDeletion: async () => {
    try {
      const scheduledAt = await requestAccountDeletionRpc(); // RPC serveur
      await powerSync.disconnectAndClear(); // purge SQLite locale (AVANT signOut)
      await supabase.auth.signOut(); // purge clés secureStorage
      return { error: null, scheduledAt };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Échec de la suppression.' };
    }
  },
  cancelAccountDeletion: async () => {
    try {
      await cancelAccountDeletionRpc();
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Échec de l'annulation." };
    }
  },
}));

// Résolution de la session au démarrage + abonnement aux changements (persistance,
// refresh silencieux, connexion/déconnexion). Voir compte-profil-onboarding §2.2.
void supabase.auth
  .getSession()
  .then(({ data }) => {
    useAuthStore.setState({ session: data.session, initializing: false });
  })
  .catch(() => {
    // 🔴 **Sans ce `catch`, un échec de lecture de session bloquait le DÉMARRAGE de l'app.**
    // `void p.then(cb)` ne capture rien : si `getSession()` rejette (stockage sécurisé illisible,
    // jeton corrompu, panne réseau au premier lancement), `initializing` restait à `true` **pour
    // toujours** — l'app demeurait sur son écran de chargement, et le rejet n'apparaissait que
    // dans les logs natifs.
    //
    // On retombe donc sur « pas de session » : l'utilisateur arrive sur l'écran de connexion.
    // C'est un état peut-être faux, mais **actionnable** — ce qu'un écran mort n'est pas.
    useAuthStore.setState({ session: null, initializing: false });
  });

supabase.auth.onAuthStateChange((_event, session) => {
  // Filet de sécurité : toute perte de session éteint le mode récupération. Sans ça, un drapeau resté
  // levé (déconnexion pour une autre raison, expiration) referait apparaître l'écran « nouveau mot de
  // passe » à la prochaine connexion, alors qu'aucun lien de récupération n'a été suivi.
  if (!session) {
    useAuthStore.setState({ session, recoveryPending: false });
    return;
  }
  useAuthStore.setState({ session });
});

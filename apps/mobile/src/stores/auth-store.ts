import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { AUTH_REDIRECT_URL } from '@/lib/auth-redirect';
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
    await supabase.auth.signOut();
  },
  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error?.message ?? null };
  },
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
void supabase.auth.getSession().then(({ data }) => {
  useAuthStore.setState({ session: data.session, initializing: false });
});

supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.setState({ session });
});

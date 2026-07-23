import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
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
    const { data, error } = await supabase.auth.signUp({ email, password });
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

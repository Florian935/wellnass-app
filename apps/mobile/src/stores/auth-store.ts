import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

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
}));

// Résolution de la session au démarrage + abonnement aux changements (persistance,
// refresh silencieux, connexion/déconnexion). Voir compte-profil-onboarding §2.2.
void supabase.auth.getSession().then(({ data }) => {
  useAuthStore.setState({ session: data.session, initializing: false });
});

supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.setState({ session });
});

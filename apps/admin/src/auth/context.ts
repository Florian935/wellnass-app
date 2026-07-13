import { createContext } from 'react';
import type { AuthError, Session, User } from '@supabase/supabase-js';

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

/** Contexte d'authentification. Peuplé par `<AuthProvider>`, lu via `useAuth()`. */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

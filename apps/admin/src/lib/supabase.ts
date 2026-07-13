import { createClient } from '@supabase/supabase-js';
import type { Database } from '@wellness/shared';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Garde-fou au runtime (navigateur) : évite un échec silencieux si l'env
  // n'est pas configurée. Copier apps/admin/.env.example vers .env.
  throw new Error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants — copier apps/admin/.env.example vers .env.',
  );
}

/**
 * Client Supabase (Auth) du back-office web. Session persistée en `localStorage`
 * (défaut supabase-js sur navigateur). **Clé anon uniquement** (client-safe) ;
 * jamais de `service_role`. Le RLS reste la frontière de sécurité.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

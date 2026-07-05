import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { Database } from '@wellness/shared';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY manquants — copier apps/mobile/.env.example vers .env.',
  );
}

/**
 * Client Supabase (Auth uniquement pour l'instant). La base locale et la synchro passeront
 * par PowerSync (SQLite ↔ Supabase) — voir offline-sync.md.
 *
 * TODO(auth-us) : remplacer `AsyncStorage` par un stockage chiffré (SecureStore/Keystore)
 * pour les tokens (architecture §7 « chiffrement au repos »).
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Rafraîchit la session tant que l'app est au premier plan, la met en pause sinon
// (pattern recommandé Supabase + React Native).
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});

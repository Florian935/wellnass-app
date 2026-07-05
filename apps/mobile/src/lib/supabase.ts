import 'react-native-url-polyfill/auto';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
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
 * Stockage de session **en mémoire** (aucun module natif) — permet de tester le flux d'auth
 * sur le dev client actuel sans rebuild.
 *
 * TODO(9.8) : remplacer par un stockage **chiffré et persistant** (`expo-secure-store` /
 * Android Keystore, architecture §7) lors du prochain dev build (groupé avec PowerSync).
 * Tant qu'on est en mémoire, la session ne survit pas à un redémarrage complet de l'app.
 */
const memoryStorage: SupportedStorage = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
})();

/**
 * Client Supabase (Auth). La base locale et la synchro passeront par PowerSync
 * (SQLite ↔ Supabase) — voir offline-sync.md.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: memoryStorage,
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

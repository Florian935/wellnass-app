import { useEffect } from 'react';
import * as Linking from 'expo-linking';

import { parseAuthTokensFromUrl } from '@/lib/auth-redirect';
import { supabase } from '@/lib/supabase';

/**
 * Gère les deep links d'authentification Supabase (confirmation d'e-mail…).
 *
 * Quand l'app est ouverte via `wellness://auth-callback#access_token=…&refresh_token=…`
 * (lien cliqué depuis l'e-mail sur l'appareil), on établit la session via `setSession`.
 * `onAuthStateChange` (auth-store) prend ensuite le relais → routing/onboarding, comme une
 * connexion classique. Sans jetons dans l'URL → no-op (n'importe quel autre deep link).
 *
 * À monter **une seule fois**, au niveau du navigateur racine.
 */
export function useAuthDeepLink(): void {
  useEffect(() => {
    const handle = (url: string | null) => {
      const tokens = parseAuthTokensFromUrl(url);
      if (!tokens) return;
      void supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
    };

    // Ouverture à froid (app lancée par le lien) + ouverture à chaud (app déjà ouverte).
    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (event) => handle(event.url));
    return () => sub.remove();
  }, []);
}

import { useEffect } from 'react';
import * as Linking from 'expo-linking';

import { parseAuthDeepLink } from '@/lib/auth-redirect';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Gère les deep links d'authentification Supabase (confirmation d'e-mail, réinitialisation de mot
 * de passe).
 *
 * Deux flux, deux issues :
 * - **Confirmation d'inscription** (`wellness://auth-callback`) → on établit la session ;
 *   `onAuthStateChange` (auth-store) prend le relais → routing/onboarding, comme une connexion.
 * - **Réinitialisation** (`wellness://password-reset`, CONF-08) → on lève `recoveryPending`
 *   **avant** d'établir la session, puis on établit la session. Le gate `password-recovery` de
 *   `resolveRootRoute` impose alors l'écran « nouveau mot de passe ».
 *
 * Un lien refusé par Supabase (expiré, déjà consommé) n'ouvre **aucune** session : on expose le code
 * d'erreur, affiché par l'écran de connexion. Tout autre deep link → no-op.
 *
 * À monter **une seule fois**, au niveau du navigateur racine.
 */
export function useAuthDeepLink(): void {
  useEffect(() => {
    const handle = (url: string | null) => {
      const link = parseAuthDeepLink(url);
      if (!link) return; // n'importe quel autre deep link

      if (link.kind === 'error') {
        useAuthStore.setState({ deepLinkError: link.code });
        return;
      }

      // ⚠️ ORDRE : le drapeau doit être levé AVANT setSession. Dans l'autre sens,
      // `onAuthStateChange` peut déclencher un rendu où la session existe sans le drapeau →
      // redirection éclair vers (tabs), soit exactement le bug qu'on veut éviter.
      if (link.isRecovery) {
        useAuthStore.setState({ recoveryPending: true });
      }

      void supabase.auth.setSession({
        access_token: link.tokens.accessToken,
        refresh_token: link.tokens.refreshToken,
      });
    };

    // Ouverture à froid (app lancée par le lien) + ouverture à chaud (app déjà ouverte).
    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (event) => handle(event.url));
    return () => sub.remove();
  }, []);
}

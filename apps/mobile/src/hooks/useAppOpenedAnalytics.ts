import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { useAuthStore } from '@/stores/auth-store';

/** Fenêtre de throttle : au plus un `app_opened` par tranche de 30 minutes. */
const APP_OPENED_THROTTLE_MS = 30 * 60 * 1000;

// Timestamp (ms epoch) du dernier `app_opened` réellement émis. Au niveau module pour
// survivre aux remontages du hook (un seul point d'ancrage attendu, à la racine).
let lastAppOpenedAt = 0;

/**
 * Émet l'événement `app_opened` au passage de l'app au premier plan
 * (`AppState` → 'active'), au démarrage à froid, et dès l'arrivée d'une session.
 * Throttlé : jamais plus d'un événement par `APP_OPENED_THROTTLE_MS` (30 min), via
 * un timestamp module.
 *
 * Invariant : le timestamp de throttle n'est posé que si une **session** existe et que la
 * fenêtre est ouverte. Sans session, on sort immédiatement sans rien poser → un cold start
 * déconnecté ne « consomme » pas la fenêtre, et le 1er `app_opened` est capté dès l'arrivée
 * de la session (effet dépendant de `session`).
 *
 * Nuance : le stamp est posé AVANT `track()`, qui applique ensuite le gating **consentement**.
 * Si le consentement est OFF, `track` est un no-op mais la fenêtre est tout de même consommée
 * — impact négligeable (`app_opened` = l'événement le moins critique ; consentement OFF = on ne
 * veut de toute façon pas mesurer). `track` reste fire-and-forget : on l'appelle en `void`.
 *
 * À appeler **une seule fois**, au niveau du navigateur racine.
 */
export function useAppOpenedAnalytics(): void {
  // Refire à l'arrivée d'une session (login post-cold-start) : capte le 1er app_opened.
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    // Sans session : ni émission ni pose de timestamp (la fenêtre reste intacte).
    if (!session) return;

    const now = Date.now();
    if (now - lastAppOpenedAt < APP_OPENED_THROTTLE_MS) return;
    lastAppOpenedAt = now;
    void track(ANALYTICS_EVENTS.appOpened);
  }, [session]);

  useEffect(() => {
    const maybeEmit = () => {
      // Même invariant que ci-dessus : pas de session → aucun stamp, aucune émission.
      if (!useAuthStore.getState().session) return;
      const now = Date.now();
      if (now - lastAppOpenedAt < APP_OPENED_THROTTLE_MS) return;
      lastAppOpenedAt = now;
      void track(ANALYTICS_EVENTS.appOpened);
    };

    // Retour au premier plan (`AppState` → 'active'), throttlé. Le démarrage à froid
    // est couvert par l'effet dépendant de `session` ci-dessus.
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') maybeEmit();
    });
    return () => sub.remove();
  }, []);
}

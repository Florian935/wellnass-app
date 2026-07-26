import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { importWeightIfDue } from '@/lib/health-connect';

/**
 * US CONF-06 — importe les pesées de Health Connect au démarrage et au retour au premier plan,
 * **throttlé** (6 h, curseur persisté par le service).
 *
 * Calqué sur `useAppOpenedAnalytics` pour la gestion d'`AppState`, avec deux différences :
 * - le throttle n'est pas une variable module mais un curseur **persisté** (`expo-secure-store`),
 *   parce que les Réglages affichent « Dernier import : … » — une seule source pour les deux ;
 * - la décision est donc **asynchrone** : `importWeightIfDue()` lit le curseur avant de trancher.
 *
 * `enabled` porte la garde de démarrage (session + synchro initiale) : un hook s'appelle
 * inconditionnellement, la condition vit donc **dans** l'effet. Sans `hasSynced`, on lirait le
 * réglage d'une ligne locale non encore synchronisée.
 *
 * Best-effort de bout en bout : le service ne jette jamais et est no-op hors Android, opt-in OFF
 * ou permissions absentes.
 */
export function useHealthConnectWeightImport(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    void importWeightIfDue();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void importWeightIfDue();
    });
    return () => sub.remove();
  }, [enabled]);
}

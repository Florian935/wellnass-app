import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { importCycleDataIfDue, importStepsIfDue, importWeightIfDue } from '@/lib/health-connect';

/**
 * Importe les données **lues** dans Health Connect au démarrage et au retour au premier plan :
 * les pesées (US CONF-06, throttle 6 h), les **pas quotidiens** (US PAS-01, throttle 1 h) et le
 * **cycle** (US CYCLE-01, throttle 6 h).
 *
 * Anciennement `useHealthConnectWeightImport` — renommé quand les pas sont arrivés, le nom devenant
 * faux. C'est bien un seul point d'entrée pour des imports **indépendants** : chacun a son curseur
 * persisté et son throttle, et l'échec de l'un ne doit pas empêcher les autres (d'où des `void`
 * séparés, jamais un `await` en série). `importCycleDataIfDue` est no-op silencieux tant que les
 * trois opt-in R20 (`cycleTrackingEnabled`, `healthConnectEnabled`, `cycleHealthConnectEnabled`) ne
 * sont pas tous réunis — pas besoin d'un `enabled` dédié ici.
 *
 * Calqué sur `useAppOpenedAnalytics` pour la gestion d'`AppState`, avec deux différences :
 * - le throttle n'est pas une variable module mais un curseur **persisté** (`expo-secure-store`),
 *   parce que les Réglages affichent « Dernier import : … » — une seule source pour les deux ;
 * - la décision est donc **asynchrone** : `import…IfDue()` lit le curseur avant de trancher.
 *
 * `enabled` porte la garde de démarrage (session + synchro initiale) : un hook s'appelle
 * inconditionnellement, la condition vit donc **dans** l'effet. Sans `hasSynced`, on lirait le
 * réglage d'une ligne locale non encore synchronisée.
 *
 * Best-effort de bout en bout : le service ne jette jamais et est no-op hors Android, opt-in OFF
 * ou permissions absentes.
 */
export function useHealthConnectImports(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    void importWeightIfDue();
    void importStepsIfDue();
    void importCycleDataIfDue();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      void importWeightIfDue();
      void importStepsIfDue();
      void importCycleDataIfDue();
    });
    return () => sub.remove();
  }, [enabled]);
}

import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getState, type HealthConnectState } from '@/lib/health-connect';

/**
 * État courant de Health Connect (US PAS-01), rafraîchi au montage et à chaque retour au premier
 * plan — les permissions peuvent avoir été révoquées depuis les réglages système entre-temps.
 *
 * Extrait de `HealthConnectSection`, qui faisait le même travail en interne : le widget des pas et
 * l'écran d'historique doivent afficher **exactement** le même état, sinon l'utilisateur voit un
 * widget « prêt » et des Réglages « autorisation manquante ».
 *
 * `null` = pas encore résolu (`getState()` est asynchrone) → l'appelant n'affiche rien plutôt qu'un
 * état faux pendant une frame.
 */
export function useHealthConnectState(): {
  state: HealthConnectState | null;
  refresh: () => void;
} {
  const [state, setState] = useState<HealthConnectState | null>(null);

  const load = useCallback(async (): Promise<HealthConnectState> => getState(), []);

  const refresh = useCallback(() => {
    void load()
      .then(setState)
      // `getState()` capture déjà en interne et rend un état « indisponible » ; ce `catch` ne
      // couvre que l'imprévu, pour ne pas le transformer en rejet non capturé.
      .catch(() => undefined);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      void load()
        .then((next) => {
          if (!cancelled) setState(next);
        })
        .catch(() => undefined);
    };
    run();
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') run();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [load]);

  return { state, refresh };
}

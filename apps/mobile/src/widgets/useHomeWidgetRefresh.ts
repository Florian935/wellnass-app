/**
 * US LAUNCHER-01 — déclenche un rafraîchissement du widget d'écran d'accueil à chaque
 * foreground/background de l'app (D5), en plus du filet périodique OS. Même patron que
 * `useAppOpenedAnalytics` : un seul point d'ancrage, au niveau du navigateur racine.
 */

import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { refreshHomeWidget } from './refresh-home-widget';

export function useHomeWidgetRefresh(): void {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' || state === 'background') refreshHomeWidget();
    });
    return () => sub.remove();
  }, []);
}

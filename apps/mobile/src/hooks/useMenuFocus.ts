import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useMenuAccent, type MenuKey } from '@/stores/menu-accent-store';

/**
 * Déclare le **menu actif** (Accueil / Muscu / Course / Alimentation) tant que l'écran a le
 * focus. Pose l'accent effectif du thème (`useTheme`) sur la couleur de ce menu. Les écrans
 * enfants poussés au-dessus d'un onglet héritent de la couleur (ils ne réinitialisent pas
 * `activeMenu`) jusqu'au retour sur l'onglet.
 */
export function useMenuFocus(menu: MenuKey): void {
  useFocusEffect(
    useCallback(() => {
      const store = useMenuAccent.getState();
      store.setActiveMenu(menu);
      store.setFocusedMenu(menu);
      // US DASH-01 (R4) : à la perte de focus, les boucles de la scène doivent s'arrêter.
      return () => useMenuAccent.getState().clearFocusedMenu(menu);
    }, [menu]),
  );
}

import { useAppReducedMotion } from './useAppReducedMotion';
import { useIsAppActive } from './useIsAppActive';
import { useMenuAccent, type MenuKey } from '@/stores/menu-accent-store';

/**
 * US DASH-01 (R4) — vrai seulement si une boucle décorative de ce pilier a le droit de tourner.
 *
 * Trois conditions, toutes nécessaires : l'onglet du pilier est au premier plan (`focusedMenu`, posé
 * par `useMenuFocus`), l'app n'est pas en arrière-plan, et le mouvement n'est pas coupé (R1). Une trace
 * GPS qui tourne sous un écran empilé, pendant une heure de sortie, se paie en batterie.
 */
export function useLoopActive(menu: MenuKey): boolean {
  const focused = useMenuAccent((s) => s.focusedMenu === menu);
  const appActive = useIsAppActive();
  const reduced = useAppReducedMotion();
  return focused && appActive && !reduced;
}

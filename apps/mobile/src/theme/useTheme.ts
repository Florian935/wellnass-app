import { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from '@/data/repositories/settings-repository';
import { useColorSchemeStore } from '@/stores/color-scheme-store';
import { useMenuAccent } from '@/stores/menu-accent-store';
import { palettes, type ColorScheme, type Palette } from './colors';

/**
 * Résout le schéma effectif et le publie dans le store partagé. **À appeler une seule fois**, dans
 * le navigateur racine — c'est le seul endroit qui lit la préférence en base.
 *
 * Avant le 30/07/2026, cette résolution vivait dans `useTheme()` : les 126 composants qui l'appellent
 * ouvraient donc chacun leur propre requête PowerSync et repartaient du thème système à chaque
 * montage, d'où un flash de thème à chaque navigation. Voir `color-scheme-store.ts`.
 */
export function useSyncColorScheme(): void {
  const system = useColorScheme();
  const { settings, isLoading } = useSettings();
  const setScheme = useColorSchemeStore((s) => s.setScheme);

  const preference = settings?.theme ?? null;
  // Tant que la lecture n'a pas abouti, on ne publie **rien** : publier le thème système serait
  // exactement le flash qu'on supprime. Le splash couvre cette fenêtre (`resolveRootRoute` attend
  // `settingsLoading`).
  const resolved: ColorScheme | null = isLoading
    ? null
    : preference === 'light' || preference === 'dark'
      ? preference
      : system === 'dark'
        ? 'dark'
        : 'light';

  useEffect(() => {
    if (resolved !== null) setScheme(resolved);
  }, [resolved, setScheme]);
}

/**
 * Schéma effectif pour l'affichage. Lit le store (résolu une fois par `useSyncColorScheme`).
 *
 * Repli sur le thème **système** uniquement si le store n'a jamais été alimenté — cas d'un composant
 * rendu hors de l'app (test isolé, story). En fonctionnement normal ce repli ne sert jamais : le
 * splash est maintenu jusqu'à la résolution.
 */
export function useColorSchemePref(): ColorScheme {
  const stored = useColorSchemeStore((s) => s.scheme);
  const system = useColorScheme();
  if (stored !== null) return stored;
  return system === 'dark' ? 'dark' : 'light';
}

/**
 * Palette effective. Si le réglage « Couleurs des menus » est activé, l'**accent** est
 * surchargé par la couleur du **menu actif** (Accueil / Muscu / Course / Alimentation, cf.
 * `menu-accent-store`) au lieu de l'accent unique de la palette. Off (défaut) → accent
 * unique inchangé. Le reste de la palette (surfaces, texte…) est toujours inchangé.
 */
export function useTheme(): { scheme: ColorScheme; colors: Palette } {
  const scheme = useColorSchemePref();
  const base = palettes[scheme];
  const menuColorsEnabled = useMenuAccent((s) => s.enabled);
  const activeMenu = useMenuAccent((s) => s.activeMenu);
  const menuAccent = useMenuAccent((s) => s.colors[activeMenu]);

  const colors = useMemo(() => {
    if (!menuColorsEnabled || !menuAccent || menuAccent === base.accent) return base;
    return { ...base, accent: menuAccent };
  }, [base, menuColorsEnabled, menuAccent]);
  return { scheme, colors };
}

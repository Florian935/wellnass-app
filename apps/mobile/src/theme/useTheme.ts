import { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { readableOn } from '@wellness/shared';
import { useSettings } from '@/data/repositories/settings-repository';
import { useColorSchemeStore } from '@/stores/color-scheme-store';
import { useMenuAccent } from '@/stores/menu-accent-store';
import { type ColorScheme, type Palette } from './colors';
import { pillarPalette } from './pillar';

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
 * Palette effective — en **deux couches**, et l'ordre compte.
 *
 * 1. **L'identité du pilier** (US MUSCU-UX04, `theme/pillar.ts`) : surfaces teintées et accent du
 *    menu actif. C'est un fait du design system, toujours appliqué. Avant, la scène d'un pilier
 *    était en couleur pendant que toutes les cartes en dessous restaient brunes et terracotta —
 *    trois identités sur un écran (voir l'en-tête de `pillar.ts`).
 * 2. **La préférence « Couleurs des menus »** par-dessus, si elle est activée : l'utilisateur
 *    remplace alors l'accent par le sien. Elle ne touche que l'accent, jamais les surfaces.
 *
 * Les écrans empilés au-dessus d'un onglet héritent du pilier : `activeMenu` n'est pas réinitialisé
 * à la poussée (voir `useMenuFocus`), donc toute la branche muscu reste en muscu.
 */
export function useTheme(): { scheme: ColorScheme; colors: Palette } {
  const scheme = useColorSchemePref();
  const menuColorsEnabled = useMenuAccent((s) => s.enabled);
  const activeMenu = useMenuAccent((s) => s.activeMenu);
  const menuAccent = useMenuAccent((s) => s.colors[activeMenu]);

  // Mémoïsée dans le module (dix combinaisons possibles) : la référence est stable, `useMemo` ci-
  // dessous peut donc en dépendre sans recalculer à chaque rendu.
  const base = pillarPalette(scheme, activeMenu);

  const colors = useMemo(() => {
    if (!menuColorsEnabled || !menuAccent || menuAccent === base.accent) return base;
    // La préférence stocke UNE couleur par menu, employée dans les deux thèmes — or aucune couleur
    // n'est lisible à la fois sur une carte presque blanche et sur une carte presque noire
    // (`#e07a98` : 5,2:1 en sombre, 2,5:1 en clair). On l'adapte donc au fond plutôt que de poser
    // telle quelle une couleur hors seuil, et l'encre des boutons pleins suit.
    const accent = readableOn(menuAccent, base.surface) ?? base.accent;
    return { ...base, accent, accentText: readableOn(base.accentText, accent) ?? base.accentText };
  }, [base, menuColorsEnabled, menuAccent]);
  return { scheme, colors };
}

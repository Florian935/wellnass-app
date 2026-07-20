import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from '@/data/repositories/settings-repository';
import { useMenuAccent } from '@/stores/menu-accent-store';
import { palettes, type ColorScheme, type Palette } from './colors';

/**
 * Résout le schéma effectif : la préférence utilisateur (Réglages, persistée via
 * PowerSync) prime ; en mode « système » on suit le réglage OS. Indépendant de la
 * langue et des unités.
 *
 * Tant que les réglages ne sont pas chargés (`settings` null), on retombe sur
 * `'system'` afin d'éviter tout plantage / flash.
 */
export function useColorSchemePref(): ColorScheme {
  const system = useColorScheme();
  const { settings } = useSettings();
  const preference = settings?.theme ?? 'system';
  if (preference === 'system') {
    return system === 'dark' ? 'dark' : 'light';
  }
  return preference;
}

/**
 * Palette effective. L'**accent** est surchargé par la couleur du **menu actif**
 * (Accueil / Muscu / Course / Alimentation, cf. `menu-accent-store`) au lieu de
 * l'accent unique de la palette. Le reste de la palette (surfaces, texte…) est inchangé.
 */
export function useTheme(): { scheme: ColorScheme; colors: Palette } {
  const scheme = useColorSchemePref();
  const base = palettes[scheme];
  const activeMenu = useMenuAccent((s) => s.activeMenu);
  const menuAccent = useMenuAccent((s) => s.colors[activeMenu]);

  const colors = useMemo(
    () => (menuAccent && menuAccent !== base.accent ? { ...base, accent: menuAccent } : base),
    [base, menuAccent],
  );
  return { scheme, colors };
}

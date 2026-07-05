import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@/stores/settings-store';
import { palettes, type ColorScheme, type Palette } from './colors';

/**
 * Résout le schéma effectif : la préférence utilisateur (Réglages) prime ; en mode
 * « système » on suit le réglage OS. Indépendant de la langue et des unités.
 */
export function useColorSchemePref(): ColorScheme {
  const system = useColorScheme();
  const preference = useSettingsStore((s) => s.theme);
  if (preference === 'system') {
    return system === 'dark' ? 'dark' : 'light';
  }
  return preference;
}

export function useTheme(): { scheme: ColorScheme; colors: Palette } {
  const scheme = useColorSchemePref();
  return { scheme, colors: palettes[scheme] };
}

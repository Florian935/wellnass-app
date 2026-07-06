import { useColorScheme } from 'react-native';
import { useSettings } from '@/data/repositories/settings-repository';
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

export function useTheme(): { scheme: ColorScheme; colors: Palette } {
  const scheme = useColorSchemePref();
  return { scheme, colors: palettes[scheme] };
}

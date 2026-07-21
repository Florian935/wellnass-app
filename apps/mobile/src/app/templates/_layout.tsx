import { Stack } from 'expo-router';

/**
 * Pile de navigation des templates de séance libre (liste, composition, détail).
 * En-têtes masqués : chaque écran fournit son propre `ScreenHeader`.
 */
export default function TemplatesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

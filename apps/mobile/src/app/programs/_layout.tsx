import { Stack } from 'expo-router';

/**
 * Pile de navigation des programmes (liste, édition, détail).
 * En-têtes masqués : chaque écran fournit son propre `ScreenHeader`.
 */
export default function ProgramsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

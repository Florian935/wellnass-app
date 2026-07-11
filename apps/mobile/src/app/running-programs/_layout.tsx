import { Stack } from 'expo-router';

/**
 * Pile de navigation des programmes de course (liste, détail, édition).
 * En-têtes masqués : chaque écran fournit son propre `ScreenHeader`.
 */
export default function RunningProgramsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

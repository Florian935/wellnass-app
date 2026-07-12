import { Stack } from 'expo-router';

/**
 * Pile de navigation de l'historique & progression de course.
 * En-têtes masqués : l'écran fournit son propre `ScreenHeader`.
 */
export default function RunningHistoryLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

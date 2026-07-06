import { Stack } from 'expo-router';

/**
 * Pile de navigation de l'historique (liste, détail).
 * En-têtes masqués : chaque écran fournit son propre `ScreenHeader`.
 */
export default function HistoryLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

import { Stack } from 'expo-router';

/**
 * Pile de navigation du planning de course (vue semaine).
 * En-têtes masqués : l'écran fournit son propre `ScreenHeader`.
 */
export default function PlanningLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

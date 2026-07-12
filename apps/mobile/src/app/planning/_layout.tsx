import { Stack } from 'expo-router';

/**
 * Pile de navigation du planning unifié (muscu + course) : vue semaine + assistant.
 * En-têtes masqués : chaque écran fournit son propre `ScreenHeader`.
 */
export default function PlanningLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

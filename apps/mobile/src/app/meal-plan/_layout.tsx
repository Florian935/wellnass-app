import { Stack } from 'expo-router';

/**
 * Pile de navigation du planning repas (US REPAS-01) : vue semaine + liste de courses.
 * En-têtes masqués : chaque écran fournit son propre `ScreenHeader`, comme `planning/`.
 */
export default function MealPlanLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

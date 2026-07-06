import { Stack } from 'expo-router';

/**
 * Pile de navigation de la progression (records + courbes).
 * En-têtes masqués : l'écran fournit son propre ScreenHeader.
 */
export default function ProgressLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

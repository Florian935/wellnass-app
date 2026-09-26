import { Stack } from 'expo-router';

/**
 * Pile de navigation de « Toutes tes stats » (US CARDIO-UX03, D7).
 * En-têtes masqués : l'écran fournit son propre `ScreenHeader`.
 */
export default function RunningStatsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

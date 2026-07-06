import { Stack } from 'expo-router';

/**
 * Pile de navigation de la course libre (démarrage, suivi temps réel, résumé).
 * En-têtes masqués : chaque écran fournit son propre en-tête / ses contrôles.
 */
export default function RunLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

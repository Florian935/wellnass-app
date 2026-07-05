import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// Initialise i18next (side-effect) avant le rendu des écrans.
import '@/i18n';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}

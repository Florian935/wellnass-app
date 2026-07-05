import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Initialise i18next (side-effect) avant le rendu des écrans.
import '@/i18n';
import { useAuthStore } from '@/stores/auth-store';
import { useAppFonts } from '@/theme/fonts';
import { typography } from '@/theme/typography';
import { useTheme } from '@/theme/useTheme';

// Garde le splash affiché tant que les polices ne sont pas chargées.
void SplashScreen.preventAutoHideAsync();

type NavTheme = typeof DefaultTheme;

function navTheme(base: NavTheme, colors: ReturnType<typeof useTheme>['colors']): NavTheme {
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };
}

export default function RootLayout() {
  const { t } = useTranslation();
  const { scheme, colors } = useTheme();
  const { loaded, error } = useAppFonts();
  const session = useAuthStore((s) => s.session);
  const initializing = useAuthStore((s) => s.initializing);
  const segments = useSegments();
  const router = useRouter();
  const theme = navTheme(scheme === 'dark' ? DarkTheme : DefaultTheme, colors);

  const fontsReady = loaded || error;
  const ready = fontsReady && !initializing;

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  // Redirige selon l'état de session (compte-profil-onboarding §2).
  useEffect(() => {
    if (!ready) {
      return;
    }
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [ready, session, segments, router]);

  // Tant que les polices / la session ne sont pas prêtes, on laisse le splash.
  if (!ready) {
    return null;
  }

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="settings"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('settings.title'),
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { color: colors.text, fontFamily: typography.title.fontFamily },
            headerTintColor: colors.accent,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}

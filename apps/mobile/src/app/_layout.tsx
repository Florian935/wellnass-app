import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Initialise i18next (side-effect) avant le rendu des écrans.
import '@/i18n';
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
  const theme = navTheme(scheme === 'dark' ? DarkTheme : DefaultTheme, colors);

  useEffect(() => {
    if (loaded || error) {
      void SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // Tant que les polices ne sont pas prêtes (et sans erreur), on laisse le splash.
  if (!loaded && !error) {
    return null;
  }

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
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

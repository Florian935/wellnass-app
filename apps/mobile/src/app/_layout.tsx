import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

// Initialise i18next (side-effect) avant le rendu des écrans.
import '@/i18n';
import { useTheme } from '@/theme/useTheme';

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
  const theme = navTheme(scheme === 'dark' ? DarkTheme : DefaultTheme, colors);

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
            headerTitleStyle: { color: colors.text },
            headerTintColor: colors.accent,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}

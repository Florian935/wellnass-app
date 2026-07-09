// Polyfill requis par PowerSync (async iterators) — doit précéder tout usage de PowerSync.
import '@azure/core-asynciterator-polyfill';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useStatus } from '@powersync/react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Initialise i18next (side-effect) avant le rendu des écrans.
import i18n from '@/i18n';
// Enregistre la tâche de fond de suivi GPS (side-effect) dès le chargement du JS
// (portée globale requise par expo-task-manager — voir running/tracker-task.ts).
import '@/running/tracker-task';
import { useProfile } from '@/data/repositories/profile-repository';
import { ensureSettings, useSettings } from '@/data/repositories/settings-repository';
import { PowerSyncProvider } from '@/powersync/PowerSyncProvider';
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

/**
 * Navigateur racine — vit **à l'intérieur** de `PowerSyncProvider` afin de pouvoir
 * lire le profil via `useProfile()` (basé sur `useQuery`/`useStatus` de PowerSync).
 *
 * Gate de routing (compte-profil-onboarding §2/§3) :
 *  - tant que les polices ne sont pas chargées, que l'auth s'initialise ou que le
 *    profil se charge (`useProfile().isLoading` — base locale pas encore synchronisée),
 *    on laisse le splash natif : on ne route pas (évite le flash d'onboarding / la
 *    boucle de redirection) ;
 *  - une fois prêt et authentifié : si `onboardingCompletedAt == null` → onboarding,
 *    sinon → app.
 */
function RootNavigator() {
  const { t } = useTranslation();
  const { scheme, colors } = useTheme();
  const { loaded, error } = useAppFonts();
  const session = useAuthStore((s) => s.session);
  const initializing = useAuthStore((s) => s.initializing);
  const { profile, isLoading: profileLoading } = useProfile();
  const { settings, isLoading: settingsLoading } = useSettings();
  const syncStatus = useStatus();
  const segments = useSegments();
  const router = useRouter();
  const theme = navTheme(scheme === 'dark' ? DarkTheme : DefaultTheme, colors);

  const fontsReady = loaded || error;
  // Le profil / les réglages ne sont pertinents qu'une fois authentifié : sans
  // session, PowerSync ne synchronise pas et `isLoading` resterait vrai (on ne
  // bloquerait jamais le routage vers l'écran de connexion).
  const profileReady = !session || !profileLoading;
  // On attend aussi les réglages avant de router, pour appliquer le thème/la langue
  // sans flash (voir gate compte-profil-onboarding §2/§3).
  const settingsReady = !session || !settingsLoading;
  const ready = fontsReady && !initializing && profileReady && settingsReady;
  const onboardingCompleted = profile?.onboardingCompletedAt != null;

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  // Bootstrap : on n'initialise les réglages par défaut qu'une fois la **synchro
  // initiale terminée** (`hasSynced`). Sinon on créerait une ligne locale alors que
  // le serveur en a déjà une → doublon sur la contrainte unique `user_id`, dont
  // l'upload échoue en boucle et **bloque toute la synchro** (write-checkpoint).
  useEffect(() => {
    if (session && syncStatus.hasSynced && !settingsLoading && settings == null) {
      void ensureSettings();
    }
  }, [session, syncStatus.hasSynced, settingsLoading, settings]);

  // Applique la langue persistée dans les réglages à i18next (la préférence
  // utilisateur synchronisée prime sur la locale de l'appareil).
  useEffect(() => {
    const language = settings?.language;
    if (language && i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [settings?.language]);

  // Redirige selon session + onboarding (compte-profil-onboarding §2/§3).
  useEffect(() => {
    if (!ready) {
      return;
    }
    const group = segments[0];
    const inAuth = group === '(auth)';
    const inOnboarding = group === '(onboarding)';

    if (!session) {
      if (!inAuth) {
        router.replace('/(auth)/sign-in');
      }
      return;
    }
    if (!onboardingCompleted) {
      if (!inOnboarding) {
        router.replace('/(onboarding)/intro');
      }
      return;
    }
    if (inAuth || inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [ready, session, onboardingCompleted, segments, router]);

  // Tant que les polices / la session / le profil ne sont pas prêts, on laisse le splash.
  if (!ready) {
    return null;
  }

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
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
        <Stack.Screen
          name="profile"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('profile.title'),
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { color: colors.text, fontFamily: typography.title.fontFamily },
            headerTintColor: colors.accent,
          }}
        />
        <Stack.Screen
          name="exercises"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('exercises.title'),
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { color: colors.text, fontFamily: typography.title.fontFamily },
            headerTintColor: colors.accent,
          }}
        />
        <Stack.Screen
          name="nutrition-profile"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('nutrition.title'),
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { color: colors.text, fontFamily: typography.title.fontFamily },
            headerTintColor: colors.accent,
          }}
        />
        <Stack.Screen
          name="food-picker"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('journal.addFood'),
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { color: colors.text, fontFamily: typography.title.fontFamily },
            headerTintColor: colors.accent,
          }}
        />
        <Stack.Screen
          name="food-scan"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('scan.title'),
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { color: colors.text, fontFamily: typography.title.fontFamily },
            headerTintColor: colors.accent,
          }}
        />
        <Stack.Screen
          name="food-custom"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('journal.createFood'),
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { color: colors.text, fontFamily: typography.title.fontFamily },
            headerTintColor: colors.accent,
          }}
        />
        <Stack.Screen
          name="meal-quick-entry"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('quickList.title'),
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { color: colors.text, fontFamily: typography.title.fontFamily },
            headerTintColor: colors.accent,
          }}
        />
        <Stack.Screen
          name="recipe-edit"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('recipes.title'),
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { color: colors.text, fontFamily: typography.title.fontFamily },
            headerTintColor: colors.accent,
          }}
        />
        <Stack.Screen
          name="nutrition-stats"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('stats.title'),
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { color: colors.text, fontFamily: typography.title.fontFamily },
            headerTintColor: colors.accent,
          }}
        />
        <Stack.Screen
          name="nutrition-meals"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('meals.manage'),
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { color: colors.text, fontFamily: typography.title.fontFamily },
            headerTintColor: colors.accent,
          }}
        />
        <Stack.Screen
          name="programs"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen name="history" options={{ headerShown: false }} />
        <Stack.Screen name="run" options={{ headerShown: false }} />
        <Stack.Screen name="progress" options={{ headerShown: false }} />
        <Stack.Screen name="workout" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="workout-summary" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <PowerSyncProvider>
      <RootNavigator />
    </PowerSyncProvider>
  );
}

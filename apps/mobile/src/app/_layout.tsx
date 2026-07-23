// Polyfill requis par PowerSync (async iterators) — doit précéder tout usage de PowerSync.
import '@azure/core-asynciterator-polyfill';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useStatus } from '@powersync/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveRootRoute } from '@wellness/shared';

// Initialise i18next (side-effect) avant le rendu des écrans.
import i18n from '@/i18n';
// Enregistre la tâche de fond de suivi GPS (side-effect) dès le chargement du JS
// (portée globale requise par expo-task-manager — voir running/tracker-task.ts).
import '@/running/tracker-task';
import { fetchPendingDeletion } from '@/data/repositories/account-deletion-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { ensureSettings, useSettings } from '@/data/repositories/settings-repository';
import { useStreakReminderScheduler } from '@/data/repositories/notification-repository';
import { PowerSyncProvider } from '@/powersync/PowerSyncProvider';
import { useAuthStore } from '@/stores/auth-store';
import { useMenuAccent } from '@/stores/menu-accent-store';
import { useTrackedMicros } from '@/stores/tracked-micros';
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

  // Détection de la suppression de compte pending (CONF-02) : contrôle serveur (hors
  // PowerSync) une seule fois par utilisateur. On key sur `session?.user?.id` (stable
  // entre les refreshes de token) plutôt que sur l'objet `session` (qui est ré-émis à
  // chaque refresh) pour ne pas re-déclencher le contrôle ni faire flasher/remonter le
  // Stack à chaque renouvellement horaire du token.
  const userId = session?.user?.id ?? null;
  const [deletionState, setDeletionState] = useState<{ loading: boolean; pending: boolean }>({
    loading: true,
    pending: false,
  });
  const deletionCheckedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!userId) {
      // Pas de setState synchrone ici : sans utilisateur, l'état pertinent est dérivé
      // directement au rendu ci-dessous (`deletion`) — seul le ref de dédup est réinitialisé.
      deletionCheckedFor.current = null;
      return;
    }
    if (deletionCheckedFor.current === userId) {
      return;
    }
    deletionCheckedFor.current = userId;
    let cancelled = false;
    setDeletionState({ loading: true, pending: false });
    fetchPendingDeletion()
      .then((r) => {
        if (!cancelled) setDeletionState({ loading: false, pending: r != null });
      })
      .catch(() => {
        // Fail-open (hors-ligne / erreur réseau) : on ne bloque pas l'accès à l'app sur
        // un contrôle de suppression indisponible.
        if (!cancelled) setDeletionState({ loading: false, pending: false });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  // Dérivé plutôt que stocké : sans utilisateur, l'état de suppression n'a pas de sens
  // (évite un setState synchrone superflu dans l'effet ci-dessus).
  const deletion = userId ? deletionState : { loading: false, pending: false };
  // TODO(conf02): signOut gracieux si compte purgé à distance (J+30) — nécessite d'identifier,
  // côté connector PowerSync, un signal d'erreur d'auth irrécupérable (hors périmètre _layout.tsx).

  const fontsReady = loaded || error != null;
  // Décision de routing centralisée dans un helper pur testé (@wellness/shared) : gère l'attente
  // (splash), l'auth, l'onboarding et l'app — y compris la garde anti-race offline-first (ne pas
  // conclure « onboarding non fait » sur un profil local absent avant la fin de la synchro initiale,
  // sinon l'onboarding réapparaît après une réinstallation). Voir fix-onboarding-rejeu-connexion.
  const route = resolveRootRoute({
    fontsReady,
    authInitializing: initializing,
    hasSession: !!session,
    profileLoading,
    hasProfile: profile != null,
    onboardingCompletedAt: profile?.onboardingCompletedAt ?? null,
    settingsLoading,
    hasSynced: !!syncStatus.hasSynced,
    deletionCheckLoading: deletion.loading,
    deletionPending: deletion.pending,
  });
  const ready = route !== 'wait';

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  // Charge les préférences locales (micros suivis + couleurs de menu), une seule fois.
  useEffect(() => {
    void useTrackedMicros.getState().hydrate();
    void useMenuAccent.getState().hydrate();
  }, []);

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

  // Notifications (US 2.6) : monte le planificateur du rappel « série en danger ».
  // Hook inconditionnel (appelé avant tout retour anticipé). Assure la permission
  // + le canal Android à l'init, puis (re)planifie/annule selon l'activité du jour
  // et les préférences — au montage, sur changement, et au retour au premier plan.
  useStreakReminderScheduler();

  // Redirige selon session + onboarding (compte-profil-onboarding §2/§3).
  useEffect(() => {
    if (route === 'wait') {
      return;
    }
    const group = segments[0];
    const inAuth = group === '(auth)';
    const inOnboarding = group === '(onboarding)';

    if (route === 'auth') {
      if (!inAuth) {
        router.replace('/(auth)/sign-in');
      }
      return;
    }
    if (route === 'onboarding') {
      if (!inOnboarding) {
        router.replace('/(onboarding)/intro');
      }
      return;
    }
    if (route === 'deletion-pending') {
      // Cast nécessaire tant que l'écran `deletion-pending` n'existe pas encore sur le
      // disque (Task 6) : les routes typées d'expo-router sont générées depuis les
      // fichiers présents sous `app/`, donc absentes du type tant que le fichier n'existe pas.
      if ((segments[0] as string) !== 'deletion-pending') {
        router.replace('/deletion-pending' as Parameters<typeof router.replace>[0]);
      }
      return;
    }
    // route === 'app'
    if (inAuth || inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [route, segments, router]);

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
        <Stack.Screen name="deletion-pending" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen
          name="account-delete"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('account.delete.title'),
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { color: colors.text, fontFamily: typography.title.fontFamily },
            headerTintColor: colors.accent,
          }}
        />
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
          name="exercises/[id]"
          options={{
            headerShown: true,
            title: t('exercises.detail.title'),
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
          name="running-profile"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('running.profile.title'),
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
        <Stack.Screen
          name="running-programs"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="planning"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="running-history"
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PowerSyncProvider>
        <RootNavigator />
      </PowerSyncProvider>
    </GestureHandlerRootView>
  );
}

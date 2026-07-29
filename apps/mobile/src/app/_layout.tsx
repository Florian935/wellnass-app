// Polyfill requis par PowerSync (async iterators) — doit précéder tout usage de PowerSync.
import '@azure/core-asynciterator-polyfill';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useStatus } from '@powersync/react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveRootRoute } from '@wellness/shared';

// Initialise i18next (side-effect) avant le rendu des écrans.
import i18n from '@/i18n';
// Enregistre la tâche de fond de suivi GPS (side-effect) dès le chargement du JS
// (portée globale requise par expo-task-manager — voir running/tracker-task.ts).
import '@/running/tracker-task';
// Configure Google Sign-In (side-effect) au chargement du JS (US 1.2).
import '@/lib/google-signin';
import { useDeletionStore } from '@/stores/deletion-store';
import { useProfile } from '@/data/repositories/profile-repository';
import { autoCloseStaleWorkout } from '@/data/repositories/workout-repository';
import { ensureSettings, useSettings } from '@/data/repositories/settings-repository';
import { useStreakReminderScheduler } from '@/data/repositories/notification-repository';
import { useAppOpenedAnalytics } from '@/hooks/useAppOpenedAnalytics';
import { useHealthConnectImports } from '@/hooks/useHealthConnectImports';
import { useAuthDeepLink } from '@/hooks/useAuthDeepLink';
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
  const recoveryPending = useAuthStore((s) => s.recoveryPending);
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
  // Détection « suppression de compte en cours » (CONF-02) via un store partagé : l'écran-gate
  // peut ainsi réinitialiser l'état après une annulation (sinon on resterait piégé sur la gate).
  // Keyé sur `session.user.id` (stable entre refreshes de token) — le store dédup par utilisateur.
  const userId = session?.user?.id ?? null;
  const deletionLoading = useDeletionStore((s) => s.loading);
  const deletionPending = useDeletionStore((s) => s.pending);
  useEffect(() => {
    if (!userId) {
      useDeletionStore.getState().reset();
      return;
    }
    useDeletionStore.getState().check(userId);
  }, [userId]);
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
    deletionCheckLoading: deletionLoading,
    deletionPending: deletionPending,
    recoveryPending,
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

  // Clôture auto d'une séance périmée (spec 3.37) — une seule fois par lancement, après la
  // synchro initiale (`hasSynced`) pour raisonner sur l'état réel (pas une ligne locale non
  // synchronisée). Best-effort côté repository (jamais bloquant).
  const staleWorkoutCheckedRef = useRef(false);
  useEffect(() => {
    if (session && syncStatus.hasSynced && !staleWorkoutCheckedRef.current) {
      staleWorkoutCheckedRef.current = true;
      void autoCloseStaleWorkout();
    }
  }, [session, syncStatus.hasSynced]);

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

  // Analytics : émet `app_opened` au démarrage et au retour au premier plan (throttlé 30 min).
  useAppOpenedAnalytics();

  // Health Connect : importe les pesées d'une balance connectée (US CONF-06, throttle 6 h) **et**
  // les pas quotidiens (US PAS-01, throttle 1 h — un compteur de pas évolue toute la journée).
  // Gardé sur `hasSynced` — comme la clôture auto de séance — pour lire le réglage réel et non
  // une ligne locale non encore synchronisée.
  useHealthConnectImports(!!session && !!syncStatus.hasSynced);

  // Deep links d'auth (confirmation d'e-mail…) : établit la session au retour dans l'app.
  useAuthDeepLink();

  // Redirige selon session + onboarding (compte-profil-onboarding §2/§3).
  useEffect(() => {
    if (route === 'wait') {
      return;
    }
    // Lu en `string` volontairement : `segments[0]` est typé par les **routes générées** par Expo
    // Router (`.expo/types`, artefact local gitignoré, absent en CI). Or on doit comparer à
    // `auth-callback`, un **chemin d'atterrissage de deep link sans écran** — donc jamais présent dans
    // cette union. Sans ce typage lâche, le typecheck casse chez qui a les types générés (TS2367) tout
    // en passant en CI : divergence à éviter.
    const group: string | undefined = segments[0];
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
      if (segments[0] !== 'deletion-pending') {
        router.replace('/deletion-pending');
      }
      return;
    }
    if (route === 'password-recovery') {
      // Le nom de la route DOIT rester aligné sur PASSWORD_RESET_REDIRECT_URL
      // (`wellness://password-reset`) : Expo Router résout le deep link entrant comme un chemin et
      // navigue lui-même dessus. Un nom différent → « Unmatched Route » (sa navigation gagne la
      // course contre celle-ci).
      if (segments[0] !== 'password-reset') {
        router.replace('/password-reset');
      }
      return;
    }
    // route === 'app'
    // Les deep links d'auth font naviguer **Expo Router lui-même** sur le chemin de l'URL reçue.
    // `password-reset` a un écran (gate ci-dessus) ; `auth-callback` (confirmation d'inscription)
    // n'en a pas → Expo Router affiche son écran « Unmatched Route » et, sans l'échappatoire
    // ci-dessous, on y resterait **bloqué**. Le cas ne se voyait pas pour un **nouveau** compte
    // (route = 'onboarding', dont la branche redirige inconditionnellement) mais piégeait un compte
    // **déjà onboardé** qui clique un lien de confirmation.
    const onAuthDeepLinkLanding = group === 'auth-callback';
    if (inAuth || inOnboarding || onAuthDeepLinkLanding) {
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
        <Stack.Screen name="password-reset" options={{ headerShown: false, gestureEnabled: false }} />
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
          name="help"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('help.title'),
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
        {/* US MESUR-01 — mensurations. Ouvert depuis Progression (muscu). */}
        <Stack.Screen
          name="measurements"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('measurements.title'),
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { color: colors.text, fontFamily: typography.title.fontFamily },
            headerTintColor: colors.accent,
          }}
        />
        {/* US OBJ-01 — objectifs à échéance. Ouvert depuis le widget d'accueil. */}
        <Stack.Screen
          name="goals"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('goals.title'),
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { color: colors.text, fontFamily: typography.title.fontFamily },
            headerTintColor: colors.accent,
          }}
        />
        {/* US BIEN-01 — historique du check-in de bien-être. */}
        <Stack.Screen
          name="wellbeing"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('wellbeing.historyTitle'),
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

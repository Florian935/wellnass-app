/**
 * Gate de routing racine (`app/_layout.tsx`) — la redirection, montée pour de vrai.
 *
 * Fichier à **0 %** avant celui-ci (85 instructions). C'est le premier code qui tourne au
 * démarrage, et une erreur y est totale : soit l'app boucle, soit elle laisse entrer sans compte,
 * soit elle refait l'onboarding à quelqu'un qui l'a déjà fait.
 *
 * La **décision** de route vit dans `resolveRootRoute` (`@wellness/shared`, pure et déjà testée) :
 * elle n'est donc pas re-testée ici. Ce qui l'est, c'est ce que ce fichier fait de la décision, et
 * c'est là que se logent les défauts :
 *
 *  1. **Tant que la décision est « attendre », on ne rend RIEN et on ne redirige pas.** Rediriger
 *     pendant le chargement produit un flash d'onboarding, puis une boucle quand le profil arrive.
 *  2. **On ne redirige que si l'on n'est pas déjà au bon endroit.** Un `replace` inconditionnel à
 *     chaque rendu remonterait la pile en boucle.
 *  3. **`auth-callback` est une échappatoire, pas une route.** Le lien de confirmation d'e-mail
 *     fait naviguer Expo Router lui-même sur un chemin **sans écran** : sans cette sortie, un
 *     compte déjà onboardé reste bloqué sur « Unmatched Route ».
 *  4. **Le splash ne se cache qu'une fois prêt**, et l'amorçage des réglages attend la **fin de la
 *     synchro initiale** — sinon on crée une ligne locale que le serveur a déjà, l'envoi échoue en
 *     boucle sur la contrainte unique et **bloque toute la synchro**.
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';

import RootLayout from '../_layout';
import { ensureSettings, useSettings } from '@/data/repositories/settings-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { autoCloseStaleWorkout } from '@/data/repositories/workout-repository';
import { useStatus } from '@powersync/react';
import { useRouter, useSegments } from 'expo-router';
import i18n from '@/i18n';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@azure/core-asynciterator-polyfill', () => ({}));
jest.mock('@/running/tracker-task', () => ({}));
jest.mock('@/lib/google-signin', () => ({}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-router', () => {
  const { View } = require('react-native');
  const Stack = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  Stack.displayName = 'Stack';
  const Ecran = ({ name }: { name: string }) => <View accessibilityLabel={`ecran-${name}`} />;
  Ecran.displayName = 'StackScreen';
  Stack.Screen = Ecran;
  return {
    Stack,
    ThemeProvider: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    DefaultTheme: { colors: {} },
    DarkTheme: { colors: {} },
    useRouter: jest.fn(),
    useSegments: jest.fn(() => []),
  };
});

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return { GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/powersync/PowerSyncProvider', () => {
  const { View } = require('react-native');
  return { PowerSyncProvider: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@powersync/react', () => ({ useStatus: jest.fn() }));

jest.mock('@/data/repositories/profile-repository', () => ({ useProfile: jest.fn() }));
jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: jest.fn(),
  ensureSettings: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/data/repositories/workout-repository', () => ({
  autoCloseStaleWorkout: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/data/repositories/notification-repository', () => ({
  useStreakReminderScheduler: jest.fn(),
  useWeeklyReviewScheduler: jest.fn(),
  useProgrammedRemindersScheduler: jest.fn(),
}));
jest.mock('@/hooks/useAppOpenedAnalytics', () => ({ useAppOpenedAnalytics: jest.fn() }));
jest.mock('@/widgets/useHomeWidgetRefresh', () => ({ useHomeWidgetRefresh: jest.fn() }));
jest.mock('@/hooks/useHealthConnectImports', () => ({ useHealthConnectImports: jest.fn() }));
jest.mock('@/hooks/useAuthDeepLink', () => ({ useAuthDeepLink: jest.fn() }));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { language: 'fr', changeLanguage: jest.fn(() => Promise.resolve()) },
}));

jest.mock('@/theme/fonts', () => ({
  useAppFonts: jest.fn(() => ({ loaded: true, error: null })),
  fontFamily: {},
}));
jest.mock('@/theme/typography', () => ({ typography: { title: { fontFamily: 'X' } } }));
jest.mock('@/theme/useTheme', () => ({
  useSyncColorScheme: jest.fn(),
  useTheme: () => ({
    scheme: 'light',
    colors: { accent: '#c0562f', background: '#fffaf2', surface: '#fff', text: '#000', border: '#eee' },
  }),
}));

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

/**
 * Stores Zustand : l'état et les espions vivent **dans** la fabrique — une fabrique `jest.mock` est
 * hoistée et ne peut refermer sur aucune variable du fichier. On les relit ensuite par
 * `jest.requireMock`, seule façon de piloter l'état depuis les tests.
 */
jest.mock('@/stores/auth-store', () => {
  const etat = {
    session: null as { user: { id: string; email: string } } | null,
    initializing: false,
    recoveryPending: false,
  };
  return {
    useAuthStore: (selecteur: (s: typeof etat) => unknown) => selecteur(etat),
    __etat: etat,
  };
});

jest.mock('@/stores/deletion-store', () => {
  const etat = { loading: false, pending: false };
  const check = jest.fn();
  const reset = jest.fn();
  const store = (selecteur: (s: typeof etat) => unknown) => selecteur(etat);
  store.getState = () => ({ check, reset });
  return { useDeletionStore: store, __etat: etat, __check: check, __reset: reset };
});

jest.mock('@/stores/tracked-micros', () => {
  const hydrate = jest.fn(() => Promise.resolve());
  return { useTrackedMicros: { getState: () => ({ hydrate }) }, __hydrate: hydrate };
});
jest.mock('@/stores/menu-accent-store', () => {
  const hydrate = jest.fn(() => Promise.resolve());
  return { useMenuAccent: { getState: () => ({ hydrate }) }, __hydrate: hydrate };
});

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockProfile = useProfile as jest.Mock;
const mockSettings = useSettings as jest.Mock;
const mockEnsureSettings = ensureSettings as jest.Mock;
const mockAutoClose = autoCloseStaleWorkout as jest.Mock;
const mockStatus = useStatus as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockSegments = useSegments as unknown as jest.Mock;
const mockHideSplash = SplashScreen.hideAsync as jest.Mock;
const mockChangeLanguage = (i18n as unknown as { changeLanguage: jest.Mock }).changeLanguage;

const etatAuth = jest.requireMock('@/stores/auth-store').__etat as {
  session: { user: { id: string; email: string } } | null;
  initializing: boolean;
  recoveryPending: boolean;
};
const etatDeletion = jest.requireMock('@/stores/deletion-store').__etat as {
  loading: boolean;
  pending: boolean;
};
const deletionCheck = jest.requireMock('@/stores/deletion-store').__check as jest.Mock;
const deletionReset = jest.requireMock('@/stores/deletion-store').__reset as jest.Mock;
const hydrateMicros = jest.requireMock('@/stores/tracked-micros').__hydrate as jest.Mock;
const hydrateAccent = jest.requireMock('@/stores/menu-accent-store').__hydrate as jest.Mock;

const replace = jest.fn();

const SESSION = { user: { id: 'u-1', email: 'moi@example.com' } };

/**
 * Monte l'app dans un état donné. Les valeurs par défaut décrivent un utilisateur **connecté,
 * onboardé, synchronisé** — le cas nominal, dont chaque test ne fait varier qu'une dimension.
 */
const monter = async ({
  session = SESSION as typeof SESSION | null,
  initializing = false,
  recoveryPending = false,
  profile = { onboardingCompletedAt: '2026-01-01T00:00:00.000Z' } as Record<string, unknown> | null,
  profileLoading = false,
  settings = { language: 'fr' } as Record<string, unknown> | null,
  settingsLoading = false,
  hasSynced = true,
  deletionLoading = false,
  deletionPending = false,
  segments = ['(tabs)'] as string[],
} = {}) => {
  etatAuth.session = session;
  etatAuth.initializing = initializing;
  etatAuth.recoveryPending = recoveryPending;
  etatDeletion.loading = deletionLoading;
  etatDeletion.pending = deletionPending;
  mockProfile.mockReturnValue({ profile, isLoading: profileLoading });
  mockSettings.mockReturnValue({ settings, isLoading: settingsLoading });
  mockStatus.mockReturnValue({ hasSynced });
  mockSegments.mockReturnValue(segments);
  return render(<RootLayout />);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ replace });
  (i18n as unknown as { language: string }).language = 'fr';
});

// ---------------------------------------------------------------------------
// Attente : ne rien faire tant qu'on ne sait pas
// ---------------------------------------------------------------------------

describe('attente', () => {
  it.each([
    ['l’auth s’initialise', { initializing: true }],
    ['le profil charge', { profileLoading: true, profile: null }],
    ['les réglages chargent', { settingsLoading: true, settings: null }],
    ['le contrôle de suppression tourne', { deletionLoading: true }],
  ])('🔴 %s : aucune redirection, aucun écran monté', async (_cas, etat) => {
    await monter({ segments: [], ...etat });

    // Rediriger pendant le chargement produit un flash d'onboarding, puis une boucle quand le
    // profil arrive. Le splash natif reste, et c'est le bon écran d'attente.
    //
    // `RootNavigator` rend `null`, mais les enveloppes (`GestureHandlerRootView`, le fournisseur
    // PowerSync) restent montées : c'est l'absence du **Stack** qu'on vérifie, pas un arbre vide.
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('ecran-(tabs)')).toBeNull();
  });

  it('🔴 le splash n’est PAS caché tant qu’on attend', async () => {
    await monter({ initializing: true, segments: [] });

    expect(mockHideSplash).not.toHaveBeenCalled();
  });

  it('le splash est caché dès que la décision est prise', async () => {
    await monter();

    expect(mockHideSplash).toHaveBeenCalled();
  });

  it('🔴 des polices en ERREUR ne bloquent pas le démarrage', async () => {
    jest.requireMock('@/theme/fonts').useAppFonts.mockReturnValue({ loaded: false, error: new Error('woff') });
    await monter();

    // `loaded || error != null` : une police manquante dégrade la typographie, elle ne doit pas
    // laisser l'app sur un splash définitif.
    expect(mockHideSplash).toHaveBeenCalled();
    jest.requireMock('@/theme/fonts').useAppFonts.mockReturnValue({ loaded: true, error: null });
  });
});

// ---------------------------------------------------------------------------
// Redirections
// ---------------------------------------------------------------------------

describe('redirections', () => {
  it('sans session, on va sur la connexion', async () => {
    await monter({ session: null, profile: null, segments: ['(tabs)'] });

    expect(replace).toHaveBeenCalledWith('/(auth)/sign-in');
  });

  it('🔴 déjà sur la connexion, on ne redirige PAS', async () => {
    await monter({ session: null, profile: null, segments: ['(auth)'] });

    // Un `replace` inconditionnel à chaque rendu remonterait la pile en boucle.
    expect(replace).not.toHaveBeenCalled();
  });

  it('un onboarding non terminé mène à l’onboarding', async () => {
    await monter({ profile: { onboardingCompletedAt: null }, segments: ['(tabs)'] });

    expect(replace).toHaveBeenCalledWith('/(onboarding)/intro');
  });

  it('déjà dans l’onboarding, on y reste', async () => {
    await monter({ profile: { onboardingCompletedAt: null }, segments: ['(onboarding)'] });

    expect(replace).not.toHaveBeenCalled();
  });

  it('une suppression de compte en cours enferme sur son écran', async () => {
    await monter({ deletionPending: true, segments: ['(tabs)'] });

    expect(replace).toHaveBeenCalledWith('/deletion-pending');
  });

  it('une récupération de mot de passe mène à l’écran de réinitialisation', async () => {
    await monter({ recoveryPending: true, segments: ['(tabs)'] });

    // Le nom doit rester aligné sur `wellness://password-reset` : Expo Router navigue lui-même sur
    // le chemin du deep link, et un nom différent produit « Unmatched Route ».
    expect(replace).toHaveBeenCalledWith('/password-reset');
  });

  it('un utilisateur onboardé encore dans l’auth est renvoyé dans l’app', async () => {
    await monter({ segments: ['(auth)'] });

    expect(replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('🔴 `auth-callback` est une ÉCHAPPATOIRE, pas une impasse', async () => {
    await monter({ segments: ['auth-callback'] });

    // Le lien de confirmation d'e-mail fait naviguer Expo Router lui-même sur un chemin **sans
    // écran**. Sans cette sortie, un compte DÉJÀ onboardé reste bloqué sur « Unmatched Route » —
    // le cas ne se voyait pas sur un compte neuf, dont la branche onboarding redirige toujours.
    expect(replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('🔴 un utilisateur onboardé DÉJÀ dans l’app n’est pas redirigé', async () => {
    await monter({ segments: ['(tabs)'] });

    expect(replace).not.toHaveBeenCalled();
  });

  it('une route ordinaire de l’app ne déclenche aucune redirection', async () => {
    await monter({ segments: ['settings'] });

    // Sans cette condition, ouvrir les réglages renverrait aussitôt sur l'accueil.
    expect(replace).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Amorçage
// ---------------------------------------------------------------------------

describe('amorçage', () => {
  it('🔴 les réglages ne sont créés qu’APRÈS la synchro initiale', async () => {
    await monter({ settings: null, hasSynced: false });

    // Créer une ligne locale que le serveur a déjà viole la contrainte unique `user_id` : l'envoi
    // échoue en boucle sur le write-checkpoint et **bloque toute la synchro**.
    expect(mockEnsureSettings).not.toHaveBeenCalled();
  });

  it('une fois synchronisé et sans réglages, ils sont créés', async () => {
    await monter({ settings: null, hasSynced: true });

    expect(mockEnsureSettings).toHaveBeenCalledTimes(1);
  });

  it('des réglages existants ne sont pas recréés', async () => {
    await monter({ settings: { language: 'fr' }, hasSynced: true });

    expect(mockEnsureSettings).not.toHaveBeenCalled();
  });

  it('🔴 la clôture d’une séance périmée attend aussi la synchro', async () => {
    await monter({ hasSynced: false });

    // Raisonner sur une ligne locale non synchronisée clôturerait une séance que le serveur sait
    // encore ouverte.
    expect(mockAutoClose).not.toHaveBeenCalled();
  });

  it('🔴 et n’a lieu qu’UNE fois par lancement', async () => {
    const { rerender } = await monter({ hasSynced: true });
    expect(mockAutoClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      await rerender(<RootLayout />);
    });

    // Garde par `useRef` : sans elle, chaque changement de statut de synchro relancerait la
    // clôture, et une séance rouverte entre-temps serait refermée sous les doigts de l'utilisateur.
    expect(mockAutoClose).toHaveBeenCalledTimes(1);
  });

  it('les préférences locales sont hydratées au montage', async () => {
    await monter();

    expect(hydrateMicros).toHaveBeenCalledTimes(1);
    expect(hydrateAccent).toHaveBeenCalledTimes(1);
  });

  it('🔴 la langue des réglages PRIME sur celle de l’appareil', async () => {
    await monter({ settings: { language: 'en' } });

    // La préférence est synchronisée : elle doit suivre l'utilisateur d'un appareil à l'autre,
    // quelle que soit la locale système du second.
    expect(mockChangeLanguage).toHaveBeenCalledWith('en');
  });

  it('une langue déjà appliquée n’est pas réappliquée', async () => {
    await monter({ settings: { language: 'fr' } });

    // `changeLanguage` remonte tout l'arbre : l'appeler à chaque rendu ferait clignoter l'app.
    expect(mockChangeLanguage).not.toHaveBeenCalled();
  });

  it('🔴 la déconnexion RÉINITIALISE le contrôle de suppression', async () => {
    await monter({ session: null, profile: null, segments: ['(auth)'] });

    // Sans cette remise à zéro, l'état « suppression en cours » du compte précédent piégerait le
    // compte suivant sur l'écran-gate.
    expect(deletionReset).toHaveBeenCalled();
    expect(deletionCheck).not.toHaveBeenCalled();
  });

  it('une session ouverte déclenche le contrôle pour CET utilisateur', async () => {
    await monter();

    expect(deletionCheck).toHaveBeenCalledWith('u-1');
  });
});

// ---------------------------------------------------------------------------
// Rendu du Stack
// ---------------------------------------------------------------------------

describe('rendu', () => {
  it('une fois prêt, le Stack est monté avec ses routes', async () => {
    await monter();

    expect(screen.getByLabelText('ecran-(tabs)')).toBeTruthy();
    expect(screen.getByLabelText('ecran-cycle')).toBeTruthy();
  });
});

/**
 * jest.setup.ts — Fichier de setup jest exécuté après le framework de test.
 *
 * Responsabilités :
 * - Mocker les modules natifs impossibles à charger dans jest (PowerSync, op-sqlite).
 * - Fournir des valeurs par défaut cohérentes pour les hooks/contextes PowerSync.
 */

// Variables d'environnement Supabase : défauts pour les tests (jest ne charge pas .env).
// Le vrai src/lib/supabase.ts lève au chargement sans elles ; createClient reste mocké ci-dessous.
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'http://localhost';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';

// ---------------------------------------------------------------------------
// Mock @powersync/react — hooks utilisés dans les repositories et composants
// ---------------------------------------------------------------------------
jest.mock('@powersync/react', () => ({
  useQuery: jest.fn(() => ({ data: [], isLoading: false, error: undefined })),
  useStatus: jest.fn(() => ({ hasSynced: true, connected: false })),
  PowerSyncContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
    Consumer: null,
    displayName: 'PowerSyncContext',
  },
}));

// ---------------------------------------------------------------------------
// Mock @powersync/react-native — module natif (ne peut pas charger en jest)
// ---------------------------------------------------------------------------
jest.mock('@powersync/react-native', () => ({
  PowerSyncDatabase: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({ rows: { _array: [] } }),
    getOptional: jest.fn().mockResolvedValue(null),
    getAll: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  OPSqliteOpenFactory: jest.fn(),
  column: {
    text: 'TEXT',
    integer: 'INTEGER',
    real: 'REAL',
  },
  Schema: jest.fn().mockImplementation((tables) => ({ tables })),
  Table: jest.fn().mockImplementation((columns) => ({ columns })),
  UpdateType: {
    PUT: 'PUT',
    PATCH: 'PATCH',
    DELETE: 'DELETE',
  },
}));

// ---------------------------------------------------------------------------
// Mock @powersync/op-sqlite — binding natif op-sqlite
// ---------------------------------------------------------------------------
jest.mock('@powersync/op-sqlite', () => ({
  OPSqliteOpenFactory: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock @op-engineering/op-sqlite — binding natif bas niveau
// ---------------------------------------------------------------------------
jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(),
  openSync: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock @/powersync/system — instance PowerSync globale de l'app
// ---------------------------------------------------------------------------
jest.mock('@/powersync/system', () => ({
  powerSync: {
    execute: jest.fn().mockResolvedValue({ rows: { _array: [] } }),
    getOptional: jest.fn().mockResolvedValue(null),
    getAll: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  },
  connector: {},
}));

// ---------------------------------------------------------------------------
// Mock expo-localization (natif — accès device)
// ---------------------------------------------------------------------------
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'fr', regionCode: 'FR' }]),
}));

// ---------------------------------------------------------------------------
// Mock expo-crypto (natif) — `generateId()` en dépend
// ---------------------------------------------------------------------------
// Sans ce mock, `Crypto.randomUUID()` renvoie `undefined` en test : toute ligne insérée par
// `insertWithSyncFields` reçoit un `id` nul, et les `WHERE id = ?` suivants ne matchent rien —
// une panne muette qui rend intestable tout parcours écriture puis relecture.
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID(),
}));

// ---------------------------------------------------------------------------
// Mock expo-secure-store (natif)
// ---------------------------------------------------------------------------
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Mock expo-constants (natif)
// ---------------------------------------------------------------------------
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: { extra: {} },
  },
}));

// ---------------------------------------------------------------------------
// Mock expo-location (natif — accès GPS)
// ---------------------------------------------------------------------------
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue(null),
  watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  Accuracy: { High: 5, Highest: 6, BestForNavigation: 6 },
}));

// ---------------------------------------------------------------------------
// Mock expo-task-manager (natif — tâches de fond)
// ---------------------------------------------------------------------------
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn().mockResolvedValue(false),
  unregisterTaskAsync: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Mock expo-keep-awake (natif — empêche la mise en veille écran)
// ---------------------------------------------------------------------------
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: jest.fn(),
  activateKeepAwakeAsync: jest.fn().mockResolvedValue(undefined),
  deactivateKeepAwake: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock @/running/tracker — module natif (expo-location + expo-task-manager)
// ---------------------------------------------------------------------------
jest.mock('@/running/tracker', () => ({
  startTracking: jest.fn().mockResolvedValue({ ok: true }),
  stopTracking: jest.fn().mockResolvedValue(undefined),
  pauseTracking: jest.fn().mockResolvedValue(undefined),
  resumeTracking: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock react-native-safe-area-context — pas de SafeAreaProvider en tests
// (useSafeAreaInsets lèverait « No safe area value available »). On utilise le
// mock officiel de la lib (insets à 0, providers passthrough).
// ---------------------------------------------------------------------------
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});

// ---------------------------------------------------------------------------
// Mock @react-native-google-signin/google-signin — module natif (getEnforcing
// échoue en env jest). Importé transitivement dès qu'un test tire `auth-store`
// (US 1.2 OAuth Google). Un test peut surcharger ce mock localement au besoin.
// ---------------------------------------------------------------------------
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({ type: 'cancelled', data: null }),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
  isErrorWithCode: jest.fn(() => false),
}));

// ---------------------------------------------------------------------------
// Mock @supabase/supabase-js — client réseau non nécessaire en tests unitaires
// ---------------------------------------------------------------------------
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    })),
  })),
}));

// ---------------------------------------------------------------------------
// Mock expo-notifications — module natif, absent de l'environnement de test
// ---------------------------------------------------------------------------
// `@/lib/notifications` enregistre un `setNotificationHandler` **au chargement du module** : sans
// ce mock, tout test qui importe (même indirectement) un écran ou un repository touchant aux
// notifications échoue à l'import, avant même d'exécuter une assertion.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  // US MUSCU-UX03 : la notification continue du repos se retire par `dismiss`, pas par `cancel`
  // (elle est déjà affichée, plus en attente).
  dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly' },
}));

// ---------------------------------------------------------------------------
// Mock expo-speech — module natif, absent de l'environnement de test (US RUN-F2a)
// ---------------------------------------------------------------------------
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
}));


// ---------------------------------------------------------------------------
// Mock react-native-reanimated — module natif, absent de l'environnement de test (US MOTION-01)
// ---------------------------------------------------------------------------
// **Pourquoi c'est devenu global.** Jusqu'à MOTION-01, Reanimated n'était importé que par deux
// écrans (planning, grille de widgets) et chacun le mockait dans son propre fichier de test. Le
// langage de mouvement le fait entrer dans des **primitives partagées** — à commencer par
// `RingGauge`, que 38 endroits utilisent : un mock par fichier de test aurait demandé de le
// recopier dans des dizaines de suites, avec la garantie d'en oublier.
//
// Sans lui, l'échec ne ressemble pas à un test rouge : `react-native-worklets` charge son module
// natif (`loadUnpackers`) au moment de l'`import`, donc la suite meurt avant la première
// assertion — 26 suites dans le cas présent.
//
// **Pourquoi un mock écrit à la main plutôt que celui de la bibliothèque.**
// `react-native-reanimated/mock` est inutilisable ici : son propre code
// (`src/mock.ts`) réimporte `react-native-reanimated/src/index.ts`, qui déclenche exactement
// l'initialisation native qu'on cherche à éviter. Le mock officiel suppose un environnement où
// le module natif se charge — ce n'est pas le cas de jest-expo.
//
// Le contrat reproduit ici est **le comportement au repos** : chaque animation atteint sa valeur
// finale immédiatement. C'est cohérent avec la règle R1 de l'US (aucune animation ne porte
// d'information), donc un test qui passe avec ce mock teste bien l'état que verra l'utilisateur.
jest.mock('react-native-reanimated', () => {
  const { View, Text, ScrollView, FlatList, Image } = jest.requireActual('react-native');

  /** Valeur partagée : un objet mutable ordinaire suffit, aucun pont natif n'est en jeu. */
  const useSharedValue = <T,>(init: T) => ({ value: init });

  /** Les animations rendent leur valeur cible : au repos, c'est ce que l'écran affiche. */
  const identityAnimation = <T,>(toValue: T) => toValue;
  /** `withDelay(ms, anim)` / `withRepeat(anim, …)` : on ne garde que l'animation enveloppée. */
  const unwrapDelay = <T,>(_ms: number, animation: T) => animation;
  const unwrapRepeat = <T,>(animation: T) => animation;

  /**
   * Constructeur d'animation d'entrée/sortie. Chaînable à l'infini (`.duration().delay()…`) et
   * sans effet : en test, un composant monté est simplement présent.
   */
  const makeEntering = () => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const method of [
      'duration',
      'delay',
      'springify',
      'damping',
      'stiffness',
      'withInitialValues',
      'easing',
      'build',
      'randomDelay',
      'reduceMotion',
    ]) {
      builder[method] = chain;
    }
    return builder;
  };

  const easingFn = () => 0;
  const Easing = {
    linear: easingFn,
    ease: easingFn,
    quad: easingFn,
    cubic: easingFn,
    sin: easingFn,
    circle: easingFn,
    exp: easingFn,
    bezier: () => easingFn,
    in: () => easingFn,
    out: () => easingFn,
    inOut: () => easingFn,
  };

  const Animated = {
    View,
    Text,
    ScrollView,
    FlatList,
    Image,
    // `createAnimatedComponent` rend le composant tel quel. Conséquence assumée : les props
    // `animatedProps` arrivent au composant réel, qui les ignore — sans bruit ni avertissement.
    createAnimatedComponent: <T,>(component: T) => component,
  };

  return {
    __esModule: true,
    default: Animated,
    ...Animated,

    useSharedValue,
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useAnimatedProps: (factory: () => unknown) => factory(),
    useDerivedValue: (factory: () => unknown) => ({ value: factory() }),
    useAnimatedRef: () => ({ current: null }),
    // Le cas nominal : le système ne demande pas de réduire les animations.
    //
    // C'est un `jest.fn` et non une fonction ordinaire pour que les tests du hook applicatif
    // puissent le piloter (`jest.mocked(useReducedMotion).mockReturnValue(true)`). Un
    // `jest.mock('react-native-reanimated', …)` local **ne marcherait pas** : la factory ne peut
    // pas faire de `requireActual` sans déclencher le chargement natif que ce mock évite.
    useReducedMotion: jest.fn(() => false),

    withTiming: identityAnimation,
    withSpring: identityAnimation,
    withDecay: identityAnimation,
    withDelay: unwrapDelay,
    withRepeat: unwrapRepeat,
    withSequence: <T,>(...animations: T[]) => animations[animations.length - 1],
    cancelAnimation: () => {},

    // `runOnJS(fn)` renvoie une fonction qui appelle `fn` : en test il n'y a qu'un seul thread,
    // donc l'appel est direct. C'est ce qui permet aux tests du glisser-déposer de vérifier
    // qu'un geste déclenche bien son callback.
    runOnJS:
      <A extends unknown[], R>(fn: (...args: A) => R) =>
      (...args: A) =>
        fn(...args),
    runOnUI:
      <A extends unknown[], R>(fn: (...args: A) => R) =>
      (...args: A) =>
        fn(...args),

    interpolate: (value: number) => value,
    // US DASH-01 — le repli de scène au défilement. En test il n'y a pas de défilement : le gestionnaire
    // est une fonction vide, et la valeur partagée reste à 0 (scène dépliée, en-tête compact masqué).
    useAnimatedScrollHandler: () => () => {},
    useAnimatedReaction: () => {},
    interpolateColor: () => 'rgba(0, 0, 0, 1)',
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    Easing,

    FadeIn: makeEntering(),
    FadeInDown: makeEntering(),
    FadeInUp: makeEntering(),
    FadeInLeft: makeEntering(),
    FadeInRight: makeEntering(),
    FadeOut: makeEntering(),
    FadeOutDown: makeEntering(),
    FadeOutUp: makeEntering(),
    SlideInDown: makeEntering(),
    SlideOutDown: makeEntering(),
    ZoomIn: makeEntering(),
    ZoomOut: makeEntering(),
    Layout: makeEntering(),
    LinearTransition: makeEntering(),
  };
});

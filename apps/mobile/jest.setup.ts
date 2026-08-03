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
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly' },
}));

// ---------------------------------------------------------------------------
// Mock expo-speech — module natif, absent de l'environnement de test (US RUN-F2a)
// ---------------------------------------------------------------------------
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
}));

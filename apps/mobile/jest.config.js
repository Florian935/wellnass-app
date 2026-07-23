/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',

  // Délai par test relevé à 15 s : en CI le cache de transformation Jest n'est pas
  // persisté (seul npm est mis en cache) et le runner est à 2 cœurs. Le premier test
  // d'un suite lourd (modale + react-i18next + safe-area) paie tout le coût de
  // démarrage à froid dans son corps (~4 s en local à froid, davantage en CI) et
  // dépassait le défaut de 5 s. Le budget élargi absorbe ce coût unique tout en
  // laissant détecter un vrai blocage.
  testTimeout: 15000,

  // Fichier de setup : mocks des modules natifs (PowerSync, etc.)
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Résolution de l'alias @/ → src/ (miroir des paths tsconfig)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Patterns de transformation : étend jest-expo pour inclure @powersync et @op-engineering
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@powersync|@op-engineering|@testing-library))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],

  // Extensions de fichiers à traiter (ordre de résolution)
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Ignorer le dossier node_modules mais pas les libs à transformer
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],

  // Collecte de couverture (activée via --coverage)
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};

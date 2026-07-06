/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',

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

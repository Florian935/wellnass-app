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
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/test-utils/**'],

  // ── Seuils de couverture (lot 6, 03/08/2026) ────────────────────────────────
  //
  // **Par chemin, jamais un seuil global unique** : la moyenne d'un dossier d'écrans à 6 % et
  // d'une couche data à 31 % ne veut rien dire, et un seuil global se satisfait de n'importe quel
  // équilibre entre les deux — on pourrait laisser pourrir le SQL en couvrant des composants.
  //
  // Les chiffres sont des **cliquets** posés légèrement sous le réel du jour : leur rôle est
  // d'interdire la régression, pas de fixer un objectif. Une PR qui les fait rougir a retiré de la
  // couverture ; la réponse est d'en ajouter, pas de baisser le seuil.
  //
  // ⚠️ `global` porte sur ce qui reste APRÈS déduction des chemins ci-dessous — donc surtout
  // `src/app` (écrans) et `src/components`. Il reste **volontairement en retrait du réel**
  // (34,4 / 31,6 / 29,0 au 11/08/2026) : un nouvel écran arrive toujours moins couvert que la
  // moyenne, et un seuil collé au réel le ferait rougir dès le premier commit — ce qui pousserait
  // à contourner le garde-fou plutôt qu'à écrire des tests. La marge est l'ajustement, pas un oubli.
  coverageThreshold: {
    './src/data/repositories/': { statements: 44, branches: 33, functions: 39 },
    './src/lib/': { statements: 52, branches: 51, functions: 64 },
    './src/stores/': { statements: 47, branches: 36, functions: 46 },
    global: { statements: 33, branches: 30, functions: 28 },
  },
};

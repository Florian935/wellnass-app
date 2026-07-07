// Metro configuré pour un monorepo npm workspaces.
// Voir https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Surveiller aussi la racine du monorepo (packages/shared, etc.).
config.watchFolders = [workspaceRoot];

// 2. Résoudre les dépendances hoistées à la racine puis celles locales à l'app.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Map explicite des packages workspace : sur Windows, npm crée des
//    *junctions* (et non des symlinks) que le resolver Metro ne suit pas
//    (lstat ne les voit pas comme des liens) → « Unable to resolve
//    @wellness/shared ». On pointe donc directement vers le dossier réel.
config.resolver.extraNodeModules = {
  '@wellness/shared': path.resolve(workspaceRoot, 'packages/shared'),
};

// 4. PowerSync : désactiver les inline requires pour son entrée (évite
//    « Cannot read property 'PowerSyncDatabase' of undefined »). Voir doc op-sqlite.
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: {
      blockList: {
        [require.resolve('@powersync/react-native')]: true,
      },
    },
  },
});

module.exports = config;

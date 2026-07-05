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

// 3. PowerSync : désactiver les inline requires pour son entrée (évite
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

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

module.exports = config;

/**
 * Les chemins CMake de l'app dépassent la limite de Ninja sous Windows lorsque le
 * dépôt vit dans un worktree imbriqué. Seuls les intermédiaires CMake changent de
 * répertoire ; l'APK et les sources restent à leur emplacement habituel.
 * Config plugin : le correctif survit à la régénération du dossier android/.
 */
const { withAppBuildGradle } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const nativeBuildBlock = [
  "if (System.getProperty('os.name').toLowerCase(java.util.Locale.ROOT).startsWith('windows')) {",
  "    def wellnessCMakeKey = java.security.MessageDigest.getInstance('SHA-256')",
  "        .digest(rootProject.projectDir.canonicalPath.getBytes('UTF-8')).encodeHex().toString().take(12)",
  '    android.externalNativeBuild.cmake.buildStagingDirectory =',
  '        new File(gradle.gradleUserHomeDir, "cxx/${wellnessCMakeKey}/app")',
  '}',
].join('\n');

function addWindowsNativeBuild(source) {
  return mergeContents({
    src: source,
    newSrc: nativeBuildBlock,
    tag: 'wellness-windows-native-build',
    anchor: /^apply plugin: ["']com\.facebook\.react["']\s*$/m,
    offset: 1,
    comment: '//',
  }).contents;
}

module.exports = function withWindowsNativeBuild(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withWindowsNativeBuild nécessite le template Gradle Groovy du projet.');
    }
    cfg.modResults.contents = addWindowsNativeBuild(cfg.modResults.contents);
    return cfg;
  });
};
module.exports.addWindowsNativeBuild = addWindowsNativeBuild;

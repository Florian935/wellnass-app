const { addWindowsNativeBuild } = require('../withWindowsNativeBuild');

const source = `apply plugin: "com.android.application"
apply plugin: "com.facebook.react"
android {
    namespace 'com.wellness.app'
    buildTypes { release { signingConfig signingConfigs.debug } }
}
`;

test('conserve le Gradle existant et ajoute le cache court limité à Windows', () => {
  const result = addWindowsNativeBuild(source);
  expect(result).toContain("System.getProperty('os.name').toLowerCase(java.util.Locale.ROOT).startsWith('windows')");
  expect(result).toContain('gradle.gradleUserHomeDir');
  expect(result).toContain('rootProject.projectDir.canonicalPath');
  expect(result).toContain("getInstance('SHA-256')");
  expect(result).toContain('android.externalNativeBuild.cmake.buildStagingDirectory');
  expect(result).toContain("namespace 'com.wellness.app'");
  expect(result).toContain('signingConfig signingConfigs.debug');
  expect(result).not.toMatch(/C:[/\\]|flori/);
});

test('un deuxième prebuild ne duplique pas la configuration', () => {
  const once = addWindowsNativeBuild(source);
  expect(addWindowsNativeBuild(once)).toBe(once);
});

test('met à jour son bloc généré sans toucher à la configuration voisine', () => {
  const old = addWindowsNativeBuild(source).replace('cxx/', 'old-cxx/');
  const updated = addWindowsNativeBuild(old.replace(/sync-[a-z0-9]+/, 'sync-old'));
  expect(updated).not.toContain('old-cxx/');
  expect(updated.match(/buildStagingDirectory/g)).toHaveLength(1);
  expect(updated).toContain('signingConfig signingConfigs.debug');
});

test('refuse un template inattendu au lieu de produire un correctif silencieusement absent', () => {
  expect(() => addWindowsNativeBuild('android {}')).toThrow();
});

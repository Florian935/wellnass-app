/**
 * US CONF-06 — config plugin Health Connect, **maison**.
 *
 * Remplace la dépendance `expo-health-connect` (v0.1.1, dernière publication le 31/07/2024), qui ne
 * faisait que trois choses, toutes reproduites ici :
 *   1. l'intent-filter `ACTION_SHOW_PERMISSIONS_RATIONALE` sur MainActivity (Android ≤ 13) ;
 *   2. l'`activity-alias ViewPermissionUsageActivity` (Android 14+) ;
 *   3. l'appel `HealthConnectPermissionDelegate.setPermissionDelegate(this)` au démarrage —
 *      indispensable : `registerForActivityResult` doit être enregistré **avant** que l'activité
 *      passe à RESUMED, sinon la demande de permissions plante.
 *
 * Pourquoi ne pas garder la dépendance : son `build.gradle` fige un `compileSdkVersion` de repli à
 * 34 et une version dynamique de `com.facebook.react:react-native:+`, sans maintenance depuis 2024.
 * Le jour où elle casse sur une montée d'Expo, on est bloqués sur du code qui n'est pas le nôtre —
 * pour 20 lignes de Kotlin. Ici, tout est visible et versionné.
 *
 * ⚠️ `apps/mobile/android/` n'est pas versionné (CNG) : ce plugin est la **seule** façon correcte
 * de toucher au projet natif. Ne jamais éditer les fichiers générés à la main.
 *
 * Le module natif `react-native-health-connect` reste, lui, une dépendance normale (autolinkée).
 */

const {
  AndroidConfig,
  withAndroidManifest,
  withMainActivity,
} = require('@expo/config-plugins');

const { getMainActivityOrThrow, getMainApplicationOrThrow } = AndroidConfig.Manifest;

const RATIONALE_ACTION = 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE';
const ALIAS_NAME = 'ViewPermissionUsageActivity';

const DELEGATE_IMPORT =
  'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const DELEGATE_CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

/**
 * Manifest : intent-filter de justification + activity-alias. Les deux ajouts sont **idempotents**
 * (on vérifie l'existant avant d'insérer) — un prebuild rejoué ne doit pas dupliquer les entrées.
 */
function withHealthConnectManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const mainApplication = getMainApplicationOrThrow(cfg.modResults);
    const mainActivity = getMainActivityOrThrow(cfg.modResults);

    // 1. Intent-filter de justification des permissions (Android ≤ 13).
    mainActivity['intent-filter'] = mainActivity['intent-filter'] ?? [];
    const hasRationale = mainActivity['intent-filter'].some((filter) =>
      (filter.action ?? []).some((action) => action.$['android:name'] === RATIONALE_ACTION),
    );
    if (!hasRationale) {
      mainActivity['intent-filter'].push({
        action: [{ $: { 'android:name': RATIONALE_ACTION } }],
      });
    }

    // 2. Activity-alias équivalent pour Android 14+.
    mainApplication['activity-alias'] = mainApplication['activity-alias'] ?? [];
    const hasAlias = mainApplication['activity-alias'].some(
      (alias) => alias.$['android:name'] === ALIAS_NAME,
    );
    if (!hasAlias) {
      mainApplication['activity-alias'].push({
        $: {
          'android:name': ALIAS_NAME,
          'android:exported': 'true',
          'android:targetActivity': mainActivity.$['android:name'],
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
            category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
          },
        ],
      });
    }

    return cfg;
  });
}

/**
 * MainActivity : enregistre le délégué de permissions juste après `super.onCreate(...)`.
 *
 * L'insertion est textuelle (le fichier est régénéré par `expo prebuild`). Si le motif attendu
 * n'est plus là — MainActivity réécrite par une montée d'Expo — on **échoue bruyamment** plutôt que
 * de produire une build où la demande de permissions plante à l'exécution. Un prebuild rouge se
 * corrige en cinq minutes ; un délégué manquant se découvre en recette, sur device.
 */
function withHealthConnectDelegate(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error(
        '[withHealthConnect] MainActivity attendue en Kotlin (trouvé : ' +
          cfg.modResults.language +
          '). Adapter le plugin.',
      );
    }

    let contents = cfg.modResults.contents;

    // Déjà appliqué (prebuild rejoué sans --clean) → ne rien faire.
    if (contents.includes(DELEGATE_CALL)) return cfg;

    // Import, juste après la déclaration de package.
    const packageMatch = /^package .*$/m.exec(contents);
    if (!packageMatch) {
      throw new Error('[withHealthConnect] déclaration `package` introuvable dans MainActivity.');
    }
    contents = contents.replace(packageMatch[0], `${packageMatch[0]}\n${DELEGATE_IMPORT}`);

    // Appel, juste après super.onCreate(...) — l'activité est encore CREATED, ce qu'exige
    // registerForActivityResult.
    const superCall = /super\.onCreate\([^)]*\)/.exec(contents);
    if (!superCall) {
      throw new Error(
        '[withHealthConnect] `super.onCreate(...)` introuvable dans MainActivity : impossible ' +
          "d'enregistrer le délégué de permissions Health Connect. Adapter le plugin avant de builder.",
      );
    }
    contents = contents.replace(
      superCall[0],
      `${superCall[0]}\n    // US CONF-06 — délégué de permissions Health Connect (plugin withHealthConnect).\n    ${DELEGATE_CALL}`,
    );

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = function withHealthConnect(config) {
  return withHealthConnectDelegate(withHealthConnectManifest(config));
};

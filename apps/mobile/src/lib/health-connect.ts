/**
 * US CONF-06 — adaptateur Health Connect (Android).
 *
 * Seule frontière avec le module natif `react-native-health-connect`. Toute la logique métier vit
 * dans `@wellness/shared` (`health-connect.ts`, testée sous Vitest) ; ici il n'y a que des
 * entrées/sorties.
 *
 * Trois invariants tenus par ce fichier :
 * 1. **Aucune fonction ne jette.** Un échec Health Connect ne doit jamais casser une clôture de
 *    séance ni bloquer l'UI (même contrat que `track()` de l'US 9.10).
 * 2. **Import natif paresseux.** Le module n'est chargé qu'à l'intérieur des fonctions, après la
 *    garde `Platform.OS === 'android'`. Metro le *résout* de toute façon au bundling ; ce qu'on
 *    évite, c'est son **évaluation** hors Android — la bibliothèque installe un `Proxy` qui ne jette
 *    qu'au premier accès. D'où : aucun import en tête de fichier.
 * 3. **Rien ne part sans consentement.** Le réglage `healthConnectEnabled` (opt-in) et les
 *    permissions système sont vérifiés avant toute écriture ou lecture. Les permissions ne sont
 *    demandées **que** par `requestPermissions()`, appelée depuis les Réglages sur action explicite.
 */

import { Linking, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  buildRunRecords,
  buildWorkoutSessionRecord,
  selectWeightEntriesToImport,
  shouldImportWeight,
  type DistanceRecordInput,
  type ExerciseSessionRecordInput,
  type RemoteWeightRecord,
} from '@wellness/shared';

import { powerSync } from '@/powersync/system';
import { getHealthConnectEnabled } from '@/data/repositories/settings-repository';
import { logWeight } from '@/data/repositories/bodyweight-repository';

/** Package du fournisseur Health Connect (app système sur Android 14+, APK Play Store avant). */
export const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

/** Notre propre package : sert à ignorer nos records à la lecture (pas d'aller-retour). */
const OWN_PACKAGE = 'com.wellness.app';

/** Clé du curseur local du dernier import de poids (jamais synchronisé : Health Connect est local). */
const LAST_WEIGHT_IMPORT_KEY = 'healthConnect.lastWeightImportAt';

/** Fenêtre par défaut, en jours, pour le rattrapage et la lecture du poids. */
export const DEFAULT_WINDOW_DAYS = 30;

/** Throttle de l'import automatique de poids au retour au premier plan. */
export const WEIGHT_IMPORT_THROTTLE_HOURS = 6;

/** Les 3 permissions demandées — et pas une de plus (minimisation, déclaration Play). */
const PERMISSIONS = [
  { accessType: 'write', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'Distance' },
  { accessType: 'read', recordType: 'Weight' },
] as const;

/** Disponibilité du fournisseur — niveau 1 de l'état affiché (spec §2.1). */
export type HealthConnectAvailability =
  | 'unsupported'
  | 'provider_missing'
  | 'provider_update_required'
  | 'available';

/** État complet de la section Réglages (spec §2.1) : disponibilité × réglage × permissions. */
export type HealthConnectState =
  | 'unsupported'
  | 'provider_missing'
  | 'provider_update_required'
  | 'off'
  | 'permissions_missing'
  | 'ready';

/** Valeurs de `getSdkStatus()` (constantes `SdkAvailabilityStatus` de la bibliothèque v3). */
const SDK_UNAVAILABLE = 1;
const SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED = 2;
const SDK_AVAILABLE = 3;

/** Charge le module natif — jamais au niveau du fichier (cf. invariant 2). */
async function nativeModule() {
  return import('react-native-health-connect');
}

/**
 * Disponibilité du fournisseur. Ne demande aucune permission et n'initialise rien de lourd :
 * appelable librement depuis l'UI.
 */
export async function getAvailability(): Promise<HealthConnectAvailability> {
  if (Platform.OS !== 'android') return 'unsupported';
  try {
    const { getSdkStatus } = await nativeModule();
    const status = await getSdkStatus(HEALTH_CONNECT_PACKAGE);
    if (status === SDK_AVAILABLE) return 'available';
    if (status === SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'provider_update_required';
    if (status === SDK_UNAVAILABLE) return 'provider_missing';
    return 'provider_missing';
  } catch (error) {
    console.warn('[health-connect] getSdkStatus a échoué :', error);
    return 'provider_missing';
  }
}

/** Les 3 permissions sont-elles **déjà** accordées ? (Ne déclenche aucune demande.) */
export async function hasPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const { initialize, getGrantedPermissions } = await nativeModule();
    if (!(await initialize(HEALTH_CONNECT_PACKAGE))) return false;
    const granted = await getGrantedPermissions();
    return PERMISSIONS.every((needed) =>
      granted.some(
        (g) =>
          (g as { accessType?: string }).accessType === needed.accessType &&
          (g as { recordType?: string }).recordType === needed.recordType,
      ),
    );
  } catch (error) {
    console.warn('[health-connect] getGrantedPermissions a échoué :', error);
    return false;
  }
}

/**
 * Demande les permissions à l'utilisateur (écran système). **Seul** point de l'app qui déclenche
 * cette demande, et uniquement sur action explicite dans les Réglages.
 *
 * Renvoie `true` si les 3 permissions sont accordées à l'issue de la demande.
 */
export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const { initialize, requestPermission } = await nativeModule();
    if (!(await initialize(HEALTH_CONNECT_PACKAGE))) return false;
    await requestPermission([...PERMISSIONS] as Parameters<typeof requestPermission>[0]);
    // On ne se fie pas au retour de la demande : on relit l'état réel des permissions.
    return hasPermissions();
  } catch (error) {
    console.warn('[health-connect] requestPermission a échoué :', error);
    return false;
  }
}

/** État complet de la section Réglages — une seule source pour l'UI et la spec §2.1. */
export async function getState(): Promise<HealthConnectState> {
  const availability = await getAvailability();
  if (availability !== 'available') return availability;
  if (!(await getHealthConnectEnabled())) return 'off';
  return (await hasPermissions()) ? 'ready' : 'permissions_missing';
}

/**
 * Garde commune à toute écriture / lecture : plateforme, `initialize()`, disponibilité, opt-in,
 * permissions. Renvoie le module natif si tout est réuni, `null` sinon (→ no-op silencieux).
 */
async function ready() {
  if (Platform.OS !== 'android') return null;
  try {
    if (!(await getHealthConnectEnabled())) return null;
    const native = await nativeModule();
    if ((await native.getSdkStatus(HEALTH_CONNECT_PACKAGE)) !== SDK_AVAILABLE) return null;
    // `initialize()` est indispensable : sans lui, tous les appels suivants échouent.
    if (!(await native.initialize(HEALTH_CONNECT_PACKAGE))) return null;
    if (!(await hasPermissions())) return null;
    return native;
  } catch (error) {
    console.warn('[health-connect] initialisation impossible :', error);
    return null;
  }
}

/**
 * Écrit un lot de records. `insertRecords` **jette** sur une liste vide et refuse les lots
 * hétérogènes : d'où un appel par type de record, chacun gardé.
 *
 * Si le lot entier est refusé (un seul record en cause suffit : chevauchement de sessions,
 * horodatage aberrant, quota), on **retente record par record** au lieu de tout perdre — sans quoi
 * un rattrapage de 30 jours serait tout-ou-rien, et l'utilisateur verrait « 0 activité » sans
 * pouvoir distinguer « rien à envoyer » de « tout a échoué ».
 *
 * Renvoie le nombre de records réellement écrits.
 */
async function insertBatch(
  native: Awaited<ReturnType<typeof nativeModule>>,
  records: readonly (ExerciseSessionRecordInput | DistanceRecordInput)[],
): Promise<number> {
  if (records.length === 0) return 0;
  try {
    await native.insertRecords(records as Parameters<typeof native.insertRecords>[0]);
    return records.length;
  } catch (error) {
    console.warn('[health-connect] insertRecords a échoué sur le lot, reprise unitaire :', error);
    if (records.length === 1) return 0;
    let written = 0;
    for (const record of records) {
      try {
        await native.insertRecords([record] as Parameters<typeof native.insertRecords>[0]);
        written += 1;
      } catch (itemError) {
        console.warn('[health-connect] record refusé :', itemError);
      }
    }
    return written;
  }
}

/** Ligne de séance nécessaire à la construction du record (titre via jointure `sessions`). */
type WorkoutRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  updated_at: string;
  session_name: string | null;
};

/**
 * Requête des séances terminées. Le titre vient de `sessions.name` : `workouts` n'a pas de colonne
 * `name`, et une séance libre ou issue d'un template n'a pas de `session_id` → titre nul, remplacé
 * plus haut par un libellé i18n.
 */
const SELECT_WORKOUT = `
  SELECT w.id, w.started_at, w.finished_at, w.updated_at, s.name AS session_name
  FROM workouts w
  LEFT JOIN sessions s ON s.id = w.session_id AND s.deleted_at IS NULL
  WHERE w.id = ? AND w.deleted_at IS NULL AND w.status = 'completed'`;

type RunRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  updated_at: string;
  distance_m: number | null;
  source: string;
};

const SELECT_RUN = `
  SELECT id, started_at, finished_at, updated_at, distance_m, source
  FROM runs
  WHERE id = ? AND deleted_at IS NULL AND status = 'completed'`;

/**
 * Écrit une séance de musculation terminée. Appelée en fire-and-forget depuis `finishWorkout`.
 * `defaultTitle` est le libellé i18n de repli (ce module ne dépend pas d'i18next).
 */
export async function pushWorkout(workoutId: string, defaultTitle?: string): Promise<void> {
  const native = await ready();
  if (!native) return;
  try {
    const row = await powerSync.getOptional<WorkoutRow>(SELECT_WORKOUT, [workoutId]);
    if (!row) return;
    const record = buildWorkoutSessionRecord({
      id: row.id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      updatedAt: row.updated_at,
      sessionName: row.session_name,
      defaultTitle,
    });
    if (!record) return;
    await insertBatch(native, [record]);
  } catch (error) {
    console.warn('[health-connect] pushWorkout a échoué :', error);
  }
}

/** Écrit une course terminée (session + distance, en deux appels). Fire-and-forget. */
export async function pushRun(runId: string, defaultTitle?: string): Promise<void> {
  const native = await ready();
  if (!native) return;
  try {
    const row = await powerSync.getOptional<RunRow>(SELECT_RUN, [runId]);
    if (!row) return;
    const records = buildRunRecords({
      id: row.id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      updatedAt: row.updated_at,
      distanceM: row.distance_m,
      source: row.source,
      defaultTitle,
    });
    if (!records) return;
    await insertBatch(native, records.sessions);
    await insertBatch(native, records.distances);
  } catch (error) {
    console.warn('[health-connect] pushRun a échoué :', error);
  }
}

/**
 * Rattrapage : écrit les activités terminées des `days` derniers jours. Sûr à relancer autant de
 * fois que voulu — Health Connect déduplique sur `clientRecordId`.
 *
 * Renvoie le nombre d'**activités** écrites — c'est-à-dire de sessions, pas de records : une course
 * avec distance produit 2 records, et annoncer « 6 activités synchronisées » pour 3 courses serait
 * faux pour l'utilisateur.
 */
export async function pushRecent(
  days = DEFAULT_WINDOW_DAYS,
  titles?: { workout?: string; run?: string },
): Promise<number> {
  const native = await ready();
  if (!native) return 0;
  try {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const workouts = await powerSync.getAll<WorkoutRow>(
      `SELECT w.id, w.started_at, w.finished_at, w.updated_at, s.name AS session_name
       FROM workouts w
       LEFT JOIN sessions s ON s.id = w.session_id AND s.deleted_at IS NULL
       WHERE w.deleted_at IS NULL AND w.status = 'completed' AND w.finished_at >= ?`,
      [since],
    );
    const runs = await powerSync.getAll<RunRow>(
      `SELECT id, started_at, finished_at, updated_at, distance_m, source
       FROM runs
       WHERE deleted_at IS NULL AND status = 'completed' AND finished_at >= ?`,
      [since],
    );

    // Lots homogènes : toutes les sessions ensemble, puis toutes les distances.
    const sessions: ExerciseSessionRecordInput[] = [];
    const distances: DistanceRecordInput[] = [];

    for (const row of workouts) {
      const record = buildWorkoutSessionRecord({
        id: row.id,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        updatedAt: row.updated_at,
        sessionName: row.session_name,
        defaultTitle: titles?.workout,
        backfill: true,
      });
      if (record) sessions.push(record);
    }

    for (const row of runs) {
      const records = buildRunRecords({
        id: row.id,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        updatedAt: row.updated_at,
        distanceM: row.distance_m,
        source: row.source,
        defaultTitle: titles?.run,
        backfill: true,
      });
      if (!records) continue;
      sessions.push(...records.sessions);
      distances.push(...records.distances);
    }

    // Le compte rendu ne porte que sur les sessions ; les distances les accompagnent.
    const activities = await insertBatch(native, sessions);
    await insertBatch(native, distances);
    return activities;
  } catch (error) {
    console.warn('[health-connect] pushRecent a échoué :', error);
    return 0;
  }
}

/**
 * Importe les pesées de Health Connect sur les `days` derniers jours.
 *
 * Fenêtre glissante relue intégralement : aucun curseur de lecture à maintenir (Health Connect est
 * local à l'appareil, un curseur synchronisé serait faux). Ne crée que les jours **absents**
 * localement — une saisie de l'app n'est jamais écrasée.
 *
 * Renvoie le nombre de pesées créées.
 */
export async function importWeight(days = DEFAULT_WINDOW_DAYS): Promise<number> {
  const native = await ready();
  if (!native) return 0;
  try {
    const now = Date.now();
    const result = await native.readRecords('Weight', {
      timeRangeFilter: {
        operator: 'between',
        startTime: new Date(now - days * 86_400_000).toISOString(),
        endTime: new Date(now).toISOString(),
      },
    });

    // Les jours déjà connus localement, **y compris supprimés** : réimporter une pesée effacée
    // serait la ressusciter à chaque passage.
    const existing = await powerSync.getAll<{ log_date: string }>(
      `SELECT log_date FROM body_weight_entries`,
    );

    const toImport = selectWeightEntriesToImport(
      result.records as unknown as RemoteWeightRecord[],
      existing.map((r) => r.log_date),
      OWN_PACKAGE,
    );

    for (const entry of toImport) {
      await logWeight(entry.logDate, entry.weightKg);
    }

    await setLastWeightImportAt(new Date(now).toISOString());
    return toImport.length;
  } catch (error) {
    console.warn('[health-connect] importWeight a échoué :', error);
    return 0;
  }
}

/** Horodatage du dernier import de poids (affiché dans les Réglages + base du throttle). */
export async function getLastWeightImportAt(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(LAST_WEIGHT_IMPORT_KEY);
  } catch {
    return null;
  }
}

async function setLastWeightImportAt(iso: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(LAST_WEIGHT_IMPORT_KEY, iso);
  } catch (error) {
    console.warn('[health-connect] écriture du curseur d’import impossible :', error);
  }
}

/**
 * Import de poids automatique, throttlé (retour au premier plan). Ne fait rien si la fenêtre n'est
 * pas écoulée. Renvoie le nombre de pesées créées.
 */
export async function importWeightIfDue(): Promise<number> {
  if (Platform.OS !== 'android') return 0;
  const last = await getLastWeightImportAt();
  if (!shouldImportWeight(last, Date.now(), WEIGHT_IMPORT_THROTTLE_HOURS)) return 0;
  return importWeight();
}

/** Ouvre les réglages Health Connect du système (pour revoir ou révoquer les accès). */
export async function openSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { openHealthConnectSettings } = await nativeModule();
    openHealthConnectSettings();
  } catch (error) {
    console.warn('[health-connect] ouverture des réglages impossible :', error);
  }
}

/**
 * Ouvre la fiche Play Store de Health Connect — pour l'**installer** (Android ≤ 13) ou le **mettre à
 * jour**. On passe par le Play Store, pas par `openHealthConnectSettings()` : si le fournisseur est
 * absent ou périmé, ses réglages ne sont pas accessibles.
 *
 * `market://` ouvre directement l'app Play Store ; repli sur l'URL web si elle est absente.
 */
export async function openProviderInstall(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const market = `market://details?id=${HEALTH_CONNECT_PACKAGE}`;
  const web = `https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_PACKAGE}`;
  try {
    await Linking.openURL(market);
  } catch {
    try {
      await Linking.openURL(web);
    } catch (error) {
      console.warn('[health-connect] ouverture du Play Store impossible :', error);
    }
  }
}

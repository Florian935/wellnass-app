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
  shouldImportSteps,
  shouldImportWeight,
  toDailySteps,
  type DistanceRecordInput,
  type ExerciseSessionRecordInput,
  type RemoteWeightRecord,
  type StepsBucket,
} from '@wellness/shared';

import { powerSync } from '@/powersync/system';
import { getHealthConnectEnabled } from '@/data/repositories/settings-repository';
import { logWeight } from '@/data/repositories/bodyweight-repository';
import { upsertDailySteps } from '@/data/repositories/daily-steps-repository';

/** Package du fournisseur Health Connect (app système sur Android 14+, APK Play Store avant). */
export const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

/** Notre propre package : sert à ignorer nos records à la lecture (pas d'aller-retour). */
const OWN_PACKAGE = 'com.wellness.app';

/** Clé du curseur local du dernier import de poids (jamais synchronisé : Health Connect est local). */
const LAST_WEIGHT_IMPORT_KEY = 'healthConnect.lastWeightImportAt';

/** Idem pour les pas (US PAS-01) — curseur distinct, throttle distinct. */
const LAST_STEPS_IMPORT_KEY = 'healthConnect.lastStepsImportAt';

/** Fenêtre par défaut, en jours, pour le rattrapage et la lecture du poids. */
export const DEFAULT_WINDOW_DAYS = 30;

/** Throttle de l'import automatique de poids au retour au premier plan. */
export const WEIGHT_IMPORT_THROTTLE_HOURS = 6;

/**
 * Throttle de l'import des pas — **1 h**, six fois plus court que pour le poids (US PAS-01).
 *
 * Une pesée est un événement quotidien ; un compteur de pas **évolue toute la journée**. Un widget
 * qui affiche 2 000 pas quand le téléphone en compte 7 000 est perçu comme cassé, pas comme « pas
 * encore rafraîchi ».
 */
export const STEPS_IMPORT_THROTTLE_HOURS = 1;

/**
 * Les 4 permissions demandées — et pas une de plus (minimisation, déclaration Play).
 *
 * ⚠️ `Steps` (US PAS-01) est arrivée **après** CONF-06 : `hasPermissions()` étant un ET logique sur
 * cette liste, tous les comptes déjà autorisés repassent en état `permissions_missing` jusqu'à ce
 * qu'ils accordent la lecture des pas. C'est attendu — et sans conséquence sur l'écriture des
 * séances, les permissions étant indépendantes côté système.
 */
const PERMISSIONS = [
  { accessType: 'write', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'Distance' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'Steps' },
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
 * Compte rendu de la dernière tentative de synchronisation, **y compris les abandons silencieux**.
 *
 * Sans lui, un échec d'écriture est indiscernable d'un succès : les erreurs partent dans un
 * `console.warn` invisible sur un APK de production, et un lot vide (aucun record construit) ne
 * produit même pas d'erreur. C'est exactement ce qui a rendu la première recette impossible à
 * diagnostiquer. La section Réglages affiche ce compte rendu.
 */
export type SyncReport = {
  /** Instant de la tentative (ISO UTC). */
  at: string;
  /** Ce qui était tenté. */
  kind: 'workout' | 'run' | 'backfill' | 'weight' | 'steps';
  /** Nombre d'éléments réellement écrits / importés. */
  written: number;
  /**
   * `null` en cas de succès. Sinon, message court **technique** (non traduit) : c'est un outil de
   * diagnostic, pas un texte produit.
   */
  error: string | null;
};

/**
 * Révision du service, incrémentée à la main à chaque correctif livré en recette.
 *
 * Elle est préfixée aux messages d'erreur pour lever une ambiguïté rencontrée le 28/07/2026 : deux
 * versions de l'app produisaient un message identique, et rien ne permettait de savoir si l'APK
 * installé contenait bien le correctif (l'UI est la même, `app.json` garde `version: 0.0.0`).
 * Une erreur sans `rev` = APK antérieur au 28/07/2026.
 */
export const SERVICE_REV = 'r4';

let lastReport: SyncReport | null = null;

/** Dernier compte rendu de synchronisation (ou `null` si aucune tentative depuis le lancement). */
export function getLastSyncReport(): SyncReport | null {
  return lastReport;
}

function report(kind: SyncReport['kind'], written: number, error: string | null): void {
  const stamped = error === null ? null : `[${SERVICE_REV}] ${error}`;
  lastReport = { at: new Date().toISOString(), kind, written, error: stamped };
  if (stamped !== null) console.warn(`[health-connect] ${kind} : ${stamped}`);
}

/** Message court à partir d'une exception, pour le compte rendu. */
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
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

/** Les 4 permissions sont-elles **déjà** accordées ? (Ne déclenche aucune demande.) */
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
 * Garde commune à toute écriture / lecture : plateforme, opt-in, disponibilité, `initialize()`,
 * permissions.
 *
 * Renvoie le module natif, ou la **raison** de l'abandon — jamais un `null` muet : un abandon
 * silencieux est ce qui rend une panne indiagnosticable côté recette.
 */
async function ready(): Promise<
  { native: Awaited<ReturnType<typeof nativeModule>>; reason?: undefined } | { native: null; reason: string }
> {
  if (Platform.OS !== 'android') return { native: null, reason: 'plateforme non Android' };
  try {
    if (!(await getHealthConnectEnabled())) {
      return { native: null, reason: 'synchronisation désactivée (opt-in OFF)' };
    }
    const native = await nativeModule();
    const status = await native.getSdkStatus(HEALTH_CONNECT_PACKAGE);
    if (status !== SDK_AVAILABLE) {
      return { native: null, reason: `Health Connect indisponible (getSdkStatus = ${status})` };
    }
    // `initialize()` est indispensable : sans lui, tous les appels suivants échouent.
    if (!(await native.initialize(HEALTH_CONNECT_PACKAGE))) {
      return { native: null, reason: 'initialize() a renvoyé false' };
    }
    if (!(await hasPermissions())) {
      return { native: null, reason: 'permissions non accordées' };
    }
    return { native };
  } catch (error) {
    return { native: null, reason: `initialisation impossible : ${errorMessage(error)}` };
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
): Promise<{ written: number; error: string | null }> {
  if (records.length === 0) return { written: 0, error: null };
  try {
    await native.insertRecords(records as Parameters<typeof native.insertRecords>[0]);
    return { written: records.length, error: null };
  } catch (error) {
    if (records.length === 1) return { written: 0, error: errorMessage(error) };
    // Reprise unitaire : un seul record fautif ne doit pas faire perdre tout le lot.
    let written = 0;
    let firstError: string | null = null;
    for (const record of records) {
      try {
        await native.insertRecords([record] as Parameters<typeof native.insertRecords>[0]);
        written += 1;
      } catch (itemError) {
        firstError = firstError ?? errorMessage(itemError);
      }
    }
    return { written, error: written === records.length ? null : firstError };
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
  const { native, reason } = await ready();
  if (!native) {
    report('workout', 0, reason);
    return;
  }
  try {
    const row = await powerSync.getOptional<WorkoutRow>(SELECT_WORKOUT, [workoutId]);
    if (!row) {
      report('workout', 0, `séance ${workoutId} introuvable ou non terminée en base locale`);
      return;
    }
    const record = buildWorkoutSessionRecord({
      id: row.id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      updatedAt: row.updated_at,
      sessionName: row.session_name,
      defaultTitle,
    });
    if (!record) {
      report(
        'workout',
        0,
        `record non constructible (started_at=${row.started_at}, finished_at=${row.finished_at})`,
      );
      return;
    }
    const { written, error } = await insertBatch(native, [record]);
    report('workout', written, error);
  } catch (error) {
    report('workout', 0, errorMessage(error));
  }
}

/** Écrit une course terminée (session + distance, en deux appels). Fire-and-forget. */
export async function pushRun(runId: string, defaultTitle?: string): Promise<void> {
  const { native, reason } = await ready();
  if (!native) {
    report('run', 0, reason);
    return;
  }
  try {
    const row = await powerSync.getOptional<RunRow>(SELECT_RUN, [runId]);
    if (!row) {
      report('run', 0, `course ${runId} introuvable ou non terminée en base locale`);
      return;
    }
    const records = buildRunRecords({
      id: row.id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      updatedAt: row.updated_at,
      distanceM: row.distance_m,
      source: row.source,
      defaultTitle,
    });
    if (!records) {
      report(
        'run',
        0,
        `records non constructibles (started_at=${row.started_at}, finished_at=${row.finished_at})`,
      );
      return;
    }
    const session = await insertBatch(native, records.sessions);
    const distance = await insertBatch(native, records.distances);
    report('run', session.written, session.error ?? distance.error);
  } catch (error) {
    report('run', 0, errorMessage(error));
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
  const { native, reason } = await ready();
  if (!native) {
    report('backfill', 0, reason);
    return 0;
  }
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
    const session = await insertBatch(native, sessions);
    const distance = await insertBatch(native, distances);
    report(
      'backfill',
      session.written,
      session.error ??
        distance.error ??
        // Cas piégeux : aucun record à écrire. Ce n'est pas une erreur, mais le silence complet
        // est trompeur en recette — on dit ce qu'on a trouvé.
        (sessions.length === 0
          ? `aucune activité terminée trouvée sur ${days} jours (${workouts.length} séance(s), ${runs.length} course(s) en base)`
          : null),
    );
    return session.written;
  } catch (error) {
    report('backfill', 0, errorMessage(error));
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
  const { native, reason } = await ready();
  if (!native) {
    report('weight', 0, reason);
    return 0;
  }
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
    report(
      'weight',
      toImport.length,
      // Idem : distinguer « rien de neuf » de « rien lu du tout ».
      result.records.length === 0 ? `aucune pesée lue sur ${days} jours` : null,
    );
    return toImport.length;
  } catch (error) {
    report('weight', 0, errorMessage(error));
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

/**
 * Importe les **pas quotidiens** des `days` derniers jours (US PAS-01).
 *
 * ⚠️ Passe par l'**API d'agrégation** (`aggregateGroupByPeriod`, bucket d'un jour) et **jamais** par
 * `readRecords('Steps')` : Health Connect reçoit des pas de plusieurs sources (téléphone, montre,
 * Google Fit) sur des plages qui **se chevauchent**. Sommer les records gonflerait le total ;
 * l'agrégation, elle, déduplique — c'est le cœur de la correction de cette US.
 *
 * Le total du jour courant est relu à chaque passage : la fenêtre est réécrite, pas complétée
 * (règle du max côté `upsertDailySteps`, donc un total ne redescend jamais).
 *
 * Renvoie le nombre de jours écrits (créés ou mis à jour).
 */
export async function importSteps(days = DEFAULT_WINDOW_DAYS): Promise<number> {
  const { native, reason } = await ready();
  if (!native) {
    report('steps', 0, reason);
    return 0;
  }
  try {
    const now = Date.now();
    const buckets = (await native.aggregateGroupByPeriod({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: new Date(now - days * 86_400_000).toISOString(),
        endTime: new Date(now).toISOString(),
      },
      timeRangeSlicer: { period: 'DAYS', length: 1 },
    })) as unknown as StepsBucket[];

    const rows = toDailySteps(buckets);
    const written = await upsertDailySteps(rows);

    await setLastStepsImportAt(new Date(now).toISOString());
    report(
      'steps',
      written,
      // Distinguer « rien de neuf » de « rien lu du tout » : sans ce message, une panne de lecture
      // est indiscernable d'une journée sans marche (leçon de recette de CONF-06).
      rows.length === 0 ? `aucun pas lu sur ${days} jours` : null,
    );
    return written;
  } catch (error) {
    report('steps', 0, errorMessage(error));
    return 0;
  }
}

/** Horodatage du dernier import de pas (affiché dans les Réglages + base du throttle). */
export async function getLastStepsImportAt(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(LAST_STEPS_IMPORT_KEY);
  } catch {
    return null;
  }
}

async function setLastStepsImportAt(iso: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(LAST_STEPS_IMPORT_KEY, iso);
  } catch (error) {
    console.warn('[health-connect] écriture du curseur d’import des pas impossible :', error);
  }
}

/**
 * Import des pas automatique, throttlé (retour au premier plan). Ne fait rien si la fenêtre n'est
 * pas écoulée. Renvoie le nombre de jours écrits.
 */
export async function importStepsIfDue(): Promise<number> {
  if (Platform.OS !== 'android') return 0;
  const last = await getLastStepsImportAt();
  if (!shouldImportSteps(last, Date.now(), STEPS_IMPORT_THROTTLE_HOURS)) return 0;
  return importSteps();
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

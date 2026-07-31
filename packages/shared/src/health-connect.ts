/**
 * US CONF-06 (+ CYCLE-01 §4, D) — briques pures de l'intégration Health Connect.
 *
 * Volontairement **sans aucune dépendance à `react-native-health-connect`** : toute la logique
 * métier vit ici (donc testable sous Vitest, sans device ni module natif), l'adaptateur mobile
 * (`apps/mobile/src/lib/health-connect.ts`) ne fait plus que des entrées/sorties.
 *
 * Les constantes numériques ci-dessous sont **recopiées** de la bibliothèque (v3.5.3) pour la même
 * raison. À revérifier contre `node_modules` si l'on met la lib à jour.
 */

import { addDays, localDateFromDayKey, localDayKey } from './date';
import type { MenstrualFlow } from './menstrual-cycle';

/** `ExerciseType.STRENGTH_TRAINING` — musculation. */
export const EXERCISE_TYPE_STRENGTH_TRAINING = 70;
/** `ExerciseType.RUNNING` — course à pied. */
export const EXERCISE_TYPE_RUNNING = 56;
/**
 * ⚠️ Ne pas confondre avec `ExerciseSegmentType`, une **autre** énumération de la même
 * bibliothèque, où `RUNNING = 46` et `WEIGHTLIFTING = 65`. Utiliser ces valeurs-là donnerait des
 * activités mal typées dans Health Connect (« autre » ou pire, un type sans rapport).
 */

/** `RecordingMethod.RECORDING_METHOD_ACTIVELY_RECORDED` — enregistré en direct par l'utilisateur. */
export const RECORDING_METHOD_ACTIVELY_RECORDED = 1;
/** `RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY` — saisi à la main / importé après coup. */
export const RECORDING_METHOD_MANUAL_ENTRY = 3;

/**
 * `MenstruationFlowRecord.FLOW_*` (androidx.health.connect.client.records) — trois niveaux, quand
 * notre propre échelle en a quatre (R7 : `spotting`, `light`, `medium`, `heavy`). Pas de niveau
 * `UNKNOWN` en écriture : un flux qu'on choisit d'exporter est par définition connu.
 */
export const MENSTRUATION_FLOW_LIGHT = 1;
export const MENSTRUATION_FLOW_MEDIUM = 2;
export const MENSTRUATION_FLOW_HEAVY = 3;

/** Bornes de plausibilité d'une pesée (la base impose déjà `weight_kg > 0`). */
const MIN_WEIGHT_KG = 0;
const MAX_WEIGHT_KG = 500;

/** Métadonnées d'un record, telles que Health Connect les attend. */
type RecordMetadata = {
  clientRecordId: string;
  clientRecordVersion: number;
  recordingMethod: number;
};

/** `ExerciseSessionRecord` (sous-ensemble que nous écrivons). */
export type ExerciseSessionRecordInput = {
  recordType: 'ExerciseSession';
  startTime: string;
  endTime: string;
  exerciseType: number;
  title?: string;
  /** Jamais renseigné par nous : les notes d'activité ne quittent pas l'app. */
  notes?: undefined;
  metadata?: RecordMetadata;
};

/** `DistanceRecord` — la distance est un objet `Length`, pas un nombre. */
export type DistanceRecordInput = {
  recordType: 'Distance';
  startTime: string;
  endTime: string;
  distance: { unit: 'meters'; value: number };
  metadata?: RecordMetadata;
};

/** Une pesée prête à être écrite dans `body_weight_entries`. */
export type WeightEntryToImport = { logDate: string; weightKg: number };

/**
 * Décalage horaire d'un record. La bibliothèque renvoie **un objet**
 * `{ id: '+02:00', totalSeconds: 7200 }` (ou `null`) — c'est la seule forme réellement produite.
 * Les variantes chaîne et nombre sont acceptées par défense, au cas où l'API évoluerait.
 */
export type RecordZoneOffset =
  | string
  | number
  | { id?: string; totalSeconds?: number }
  | null;

/** Record `Weight` tel que renvoyé par Health Connect (poids déjà multi-unités). */
export type RemoteWeightRecord = {
  time: string;
  zoneOffset?: RecordZoneOffset;
  weight?: { inKilograms?: number };
  metadata?: { dataOrigin?: string };
};

/**
 * Normalise un horodatage en **ISO-8601 strict UTC** (`2026-07-24T12:39:10.931Z`).
 *
 * ⚠️ Indispensable côté Health Connect : la base locale (PowerSync, valeurs venues de Postgres)
 * stocke `2026-07-24 12:39:10.931Z` — avec un **espace** au lieu du `T`. JavaScript tolère cette
 * forme (d'où tout le reste de l'app qui fonctionne avec `new Date(row.finished_at)`), mais le
 * `Instant.parse()` de Java la **refuse** : `could not be parsed at index 10`. Passer la chaîne
 * brute dans un record faisait échouer chaque écriture, silencieusement.
 *
 * Renvoie `null` si la valeur est inexploitable.
 */
export function toIsoInstant(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  let candidate = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  // Convention du projet : tous les timestamps sont en UTC. Sans marqueur de fuseau, JS
  // interpréterait la valeur en heure **locale** → décalage silencieux selon l'appareil.
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(candidate)) candidate += 'Z';
  const ms = Date.parse(candidate);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** Millisecondes d'un instant, tolérant sur le format d'entrée (cf. `toIsoInstant`). */
function msOf(value: string): number | null {
  const iso = toIsoInstant(value);
  return iso === null ? null : Date.parse(iso);
}

/**
 * Métadonnées communes : `clientRecordId` **préfixé** (dédup + suppression future non ambiguë) et
 * `clientRecordVersion` dérivée d'`updated_at`, donc croissante par construction — une réécriture
 * ultérieure de la même activité gagne toujours sur la précédente.
 *
 * C'est ce mécanisme (natif à Health Connect) qui rend le rattrapage et les retentatives sûrs :
 * réinsérer un `clientRecordId` déjà connu **met à jour** le record au lieu de le dupliquer. Aucune
 * table de suivi des exports n'est donc nécessaire côté app.
 */
function metadataFor(
  clientRecordId: string,
  updatedAt: string,
  manualEntry: boolean,
): RecordMetadata {
  return {
    clientRecordId,
    clientRecordVersion: msOf(updatedAt) ?? 0,
    recordingMethod: manualEntry
      ? RECORDING_METHOD_MANUAL_ENTRY
      : RECORDING_METHOD_ACTIVELY_RECORDED,
  };
}

/**
 * Valide **et normalise** l'intervalle d'une activité. Deux raisons de passer par ici :
 * - Health Connect **refuse** `endTime <= startTime` — on écarte en amont plutôt que de laisser
 *   l'écriture échouer côté natif ;
 * - les bornes doivent être en **ISO strict** (cf. `toIsoInstant`), sinon `Instant.parse` rejette.
 *
 * Renvoie `null` si l'activité n'est pas exportable.
 */
function normalizedInterval(
  startedAt: string,
  finishedAt: string | null,
): { startTime: string; endTime: string } | null {
  const startTime = toIsoInstant(startedAt);
  const endTime = toIsoInstant(finishedAt);
  if (startTime === null || endTime === null) return null;
  if (Date.parse(endTime) <= Date.parse(startTime)) return null;
  return { startTime, endTime };
}

/**
 * Séance de musculation → record `ExerciseSession`.
 *
 * `sessionName` vient de `sessions.name` (jointure sur `workouts.session_id`) : une séance libre ou
 * issue d'un template n'en a pas, d'où le repli sur `defaultTitle` (libellé i18n fourni par
 * l'appelant — ce paquet ne connaît pas i18next).
 *
 * `backfill` = activité rejouée par le rattrapage 30 jours : on la marque `MANUAL_ENTRY`, car elle
 * n'est pas enregistrée en direct.
 *
 * Renvoie `null` si l'activité n'est pas exportable (pas terminée, durée ≤ 0, horodatage illisible).
 */
export function buildWorkoutSessionRecord(input: {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  updatedAt: string;
  sessionName?: string | null;
  defaultTitle?: string;
  backfill?: boolean;
}): ExerciseSessionRecordInput | null {
  const interval = normalizedInterval(input.startedAt, input.finishedAt);
  if (interval === null) return null;

  const title = input.sessionName?.trim() || input.defaultTitle?.trim() || undefined;

  return {
    recordType: 'ExerciseSession',
    startTime: interval.startTime,
    endTime: interval.endTime,
    exerciseType: EXERCISE_TYPE_STRENGTH_TRAINING,
    ...(title ? { title } : {}),
    // `notes` volontairement absent : cf. spec §2.3 (minimisation).
    metadata: metadataFor(`workout-${input.id}`, input.updatedAt, input.backfill === true),
  };
}

/**
 * Course → records Health Connect, **regroupés par type**.
 *
 * `insertRecords` n'accepte qu'un seul `recordType` par appel et jette sur une liste vide : on
 * renvoie donc deux lots séparés, à écrire en deux appels gardés. `distances` est vide quand la
 * course n'a pas de distance exploitable (GPS refusé, saisie manuelle sans distance, valeur
 * aberrante) — la session, elle, reste écrite.
 *
 * Renvoie `null` si la course n'est pas exportable (mêmes règles que la séance).
 */
export function buildRunRecords(input: {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  updatedAt: string;
  distanceM?: number | null;
  source?: string;
  defaultTitle?: string;
  backfill?: boolean;
}): { sessions: ExerciseSessionRecordInput[]; distances: DistanceRecordInput[] } | null {
  const interval = normalizedInterval(input.startedAt, input.finishedAt);
  if (interval === null) return null;

  const { startTime, endTime } = interval;
  // Une course saisie à la main n'a rien été « enregistré activement », et le rattrapage rejoue du passé.
  const manualEntry = input.backfill === true || input.source === 'manual';
  const title = input.defaultTitle?.trim() || undefined;

  const sessions: ExerciseSessionRecordInput[] = [
    {
      recordType: 'ExerciseSession',
      startTime,
      endTime,
      exerciseType: EXERCISE_TYPE_RUNNING,
      ...(title ? { title } : {}),
      metadata: metadataFor(`run-${input.id}`, input.updatedAt, manualEntry),
    },
  ];

  const distanceM = input.distanceM;
  const distances: DistanceRecordInput[] =
    typeof distanceM === 'number' && Number.isFinite(distanceM) && distanceM > 0
      ? [
          {
            recordType: 'Distance',
            startTime,
            endTime,
            distance: { unit: 'meters', value: distanceM },
            metadata: metadataFor(`run-dist-${input.id}`, input.updatedAt, manualEntry),
          },
        ]
      : [];

  return { sessions, distances };
}

/** Décalage courant de l'appareil, en secondes (positif à l'est de Greenwich). */
export function deviceOffsetSeconds(atMs: number = Date.now()): number {
  return -new Date(atMs).getTimezoneOffset() * 60;
}

/**
 * Date civile (`AAAA-MM-JJ`) d'un instant, **dans le fuseau du record** et non dans celui de
 * l'appareil : une pesée faite à 23 h 30 heure locale doit rester datée de ce jour-là, même si
 * l'utilisateur consulte l'app depuis un autre fuseau (ou a voyagé depuis).
 *
 * ⚠️ La bibliothèque renvoie `zoneOffset` sous forme d'**objet** `{ id, totalSeconds }` — les formes
 * chaîne et nombre ne sont acceptées que par défense. Ne pas les traiter reviendrait à dater en UTC,
 * c'est-à-dire exactement le contraire de la règle ci-dessus.
 *
 * `fallbackOffsetSeconds` s'applique quand le record ne porte aucun décalage exploitable
 * (`zoneOffset: null`, cas courant) : on retombe sur le **fuseau de l'appareil**, cohérent avec le
 * reste de l'app qui date les pesées en local — surtout pas sur UTC. Injecté en paramètre pour que
 * la fonction reste pure et testable.
 */
export function localDateOfInstant(
  time: string,
  zoneOffset?: RecordZoneOffset,
  fallbackOffsetSeconds?: number,
): string | null {
  const ms = msOf(time);
  if (ms === null) return null;

  let offsetSeconds: number | null = null;

  if (typeof zoneOffset === 'object' && zoneOffset !== null) {
    // Forme réellement produite par la bibliothèque.
    if (Number.isFinite(zoneOffset.totalSeconds)) offsetSeconds = zoneOffset.totalSeconds!;
  } else if (typeof zoneOffset === 'number' && Number.isFinite(zoneOffset)) {
    offsetSeconds = zoneOffset;
  } else if (typeof zoneOffset === 'string') {
    const match = /^([+-])(\d{2}):?(\d{2})$/.exec(zoneOffset.trim());
    if (match) {
      const sign = match[1] === '-' ? -1 : 1;
      offsetSeconds = sign * (Number(match[2]) * 3600 + Number(match[3]) * 60);
    }
  }

  if (offsetSeconds === null) {
    offsetSeconds = fallbackOffsetSeconds ?? deviceOffsetSeconds(ms);
  }

  return new Date(ms + offsetSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * Réduit les records `Weight` de Health Connect aux pesées à créer localement.
 *
 * Trois règles, dans cet ordre :
 * 1. on écarte nos propres records (`ownPackageName`) — l'API ne propose qu'un filtre d'origine
 *    *inclusif*, donc l'exclusion se fait ici ;
 * 2. une seule pesée par jour, **la plus récente** de la journée (cohérent avec `body_weight_entries`,
 *    une ligne par jour) ;
 * 3. **jamais d'écrasement** : un jour déjà présent localement est ignoré. La saisie de l'app gagne
 *    toujours — c'est la règle de conflit de la spec §2.5, choisie pour être prévisible plutôt que
 *    « la plus récente gagne », qui obligerait à comparer des horodatages hétérogènes.
 *
 * Les records illisibles ou invraisemblables sont ignorés un par un, sans faire échouer l'import.
 */
export function selectWeightEntriesToImport(
  remote: ReadonlyArray<RemoteWeightRecord>,
  existingLocalDates: ReadonlyArray<string>,
  ownPackageName?: string,
  fallbackOffsetSeconds?: number,
): WeightEntryToImport[] {
  const taken = new Set(existingLocalDates);
  /** date → { poids, instant } de la pesée la plus récente du jour. */
  const bestOfDay = new Map<string, { weightKg: number; ms: number }>();

  for (const record of remote) {
    if (ownPackageName && record.metadata?.dataOrigin === ownPackageName) continue;

    const weightKg = record.weight?.inKilograms;
    if (typeof weightKg !== 'number' || !Number.isFinite(weightKg)) continue;
    if (weightKg <= MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG) continue;

    const logDate = localDateOfInstant(record.time, record.zoneOffset, fallbackOffsetSeconds);
    if (logDate === null || taken.has(logDate)) continue;

    const ms = msOf(record.time)!;
    const current = bestOfDay.get(logDate);
    if (!current || ms > current.ms) bestOfDay.set(logDate, { weightKg, ms });
  }

  return [...bestOfDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([logDate, { weightKg }]) => ({ logDate, weightKg }));
}

/**
 * Faut-il relancer l'import du poids ? Throttle simple sur l'horodatage du dernier import.
 *
 * En cas de doute (curseur illisible, horloge décalée vers le futur), on **autorise** : mieux vaut
 * un import de trop — idempotent et peu coûteux — qu'un utilisateur définitivement enfermé.
 */
export function shouldImportWeight(
  lastImportAt: string | null | undefined,
  nowMs: number,
  throttleHours: number,
): boolean {
  if (!lastImportAt) return true;
  const last = msOf(lastImportAt);
  if (last === null || last > nowMs) return true;
  return nowMs - last >= throttleHours * 3600 * 1000;
}

// ---------------------------------------------------------------------------
// US CYCLE-01 §4 (D) — MenstruationPeriod / MenstruationFlow
// ---------------------------------------------------------------------------
//
// Le modèle natif Health Connect (androidx) traite une période comme un **intervalle**
// (`MenstruationPeriodRecord.startTime`/`endTime`) — malgré une déclaration TypeScript trompeuse
// dans `react-native-health-connect@3.5.3` qui le fait hériter d'`InstantaneousRecord` (`time` seul).
// Vérifié dans le binding natif de la bibliothèque
// (`android/src/main/java/dev/matinzd/healthconnect/records/ReactMenstruationPeriodRecord.kt`),
// qui construit bien un `MenstruationPeriodRecord(startTime, endTime, …)`. C'est ce qui rend le
// mapping direct : nos `menstrual_periods.started_on`/`ended_on` **sont** l'intervalle attendu — la
// spec le dit explicitement (§2, « calqué sur la façon dont Health Connect modélise le sujet »).
// `MenstruationFlowRecord`, lui, est bien un `InstantaneousRecord` (`time` + `flow`) — un marqueur
// par jour, symétrique de `menstrual_daily_logs`.

/** `MenstruationPeriodRecord` (sous-ensemble écrit). */
export type MenstruationPeriodRecordInput = {
  recordType: 'MenstruationPeriod';
  startTime: string;
  endTime: string;
  metadata?: RecordMetadata;
};

/** `MenstruationFlowRecord` (sous-ensemble écrit). */
export type MenstruationFlowRecordInput = {
  recordType: 'MenstruationFlow';
  time: string;
  flow: number;
  metadata?: RecordMetadata;
};

/** `MenstruationPeriodRecord` tel que renvoyé par Health Connect à la lecture. */
export type RemoteMenstruationPeriodRecord = {
  startTime: string;
  endTime: string;
  startZoneOffset?: RecordZoneOffset;
  endZoneOffset?: RecordZoneOffset;
  metadata?: { dataOrigin?: string };
};

/** `MenstruationFlowRecord` tel que renvoyé par Health Connect à la lecture. */
export type RemoteMenstruationFlowRecord = {
  time: string;
  flow?: number;
  zoneOffset?: RecordZoneOffset;
  metadata?: { dataOrigin?: string };
};

/** Période prête à être importée localement. */
export type PeriodToImport = { startedOn: string; endedOn: string };

/** Journal quotidien (flux seul) prêt à être importé localement. */
export type FlowLogToImport = { logDate: string; flow: MenstrualFlow };

/**
 * `spotting` (notre niveau le plus faible, R7) n'existe pas côté Health Connect : le plus proche est
 * `LIGHT`, pas `UNKNOWN` — un flux « inconnu » chez un partenaire santé se lit comme « non
 * renseigné », ce qu'un spotting n'est pas.
 */
const FLOW_TO_HEALTH_CONNECT: Record<MenstrualFlow, number> = {
  spotting: MENSTRUATION_FLOW_LIGHT,
  light: MENSTRUATION_FLOW_LIGHT,
  medium: MENSTRUATION_FLOW_MEDIUM,
  heavy: MENSTRUATION_FLOW_HEAVY,
};

/** Sens inverse — `UNKNOWN` (0) ou toute valeur hors échelle est **ignorée**, jamais devinée. */
const FLOW_FROM_HEALTH_CONNECT: Partial<Record<number, MenstrualFlow>> = {
  [MENSTRUATION_FLOW_LIGHT]: 'light',
  [MENSTRUATION_FLOW_MEDIUM]: 'medium',
  [MENSTRUATION_FLOW_HEAVY]: 'heavy',
};

export function flowToHealthConnect(flow: MenstrualFlow): number {
  return FLOW_TO_HEALTH_CONNECT[flow];
}

export function flowFromHealthConnect(flow: number | undefined): MenstrualFlow | null {
  if (flow === undefined) return null;
  return FLOW_FROM_HEALTH_CONNECT[flow] ?? null;
}

/** Minuit local d'une date civile (`AAAA-MM-JJ`), en millisecondes UTC. `null` si illisible. */
function localMidnightMs(dateKey: string, offsetSeconds: number): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const utcMidnight = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return utcMidnight - offsetSeconds * 1000;
}

/** Midi local d'une date civile — instant neutre pour un marqueur ponctuel (le flux n'a pas d'heure). */
function localMiddayMs(dateKey: string, offsetSeconds: number): number | null {
  const midnight = localMidnightMs(dateKey, offsetSeconds);
  return midnight === null ? null : midnight + 12 * 3600 * 1000;
}

/**
 * Période close → `MenstruationPeriodRecord`.
 *
 * `endTime` est **exclusif** : minuit local du lendemain du dernier jour de règles. Sans ça, une
 * période d'un seul jour donnerait `startTime === endTime`, que Health Connect refuse (l'intervalle
 * doit être strictement positif) — même contrainte que `normalizedInterval` pour les séances.
 *
 * Toujours marqué `RECORDING_METHOD_MANUAL_ENTRY` : une date de début/fin de règles est **choisie**,
 * jamais captée par un capteur, qu'elle soit issue d'une saisie immédiate ou corrigée après coup.
 *
 * Renvoie `null` si l'intervalle n'est pas constructible (dates illisibles).
 */
export function buildMenstruationPeriodRecord(input: {
  startedOn: string;
  endedOn: string;
  updatedAt: string;
  offsetSeconds: number;
}): MenstruationPeriodRecordInput | null {
  const startMs = localMidnightMs(input.startedOn, input.offsetSeconds);
  const endExclusiveKey = localDayKey(addDays(localDateFromDayKey(input.endedOn), 1));
  const endMs = localMidnightMs(endExclusiveKey, input.offsetSeconds);
  if (startMs === null || endMs === null || endMs <= startMs) return null;

  return {
    recordType: 'MenstruationPeriod',
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(endMs).toISOString(),
    metadata: metadataFor(`period-${input.startedOn}`, input.updatedAt, true),
  };
}

/** Journal quotidien (flux) → `MenstruationFlowRecord`. Renvoie `null` si la date est illisible. */
export function buildMenstruationFlowRecord(input: {
  logDate: string;
  flow: MenstrualFlow;
  updatedAt: string;
  offsetSeconds: number;
}): MenstruationFlowRecordInput | null {
  const ms = localMiddayMs(input.logDate, input.offsetSeconds);
  if (ms === null) return null;

  return {
    recordType: 'MenstruationFlow',
    time: new Date(ms).toISOString(),
    flow: flowToHealthConnect(input.flow),
    metadata: metadataFor(`flow-${input.logDate}`, input.updatedAt, true),
  };
}

/**
 * Réduit les records `MenstruationPeriod` de Health Connect aux périodes à importer.
 *
 * Le dernier jour de règles est retrouvé en retranchant 1 ms à `endTime` **avant** de le redater
 * localement — symétrique de la borne exclusive posée par `buildMenstruationPeriodRecord`. Un
 * fournisseur tiers qui daterait différemment produirait au pire un décalage d'un jour, jamais un
 * plantage : les records illisibles sont ignorés un par un (même politique que l'import du poids).
 */
export function selectPeriodsToImport(
  remote: ReadonlyArray<RemoteMenstruationPeriodRecord>,
  ownPackageName?: string,
  fallbackOffsetSeconds?: number,
): PeriodToImport[] {
  const out: PeriodToImport[] = [];
  for (const record of remote) {
    if (ownPackageName && record.metadata?.dataOrigin === ownPackageName) continue;

    const startedOn = localDateOfInstant(record.startTime, record.startZoneOffset, fallbackOffsetSeconds);
    const endMs = msOf(record.endTime);
    if (startedOn === null || endMs === null) continue;

    const endedOn = localDateOfInstant(
      new Date(endMs - 1).toISOString(),
      record.endZoneOffset,
      fallbackOffsetSeconds,
    );
    if (endedOn === null || endedOn < startedOn) continue;

    out.push({ startedOn, endedOn });
  }
  return out;
}

/** Réduit les records `MenstruationFlow` de Health Connect aux journaux à importer. */
export function selectFlowLogsToImport(
  remote: ReadonlyArray<RemoteMenstruationFlowRecord>,
  ownPackageName?: string,
  fallbackOffsetSeconds?: number,
): FlowLogToImport[] {
  const out: FlowLogToImport[] = [];
  for (const record of remote) {
    if (ownPackageName && record.metadata?.dataOrigin === ownPackageName) continue;

    const flow = flowFromHealthConnect(record.flow);
    if (flow === null) continue;

    const logDate = localDateOfInstant(record.time, record.zoneOffset, fallbackOffsetSeconds);
    if (logDate === null) continue;

    out.push({ logDate, flow });
  }
  return out;
}

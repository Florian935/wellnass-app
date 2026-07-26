/**
 * US CONF-06 — briques pures de l'intégration Health Connect.
 *
 * Volontairement **sans aucune dépendance à `react-native-health-connect`** : toute la logique
 * métier vit ici (donc testable sous Vitest, sans device ni module natif), l'adaptateur mobile
 * (`apps/mobile/src/lib/health-connect.ts`) ne fait plus que des entrées/sorties.
 *
 * Les constantes numériques ci-dessous sont **recopiées** de la bibliothèque (v3.5.3) pour la même
 * raison. À revérifier contre `node_modules` si l'on met la lib à jour.
 */

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

/** Millisecondes d'un instant ISO, ou `null` s'il est illisible. */
function msOf(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
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
 * Valide l'intervalle d'une activité. Health Connect **refuse** `endTime <= startTime` ; on écarte
 * donc en amont, plutôt que de laisser l'écriture échouer côté natif.
 */
function validInterval(startedAt: string, finishedAt: string | null): boolean {
  if (!finishedAt) return false;
  const start = msOf(startedAt);
  const end = msOf(finishedAt);
  return start !== null && end !== null && end > start;
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
  if (!validInterval(input.startedAt, input.finishedAt)) return null;

  const title = input.sessionName?.trim() || input.defaultTitle?.trim() || undefined;

  return {
    recordType: 'ExerciseSession',
    startTime: input.startedAt,
    endTime: input.finishedAt!,
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
  if (!validInterval(input.startedAt, input.finishedAt)) return null;

  const startTime = input.startedAt;
  const endTime = input.finishedAt!;
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

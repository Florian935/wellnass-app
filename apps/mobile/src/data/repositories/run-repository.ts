/**
 * Repository des courses (table `runs`) — pilier Running R1 (tracker GPS nu).
 *
 * Responsabilité unique : lire/écrire la table locale PowerSync `runs`, et
 * exposer une vue « course active » (au plus une à la fois) pour l'UI ainsi que
 * l'historique des courses terminées.
 *
 * Modèle **course = une seule ligne `runs`** (voir docs/specs/functional/running.md
 * et docs/specs/technical/modele-donnees.md) : la trace GPS complète est stockée
 * ENCODÉE dans la colonne `runs.gps_track` (format append-friendly, voir
 * `appendToTrack` / `decodeTrack` dans `@wellness/shared`). Aucune table de points.
 *
 * Le **tracker** (US Running R1 Task 6) est la source de vérité des scalaires
 * `distance_m` / `duration_seconds` : il calcule le cumul (hors pauses) et le passe
 * à `flushTrack`, qui se contente de le persister et d'ajouter le nouveau segment.
 *
 * Règles offline-first (voir docs/specs/technical/offline-sync.md) :
 *  - UUID généré côté client (via `insertWithSyncFields`).
 *  - Timestamps en UTC ; suppression = soft delete (jamais de hard delete client).
 *  - Chaque mutation écrit immédiatement dans SQLite (optimiste), la synchro suit.
 *  - `user_id` = utilisateur de la session courante à l'écriture.
 *
 * PowerSync ne réplique que les lignes de l'utilisateur courant (bucket par JWT) :
 * en lecture, filtrer sur `deleted_at IS NULL` + `status` suffit.
 *
 * Contrat trace : `useActiveRun` restitue la trace **brute encodée** (`gpsTrack`)
 * SANS la décoder — c'est l'écran (carte / tracker) qui décide de décoder via
 * `decodeTrack` s'il en a besoin (évite un décodage coûteux à chaque re-render de
 * la ligne active, qui change à chaque flush).
 */

import { useQuery } from '@powersync/react';
import { appendToTrack, averagePace, type RunSource } from '@wellness/shared';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, nowUtc, patch, softDelete } from './_sql';

// ---------------------------------------------------------------------------
// Types de domaine exposés à l'UI
// ---------------------------------------------------------------------------

/** Course active regroupée pour l'écran de suivi (au plus une par utilisateur). */
export type ActiveRun = {
  id: string;
  source: RunSource;
  startedAt: string;
  /** Distance cumulée en mètres (dernière valeur flushée), `null` si aucune. */
  distanceM: number | null;
  /** Durée cumulée en secondes hors pauses (dernière valeur flushée), `null` si aucune. */
  durationSeconds: number | null;
  /** Trace GPS **brute encodée** (à décoder côté écran via `decodeTrack`), `null` si aucune. */
  gpsTrack: string | null;
};

/** Élément d'historique (course terminée), volontairement léger. */
export type RunHistoryItem = {
  id: string;
  source: RunSource;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
  distanceM: number | null;
  avgPaceSPerKm: number | null;
  rpe: number | null;
  notes: string | null;
};

/** Détail complet d'une course (résumé post-clôture). */
export type RunDetail = {
  id: string;
  source: RunSource;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
  distanceM: number | null;
  avgPaceSPerKm: number | null;
  rpe: number | null;
  notes: string | null;
  /** Trace GPS brute encodée (à décoder via `decodeTrack`), `null` si aucune. */
  gpsTrack: string | null;
};

/** Champs persistés lors d'un flush (le tracker fournit le cumul courant). */
export type FlushInput = {
  /** Segment de points GPS encodé (via `encodeSegment`) à ajouter à la trace. */
  segmentEncoded: string;
  /** Distance cumulée en mètres (source de vérité = tracker). */
  distanceM: number;
  /** Durée cumulée en secondes hors pauses (source de vérité = tracker). */
  durationSeconds: number;
};

/** Options de clôture d'une course. */
export type FinishInput = {
  rpe?: number | null;
  notes?: string | null;
  /**
   * Distance saisie manuellement en mètres, utilisée uniquement quand
   * `source='manual'` (aucune trace GPS). Ignorée pour une course GPS.
   */
  manualDistanceM?: number | null;
};

// ---------------------------------------------------------------------------
// Lignes brutes SQLite (colonnes snake_case)
// ---------------------------------------------------------------------------

/** Ligne brute d'une course active (colonnes utiles au tracker). */
type ActiveRunDbRow = {
  id: string;
  source: string;
  started_at: string;
  duration_seconds: number | null;
  distance_m: number | null;
  gps_track: string | null;
};

/** Ligne brute d'une course terminée (entête d'historique). */
type RunHistoryDbRow = {
  id: string;
  source: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  distance_m: number | null;
  avg_pace_s_per_km: number | null;
  rpe: number | null;
  notes: string | null;
};

/** Ligne brute d'une course au détail (résumé post-clôture). */
type RunDetailDbRow = {
  id: string;
  source: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  distance_m: number | null;
  avg_pace_s_per_km: number | null;
  rpe: number | null;
  notes: string | null;
  gps_track: string | null;
};

// ---------------------------------------------------------------------------
// Requêtes SQL (noms de tables/colonnes statiques ; valeurs liées via ?)
// ---------------------------------------------------------------------------

/** Course active de l'utilisateur courant (au plus une). */
const SELECT_ACTIVE_RUN = `
  SELECT id, source, started_at, duration_seconds, distance_m, gps_track
  FROM runs
  WHERE status = 'active' AND deleted_at IS NULL
  LIMIT 1
`;

/** Historique des courses terminées, plus récentes d'abord. */
const SELECT_HISTORY = `
  SELECT id, source, started_at, finished_at, duration_seconds, distance_m,
         avg_pace_s_per_km, rpe, notes
  FROM runs
  WHERE status = 'completed' AND deleted_at IS NULL
  ORDER BY finished_at DESC
`;

/** Détail d'une course par id (tous statuts, non supprimée). */
const SELECT_RUN_BY_ID = `
  SELECT id, source, status, started_at, finished_at, duration_seconds, distance_m,
         avg_pace_s_per_km, rpe, notes, gps_track
  FROM runs
  WHERE id = ? AND deleted_at IS NULL
  LIMIT 1
`;

// ---------------------------------------------------------------------------
// Mapping snake_case ↔ camelCase
// ---------------------------------------------------------------------------

/** Convertit une ligne course active SQLite → domaine (camelCase). */
function rowToActiveRun(row: ActiveRunDbRow): ActiveRun {
  return {
    id: row.id,
    source: row.source as RunSource,
    startedAt: row.started_at,
    distanceM: row.distance_m,
    durationSeconds: row.duration_seconds,
    gpsTrack: row.gps_track,
  };
}

/** Convertit une ligne course terminée SQLite → item d'historique (camelCase). */
function rowToHistoryItem(row: RunHistoryDbRow): RunHistoryItem {
  return {
    id: row.id,
    source: row.source as RunSource,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationSeconds: row.duration_seconds,
    distanceM: row.distance_m,
    avgPaceSPerKm: row.avg_pace_s_per_km,
    rpe: row.rpe,
    notes: row.notes,
  };
}

/** Convertit une ligne course détail SQLite → RunDetail (camelCase). */
function rowToRunDetail(row: RunDetailDbRow): RunDetail {
  return {
    id: row.id,
    source: row.source as RunSource,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationSeconds: row.duration_seconds,
    distanceM: row.distance_m,
    avgPaceSPerKm: row.avg_pace_s_per_km,
    rpe: row.rpe,
    notes: row.notes,
    gpsTrack: row.gps_track,
  };
}

// ---------------------------------------------------------------------------
// Lecture réactive (hooks)
// ---------------------------------------------------------------------------

/**
 * Course active de l'utilisateur courant (ou `null`), réactive aux changements de
 * la base locale — donc **survit à un kill de l'app** (la ligne `active` est relue
 * au redémarrage). La trace est restituée brute encodée ; l'écran la décode au besoin.
 *
 * `isLoading = queryLoading` : ne dépend QUE de la résolution de la requête locale,
 * jamais d'une synchro réseau (offline-first, ADR-001 / décision B).
 */
export function useActiveRun(): { run: ActiveRun | null; isLoading: boolean } {
  const { data, isLoading: queryLoading } =
    useQuery<ActiveRunDbRow>(SELECT_ACTIVE_RUN);

  const isLoading = queryLoading;
  const row = data[0] ?? null;
  const run = row ? rowToActiveRun(row) : null;

  return { run, isLoading };
}

/**
 * Historique des courses terminées, plus récentes d'abord.
 * `isLoading = queryLoading` (offline-first).
 */
export function useRunHistory(): {
  runs: RunHistoryItem[];
  isLoading: boolean;
} {
  const { data, isLoading: queryLoading } =
    useQuery<RunHistoryDbRow>(SELECT_HISTORY);

  const isLoading = queryLoading;
  const runs = data.map(rowToHistoryItem);

  return { runs, isLoading };
}

/**
 * Course individuelle par id, réactive aux changements de la base locale.
 *
 * Utilisé par l'écran de résumé pour relire la course après les patches
 * (RPE, notes, distance manuelle) sans re-fetch explicite.
 * `isLoading = queryLoading` (offline-first).
 */
export function useRun(runId: string | undefined): {
  run: RunDetail | null;
  isLoading: boolean;
} {
  const { data, isLoading: queryLoading } =
    useQuery<RunDetailDbRow>(SELECT_RUN_BY_ID, [runId ?? '']);

  const isLoading = queryLoading;
  const row = data[0] ?? null;
  const run = row ? rowToRunDetail(row) : null;

  return { run, isLoading };
}

// ---------------------------------------------------------------------------
// Écritures (hors contexte hook) — toutes optimistes (SQLite immédiat)
// ---------------------------------------------------------------------------

/** Identifiant de l'utilisateur de la session courante (lève si déconnecté). */
function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    throw new Error("Aucune session active : impossible d'écrire une course.");
  }
  return userId;
}

/**
 * Démarre une nouvelle course et retourne son id.
 *
 * Garde anti-double-active (comme `startWorkout`) : si une course `status='active'`
 * non supprimée existe déjà pour l'utilisateur courant, on retourne son id au lieu
 * d'en créer une seconde (au plus une course active à la fois — indispensable car le
 * tracker et un éventuel bouton « reprendre » pourraient sinon en créer plusieurs).
 */
export async function startRun(source: RunSource): Promise<string> {
  const userId = currentUserId();

  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM runs
     WHERE user_id = ? AND status = 'active' AND deleted_at IS NULL
     LIMIT 1`,
    [userId],
  );
  if (existing) {
    return existing.id;
  }

  return insertWithSyncFields('runs', {
    user_id: userId,
    status: 'active',
    source,
    started_at: nowUtc(),
    finished_at: null,
    duration_seconds: null,
    distance_m: null,
    avg_pace_s_per_km: null,
    gps_track: null,
    rpe: null,
    notes: null,
  });
}

// ---------------------------------------------------------------------------
// Sérialisation des flushs (file d'attente à promesse unique en cours)
//
// Deux flushs concurrents (tâche de fond GPS + flush de pause, par exemple)
// pourraient sinon faire un read-append-write entrelacé et écraser mutuellement
// la trace (lecture de la même `gps_track` avant que l'autre ait écrit).
//
// On chaîne donc chaque flush après le précédent via une promesse module-level :
// tout `flushTrack` s'exécute strictement l'un après l'autre, garantissant que la
// lecture de `gps_track` voit toujours l'écriture précédente. `catch(() => {})`
// sur la queue empêche un flush en échec de casser la chaîne suivante (chaque
// appelant reçoit malgré tout le rejet de SA propre promesse).
// ---------------------------------------------------------------------------

let flushChain: Promise<unknown> = Promise.resolve();

/**
 * Persiste l'état courant d'une course et ajoute un segment de trace.
 *
 * **Appelable hors React** (depuis la tâche de fond du tracker).
 *
 * Déroulé (sérialisé, voir ci-dessus) : lit la ligne courante, puis — **uniquement
 * si la course est encore `active` et non supprimée** — `appendToTrack(current,
 * segmentEncoded)` et `patch` de `gps_track` / `distance_m` / `duration_seconds`.
 * Le tracker fournit les scalaires cumulés (source de vérité) ; `flushTrack` ne
 * recalcule rien.
 *
 * Garde de statut : un flush background tardif peut résoudre APRÈS `finishRun` /
 * `cancelRun`. Sans garde il écraserait une ligne déjà `completed`/`cancelled` (et
 * rendrait `avg_pace` incohérent avec la distance réécrite). Si la course n'est plus
 * active (ou est supprimée / introuvable), on jette silencieusement le segment
 * tardif (no-op).
 */
export function flushTrack(runId: string, input: FlushInput): Promise<void> {
  const run = flushChain.then(async () => {
    const row = await powerSync.getOptional<{
      status: string;
      deleted_at: string | null;
      gps_track: string | null;
    }>(
      `SELECT status, deleted_at, gps_track FROM runs WHERE id = ?`,
      [runId],
    );

    // Course terminée / annulée / supprimée / introuvable : segment tardif jeté.
    if (!row || row.status !== 'active' || row.deleted_at !== null) {
      return;
    }

    const current = row.gps_track ?? '';
    const appended = appendToTrack(current, input.segmentEncoded);

    await patch('runs', runId, {
      gps_track: appended,
      distance_m: input.distanceM,
      duration_seconds: input.durationSeconds,
    });
  });

  // La chaîne ne doit jamais rester rejetée (sinon tous les flushs suivants
  // échoueraient) ; on avale l'erreur SUR LA CHAÎNE uniquement. L'appelant
  // reçoit le rejet réel via la promesse `run` retournée.
  flushChain = run.catch(() => {});
  return run;
}

/**
 * Met en pause une course.
 *
 * R1 : le tracker détient l'état de pause et la comptabilité du temps (la durée
 * flushée exclut déjà les pauses). Il n'y a **pas de colonne de pause** en R1 —
 * la pause est purement une préoccupation du tracker. `pauseRun` est donc un
 * no-op au niveau du repository : la persistance de l'état à l'instant de la
 * pause passe par un `flushTrack` explicite déclenché par le tracker.
 */
export async function pauseRun(_runId: string): Promise<void> {
  // No-op volontaire (voir docstring). Signature conservée pour l'API du tracker.
}

/**
 * Reprend une course en pause.
 *
 * R1 : symétrique de `pauseRun` — no-op au niveau du repository (le tracker gère
 * l'état et le temps ; aucune colonne dédiée).
 */
export async function resumeRun(_runId: string): Promise<void> {
  // No-op volontaire (voir docstring).
}

/**
 * Termine une course : passe le statut à `completed`, pose `finished_at`, et
 * calcule `avg_pace_s_per_km` à partir des **scalaires flushés** (`distance_m` /
 * `duration_seconds`) — on ne recalcule JAMAIS la distance depuis la trace complète
 * (le tracker en est la source de vérité, et le décodage serait coûteux/redondant).
 *
 * Pour une course manuelle (`source='manual'`), si `manualDistanceM` est fourni, il
 * remplace la distance persistée avant le calcul d'allure (permet de terminer une
 * course saisie à la main, avec ou sans distance).
 *
 * RPE / notes ne sont écrits que s'ils sont présents dans `opts` (patch partiel :
 * l'écran de résumé pourra les compléter plus tard via un autre `patch`).
 *
 * Garde de statut : on ne clôture qu'une course **active** non supprimée. Si la
 * ligne est introuvable, déjà `completed`/`cancelled`, ou supprimée → no-op (on ne
 * re-complète pas et on ne re-stampe pas `finished_at`). Le patch partiel des RPE /
 * notes par l'écran de résumé passe par un `patch` direct, pas par `finishRun`.
 */
export async function finishRun(
  runId: string,
  opts?: FinishInput,
): Promise<void> {
  const row = await powerSync.getOptional<{
    status: string;
    deleted_at: string | null;
    source: string;
    distance_m: number | null;
    duration_seconds: number | null;
  }>(
    `SELECT status, deleted_at, source, distance_m, duration_seconds FROM runs WHERE id = ?`,
    [runId],
  );

  // Course introuvable / déjà terminée / annulée / supprimée : no-op.
  if (!row || row.status !== 'active' || row.deleted_at !== null) {
    return;
  }

  // Distance retenue : la saisie manuelle prime uniquement en source manuelle.
  const manualDistance = opts?.manualDistanceM;
  const distanceM =
    row?.source === 'manual' &&
    manualDistance !== undefined &&
    manualDistance !== null
      ? manualDistance
      : (row?.distance_m ?? null);

  const durationSeconds = row?.duration_seconds ?? null;

  const avgPace =
    distanceM !== null && durationSeconds !== null
      ? averagePace(distanceM, durationSeconds)
      : null;

  const columns: Record<string, unknown> = {
    status: 'completed',
    finished_at: nowUtc(),
    distance_m: distanceM,
    avg_pace_s_per_km: avgPace,
  };
  if (opts && 'rpe' in opts) columns['rpe'] = opts.rpe;
  if (opts && 'notes' in opts) columns['notes'] = opts.notes;

  await patch('runs', runId, columns);
}

/**
 * Termine une course en saisie manuelle avec une distance donnée (ou aucune).
 * Sucre au-dessus de `finishRun` — force `manualDistanceM` dans les options.
 */
export async function finishManualRun(
  runId: string,
  distanceM: number | null,
  opts?: { rpe?: number | null; notes?: string | null },
): Promise<void> {
  await finishRun(runId, { ...opts, manualDistanceM: distanceM });
}

/**
 * Annule une course : passe le statut à `cancelled` puis soft delete la ligne
 * (nettoyage complet côté local + synchro).
 */
export async function cancelRun(runId: string): Promise<void> {
  await patch('runs', runId, { status: 'cancelled' });
  await softDelete('runs', runId);
}

/**
 * Enregistre le ressenti post-course (RPE et/ou notes) sur une course déjà clôturée.
 *
 * Patch partiel : seuls les champs présents dans `feedback` sont écrits
 * (idiome `'rpe' in` / `'notes' in` — passer `undefined` explicitement est une erreur,
 * il faut omettre la clé pour ne pas écrire). Pas de garde de statut : cette fonction
 * est conçue pour compléter une course déjà `completed`.
 */
export async function setRunFeedback(
  runId: string,
  feedback: { rpe?: number | null; notes?: string | null },
): Promise<void> {
  const columns: Record<string, unknown> = {};
  if ('rpe' in feedback) columns['rpe'] = feedback.rpe;
  if ('notes' in feedback) columns['notes'] = feedback.notes;
  await patch('runs', runId, columns);
}

/**
 * Enregistre la distance d'une course **manuelle** saisie sur l'écran de résumé.
 *
 * Uniquement pour `source='manual'` : vérifie le champ avant de patcher.
 * Recalcule `avg_pace_s_per_km` à partir de la nouvelle distance et de la durée
 * persistée (source de vérité = tracker, flushée avant `finishRun`).
 * No-op si la course n'est pas trouvée ou n'est pas manuelle.
 */
export async function setManualRunDistance(
  runId: string,
  distanceM: number,
): Promise<void> {
  const row = await powerSync.getOptional<{
    source: string;
    duration_seconds: number | null;
  }>(
    `SELECT source, duration_seconds FROM runs WHERE id = ? AND deleted_at IS NULL`,
    [runId],
  );

  if (!row || row.source !== 'manual') {
    return;
  }

  const durationSeconds = row.duration_seconds ?? null;
  const avgPace =
    durationSeconds !== null ? averagePace(distanceM, durationSeconds) : null;

  await patch('runs', runId, {
    distance_m: distanceM,
    avg_pace_s_per_km: avgPace,
  });
}

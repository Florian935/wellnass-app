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

import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import {
  appendToTrack,
  averagePace,
  localDayKey,
  aggregateRunStats,
  paceTrendPoints,
  paceTrend,
  runTerrainSchema,
  type RunSource,
  type RunTerrain,
  type StatPeriod,
  type RunStats,
  type PaceTrendPoint,
  type PaceTrendKind,
  type ProgramSessionType,
  computeKmSplits,
  computePolarisation,
  decodeTrack,
  buildGhostProfile,
  isGhostCandidate,
  type GhostProfile,
  type Polarisation,
  // US RUN-F4 (lot F) — réalisé par répétition.
  type RunIntervalDraft,
  type RunIntervalRow,
  type SegmentKind,
} from '@wellness/shared';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { upsertRunnerProfile, useRunnerProfile } from './running-profile-repository';
import i18n from '@/i18n';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { refreshHomeWidget } from '@/widgets/refresh-home-widget';
import { pushRun } from '@/lib/health-connect';
import { markPlannedSessionDone, reopenPlannedSession } from './planned-session-repository';
import { softDeleteRunEfforts } from './run-effort-repository';
import { backfillRunningRecords } from './running-record-repository';
import { insertWithSyncFields, nowUtc, patch, softDelete } from './_sql';
import {
  rowToIntervalItem,
  type IntervalBlockItem,
  type IntervalDbRow,
} from './program-repository';
import { useTodayKey, useWindowStartUtc } from '@/hooks/useTodayKey';

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
  /** US RUN-F2b : occurrence planifiée d'origine, `null` pour une course libre. */
  plannedSessionId: string | null;
  /** US FANT-01 : course passée affrontée comme fantôme, `null` si aucune (R8). */
  ghostRunId: string | null;
  /**
   * US RUN-F2d : progression du guidage fractionné — index de la phase courante dans la séquence
   * linéarisée (`expandIntervalPhases`), et distance/durée cumulées de la course au moment où
   * cette phase a démarré. `null` = guidage non démarré ou non applicable à cette course (spec R8).
   */
  intervalPhaseIndex: number | null;
  intervalPhaseStartDistanceM: number | null;
  intervalPhaseStartDurationS: number | null;
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
  /** Dénivelé cumulé (US RUN-F1b), `null` = donnée absente (course manuelle ou antérieure). */
  elevationGainM: number | null;
  elevationLossM: number | null;

  // ---- US CARDIO-UX01 (R7 / constat F24) : de quoi dire CE QU'ÉTAIT la course ----

  /** Terrain déclaré (US RUN-F3, D3), ou `null`. */
  terrain: RunTerrain | null;
  /** Séance planifiée réalisée, ou `null` pour une course libre. */
  plannedSessionId: string | null;
  /**
   * Type de la séance réalisée, résolu par jointure — `null` sur une course libre.
   *
   * ⚠️ **`runs` ne porte pas de `session_type`** : c'est le verrou documenté par ALLURE-01, qui
   * laisse RUN-07 en attente au catalogue. On ne l'ajoute pas ici (ce serait dupliquer une donnée
   * qui vit sur `sessions`) : on le **joint**. Conséquence assumée : une course libre n'a pas de
   * type, et c'est déjà une information — la ligne affiche « Course libre ».
   */
  sessionType: ProgramSessionType | null;
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
  /** Occurrence planifiée réalisée (US RUN-F3), `null` pour une course libre. */
  plannedSessionId: string | null;
  /** Terrain (US RUN-F3, D3), `null` si non renseigné. */
  terrain: RunTerrain | null;
  /** US FANT-01 : la course affrontée comme fantôme, `null` si aucune (R8). */
  ghostRunId: string | null;
  /** Dénivelé cumulé (US RUN-F1b), `null` = donnée absente (course manuelle ou antérieure). */
  elevationGainM: number | null;
  elevationLossM: number | null;
};

/**
 * Champs persistés lors d'un flush (le tracker fournit le cumul courant).
 *
 * ⚠️ **`null` ne veut pas dire zéro, il veut dire « ne pas écrire »** (US CARDIO-UX01, R1b).
 * C'est ce qui permet à une course **manuelle** de flusher sa durée sans toucher à sa distance :
 * sans cette nuance, le tick d'horloge écrirait `distance_m = 0`, et le résumé — qui décide
 * d'afficher son champ de distance sur `distanceM !== null` — ne le proposerait plus jamais.
 */
export type FlushInput = {
  /** Segment de points GPS encodé (via `encodeSegment`) à ajouter à la trace. */
  segmentEncoded: string;
  /** Distance cumulée en mètres (source de vérité = tracker), ou `null` pour ne pas l'écrire. */
  distanceM: number | null;
  /** Durée cumulée en secondes hors pauses (source de vérité = tracker). */
  durationSeconds: number;
  /**
   * Dénivelé positif/négatif cumulé en mètres (US RUN-F1b, source de vérité = tracker), ou `null`
   * pour ne pas l'écrire — une course sans GPS n'a pas de dénivelé, et une ligne « +0 m » serait
   * un chiffre inventé (spec RUN-F1b R5 : jamais une ligne à zéro).
   */
  elevationGainM: number | null;
  elevationLossM: number | null;
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
  ghost_run_id: string | null;
  started_at: string;
  duration_seconds: number | null;
  distance_m: number | null;
  gps_track: string | null;
  planned_session_id: string | null;
  interval_phase_index: number | null;
  interval_phase_start_distance_m: number | null;
  interval_phase_start_duration_s: number | null;
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
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  // US CARDIO-UX01 (R7 / F24) — jointes, pas stockées : voir la note de `SELECT_HISTORY`.
  terrain: string | null;
  planned_session_id: string | null;
  session_type: string | null;
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
  planned_session_id: string | null;
  terrain: string | null;
  ghost_run_id: string | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
};

// ---------------------------------------------------------------------------
// Requêtes SQL (noms de tables/colonnes statiques ; valeurs liées via ?)
// ---------------------------------------------------------------------------

/** Course active de l'utilisateur courant (au plus une). */
const SELECT_ACTIVE_RUN = `
  SELECT id, source, started_at, duration_seconds, distance_m, gps_track, planned_session_id,
         ghost_run_id,
         interval_phase_index, interval_phase_start_distance_m, interval_phase_start_duration_s
  FROM runs
  WHERE status = 'active' AND deleted_at IS NULL
  LIMIT 1
`;

/**
 * Historique des courses terminées, plus récentes d'abord.
 *
 * ── Les deux jointures (US CARDIO-UX01, R7 / constat F24) ────────────────────────────────────────
 * Une ligne d'historique affichait date · distance · durée · allure : impossible de distinguer
 * d'un coup d'œil un footing de récupération d'un 10 × 400. Le type de séance ne vit pas sur
 * `runs` (verrou d'ALLURE-01) mais sur `sessions`, atteignable par le lien
 * `runs.planned_session_id`. On le **joint** plutôt que de le dupliquer.
 *
 * `LEFT JOIN` des deux côtés : une course libre n'a pas de séance, et c'est le cas majoritaire.
 * Une séance supprimée depuis la course laisse aussi un lien qui ne résout à rien — la course
 * reste valide et s'affiche comme libre.
 *
 * ⚠️ **`gps_track` reste hors de cette requête**, et ce n'est pas un oubli : elle n'a aucune borne
 * de date et alimente les statistiques, la tendance d'allure et l'accueil. Y ajouter la trace
 * ferait charger en mémoire les traces GPS de **toutes** les courses, pour tous ces consommateurs
 * (note d'origine d'ALLURE-01, conservée).
 */
const SELECT_HISTORY = `
  SELECT r.id, r.source, r.started_at, r.finished_at, r.duration_seconds, r.distance_m,
         r.avg_pace_s_per_km, r.rpe, r.notes, r.elevation_gain_m, r.elevation_loss_m,
         r.terrain, r.planned_session_id, s.session_type
  FROM runs r
  LEFT JOIN planned_sessions ps
         ON ps.id = r.planned_session_id AND ps.deleted_at IS NULL
  LEFT JOIN sessions s
         ON s.id = ps.session_id AND s.deleted_at IS NULL
  WHERE r.status = 'completed' AND r.deleted_at IS NULL
  ORDER BY r.finished_at DESC
`;

/**
 * Réexport de `SELECT_HISTORY` à seule fin de test.
 *
 * ⚠️ Le nom porte son intention : ce n'est **pas** une API de repository. Elle existe pour qu'un test
 * puisse vérifier que cette requête **ne gagne jamais `gps_track`** — elle n'a aucune borne de date et
 * alimente les stats, la tendance d'allure et l'accueil.
 */
export const SELECT_HISTORY_FOR_TEST = SELECT_HISTORY;

/** Détail d'une course par id (tous statuts, non supprimée). */
const SELECT_RUN_BY_ID = `
  SELECT id, source, status, started_at, finished_at, duration_seconds, distance_m,
         avg_pace_s_per_km, rpe, notes, gps_track, planned_session_id, terrain, ghost_run_id,
         elevation_gain_m, elevation_loss_m
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
    plannedSessionId: row.planned_session_id,
    ghostRunId: row.ghost_run_id,
    intervalPhaseIndex: row.interval_phase_index,
    intervalPhaseStartDistanceM: row.interval_phase_start_distance_m,
    intervalPhaseStartDurationS: row.interval_phase_start_duration_s,
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
    elevationGainM: row.elevation_gain_m,
    elevationLossM: row.elevation_loss_m,
    // US CARDIO-UX01 (R7 / F24) — le terrain passe par son schéma Zod, comme dans `rowToRunDetail` :
    // une valeur inconnue en base ne doit pas remonter jusqu'à une clé i18n absente.
    terrain: runTerrainSchema.safeParse(row.terrain).success
      ? (row.terrain as RunTerrain)
      : null,
    plannedSessionId: row.planned_session_id,
    sessionType: (row.session_type as ProgramSessionType | null) ?? null,
  };
}

/** Convertit une ligne course détail SQLite → RunDetail (camelCase). */
function rowToRunDetail(row: RunDetailDbRow): RunDetail {
  const terrain = runTerrainSchema.safeParse(row.terrain);
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
    plannedSessionId: row.planned_session_id,
    ghostRunId: row.ghost_run_id,
    terrain: terrain.success ? terrain.data : null,
    elevationGainM: row.elevation_gain_m,
    elevationLossM: row.elevation_loss_m,
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

/** Séance de course planifiée aujourd'hui, ni faite ni sautée — au plus une (US RUN-F3). */
export type TodayRunSession = {
  id: string;
  sessionId: string;
  /** Nom de la seance, pour l affichage sur l accueil (US ACCUEIL-01). */
  name: string | null;
  /**
   * Heure locale HH:MM de l occurrence (HORAIRE-01), ou null si elle n en porte pas.
   *
   * Ajoutee par ACCUEIL-01 : la carte epinglee de l accueil annonce l heure de la seance, et
   * l heure etait stockee depuis HORAIRE-01 sans jamais etre remontee ni affichee nulle part.
   */
  scheduledTime: string | null;
  targetDistanceM: number | null;
  targetDurationSeconds: number | null;
  // US RUN-F4 — le type porte l'intensité (c'est lui qui décide si une adaptation a du sens),
  // et la consigne se lit avant de partir, pas après.
  sessionType: ProgramSessionType | null;
  targetPaceMinSPerKm: number | null;
  targetPaceMaxSPerKm: number | null;
  targetTimeSeconds: number | null;
  instructions: string | null;
};

type TodayRunSessionDbRow = {
  id: string;
  session_id: string;
  session_name: string | null;
  scheduled_time: string | null;
  target_distance_m: number | null;
  target_duration_seconds: number | null;
  session_type: string | null;
  target_pace_min_s_per_km: number | null;
  target_pace_max_s_per_km: number | null;
  target_time_seconds: number | null;
  instructions: string | null;
};

/**
 * Occurrence `planned` du jour pour le pilier course, s'il y en a une — sert de point d'entrée
 * « démarrer ma course planifiée » sur le hub (US RUN-F3, symétrique de `useTodaySession` côté
 * muscu, mais volontairement **séparé** : `useTodaySession` est propre à `strength`/`workouts`
 * et ne doit pas être touché pour ce besoin, cf. spec).
 */
export function useTodayRunSession(): { session: TodayRunSession | null; isLoading: boolean } {
  const userId = useAuthStore((s) => s.session?.user.id ?? '');
  const todayKey = useTodayKey();
  const { data, isLoading } = useQuery<TodayRunSessionDbRow>(
    `SELECT ps.id, ps.session_id, ps.scheduled_time, s.name AS session_name,
            s.target_distance_m, s.target_duration_seconds,
            s.session_type, s.target_pace_min_s_per_km, s.target_pace_max_s_per_km,
            s.target_time_seconds, s.instructions
     FROM planned_sessions ps
     JOIN sessions s ON s.id = ps.session_id AND s.deleted_at IS NULL
     JOIN programs  p ON p.id = ps.program_id AND p.deleted_at IS NULL
     WHERE ps.owner_id = ? AND ps.deleted_at IS NULL AND p.pillar = 'running'
       AND ps.status = 'planned' AND ps.scheduled_date = ?
     ORDER BY s.order_index
     LIMIT 1`,
    [userId, todayKey],
  );
  const row = data[0] ?? null;
  const session: TodayRunSession | null = row
    ? {
        id: row.id,
        sessionId: row.session_id,
        name: row.session_name,
        scheduledTime: row.scheduled_time,
        targetDistanceM: row.target_distance_m,
        targetDurationSeconds: row.target_duration_seconds,
        sessionType: (row.session_type as ProgramSessionType | null) ?? null,
        targetPaceMinSPerKm: row.target_pace_min_s_per_km,
        targetPaceMaxSPerKm: row.target_pace_max_s_per_km,
        targetTimeSeconds: row.target_time_seconds,
        instructions: row.instructions,
      }
    : null;
  return { session, isLoading };
}

/**
 * Cible (distance/durée) de la séance planifiée qu'une course a réalisée — `null` si la course
 * est libre (`plannedSessionId` absent) ou si le lien ne résout à rien (séance supprimée depuis).
 * Alimente `compareToTarget` (US RUN-F3, roadmap 5.25).
 */
export function useRunTarget(plannedSessionId: string | null): {
  targetDistanceM: number | null;
  targetDurationSeconds: number | null;
  /** US RUN-F4 (lot A) — plage d'allure SAISIE de la séance, `null` si aucune. */
  targetPaceMinSPerKm: number | null;
  targetPaceMaxSPerKm: number | null;
  /** US RUN-F4 (lot G) — objectif chrono d'un test ou d'une course. */
  targetTimeSeconds: number | null;
} | null {
  const { data } = useQuery<{
    target_distance_m: number | null;
    target_duration_seconds: number | null;
    target_pace_min_s_per_km: number | null;
    target_pace_max_s_per_km: number | null;
    target_time_seconds: number | null;
  }>(
    `SELECT s.target_distance_m, s.target_duration_seconds,
            s.target_pace_min_s_per_km, s.target_pace_max_s_per_km, s.target_time_seconds
     FROM planned_sessions ps
     JOIN sessions s ON s.id = ps.session_id AND s.deleted_at IS NULL
     WHERE ps.id = ? AND ps.deleted_at IS NULL
     LIMIT 1`,
    [plannedSessionId ?? ''],
  );
  const row = data[0];
  if (!plannedSessionId || !row) return null;
  return {
    targetDistanceM: row.target_distance_m,
    targetDurationSeconds: row.target_duration_seconds,
    targetPaceMinSPerKm: row.target_pace_min_s_per_km,
    targetPaceMaxSPerKm: row.target_pace_max_s_per_km,
    targetTimeSeconds: row.target_time_seconds,
  };
}

/**
 * Type de séance + blocs fractionné ordonnés de la séance planifiée qu'une course réalise
 * (US RUN-F2d). `null`/`[]` si la course est libre ou si le lien ne résout à rien — même garde
 * que `useRunTarget`. Deux requêtes réactives chaînées (même patron de jointure) : `useRunTarget`
 * ne résout ni `session_type` ni les blocs, d'où ce hook dédié plutôt qu'une extension du premier.
 */
export function useIntervalBlocksForRun(plannedSessionId: string | null): {
  sessionType: ProgramSessionType | null;
  blocks: IntervalBlockItem[];
} {
  const { data: sessionRows } = useQuery<{ id: string; session_type: string | null }>(
    `SELECT s.id, s.session_type
     FROM planned_sessions ps
     JOIN sessions s ON s.id = ps.session_id AND s.deleted_at IS NULL
     WHERE ps.id = ? AND ps.deleted_at IS NULL
     LIMIT 1`,
    [plannedSessionId ?? ''],
  );
  const sessionRow = sessionRows[0];
  const sessionId = plannedSessionId && sessionRow ? sessionRow.id : '';

  const { data: intervalRows } = useQuery<IntervalDbRow>(
    `SELECT id, session_id, order_index, reps, fast_distance_m, fast_duration_seconds,
            fast_pace_pct_vma, recovery_distance_m, recovery_duration_seconds,
            kind, label, fast_pace_min_s_per_km, fast_pace_max_s_per_km,
            fast_target_time_min_seconds, fast_target_time_max_seconds,
            recovery_kind, recovery_pace_min_s_per_km, recovery_pace_max_s_per_km,
            group_key, group_reps
     FROM session_intervals
     WHERE session_id = ? AND deleted_at IS NULL
     ORDER BY order_index`,
    [sessionId],
  );

  if (!plannedSessionId || !sessionRow) {
    return { sessionType: null, blocks: [] };
  }
  return {
    sessionType: (sessionRow.session_type as ProgramSessionType | null) ?? null,
    blocks: intervalRows.map(rowToIntervalItem),
  };
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
// Statistiques de course (lecture seule, réutilise useRunHistory)
// ---------------------------------------------------------------------------

/**
 * Mappe un `RunHistoryItem` (domaine) vers `StatRun` (agrégation).
 *
 * Les courses terminées ont toujours `finishedAt` non-null (filtrées par
 * `SELECT_HISTORY` sur `status='completed'`). Le jour local est obtenu via
 * `localDayKey`, cohérent avec l'indexation utilisée dans `dashboard-repository.ts`.
 */
function toStatRun(item: RunHistoryItem) {
  return {
    finishedAtDayKey: localDayKey(new Date(item.finishedAt as string)),
    distanceM: item.distanceM,
    durationS: item.durationSeconds,
    paceSPerKm: item.avgPaceSPerKm,
    elevationGainM: item.elevationGainM,
    elevationLossM: item.elevationLossM,
  };
}

/**
 * Statistiques agrégées des courses terminées pour la période donnée, avec
 * `todayKey` explicite — permet de comparer une période à la période
 * précédente via `previousPeriodTodayKey` (voir `@wellness/shared`), en
 * appelant ce hook une seconde fois avec la clé décalée.
 *
 * **Lecture seule** — repose sur `useRunHistory` (dashboard-safe : ne modifie pas
 * l'historique et ne change pas le comportement de `useIsTrainingDay` / `useStreakData`).
 * React Compiler gère la mémoïsation ; pas de `useMemo` manuel.
 */
export function useRunStatsAt(
  period: StatPeriod,
  todayKey: string,
): { stats: RunStats; isLoading: boolean } {
  const { runs, isLoading } = useRunHistory();
  const stats = aggregateRunStats(runs.map(toStatRun), period, todayKey);
  return { stats, isLoading };
}

/**
 * Statistiques agrégées des courses terminées pour la période donnée, calées
 * sur « aujourd'hui ». Délègue à `useRunStatsAt` (voir ci-dessus).
 */
export function useRunStats(period: StatPeriod): { stats: RunStats; isLoading: boolean } {
  const todayKey = useTodayKey();
  return useRunStatsAt(period, todayKey);
}

/**
 * Points d'allure sur les `days` derniers jours et tendance calculée.
 *
 * **Lecture seule** — repose sur `useRunHistory` (dashboard-safe, voir `useRunStats`).
 * `trend` vaut `'improving'` | `'declining'` | `'stable'` (≥ 2 points nécessaires ;
 * sinon `'stable'` par défaut — voir `paceTrend` dans `@wellness/shared`).
 */
export function usePaceTrend(days: number): {
  points: PaceTrendPoint[];
  trend: PaceTrendKind;
  isLoading: boolean;
} {
  const { runs, isLoading } = useRunHistory();
  const todayKey = useTodayKey();
  const points = paceTrendPoints(runs.map(toStatRun), days, todayKey);
  const trend = paceTrend(points);
  return { points, trend, isLoading };
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
 *
 * `plannedSessionId` (US RUN-F3, roadmap 5.25) : posé **une seule fois**, à la création —
 * jamais modifié ensuite. `undefined`/course déjà active → la course active existante garde
 * son lien d'origine (ou son absence), il n'est jamais réécrit ici.
 */
export async function startRun(source: RunSource, plannedSessionId?: string): Promise<string> {
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

  // Analytics : démarrage effectif d'une nouvelle course (pas une reprise). Fire-and-forget.
  void track(ANALYTICS_EVENTS.runStarted);

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
    planned_session_id: plannedSessionId ?? null,
    terrain: null,
    elevation_gain_m: null,
    elevation_loss_m: null,
  });
}

/**
 * Renseigne le terrain d'une course (US RUN-F3, D3) — saisie facultative, à tout moment après
 * la clôture (comme `setRunFeedback`). Aucune garde de statut : conçu pour compléter une course
 * déjà `completed`.
 */
export async function setRunTerrain(runId: string, terrain: RunTerrain): Promise<void> {
  await patch('runs', runId, { terrain });
}

/**
 * Persiste la progression du guidage fractionné (US RUN-F2d) : index de la phase courante et
 * point de départ (distance/durée cumulées de la course) de cette phase. Appelé à chaque
 * transition détectée par `useIntervalGuidance`, pour survivre à un remontage de l'écran de
 * suivi sans perdre ni fausser la phase courante (spec R8/R8 bis).
 */
export async function advanceIntervalPhase(
  runId: string,
  input: { phaseIndex: number; phaseStartDistanceM: number; phaseStartDurationS: number },
): Promise<void> {
  await patch('runs', runId, {
    interval_phase_index: input.phaseIndex,
    interval_phase_start_distance_m: input.phaseStartDistanceM,
    interval_phase_start_duration_s: input.phaseStartDurationS,
  });
}

/**
 * Enregistre le réalisé d'UNE phase franchie (US RUN-F4, lot F).
 *
 * ⚠️ **Idempotent par construction.** Le rattrapage silencieux de RUN-F2d (R8 bis) rejoue la
 * progression au remontage de l'écran : sans garde, une même phase produirait plusieurs lignes.
 * On vérifie donc `(run_id, phase_index)` avant d'insérer — ce que l'index unique partiel
 * garantit côté Postgres, mais qui doit aussi tenir **en local**, où l'écriture est optimiste et
 * où une violation de contrainte bloquerait la file d'upload PowerSync entière.
 *
 * Le prévu est RECOPIÉ dans la ligne, jamais joint : modifier la séance planifiée ensuite ne
 * doit pas réécrire l'histoire d'une course déjà courue.
 */
export async function recordIntervalResult(
  runId: string,
  draft: RunIntervalDraft & { blockId?: string | null; startedAt?: string | null },
): Promise<void> {
  const userId = currentUserId();

  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM run_intervals
     WHERE run_id = ? AND phase_index = ? AND deleted_at IS NULL
     LIMIT 1`,
    [runId, draft.phaseIndex],
  );
  if (existing) return;

  await insertWithSyncFields('run_intervals', {
    run_id: runId,
    user_id: userId,
    phase_index: draft.phaseIndex,
    block_id: draft.blockId ?? null,
    phase_kind: draft.phaseKind,
    segment_kind: draft.segmentKind,
    rep: draft.rep,
    total_reps: draft.totalReps,
    planned_distance_m: draft.plannedDistanceM,
    planned_duration_seconds: draft.plannedDurationSeconds,
    planned_pace_min_s_per_km: draft.plannedPaceMinSPerKm,
    planned_pace_max_s_per_km: draft.plannedPaceMaxSPerKm,
    actual_distance_m: draft.actualDistanceM,
    actual_duration_seconds: draft.actualDurationSeconds,
    actual_pace_s_per_km: draft.actualPaceSPerKm,
    started_at: draft.startedAt ?? null,
    finished_at: nowUtc(),
  });
}

/** Ligne brute de `run_intervals` (US RUN-F4, lot F). */
type RunIntervalDbRow = {
  phase_index: number;
  phase_kind: string;
  segment_kind: string | null;
  rep: number | null;
  total_reps: number | null;
  planned_distance_m: number | null;
  planned_duration_seconds: number | null;
  planned_pace_min_s_per_km: number | null;
  planned_pace_max_s_per_km: number | null;
  actual_distance_m: number | null;
  actual_duration_seconds: number | null;
  actual_pace_s_per_km: number | null;
};

/**
 * Le réalisé par répétition d'une course, dans l'ordre des phases (US RUN-F4, lot F).
 * Vide pour une course libre ou pour toute course antérieure à cette US — l'écran de résumé
 * n'affiche alors simplement pas la section, il n'écrit pas « 0 fraction ».
 */
export function useRunIntervals(runId: string | undefined): {
  intervals: RunIntervalRow[];
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery<RunIntervalDbRow>(
    `SELECT phase_index, phase_kind, segment_kind, rep, total_reps,
            planned_distance_m, planned_duration_seconds,
            planned_pace_min_s_per_km, planned_pace_max_s_per_km,
            actual_distance_m, actual_duration_seconds, actual_pace_s_per_km
     FROM run_intervals
     WHERE run_id = ? AND deleted_at IS NULL
     ORDER BY phase_index`,
    [runId ?? ''],
  );

  const intervals: RunIntervalRow[] = runId
    ? data.map((row) => ({
        phaseIndex: row.phase_index,
        phaseKind: row.phase_kind === 'recovery' ? 'recovery' : 'fast',
        segmentKind: (row.segment_kind as SegmentKind | null) ?? 'work',
        rep: row.rep ?? 1,
        totalReps: row.total_reps ?? 1,
        plannedDistanceM: row.planned_distance_m,
        plannedDurationSeconds: row.planned_duration_seconds,
        plannedPaceMinSPerKm: row.planned_pace_min_s_per_km,
        plannedPaceMaxSPerKm: row.planned_pace_max_s_per_km,
        actualDistanceM: row.actual_distance_m,
        actualDurationSeconds: row.actual_duration_seconds,
        actualPaceSPerKm: row.actual_pace_s_per_km,
      }))
    : [];

  return { intervals, isLoading };
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

    // Seule la durée est toujours écrite. Les autres colonnes ne le sont que si le tracker en a
    // une valeur à donner (voir la note sur `null` dans `FlushInput`).
    const columns: Record<string, unknown> = {
      gps_track: appended,
      duration_seconds: input.durationSeconds,
    };
    if (input.distanceM !== null) columns['distance_m'] = input.distanceM;
    if (input.elevationGainM !== null) columns['elevation_gain_m'] = input.elevationGainM;
    if (input.elevationLossM !== null) columns['elevation_loss_m'] = input.elevationLossM;

    await patch('runs', runId, columns);
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
    planned_session_id: string | null;
  }>(
    `SELECT status, deleted_at, source, distance_m, duration_seconds, planned_session_id
     FROM runs WHERE id = ?`,
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

  // ── US CARDIO-UX01 (R1c) — la boucle se referme ICI ─────────────────────────────────────────
  // `markPlannedSessionDone` existait depuis le 12/07/2026 et n'était appelée que depuis un
  // bouton du calendrier. Terminer une course rattachée à une séance planifiée ne cochait donc
  // rien : le lendemain, le hub proposait de **refaire** la séance de la veille (constat F20), et
  // tout ce qui compte les séances faites était faux — progression du bloc de course, adhérence
  // de la semaine précédente (garde de progression MUSC-F15).
  //
  // Idempotent par construction : on n'arrive ici qu'une fois (la garde de statut ci-dessus
  // rejette une course déjà `completed`), et `markPlannedSessionDone` est un `patch` par id.
  if (row.planned_session_id !== null) {
    try {
      await markPlannedSessionDone(row.planned_session_id);
    } catch (error) {
      // La course est déjà enregistrée : ne jamais la perdre parce que le pointage a échoué.
      console.warn('[finishRun] markPlannedSessionDone a échoué (course conservée) :', error);
    }
  }

  // Analytics : course terminée et enregistrée. Fire-and-forget.
  void track(ANALYTICS_EVENTS.runCompleted);

  // US LAUNCHER-01 : rafraîchit le widget d'écran d'accueil (D5). Fire-and-forget.
  refreshHomeWidget();

  // Health Connect (US CONF-06) : session + distance dans le hub santé d'Android. Fire-and-forget,
  // no-op si l'opt-in est OFF / permissions absentes / hors Android. Ne jette jamais.
  void pushRun(runId, i18n.t('settings.healthConnect.defaultRunTitle'));
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

// ---------------------------------------------------------------------------
// US CARDIO-UX01 — durée manuelle, dé-validation, suppression, correction
// ---------------------------------------------------------------------------

/**
 * Enregistre la durée d'une course **manuelle** saisie sur l'écran de résumé (R1b).
 *
 * Symétrique de `setManualRunDistance`. Le tracker pose désormais la durée nette à la clôture
 * (voir `startManualClock`), mais elle reste corrigeable : un chrono lancé en retard, un oubli
 * d'arrêt, une saisie rétroactive. Recalcule l'allure moyenne depuis la distance persistée.
 *
 * No-op si la course est introuvable ou n'est pas manuelle — la durée d'une course GPS est une
 * mesure, pas une saisie.
 */
export async function setManualRunDuration(
  runId: string,
  durationSeconds: number,
): Promise<void> {
  const row = await powerSync.getOptional<{ source: string; distance_m: number | null }>(
    `SELECT source, distance_m FROM runs WHERE id = ? AND deleted_at IS NULL`,
    [runId],
  );
  if (!row || row.source !== 'manual') {
    return;
  }

  const seconds = Math.max(0, Math.round(durationSeconds));
  const distanceM = row.distance_m;
  const avgPace = distanceM !== null && seconds > 0 ? averagePace(distanceM, seconds) : null;

  await patch('runs', runId, {
    duration_seconds: seconds,
    avg_pace_s_per_km: avgPace,
  });
}

/**
 * Détache une course de la séance planifiée qu'elle a clôturée (R1c-2).
 *
 * Le rattachement course ↔ séance est posé au démarrage depuis le hub. Il peut être faux : on
 * démarre la séance du jour, puis on fait tout autre chose. Dé-valider remet la séance en
 * `planned` **et** coupe le lien, sans quoi la prochaine clôture la recocherait.
 */
export async function unlinkPlannedSession(runId: string): Promise<void> {
  const row = await powerSync.getOptional<{ planned_session_id: string | null }>(
    `SELECT planned_session_id FROM runs WHERE id = ? AND deleted_at IS NULL`,
    [runId],
  );
  if (!row || row.planned_session_id === null) {
    return;
  }
  await reopenPlannedSession(row.planned_session_id);
  await patch('runs', runId, { planned_session_id: null });
}

/**
 * Supprime une course (R1d-1) — soft delete, et tout ce qui en dépendait.
 *
 * ── Pourquoi cette fonction est bloquante et pas confortable ─────────────────────────────────────
 * Il n'existait **aucun** moyen de supprimer une course (constat F18). `cancelRun` était réservée
 * au flux de permission refusée. Une course fantôme — démarrée par erreur, 200 m dans le salon,
 * trace GPS délirante — restait à vie dans l'historique, gonflait les statistiques, entrait dans
 * l'**ACWR** (donc dans le signal de risque de blessure) et dans la **polarisation**, et pouvait
 * **décerner un record**. Un record 5 km met à jour l'**allure de référence**, qui pilote toutes
 * les allures cibles de toutes les séances : un seul fix aberrant pouvait dérégler tout le système
 * d'allures, sans recours.
 *
 * ── Les quatre effets, dans cet ordre ────────────────────────────────────────────────────────────
 *  1. les **records portés** par la course sont supprimés — avant le soft delete, car on les
 *     retrouve par `run_id` ;
 *  2. la **course** est supprimée ;
 *  3. la **séance planifiée** qu'elle avait cochée redevient à faire (sinon on perdrait la séance
 *     en même temps que la course) ;
 *  4. les records sont **recalculés** depuis l'historique restant (`backfillRunningRecords`, qui
 *     réinsère le meilleur temps restant par distance et met à jour l'allure de référence).
 *
 * ⚠️ **L'allure de référence n'est effacée que si elle venait manifestement du record supprimé**
 * (elle vaut exactement le temps 5 km supprimé ÷ 5). Le profil ne stocke pas la provenance de
 * cette valeur : elle peut avoir été **saisie à la main**. L'effacer inconditionnellement
 * détruirait une saisie utilisateur ; la garder toujours laisserait une référence fantôme. Le test
 * d'égalité tranche les deux cas courants sans jamais écraser une saisie.
 *
 * Idempotent : une course déjà supprimée est un no-op.
 */
export async function deleteRun(runId: string): Promise<void> {
  const row = await powerSync.getOptional<{
    planned_session_id: string | null;
    deleted_at: string | null;
  }>(
    `SELECT planned_session_id, deleted_at FROM runs WHERE id = ?`,
    [runId],
  );
  if (!row || row.deleted_at !== null) {
    return;
  }

  // 1. Records portés par cette course (retrouvés par `run_id`, joignable seulement maintenant).
  const held = await powerSync.getAll<{
    id: string;
    distance_key: string;
    best_time_seconds: number;
  }>(
    `SELECT id, distance_key, best_time_seconds FROM running_pace_records
     WHERE run_id = ? AND deleted_at IS NULL`,
    [runId],
  );
  const held5k = held.find((r) => r.distance_key === '5k') ?? null;
  for (const record of held) {
    await softDelete('running_pace_records', record.id);
  }

  // 1 bis. Le journal des efforts de cette course (US EFFORT-01, spec R18).
  //
  // ⚠️ Ce n'est pas seulement du ménage : le journal est ce qui porte les **rangs**. Laisser les
  // efforts d'une course supprimée, c'est continuer à classer un coureur contre une sortie qui
  // n'existe plus — son « 2ᵉ meilleur kilomètre » resterait deuxième derrière un effort effacé.
  // La suppression logique suffit : les rangs des autres courses se recalculent tout seuls, parce
  // qu'ils sont dérivés et non stockés.
  await softDeleteRunEfforts(runId);

  // 2. La course.
  await softDelete('runs', runId);

  // 3. La séance planifiée redevient à faire.
  if (row.planned_session_id !== null) {
    try {
      await reopenPlannedSession(row.planned_session_id);
    } catch (error) {
      console.warn('[deleteRun] reopenPlannedSession a échoué :', error);
    }
  }

  // 4. Records recalculés depuis ce qui reste.
  if (held.length > 0) {
    await backfillRunningRecords();

    if (held5k !== null) {
      const remaining5k = await powerSync.getOptional<{ id: string }>(
        `SELECT id FROM running_pace_records
         WHERE distance_key = '5k' AND deleted_at IS NULL`,
      );
      if (!remaining5k) {
        // Aucun 5 km restant : on n'efface la référence que si elle dérivait de celle-ci.
        const derived = Math.round(held5k.best_time_seconds / 5);
        const profile = await powerSync.getOptional<{ ref_5k_pace_s_per_km: number | null }>(
          `SELECT ref_5k_pace_s_per_km FROM running_profiles WHERE deleted_at IS NULL`,
        );
        if (profile && profile.ref_5k_pace_s_per_km === derived) {
          await upsertRunnerProfile({ ref5kPaceSPerKm: null });
        }
      }
    }
  }
}

/** Champs corrigeables d'une course terminée (R1d / constat F19). */
export type RunCorrection = {
  /** Distance en mètres, ou `null` pour l'effacer. */
  distanceM?: number | null;
  /** Durée nette en secondes. */
  durationSeconds?: number | null;
  /** Horodatage ISO de départ — corrige une course saisie au mauvais jour. */
  startedAt?: string;
};

/**
 * Corrige les données d'une course terminée (constat F19).
 *
 * Jusqu'ici seuls le RPE, les notes et le terrain étaient modifiables : une distance GPS aberrante
 * ou une course datée du mauvais jour était **définitive**. La correction ne touche pas la trace
 * (on ne réécrit pas une mesure) : elle corrige les scalaires que l'utilisateur peut connaître
 * mieux que le capteur.
 *
 * Recalcule l'allure moyenne dès que distance ou durée change — sans quoi l'allure resterait celle
 * d'avant la correction, ce qui est précisément le genre d'incohérence que cette US supprime.
 */
export async function updateRunCore(
  runId: string,
  correction: RunCorrection,
): Promise<void> {
  const row = await powerSync.getOptional<{
    distance_m: number | null;
    duration_seconds: number | null;
  }>(
    `SELECT distance_m, duration_seconds FROM runs WHERE id = ? AND deleted_at IS NULL`,
    [runId],
  );
  if (!row) {
    return;
  }

  const columns: Record<string, unknown> = {};
  const distanceM =
    'distanceM' in correction ? (correction.distanceM ?? null) : row.distance_m;
  const durationSeconds =
    'durationSeconds' in correction
      ? (correction.durationSeconds ?? null)
      : row.duration_seconds;

  if ('distanceM' in correction) columns['distance_m'] = distanceM;
  if ('durationSeconds' in correction) columns['duration_seconds'] = durationSeconds;
  if (correction.startedAt !== undefined) columns['started_at'] = correction.startedAt;

  if ('distanceM' in correction || 'durationSeconds' in correction) {
    columns['avg_pace_s_per_km'] =
      distanceM !== null && durationSeconds !== null && durationSeconds > 0
        ? averagePace(distanceM, durationSeconds)
        : null;
  }

  if (Object.keys(columns).length === 0) {
    return;
  }
  await patch('runs', runId, columns);
}

/** Saisie d'une course déjà faite (constat F26). */
export type PastRunInput = {
  /** Horodatage ISO du départ (date + heure choisies par l'utilisateur). */
  startedAt: string;
  /** Durée nette en secondes. Obligatoire : c'est le minimum qui fait une course. */
  durationSeconds: number;
  /** Distance en mètres, ou `null` si inconnue. */
  distanceM?: number | null;
  terrain?: RunTerrain | null;
  rpe?: number | null;
  notes?: string | null;
  /** Séance planifiée passée que cette course réalise, si l'utilisateur la rattache. */
  plannedSessionId?: string | null;
};

/**
 * Crée une course **déjà faite** (constat F26).
 *
 * ── Le trou que ça comble ────────────────────────────────────────────────────────────────────────
 * `startRun` n'était appelable que depuis `/run`, en temps réel. Il était donc **impossible** de
 * journaliser la course d'hier faite sans téléphone, un dossard, ou une sortie enregistrée à la
 * montre. Combiné à l'absence d'import (constat F25), l'app ne pouvait pas être le journal
 * d'entraînement de quelqu'un qui ne court pas téléphone en main.
 *
 * La course est créée **directement `completed`** : il n'y a rien à suivre. Sa source est
 * `manual` — elle est donc exclue des records (une distance saisie n'est pas une mesure) et de la
 * polarisation (aucune trace), exactement comme une course chronométrée sans GPS.
 *
 * Clôt la séance planifiée rattachée, s'il y en a une : la boucle se referme aussi pour une
 * saisie d'après-coup.
 */
export async function createPastRun(input: PastRunInput): Promise<string> {
  const userId = currentUserId();
  const durationSeconds = Math.max(0, Math.round(input.durationSeconds));
  const distanceM = input.distanceM ?? null;
  const avgPace =
    distanceM !== null && durationSeconds > 0 ? averagePace(distanceM, durationSeconds) : null;

  const id = await insertWithSyncFields('runs', {
    user_id: userId,
    status: 'completed',
    source: 'manual',
    started_at: input.startedAt,
    finished_at: new Date(
      Date.parse(input.startedAt) + durationSeconds * 1000,
    ).toISOString(),
    duration_seconds: durationSeconds,
    distance_m: distanceM,
    avg_pace_s_per_km: avgPace,
    gps_track: null,
    rpe: input.rpe ?? null,
    notes: input.notes ?? null,
    planned_session_id: input.plannedSessionId ?? null,
    terrain: input.terrain ?? null,
    elevation_gain_m: null,
    elevation_loss_m: null,
  });

  if (input.plannedSessionId) {
    try {
      await markPlannedSessionDone(input.plannedSessionId);
    } catch (error) {
      console.warn('[createPastRun] markPlannedSessionDone a échoué :', error);
    }
  }

  refreshHomeWidget();
  return id;
}

// ---------------------------------------------------------------------------
// US ALLURE-01 — polarisation de l'entraînement (roadmap 5.35, catalogue RUN-08)
// ---------------------------------------------------------------------------

/** Fenêtre de la polarisation, en jours : **4 semaines** (spec §8 décision 3). */
export const POLARISATION_WINDOW_DAYS = 28;

/**
 * Traces des courses terminées de la fenêtre (US ALLURE-01, RUN-08).
 *
 * 🔴 **Requête dédiée, et surtout PAS `gps_track` ajouté à `SELECT_HISTORY`.** Cette dernière n'a
 * aucune borne de date et alimente les statistiques, la tendance d'allure et l'accueil : y ajouter la
 * trace ferait charger en mémoire **les traces GPS de toutes les courses de l'utilisateur**, pour tous
 * ces consommateurs, alors qu'un seul en a besoin. La régression serait invisible en recette et
 * s'aggraverait avec l'historique.
 *
 * ⚠️ **`gps_track IS NOT NULL`** : une course saisie à la main n'a rien à analyser (spec R7). L'exclure
 * en SQL évite de la compter comme « course ignorée » côté moteur.
 */
export const SELECT_RUNS_WITH_TRACK_SINCE = `
  SELECT gps_track
  FROM runs
  WHERE status = 'completed' AND deleted_at IS NULL
    AND gps_track IS NOT NULL
    AND finished_at >= ?
  ORDER BY finished_at ASC
`;

/**
 * La polarisation du volume sur les 4 dernières semaines (US ALLURE-01, RUN-08).
 *
 * Rend `null` quand le moteur se tait : moins de 2 courses exploitables, ou **allure de référence
 * absente** — auquel cas l'écran affiche l'indisponibilité **et son remède** (spec R4).
 *
 * ⚠️ **Le décodage est le coût de cette analyse.** Chaque trace est décodée puis découpée en splits.
 * Le `useMemo` dépend donc des **lignes** et de la seule allure de référence : reconstruire un objet
 * d'entrée à chaque passe relancerait tout le décodage à chaque rendu de l'écran d'historique. Si la
 * recette montre un ralentissement, la parade est de **borner le nombre de courses décodées et de le
 * dire à l'écran** — jamais de tronquer en silence.
 */
export function usePolarisation(): { polarisation: Polarisation | null; isLoading: boolean } {
  const windowStart = useWindowStartUtc(POLARISATION_WINDOW_DAYS);
  const { runnerProfile, isLoading: profileLoading } = useRunnerProfile();

  const { data, isLoading: runsLoading } = useQuery<{ gps_track: string | null }>(
    SELECT_RUNS_WITH_TRACK_SINCE,
    [windowStart],
  );

  const ref5kPaceSPerKm = runnerProfile?.ref5kPaceSPerKm ?? null;

  const polarisation = useMemo(
    () =>
      computePolarisation({
        runs: data.map((row) => ({
          // `gps_track` est non nul par la requête ; le `?? ''` satisfait le type sans mentir —
          // `decodeTrack('')` rend un tableau vide, que le moteur ignore proprement.
          splits: computeKmSplits(decodeTrack(row.gps_track ?? '')),
        })),
        ref5kPaceSPerKm,
      }),
    [data, ref5kPaceSPerKm],
  );

  return { polarisation, isLoading: runsLoading || profileLoading };
}

// ---------------------------------------------------------------------------
// US FANT-01 — Le Fantôme : candidats, choix, profil
// ---------------------------------------------------------------------------

/** Fenêtre de recherche des fantômes : au-delà, la comparaison n'intéresse plus personne. */
export const GHOST_WINDOW_DAYS = 90;

/** Nombre de propositions affichées d'emblée (spec R2) ; le reste s'ouvre à la demande. */
export const GHOST_SUGGESTIONS = 3;

/**
 * Courses candidates au fantôme (US FANT-01, R2).
 *
 * Même parti pris que `SELECT_RUNS_WITH_TRACK_SINCE` : une requête **dédiée**, bornée dans le temps,
 * plutôt que `gps_track` ajouté à `SELECT_HISTORY` — qui alimente l'accueil et les statistiques et
 * chargerait alors toutes les traces de l'utilisateur en mémoire.
 */
export const SELECT_GHOST_CANDIDATES = `
  SELECT id, finished_at, distance_m, duration_seconds, gps_track
  FROM runs
  WHERE status = 'completed' AND deleted_at IS NULL
    AND gps_track IS NOT NULL
    AND finished_at >= ?
  ORDER BY finished_at DESC
`;

export type GhostCandidate = {
  id: string;
  finishedAt: string;
  distanceM: number;
  durationSeconds: number | null;
};

type GhostCandidateRow = {
  id: string;
  finished_at: string | null;
  distance_m: number | null;
  duration_seconds: number | null;
  gps_track: string | null;
};

/**
 * Les courses passées affrontables depuis ici (US FANT-01, R2).
 *
 * `null` en position de départ (GPS pas encore fixé) ⇒ **liste vide**, jamais une liste au hasard :
 * proposer une course partie d'une autre ville serait pire que de ne rien proposer.
 *
 * ⚠️ **Le décodage est le coût de cette liste** (même avertissement que `usePolarisation`) : il a
 * lieu une fois par jeu de lignes, dans un `useMemo` qui ne dépend que des lignes et de la position
 * arrondie — sinon chaque point GPS reçu relancerait le décodage de toutes les traces.
 */
export function useGhostCandidates(start: { lat: number; lng: number } | null): {
  candidates: GhostCandidate[];
  isLoading: boolean;
} {
  const windowStart = useWindowStartUtc(GHOST_WINDOW_DAYS);
  const { data, isLoading } = useQuery<GhostCandidateRow>(SELECT_GHOST_CANDIDATES, [windowStart]);

  // La position n'entre dans les dépendances qu'arrondie à ~10 m : au mètre près, le filtre se
  // relancerait à chaque fix GPS pour un résultat identique.
  const latKey = start ? Math.round(start.lat * 10_000) : null;
  const lngKey = start ? Math.round(start.lng * 10_000) : null;

  const candidates = useMemo<GhostCandidate[]>(() => {
    if (latKey === null || lngKey === null) return [];
    const rows = data ?? [];
    const out: GhostCandidate[] = [];
    for (const row of rows) {
      if (!row.gps_track || !row.finished_at) continue;
      const points = decodeTrack(row.gps_track);
      const eligible = isGhostCandidate({
        distanceM: row.distance_m,
        points,
        startLat: latKey / 10_000,
        startLng: lngKey / 10_000,
      });
      if (!eligible) continue;
      out.push({
        id: row.id,
        finishedAt: row.finished_at,
        distanceM: row.distance_m ?? 0,
        durationSeconds: row.duration_seconds,
      });
    }
    return out;
  }, [data, latKey, lngKey]);

  return { candidates, isLoading };
}

/**
 * Pose le fantôme sur une course (US FANT-01, R8). Écrit **une fois**, au démarrage : le fantôme
 * d'une course ne change pas en cours de route, sans quoi l'écart afficherait une comparaison avec
 * deux courses différentes selon le moment.
 */
export async function setRunGhost(runId: string, ghostRunId: string | null): Promise<void> {
  await patch('runs', runId, { ghost_run_id: ghostRunId });
}

export type RunGhost = {
  id: string;
  finishedAt: string;
  profile: GhostProfile;
};

/**
 * Le fantôme d'une course : sa ligne et son profil décodé (US FANT-01, R1).
 *
 * `null` si la course n'a pas de fantôme, si celui-ci a été supprimé depuis (R9) ou si sa trace est
 * devenue illisible — dans les trois cas l'écran retombe sur son affichage sans fantôme.
 */
export function useRunGhost(ghostRunId: string | null | undefined): {
  ghost: RunGhost | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery<GhostCandidateRow>(
    `SELECT id, finished_at, distance_m, duration_seconds, gps_track
     FROM runs
     WHERE id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [ghostRunId ?? ''],
  );

  const ghost = useMemo<RunGhost | null>(() => {
    const row = (data ?? [])[0];
    if (!ghostRunId || !row?.gps_track || !row.finished_at) return null;
    const profile = buildGhostProfile(decodeTrack(row.gps_track));
    if (profile === null) return null;
    return { id: row.id, finishedAt: row.finished_at, profile };
  }, [data, ghostRunId]);

  return { ghost, isLoading: ghostRunId ? isLoading : false };
}

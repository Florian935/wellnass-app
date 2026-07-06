/**
 * Repository des séances (table `workouts`) et de leurs séries (table `workout_sets`).
 *
 * Responsabilité unique : lire/écrire les tables locales PowerSync `workouts` et
 * `workout_sets`, et exposer une vue « séance active » regroupée par exercice pour
 * l'UI, ainsi que l'historique des séances terminées.
 *
 * Modèle **plat** (voir docs/specs/functional/musculation.md et
 * docs/specs/technical/modele-donnees.md) : il n'existe pas d'entité « entry ».
 * Les séries sont des lignes `workout_sets` référençant directement un exercice ;
 * l'UI les regroupe par `exercise_id` (dans l'ordre de première apparition) puis
 * les trie par `order_index`.
 *
 * Règles offline-first (voir docs/specs/technical/offline-sync.md) :
 *  - UUID généré côté client (via `insertWithSyncFields`).
 *  - Timestamps en UTC ; suppression = soft delete.
 *  - Chaque mutation écrit immédiatement dans SQLite (optimiste), la synchro suit.
 *  - `user_id` = utilisateur de la session courante à l'écriture.
 *
 * PowerSync ne réplique que les lignes de l'utilisateur courant (bucket par JWT) :
 * en lecture, filtrer sur `deleted_at IS NULL` + `status` suffit.
 */

import { useQuery, useStatus } from '@powersync/react';
import type { SetType } from '@wellness/shared';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { resolveDeviceLocale } from '@/i18n';
import { insertWithSyncFields, nowUtc, patch, softDelete } from './_sql';

// ---------------------------------------------------------------------------
// Types de domaine exposés à l'UI
// ---------------------------------------------------------------------------

/** Une série telle qu'affichée dans la séance active. */
export type WorkoutSetItem = {
  id: string;
  setType: SetType;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  done: boolean;
  orderIndex: number;
};

/** Regroupement des séries d'un même exercice au sein d'une séance. */
export type WorkoutEntry = {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSetItem[];
};

/** Séance active regroupée par exercice, prête pour l'écran de saisie. */
export type ActiveWorkout = {
  id: string;
  startedAt: string;
  entries: WorkoutEntry[];
};

/** Élément d'historique (séance terminée), volontairement léger. */
export type WorkoutHistoryItem = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
  rpe: number | null;
  notes: string | null;
};

/** Champs modifiables d'une série via `updateSet`. */
export type WorkoutSetPatch = {
  reps?: number | null;
  weightKg?: number | null;
  done?: boolean;
  setType?: SetType;
  durationSeconds?: number | null;
};

// ---------------------------------------------------------------------------
// Lignes brutes SQLite (colonnes snake_case ; booléens en 0/1)
// ---------------------------------------------------------------------------

/** Ligne brute d'une séance. */
type WorkoutDbRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  rpe: number | null;
  notes: string | null;
};

/**
 * Ligne brute d'une série avec le nom d'exercice résolu (langue courante → fr).
 * `done` est renvoyé en 0/1 par SQLite.
 */
type WorkoutSetDbRow = {
  id: string;
  exercise_id: string;
  order_index: number;
  set_type: string;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  done: number;
  /** Nom résolu par COALESCE(langue courante, fr) — peut être null si aucune traduction. */
  exercise_name: string | null;
};

// ---------------------------------------------------------------------------
// Requêtes SQL (noms de tables/colonnes statiques ; valeurs liées via ?)
// ---------------------------------------------------------------------------

/** Séance active de l'utilisateur courant (au plus une). */
const SELECT_ACTIVE_WORKOUT = `
  SELECT id, started_at, finished_at, duration_seconds, rpe, notes
  FROM workouts
  WHERE status = 'active' AND deleted_at IS NULL
  LIMIT 1
`;

/**
 * Séries d'une séance donnée, avec nom d'exercice résolu (langue courante → fr).
 * Premier `?` = langue courante ; second `?` = id de la séance.
 * Tri par `order_index` : garantit l'ordre des séries et l'ordre de première
 * apparition des exercices lors du regroupement en JS.
 */
const SELECT_SETS_FOR_WORKOUT = `
  SELECT s.id, s.exercise_id, s.order_index, s.set_type, s.reps, s.weight_kg,
         s.duration_seconds, s.done,
         COALESCE(tl.name, tfr.name) AS exercise_name
  FROM workout_sets s
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = s.exercise_id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = s.exercise_id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE s.workout_id = ? AND s.deleted_at IS NULL
  ORDER BY s.order_index
`;

/** Historique des séances terminées, plus récentes d'abord. */
const SELECT_HISTORY = `
  SELECT id, started_at, finished_at, duration_seconds, rpe, notes
  FROM workouts
  WHERE status = 'completed' AND deleted_at IS NULL
  ORDER BY finished_at DESC
`;

// ---------------------------------------------------------------------------
// Mapping snake_case ↔ camelCase
// ---------------------------------------------------------------------------

/** Convertit une ligne série SQLite → item de domaine (camelCase). */
function rowToSetItem(row: WorkoutSetDbRow): WorkoutSetItem {
  return {
    id: row.id,
    setType: row.set_type as SetType,
    reps: row.reps,
    weightKg: row.weight_kg,
    durationSeconds: row.duration_seconds,
    done: row.done === 1,
    orderIndex: row.order_index,
  };
}

/** Convertit une ligne séance SQLite → item d'historique (camelCase). */
function rowToHistoryItem(row: WorkoutDbRow): WorkoutHistoryItem {
  return {
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationSeconds: row.duration_seconds,
    rpe: row.rpe,
    notes: row.notes,
  };
}

/**
 * Regroupe des lignes séries (déjà triées par `order_index`) par exercice.
 * L'ordre des groupes suit la première apparition de chaque exercice ; l'ordre
 * des séries au sein d'un groupe est préservé (donc trié par `order_index`).
 */
function groupSetsByExercise(rows: WorkoutSetDbRow[]): WorkoutEntry[] {
  const entries: WorkoutEntry[] = [];
  const byExercise = new Map<string, WorkoutEntry>();

  for (const row of rows) {
    let entry = byExercise.get(row.exercise_id);
    if (!entry) {
      entry = {
        exerciseId: row.exercise_id,
        // Repli ultime : chaîne vide si aucune traduction (ne devrait pas arriver).
        exerciseName: row.exercise_name ?? '',
        sets: [],
      };
      byExercise.set(row.exercise_id, entry);
      entries.push(entry);
    }
    entry.sets.push(rowToSetItem(row));
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Lecture réactive (hooks)
// ---------------------------------------------------------------------------

/**
 * Séance active de l'utilisateur courant (ou `null`), réactive aux changements
 * de la base locale. Les séries sont lues via une seconde requête filtrée sur
 * l'id de la séance active, puis regroupées par exercice.
 *
 * `isLoading` reflète l'état de la base locale (voir profile/settings-repository) :
 *  - tant que `useQuery` n'a pas résolu ;
 *  - OU tant que la première synchro n'est pas terminée (`status.hasSynced` faux).
 */
export function useActiveWorkout(): {
  workout: ActiveWorkout | null;
  isLoading: boolean;
} {
  const status = useStatus();
  const lang = resolveDeviceLocale();

  const { data: workoutRows, isLoading: workoutLoading } =
    useQuery<WorkoutDbRow>(SELECT_ACTIVE_WORKOUT);

  const activeRow = workoutRows[0] ?? null;
  const workoutId = activeRow?.id ?? '';

  // Requête des séries toujours appelée (règle des hooks), avec la requête
  // statique. Quand `workoutId === ''` (pas de séance active), la clause
  // `s.workout_id = ?` ne matche aucune ligne → résultat vide, comportement
  // voulu. Le hook reste donc appelable de façon stable dans tous les cas.
  const { data: setRows, isLoading: setsLoading } = useQuery<WorkoutSetDbRow>(
    SELECT_SETS_FOR_WORKOUT,
    [lang, workoutId],
  );

  const isLoading = workoutLoading || setsLoading || !status.hasSynced;

  if (!activeRow) {
    return { workout: null, isLoading };
  }

  const workout: ActiveWorkout = {
    id: activeRow.id,
    startedAt: activeRow.started_at,
    entries: groupSetsByExercise(setRows),
  };

  return { workout, isLoading };
}

/**
 * Historique des séances terminées, plus récentes d'abord.
 * Volontairement léger (pas de séries) ; le volume par séance se calcule à la
 * demande via `getWorkoutSets` + `computeVolume`.
 */
export function useWorkoutHistory(): {
  workouts: WorkoutHistoryItem[];
  isLoading: boolean;
} {
  const status = useStatus();
  const { data, isLoading: queryLoading } =
    useQuery<WorkoutDbRow>(SELECT_HISTORY);

  const isLoading = queryLoading || !status.hasSynced;
  const workouts = data.map(rowToHistoryItem);

  return { workouts, isLoading };
}

// ---------------------------------------------------------------------------
// Écritures (hors contexte hook) — toutes optimistes (SQLite immédiat)
// ---------------------------------------------------------------------------

/** Identifiant de l'utilisateur de la session courante (lève si déconnecté). */
function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    throw new Error("Aucune session active : impossible d'écrire une séance.");
  }
  return userId;
}

/**
 * `order_index` suivant pour une séance : max(order_index) + 1, ou 0 si aucune
 * série. On lit sur toutes les séries de la séance (tous exercices confondus)
 * pour garantir l'unicité de la position au sein de la séance.
 */
async function nextOrderIndex(workoutId: string): Promise<number> {
  const row = await powerSync.getOptional<{ max_index: number | null }>(
    `SELECT MAX(order_index) AS max_index FROM workout_sets
     WHERE workout_id = ? AND deleted_at IS NULL`,
    [workoutId],
  );
  const max = row?.max_index;
  return max === null || max === undefined ? 0 : max + 1;
}

/**
 * Démarre une nouvelle séance vide et retourne son id.
 * Le·la consommateur·rice s'assure qu'aucune autre séance n'est active.
 */
export async function startWorkout(): Promise<string> {
  return insertWithSyncFields('workouts', {
    user_id: currentUserId(),
    session_id: null,
    program_id: null,
    status: 'active',
    started_at: nowUtc(),
    finished_at: null,
    duration_seconds: null,
    rpe: null,
    notes: null,
  });
}

/**
 * Annule une séance : passe son statut à `cancelled`, puis soft delete la séance
 * ET toutes ses séries (nettoyage complet côté local + synchro).
 */
export async function cancelWorkout(id: string): Promise<void> {
  await patch('workouts', id, { status: 'cancelled' });

  const sets = await powerSync.getAll<{ id: string }>(
    `SELECT id FROM workout_sets WHERE workout_id = ? AND deleted_at IS NULL`,
    [id],
  );
  for (const set of sets) {
    await softDelete('workout_sets', set.id);
  }

  await softDelete('workouts', id);
}

/**
 * Termine une séance : calcule la durée à partir de `started_at`, passe le statut
 * à `completed`, pose `finished_at`, et enregistre RPE / notes si fournis.
 */
export async function finishWorkout(
  id: string,
  opts?: { rpe?: number | null; notes?: string | null },
): Promise<void> {
  const row = await powerSync.getOptional<{ started_at: string }>(
    `SELECT started_at FROM workouts WHERE id = ?`,
    [id],
  );

  const finishedAt = nowUtc();
  const durationSeconds = row
    ? Math.max(
        0,
        Math.round(
          (new Date(finishedAt).getTime() - new Date(row.started_at).getTime()) /
            1000,
        ),
      )
    : null;

  const columns: Record<string, unknown> = {
    status: 'completed',
    finished_at: finishedAt,
    duration_seconds: durationSeconds,
  };
  if (opts && 'rpe' in opts) columns['rpe'] = opts.rpe;
  if (opts && 'notes' in opts) columns['notes'] = opts.notes;

  await patch('workouts', id, columns);
}

/**
 * Ajoute un exercice à la séance en créant sa première série (ligne `workout_sets`).
 * Valeurs par défaut : `set_type='normal'`, `reps`/`weight_kg` nuls, `done=false`,
 * `order_index` = position suivante dans la séance.
 */
export async function addExerciseToWorkout(
  workoutId: string,
  exerciseId: string,
): Promise<void> {
  const orderIndex = await nextOrderIndex(workoutId);

  await insertWithSyncFields('workout_sets', {
    workout_id: workoutId,
    user_id: currentUserId(),
    exercise_id: exerciseId,
    order_index: orderIndex,
    set_type: 'normal',
    reps: null,
    weight_kg: null,
    duration_seconds: null,
    done: 0,
  });
}

/**
 * Ajoute une série à un exercice déjà présent dans la séance.
 * Pré-remplit `reps` / `weight_kg` / `set_type` depuis la dernière série existante
 * du même exercice (spec musculation §3.25 « valeurs pré-remplies »), `done=false`,
 * `order_index` = position suivante dans la séance.
 */
export async function addSet(
  workoutId: string,
  exerciseId: string,
): Promise<void> {
  const last = await powerSync.getOptional<{
    reps: number | null;
    weight_kg: number | null;
    duration_seconds: number | null;
    set_type: string;
  }>(
    `SELECT reps, weight_kg, duration_seconds, set_type FROM workout_sets
     WHERE workout_id = ? AND exercise_id = ? AND deleted_at IS NULL
     ORDER BY order_index DESC
     LIMIT 1`,
    [workoutId, exerciseId],
  );

  const orderIndex = await nextOrderIndex(workoutId);

  await insertWithSyncFields('workout_sets', {
    workout_id: workoutId,
    user_id: currentUserId(),
    exercise_id: exerciseId,
    order_index: orderIndex,
    set_type: last?.set_type ?? 'normal',
    reps: last?.reps ?? null,
    weight_kg: last?.weight_kg ?? null,
    duration_seconds: last?.duration_seconds ?? null,
    done: 0,
  });
}

/**
 * Met à jour une série (reps, poids, validation, type, durée).
 * Seules les clés présentes dans `input` sont modifiées.
 */
export async function updateSet(
  setId: string,
  input: WorkoutSetPatch,
): Promise<void> {
  const columns: Record<string, unknown> = {};
  if ('reps' in input) columns['reps'] = input.reps;
  if ('weightKg' in input) columns['weight_kg'] = input.weightKg;
  if ('done' in input) columns['done'] = input.done ? 1 : 0;
  if ('setType' in input) columns['set_type'] = input.setType;
  if ('durationSeconds' in input) columns['duration_seconds'] = input.durationSeconds;

  await patch('workout_sets', setId, columns);
}

/** Retire une série de la séance (soft delete). */
export async function removeSet(setId: string): Promise<void> {
  await softDelete('workout_sets', setId);
}

/**
 * Lit les séries d'une séance (hors contexte réactif), triées par `order_index`.
 * Destiné à l'écran de résumé pour calculer le volume via `computeVolume`.
 */
export async function getWorkoutSets(
  workoutId: string,
): Promise<WorkoutSetItem[]> {
  const rows = await powerSync.getAll<WorkoutSetDbRow>(SELECT_SETS_FOR_WORKOUT, [
    resolveDeviceLocale(),
    workoutId,
  ]);
  return rows.map(rowToSetItem);
}

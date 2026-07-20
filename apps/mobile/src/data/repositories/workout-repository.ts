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

import { useQuery } from '@powersync/react';
import type { SetType } from '@wellness/shared';
import { useTranslation } from 'react-i18next';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { getAppLanguage } from '@/i18n';
import { generateId } from '@/lib/id';
import { insertWithSyncFields, nowUtc, patch, softDelete } from './_sql';

// ---------------------------------------------------------------------------
// Types de domaine exposés à l'UI
// ---------------------------------------------------------------------------

/** Une série telle qu'affichée dans la séance active. */
export type WorkoutSetItem = {
  id: string;
  exerciseId: string;
  setType: SetType;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  done: boolean;
  orderIndex: number;
  rpe: number | null;
  plannedWeightKg: number | null;
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
  sessionId: string | null;
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
  rpe?: number | null;
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
  session_id: string | null;
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
  rpe: number | null;
  planned_weight_kg: number | null;
  /** Nom résolu par COALESCE(langue courante, fr) — peut être null si aucune traduction. */
  exercise_name: string | null;
};

// ---------------------------------------------------------------------------
// Requêtes SQL (noms de tables/colonnes statiques ; valeurs liées via ?)
// ---------------------------------------------------------------------------

/** Séance active de l'utilisateur courant (au plus une). */
const SELECT_ACTIVE_WORKOUT = `
  SELECT id, started_at, finished_at, duration_seconds, rpe, notes, session_id
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
         s.duration_seconds, s.done, s.rpe, s.planned_weight_kg,
         COALESCE(tl.name, tfr.name) AS exercise_name
  FROM workout_sets s
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = s.exercise_id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = s.exercise_id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE s.workout_id = ? AND s.deleted_at IS NULL
  ORDER BY s.order_index
`;

/** Historique des séances terminées, plus récentes d'abord. */
const SELECT_HISTORY = `
  SELECT id, started_at, finished_at, duration_seconds, rpe, notes, session_id
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
    exerciseId: row.exercise_id,
    setType: row.set_type as SetType,
    reps: row.reps,
    weightKg: row.weight_kg,
    durationSeconds: row.duration_seconds,
    done: row.done === 1,
    orderIndex: row.order_index,
    rpe: row.rpe,
    plannedWeightKg: row.planned_weight_kg,
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
 * `isLoading` ne dépend QUE de la résolution des requêtes locales (voir
 * profile/settings-repository) : le contenu ne doit pas se bloquer sur une
 * synchro réseau (offline-first, ADR-001 / décision B).
 *
 * Le nom d'exercice est résolu dans la langue applicative (préférence
 * utilisateur synchronisée), cohérent avec `exercise-repository`.
 */
export function useActiveWorkout(): {
  workout: ActiveWorkout | null;
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';

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

  const isLoading = workoutLoading || setsLoading;

  if (!activeRow) {
    return { workout: null, isLoading };
  }

  const workout: ActiveWorkout = {
    id: activeRow.id,
    startedAt: activeRow.started_at,
    sessionId: activeRow.session_id,
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
  const { data, isLoading: queryLoading } =
    useQuery<WorkoutDbRow>(SELECT_HISTORY);

  const isLoading = queryLoading;
  const workouts = data.map(rowToHistoryItem);

  return { workouts, isLoading };
}

/** Ligne brute d'un plan d'exercice (repos cible). */
type ExercisePlanRestDbRow = {
  exercise_id: string;
  rest_seconds: number;
};

/** Temps de repos planifié par exercice, pour une séance de programme donnée. */
const SELECT_SESSION_REST = `
  SELECT exercise_id, rest_seconds
  FROM exercise_plans
  WHERE session_id = ? AND deleted_at IS NULL AND rest_seconds IS NOT NULL
`;

/**
 * Temps de repos planifiés (`rest_seconds`) des exercices d'une séance de
 * programme, indexés par `exerciseId`. `sessionId` peut être `null` (séance
 * libre, sans programme) : le hook reste appelable de façon stable (règle des
 * hooks), la requête filtre alors sur une chaîne vide et ne matche aucune ligne.
 */
export function useSessionRest(sessionId: string | null): Record<string, number> {
  const { data } = useQuery<ExercisePlanRestDbRow>(SELECT_SESSION_REST, [
    sessionId ?? '',
  ]);

  const rest: Record<string, number> = {};
  for (const row of data) {
    rest[row.exercise_id] = row.rest_seconds;
  }
  return rest;
}

/** Ligne brute d'une série de la dernière performance (poids/reps). */
type LastPerformanceDbRow = {
  weight_kg: number | null;
  reps: number | null;
};

/**
 * Séries validées d'un exercice dans la dernière séance terminée qui le
 * contient (deux paramètres = `exerciseId` répété : sous-requête de sélection
 * de la séance la plus récente, puis filtre des séries de cette séance).
 */
const SELECT_LAST_PERFORMANCE = `
  SELECT s.weight_kg, s.reps FROM workout_sets s
  JOIN workouts w ON w.id = s.workout_id AND w.status = 'completed' AND w.deleted_at IS NULL
  WHERE s.exercise_id = ? AND s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup'
    AND w.id = (
      SELECT w2.id FROM workouts w2
      JOIN workout_sets s2 ON s2.workout_id = w2.id AND s2.exercise_id = ? AND s2.deleted_at IS NULL AND s2.done = 1 AND s2.set_type <> 'warmup'
      WHERE w2.status = 'completed' AND w2.deleted_at IS NULL
      ORDER BY w2.finished_at DESC LIMIT 1
    )
  ORDER BY s.order_index
`;

/**
 * Séries de la dernière séance terminée où l'exercice a été fait (vide si
 * jamais fait), triées par `order_index` — sert à pré-afficher la performance
 * précédente à l'écran de saisie.
 */
export function useLastPerformance(
  exerciseId: string,
): { weightKg: number | null; reps: number | null }[] {
  const { data } = useQuery<LastPerformanceDbRow>(SELECT_LAST_PERFORMANCE, [
    exerciseId,
    exerciseId,
  ]);

  return data.map((row) => ({ weightKg: row.weight_kg, reps: row.reps }));
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
 *
 * Garde défensive : si une séance `status='active'` non supprimée existe déjà
 * pour l'utilisateur courant, on retourne son id au lieu d'en créer une seconde
 * (au plus une séance active à la fois).
 */
export async function startWorkout(): Promise<string> {
  const userId = currentUserId();

  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM workouts
     WHERE user_id = ? AND status = 'active' AND deleted_at IS NULL
     LIMIT 1`,
    [userId],
  );
  if (existing) {
    return existing.id;
  }

  return insertWithSyncFields('workouts', {
    user_id: userId,
    session_id: null,
    program_id: null,
    planned_session_id: null,
    status: 'active',
    started_at: nowUtc(),
    finished_at: null,
    duration_seconds: null,
    rpe: null,
    notes: null,
  });
}

/** Insère une ligne dans une transaction en injectant les champs de synchro. */
async function txInsert(
  tx: { execute: (sql: string, params?: unknown[]) => Promise<unknown> },
  table: string,
  values: Record<string, unknown>,
): Promise<string> {
  const id = typeof values['id'] === 'string' ? (values['id'] as string) : generateId();
  const now = nowUtc();
  const merged: Record<string, unknown> = {
    ...values,
    id,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  const columns = Object.keys(merged);
  const placeholders = columns.map(() => '?').join(', ');
  const params = columns.map((col) => merged[col]);
  await tx.execute(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
    params,
  );
  return id;
}

/**
 * Extrait le premier entier d'une cible de reps du plan (`target_reps`), p. ex.
 * « 8-12 » → 8, « 10 » → 10, « AMRAP » / null → null. Sert à pré-remplir le champ reps
 * d'une séance planifiée (valeur de départ modifiable), en miroir de la charge cible.
 */
function parseTargetReps(target: string | null): number | null {
  if (!target) return null;
  const match = target.match(/\d+/);
  return match ? Number(match[0]) : null;
}

/**
 * Démarre une séance à partir d'une séance planifiée d'un programme (spec §3.24) et
 * retourne l'id de la séance créée.
 *
 * Garde défensive identique à `startWorkout` : si une séance `status='active'` non
 * supprimée existe déjà pour l'utilisateur courant, on retourne son id sans en créer
 * une seconde (au plus une séance active à la fois). **Dans ce cas précis,
 * `opts.plannedSessionId` est volontairement ignoré** : on ne fait que rendre la main
 * sur la séance active existante, sans la relier a posteriori à une occurrence
 * planifiée — la reprise d'une séance active (et son éventuelle association) est
 * gérée ailleurs, côté UI.
 *
 * Sinon, dans une transaction atomique (une séance partielle est impossible) :
 *  1. lit le `program_id` de la séance planifiée (`sessions`) ;
 *  2. lit ses `exercise_plans` (triés par `order_index`) ;
 *  3. insère la ligne `workouts` (session_id + program_id renseignés, `status='active'`,
 *     `planned_session_id` = `opts.plannedSessionId` si fourni, pour relier la séance à
 *     l'occurrence de planning dont elle découle) ;
 *  4. pour chaque plan, insère `max(1, target_sets)` séries pré-remplies :
 *     `set_type` et `weight_kg` repris du plan, `reps` pré-rempli depuis la cible
 *     `target_reps` (1er entier, ex. « 8-12 » → 8 — valeur de départ modifiable),
 *     `done=false`. L'`order_index` est séquentiel sur l'ensemble de la séance.
 */
export async function startWorkoutFromSession(
  sessionId: string,
  opts?: { plannedSessionId?: string },
): Promise<string> {
  const userId = currentUserId();

  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM workouts
     WHERE user_id = ? AND status = 'active' AND deleted_at IS NULL
     LIMIT 1`,
    [userId],
  );
  if (existing) {
    return existing.id;
  }

  return powerSync.writeTransaction(async (tx) => {
    // 1. Programme de rattachement de la séance planifiée.
    const session = await tx.getOptional<{ program_id: string }>(
      `SELECT program_id FROM sessions WHERE id = ? AND deleted_at IS NULL`,
      [sessionId],
    );
    if (!session) {
      throw new Error('Séance de programme introuvable : démarrage impossible.');
    }

    // 2. Exercices planifiés de la séance, dans l'ordre.
    const plans = await tx.getAll<{
      exercise_id: string;
      set_type: string;
      target_sets: number | null;
      target_reps: string | null;
      target_weight_kg: number | null;
    }>(
      `SELECT exercise_id, set_type, target_sets, target_reps, target_weight_kg
       FROM exercise_plans
       WHERE session_id = ? AND deleted_at IS NULL
       ORDER BY order_index`,
      [sessionId],
    );

    // 3. Nouvelle séance active rattachée à la séance et au programme.
    const workoutId = await txInsert(tx, 'workouts', {
      user_id: userId,
      session_id: sessionId,
      program_id: session.program_id,
      planned_session_id: opts?.plannedSessionId ?? null,
      status: 'active',
      started_at: nowUtc(),
      finished_at: null,
      duration_seconds: null,
      rpe: null,
      notes: null,
    });

    // 4. Séries pré-remplies : max(1, target_sets) par exercice planifié.
    let orderIndex = 0;
    for (const plan of plans) {
      const count = Math.max(1, plan.target_sets ?? 1);
      for (let i = 0; i < count; i++) {
        await txInsert(tx, 'workout_sets', {
          workout_id: workoutId,
          user_id: userId,
          exercise_id: plan.exercise_id,
          order_index: orderIndex,
          set_type: plan.set_type,
          reps: parseTargetReps(plan.target_reps),
          weight_kg: plan.target_weight_kg,
          duration_seconds: null,
          done: 0,
          planned_weight_kg: plan.target_weight_kg,
        });
        orderIndex += 1;
      }
    }

    return workoutId;
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
  const row = await powerSync.getOptional<{
    started_at: string;
    planned_session_id: string | null;
  }>(`SELECT started_at, planned_session_id FROM workouts WHERE id = ?`, [id]);

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

  // Best-effort : marque l'occurrence planifiée liée comme faite. Ne doit jamais
  // faire échouer la clôture de la séance (offline-first : la séance est déjà
  // close localement, cette étape est une synchronisation secondaire).
  if (row?.planned_session_id) {
    try {
      await patch('planned_sessions', row.planned_session_id, {
        status: 'done',
        completed_at: nowUtc(),
      });
    } catch (error) {
      console.warn("Échec du marquage de l'occurrence planifiée (ignoré, best-effort) :", error);
    }
  }
}

/**
 * Enregistre le ressenti d'une séance (RPE / notes) sans passer par `finishWorkout`
 * (écran de résumé, édition a posteriori). Seules les clés présentes dans `input`
 * sont modifiées. N'importe pas `_sql` directement côté écran.
 */
export async function setWorkoutFeedback(
  id: string,
  input: { rpe?: number | null; notes?: string | null },
): Promise<void> {
  const columns: Record<string, unknown> = {};
  if ('rpe' in input) columns['rpe'] = input.rpe;
  if ('notes' in input) columns['notes'] = input.notes;
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
    planned_weight_kg: null,
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

  // Une charge d'échauffement n'est pas un point de départ réaliste pour la
  // série suivante : si la dernière série héritée est un échauffement, on
  // repart à zéro (type 'normal', valeurs nulles) plutôt que de la recopier.
  const isLastWarmup = last?.set_type === 'warmup';
  const inheritedSetType = isLastWarmup ? 'normal' : last?.set_type ?? 'normal';
  const inheritedReps = isLastWarmup ? null : last?.reps ?? null;
  const inheritedWeightKg = isLastWarmup ? null : last?.weight_kg ?? null;
  const inheritedDurationSeconds = isLastWarmup
    ? null
    : last?.duration_seconds ?? null;

  await insertWithSyncFields('workout_sets', {
    workout_id: workoutId,
    user_id: currentUserId(),
    exercise_id: exerciseId,
    order_index: orderIndex,
    set_type: inheritedSetType,
    reps: inheritedReps,
    weight_kg: inheritedWeightKg,
    duration_seconds: inheritedDurationSeconds,
    done: 0,
    planned_weight_kg: null,
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
  if ('rpe' in input) columns['rpe'] = input.rpe;

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
    getAppLanguage(),
    workoutId,
  ]);
  return rows.map(rowToSetItem);
}

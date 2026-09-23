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
import {
  computeReorderedExerciseOrder,
  isWorkoutStale,
  sessionStruggled,
  type ReorderOperation,
  type SetType,
} from '@wellness/shared';
import { useTranslation } from 'react-i18next';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import i18n, { getAppLanguage } from '@/i18n';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { refreshHomeWidget } from '@/widgets/refresh-home-widget';
import { pushWorkout } from '@/lib/health-connect';
import { generateId } from '@/lib/id';
import { exerciseNameSql, insertWithSyncFields, nowUtc, patch, softDelete } from './_sql';

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
  /** US MUSC-F15 (roadmap 3.7) : programme d'origine, `null` si séance libre. */
  programId: string | null;
  /** US MUSC-F15 : occurrence planifiée d'origine, `null` si démarrée hors planning. */
  plannedSessionId: string | null;
  /** US MUSC-F15 : semaine du programme (résolue par jointure sur `planned_sessions`), `null` si `plannedSessionId` l'est aussi (spec R3). */
  weekIndex: number | null;
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
  sessionId: string | null;
  programId: string | null;
  /** Tonnage total (Σ reps × poids, séries validées non-échauffement), en kg. 0 si aucune. */
  volumeKg: number;
  /** Nom de la séance de programme d'origine ; `null` pour une séance libre (US MUSCU-UX01). */
  sessionName: string | null;
  /** Nombre d'exercices réellement travaillés (échauffements exclus). */
  exerciseCount: number;
  /** Records battus pendant cette séance — sert la pastille 🏆 de la liste. */
  recordCount: number;
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
  program_id: string | null;
  /** US MUSC-F15 : occurrence planifiée d'origine ; absent de `SELECT_HISTORY`. */
  planned_session_id?: string | null;
  /** US MUSC-F15 : semaine du programme (jointure `planned_sessions`) ; absent des autres requêtes. */
  week_index?: number | null;
  /** Tonnage total de la séance (correlated subquery de `SELECT_HISTORY`) ; absent des autres requêtes. */
  volume_kg?: number | null;
  /** US MUSCU-UX01, `SELECT_HISTORY` seulement : nom de la séance de programme d'origine. */
  session_name?: string | null;
  /** US MUSCU-UX01, `SELECT_HISTORY` seulement : exercices travaillés, échauffements exclus. */
  exercise_count?: number | null;
  /** US MUSCU-UX01, `SELECT_HISTORY` seulement : records battus pendant la séance. */
  record_count?: number | null;
};

/**
 * Ligne brute d'une série avec le nom d'exercice résolu (langue courante → fr).
 * `done` est renvoyé en 0/1 par SQLite.
 */
type WorkoutSetDbRow = {
  id: string;
  /** Séance de la série — sert à écarter une réponse périmée (voir `useActiveWorkout`). */
  workout_id: string;
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

/**
 * La séance active, telle que la désignent `SELECT_ACTIVE_WORKOUT` **et** `SELECT_ACTIVE_SETS`.
 * Un seul texte pour les deux : s'il restait par accident deux séances actives, les deux requêtes
 * doivent choisir la même (d'où l'ordre explicite, absent jusqu'ici).
 */
const ACTIVE_WORKOUT_FILTER = `w.status = 'active' AND w.deleted_at IS NULL
  ORDER BY w.started_at DESC LIMIT 1`;

/**
 * Séance active de l'utilisateur courant (au plus une). `week_index` (US MUSC-F15, roadmap 3.7)
 * est lu sur l'occurrence planifiée — `NULL` dès que `planned_session_id` l'est (séance libre ou
 * démarrée hors planning, spec R3). En sous-requête et non en `LEFT JOIN` : voir `exerciseNameSql`.
 */
const SELECT_ACTIVE_WORKOUT = `
  SELECT w.id, w.started_at, w.finished_at, w.duration_seconds, w.rpe, w.notes, w.session_id,
         w.program_id, w.planned_session_id,
         (SELECT ps.week_index FROM planned_sessions ps
           WHERE ps.id = w.planned_session_id AND ps.deleted_at IS NULL) AS week_index
  FROM workouts w
  WHERE ${ACTIVE_WORKOUT_FILTER}
`;

/**
 * Colonnes d'une série, avec le nom d'exercice résolu (langue courante → fr). Consomme **un** `?`
 * (la langue), en tête des paramètres.
 *
 * ⚠️ **US ADMIN-01 — le nom ne filtre PAS les traductions archivées, volontairement.**
 * Archiver un exercice côté back-office soft-delete aussi ses traductions ; les filtrer ici ferait
 * afficher une **ligne d'historique sans nom** (le repli de `groupSetsByExercise` est la chaîne
 * vide). L'utilisateur perdrait le nom du mouvement qu'il a réellement soulevé. Une séance passée
 * est un fait : son libellé doit survivre au retrait du catalogue.
 * Les **listes de sélection**, elles, continuent de filtrer (cf. `SELECT_EXERCISES`).
 */
const SET_COLUMNS = `
  s.id, s.workout_id, s.exercise_id, s.order_index, s.set_type, s.reps, s.weight_kg,
  s.duration_seconds, s.done, s.rpe, s.planned_weight_kg,
  ${exerciseNameSql('s.exercise_id')} AS exercise_name`;

/**
 * Séries d'une séance donnée. Paramètres : `[lang, workoutId]`.
 * Tri par `order_index` : garantit l'ordre des séries et l'ordre de première
 * apparition des exercices lors du regroupement en JS.
 */
const SELECT_SETS_FOR_WORKOUT = `
  SELECT ${SET_COLUMNS}
  FROM workout_sets s
  WHERE s.workout_id = ? AND s.deleted_at IS NULL
  ORDER BY s.order_index
`;

/**
 * Séries de la séance **active**, sans avoir à connaître son id. Paramètres : `[lang]`.
 *
 * ⚠️ MUSCU-FIX02 — c'est ce qui supprime la **cascade** de l'écran de séance. Les séries étaient
 * lues avec l'id rendu par la première requête : tant qu'elle n'avait pas répondu, la seconde
 * tournait pour rien sur `''`, puis repartait — et entre les deux, `useQuery` rendait la séance
 * **sans ses séries** (« séance vide », bouton « Ajouter un exercice ») pendant un rendu ou plus.
 * Les deux requêtes partent maintenant ensemble, dès le montage.
 */
export const SELECT_ACTIVE_SETS = `
  SELECT ${SET_COLUMNS}
  FROM workout_sets s
  WHERE s.workout_id = (SELECT w.id FROM workouts w WHERE ${ACTIVE_WORKOUT_FILTER})
    AND s.deleted_at IS NULL
  ORDER BY s.order_index
`;

/**
 * Historique des séances terminées, plus récentes d'abord.
 *
 * ── Enrichie par l'US MUSCU-UX01 (10/09/2026) ────────────────────────────────────────────────
 * La liste affichait date + durée + RPE : impossible de retrouver « ma séance pecs du 2 » sans
 * ouvrir les fiches une par une. La requête ramène désormais de quoi **reconnaître** une séance
 * sans l'ouvrir — son nom, ses exercices, ses records — en plus du tonnage, qui était déjà là
 * mais que l'écran n'affichait pas.
 *
 * Les trois sous-requêtes sont corrélées sur `workouts.id` : sur un historique de quelques
 * centaines de lignes en SQLite local, c'est sans effet mesurable, et cela évite trois jointures
 * avec agrégation qui rendraient la requête bien plus difficile à relire.
 */
const SELECT_HISTORY = `
  SELECT w.id, w.started_at, w.finished_at, w.duration_seconds, w.rpe, w.notes,
         w.session_id, w.program_id,
         s.name AS session_name,
         (SELECT COALESCE(SUM(ws.reps * ws.weight_kg), 0)
            FROM workout_sets ws
           WHERE ws.workout_id = w.id AND ws.deleted_at IS NULL
             AND ws.done = 1 AND ws.set_type <> 'warmup') AS volume_kg,
         (SELECT COUNT(DISTINCT ws.exercise_id)
            FROM workout_sets ws
           WHERE ws.workout_id = w.id AND ws.deleted_at IS NULL
             AND ws.done = 1 AND ws.set_type <> 'warmup') AS exercise_count,
         (SELECT COUNT(*)
            FROM personal_records pr
           WHERE pr.workout_id = w.id AND pr.deleted_at IS NULL) AS record_count
  FROM workouts w
  LEFT JOIN sessions s ON s.id = w.session_id AND s.deleted_at IS NULL
  WHERE w.status = 'completed' AND w.deleted_at IS NULL
  ORDER BY w.finished_at DESC
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
    sessionId: row.session_id,
    programId: row.program_id,
    volumeKg: row.volume_kg ?? 0,
    sessionName: row.session_name ?? null,
    exerciseCount: row.exercise_count ?? 0,
    recordCount: row.record_count ?? 0,
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
 * de la base locale. Les séries sont lues par une seconde requête **indépendante**
 * (`SELECT_ACTIVE_SETS`), puis regroupées par exercice.
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

  // Les deux requêtes partent ENSEMBLE, dès le montage : les séries ne dépendent plus de l'id
  // rendu par la première (MUSCU-FIX02 — voir `SELECT_ACTIVE_SETS`). `isLoading` couvre donc
  // vraiment les deux premiers chargements, sans rendu intermédiaire « séance sans séries ».
  const { data: workoutRows, isLoading: workoutLoading } =
    useQuery<WorkoutDbRow>(SELECT_ACTIVE_WORKOUT);
  const { data: setRows, isLoading: setsLoading } = useQuery<WorkoutSetDbRow>(
    SELECT_ACTIVE_SETS,
    [lang],
  );

  const activeRow = workoutRows[0] ?? null;
  const isLoading = workoutLoading || setsLoading;

  if (!activeRow) {
    return { workout: null, isLoading };
  }

  // Les deux requêtes se rafraîchissent chacune à leur rythme : pendant un rendu, l'une peut
  // encore décrire la séance précédente. On ne garde que les séries de CETTE séance.
  const ownSetRows = setRows.filter((row) => row.workout_id === activeRow.id);

  const workout: ActiveWorkout = {
    id: activeRow.id,
    startedAt: activeRow.started_at,
    sessionId: activeRow.session_id,
    programId: activeRow.program_id,
    plannedSessionId: activeRow.planned_session_id ?? null,
    weekIndex: activeRow.week_index ?? null,
    entries: groupSetsByExercise(ownSetRows),
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

/** Ligne brute d'une série de la dernière performance (poids/reps + contexte de suggestion). */
type LastPerformanceDbRow = {
  /** Exercice de la ligne — sert à écarter une réponse périmée (voir `useLastPerformance`). */
  exercise_id: string;
  weight_kg: number | null;
  reps: number | null;
  set_type: string;
  rpe: number | null;
  duration_seconds: number | null;
};

/**
 * La n-ième séance terminée (0 = la dernière) où l'exercice a au moins une série qualifiante.
 * Consomme **un** `?` : l'exercice.
 *
 * ⚠️ MUSCU-FIX02 — **`GROUP BY` séance.** La jointure séances × séries rendait **une ligne par
 * série**, si bien que `OFFSET 1` sautait une série et non une séance. Avec trois séries de squat
 * la dernière fois, « l'avant-dernière séance » était la dernière, et le deload de MUSC-F7 partait
 * après **une** séance difficile au lieu de deux. On part des séries de l'exercice (index
 * `exercise_id`) plutôt que des séances : un `EXISTS` par séance balayait tout l'historique
 * (24 ms contre 0,5 ms à 200 séances, mesuré).
 */
const NTH_LAST_WORKOUT_WITH = (offset: 0 | 1) => `
  SELECT s2.workout_id FROM workout_sets s2
  JOIN workouts w2 ON w2.id = s2.workout_id AND w2.status = 'completed' AND w2.deleted_at IS NULL
  WHERE s2.exercise_id = ? AND s2.deleted_at IS NULL AND s2.done = 1 AND s2.set_type <> 'warmup'
  GROUP BY s2.workout_id
  ORDER BY MAX(w2.finished_at) DESC LIMIT 1 OFFSET ${offset}`;

/**
 * Séries validées d'un exercice dans la dernière séance terminée qui le
 * contient (deux paramètres = `exerciseId` répété : filtre des séries, puis
 * sélection de la séance la plus récente).
 */
export const SELECT_LAST_PERFORMANCE = `
  SELECT s.exercise_id, s.weight_kg, s.reps, s.set_type, s.rpe, s.duration_seconds
  FROM workout_sets s
  WHERE s.exercise_id = ? AND s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup'
    AND s.workout_id = (${NTH_LAST_WORKOUT_WITH(0)})
  ORDER BY s.order_index
`;

/**
 * Séries de la dernière séance terminée où l'exercice a été fait (vide si
 * jamais fait), triées par `order_index` — sert à pré-afficher la performance
 * précédente à l'écran de saisie.
 *
 * Quand `exerciseId` change, `useQuery` rend encore un instant les lignes de l'exercice
 * **précédent** : on les écarte, sinon le pré-remplissage afficherait la charge du squat sur un
 * curl — et une validation rapide l'enregistrerait (MUSCU-FIX02).
 */
export function useLastPerformance(
  exerciseId: string,
): {
  weightKg: number | null;
  reps: number | null;
  setType: SetType;
  rpe: number | null;
  durationSeconds: number | null;
}[] {
  const { data } = useQuery<LastPerformanceDbRow>(SELECT_LAST_PERFORMANCE, [
    exerciseId,
    exerciseId,
  ]);

  return data
    .filter((row) => row.exercise_id === exerciseId)
    .map((row) => ({
      weightKg: row.weight_kg,
      reps: row.reps,
      setType: row.set_type as SetType,
      rpe: row.rpe,
      durationSeconds: row.duration_seconds,
    }));
}

/**
 * Séries qualifiantes de l'**avant-dernière** séance terminée où l'exercice a été fait (US MUSC-F7) :
 * sert de signal `previousStruggled` pour `computeProgressionSuggestion` (kind `deload`, spec 3.8).
 */
export const SELECT_SECOND_LAST_PERFORMANCE = `
  SELECT s.exercise_id, s.set_type, s.rpe FROM workout_sets s
  WHERE s.exercise_id = ? AND s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup'
    AND s.workout_id = (${NTH_LAST_WORKOUT_WITH(1)})
`;

/**
 * Vrai si l'**avant-dernière** séance terminée sur `exerciseId` était difficile (échec ou
 * RPE ≥ 8) — US MUSC-F7. `false` s'il n'existe pas d'avant-dernière séance (moins de 2 séances
 * qualifiantes en historique) : pas de deload sans donnée suffisante pour l'établir.
 */
export function usePreviousStruggled(exerciseId: string): boolean {
  const { data } = useQuery<{ exercise_id: string; set_type: string; rpe: number | null }>(
    SELECT_SECOND_LAST_PERFORMANCE,
    [exerciseId, exerciseId],
  );
  return sessionStruggled(
    data
      .filter((row) => row.exercise_id === exerciseId)
      .map((row) => ({ setType: row.set_type, rpe: row.rpe })),
  );
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

  // Analytics : démarrage effectif d'une nouvelle séance (pas une reprise). Fire-and-forget.
  void track(ANALYTICS_EVENTS.workoutStarted);

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
export function parseTargetReps(target: string | null): number | null {
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

  // Analytics : démarrage effectif d'une nouvelle séance (pas une reprise). Fire-and-forget.
  void track(ANALYTICS_EVENTS.workoutStarted);

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

// ---------------------------------------------------------------------------
// Séance libre : on choisit quoi faire AVANT que la séance existe (MUSCU-FIX02, passe 1)
// ---------------------------------------------------------------------------
//
// « Séance libre » créait une séance **vide** au premier appui (`startWorkout`) : chrono lancé,
// écran noir, et « ajoute un exercice » pour tout programme — « pas intuitif, pas fluide »
// (Florian, recette du 23/09/2026). Les deux fonctions ci-dessous ne créent la séance qu'une fois
// son contenu choisi, déjà remplie, dans une seule transaction.

/** Séries créées pour un exercice jamais fait : le format le plus courant, ajustable en séance. */
const DEFAULT_FREE_SET_COUNT = 3;

/** Id de la séance active de l'utilisateur, s'il y en a une. */
async function activeWorkoutId(userId: string): Promise<string | null> {
  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM workouts
     WHERE user_id = ? AND status = 'active' AND deleted_at IS NULL
     LIMIT 1`,
    [userId],
  );
  return existing?.id ?? null;
}

/**
 * Compose une séance libre à partir d'exercices choisis, **dans l'ordre choisi**, et la démarre.
 *
 * Chaque exercice reçoit autant de séries qu'à sa dernière séance (séries de travail validées,
 * comme `SELECT_LAST_PERFORMANCE`), sinon `DEFAULT_FREE_SET_COUNT`. Les valeurs restent **nulles** :
 * l'écran de séance les pré-remplit déjà depuis la dernière performance, rang par rang — les
 * écrire ici figerait une valeur que l'écran sait mieux choisir.
 *
 * Une séance active existante est rendue telle quelle (au plus une séance active, comme
 * `startWorkout`) ; une liste vide est refusée : une séance vide est précisément ce qu'on évite.
 */
export async function startWorkoutWithExercises(exerciseIds: readonly string[]): Promise<string> {
  const ids = [...new Set(exerciseIds)];
  if (ids.length === 0) {
    throw new Error('Séance libre sans exercice : rien à démarrer.');
  }
  const userId = currentUserId();
  const existing = await activeWorkoutId(userId);
  if (existing) return existing;

  void track(ANALYTICS_EVENTS.workoutStarted);

  return powerSync.writeTransaction(async (tx) => {
    const workoutId = await txInsert(tx, 'workouts', {
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

    let orderIndex = 0;
    for (const exerciseId of ids) {
      const last = await tx.getOptional<{ count: number }>(
        `SELECT COUNT(*) AS count FROM workout_sets s
         WHERE s.exercise_id = ? AND s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup'
           AND s.workout_id = (${NTH_LAST_WORKOUT_WITH(0)})`,
        [exerciseId, exerciseId],
      );
      const count = last?.count && last.count > 0 ? last.count : DEFAULT_FREE_SET_COUNT;
      for (let i = 0; i < count; i++) {
        await txInsert(tx, 'workout_sets', {
          workout_id: workoutId,
          user_id: userId,
          exercise_id: exerciseId,
          order_index: orderIndex,
          set_type: 'normal',
          reps: null,
          weight_kg: null,
          duration_seconds: null,
          done: 0,
          planned_weight_kg: null,
        });
        orderIndex += 1;
      }
    }
    return workoutId;
  });
}

/**
 * Refait une séance passée : mêmes exercices, même ordre, mêmes types de série, mêmes charges et
 * répétitions en valeur de départ — rien de validé. La séance créée est **libre** (ni programme,
 * ni occurrence planifiée) : la rejouer ne doit ni compter dans l'exécution d'un programme, ni
 * cocher un jour du planning.
 *
 * Séance d'origine introuvable ou supprimée → erreur, rien n'est écrit (transaction).
 */
export async function startWorkoutFromWorkout(sourceWorkoutId: string): Promise<string> {
  const userId = currentUserId();
  const existing = await activeWorkoutId(userId);
  if (existing) return existing;

  return powerSync.writeTransaction(async (tx) => {
    const source = await tx.getOptional<{ id: string }>(
      `SELECT id FROM workouts WHERE id = ? AND status = 'completed' AND deleted_at IS NULL`,
      [sourceWorkoutId],
    );
    if (!source) {
      throw new Error('Séance à refaire introuvable : démarrage impossible.');
    }
    const sets = await tx.getAll<{
      exercise_id: string;
      set_type: string;
      reps: number | null;
      weight_kg: number | null;
      duration_seconds: number | null;
    }>(
      `SELECT exercise_id, set_type, reps, weight_kg, duration_seconds FROM workout_sets
       WHERE workout_id = ? AND deleted_at IS NULL
       ORDER BY order_index`,
      [sourceWorkoutId],
    );

    void track(ANALYTICS_EVENTS.workoutStarted);

    const workoutId = await txInsert(tx, 'workouts', {
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
    let orderIndex = 0;
    for (const set of sets) {
      await txInsert(tx, 'workout_sets', {
        workout_id: workoutId,
        user_id: userId,
        exercise_id: set.exercise_id,
        order_index: orderIndex,
        set_type: set.set_type,
        reps: set.reps,
        weight_kg: set.weight_kg,
        duration_seconds: set.duration_seconds,
        done: 0,
        planned_weight_kg: null,
      });
      orderIndex += 1;
    }
    return workoutId;
  });
}

/**
 * Annule une séance : passe son statut à `cancelled`, puis soft delete la séance
 * ET toutes ses séries (nettoyage complet côté local + synchro).
 *
 * **Une seule transaction** (MUSCU-FIX02) : l'annulation faisait une écriture par série — 26
 * pour une séance de 24 séries — et chacune relançait toutes les requêtes réactives montées
 * (hub, accueil, séance). « Abandonner » pouvait prendre plusieurs secondes, pendant lesquelles
 * l'écran annonçait « Aucune séance en cours ». Même forme que `deleteWorkout`.
 */
export async function cancelWorkout(id: string): Promise<void> {
  const now = nowUtc();
  await powerSync.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE workout_sets SET deleted_at = ?, updated_at = ?
       WHERE workout_id = ? AND deleted_at IS NULL`,
      [now, now, id],
    );
    await tx.execute(
      `UPDATE workouts SET status = 'cancelled', deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, id],
    );
  });
}

/**
 * Supprime une séance **terminée** (soft delete) — US MUSCU-UX01, règle R6-1.
 *
 * La spec `musculation.md` §6.1 promet « édition / suppression d'une séance passée » depuis le
 * 04/07/2026 ; aucune fonction ne l'implémentait. Une série validée par erreur, ou une séance
 * fantôme laissée ouverte puis clôturée automatiquement, restait donc dans l'historique — et dans
 * le volume, les records et le streak — sans aucun moyen de la retirer.
 *
 * Trois effets, dans une seule transaction, parce qu'ils sont indissociables :
 *  1. la séance et ses séries passent en `deleted_at` ;
 *  2. **ses records disparaissent** — un record adossé à une séance supprimée serait invérifiable,
 *     et continuerait de plafonner les suivants ;
 *  3. l'occurrence de planning liée **retourne en `planned`** : la séance n'a plus eu lieu, donc
 *     le calendrier ne doit plus la compter faite. Sans cela, le jour resterait marqué à vide.
 *
 * ⚠️ **Ce qui n'est pas fait** : le record *précédent* n'est pas rétabli. Retrouver le second
 * meilleur demanderait de rejouer tout l'historique de l'exercice ; c'est un cadrage à part, noté
 * hors périmètre dans la spec (§7). Le prochain dépassement recréera le record normalement.
 */
export async function deleteWorkout(id: string): Promise<void> {
  const now = nowUtc();
  await powerSync.writeTransaction(async (tx) => {
    // 1. Les séries, puis la séance.
    await tx.execute(
      `UPDATE workout_sets SET deleted_at = ?, updated_at = ?
       WHERE workout_id = ? AND deleted_at IS NULL`,
      [now, now, id],
    );
    await tx.execute(
      `UPDATE workouts SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      [now, now, id],
    );

    // 2. Les records nés de cette séance.
    await tx.execute(
      `UPDATE personal_records SET deleted_at = ?, updated_at = ?
       WHERE workout_id = ? AND deleted_at IS NULL`,
      [now, now, id],
    );

    // 3. L'occurrence de planning liée redevient à faire.
    await tx.execute(
      `UPDATE planned_sessions SET status = 'planned', completed_at = NULL, updated_at = ?
       WHERE id = (SELECT planned_session_id FROM workouts WHERE id = ?)
         AND deleted_at IS NULL`,
      [now, id],
    );
  });
}

/**
 * Termine une séance : calcule la durée à partir de `started_at`, passe le statut
 * à `completed`, pose `finished_at`, et enregistre RPE / notes si fournis.
 */
export async function finishWorkout(
  id: string,
  opts?: {
    rpe?: number | null;
    notes?: string | null;
    /**
     * Instant de clôture (ISO UTC) — défaut `nowUtc()`. Surchargé par la **clôture
     * automatique** d'une séance périmée, qui passe l'horodatage de la **dernière activité
     * réelle** pour ne pas gonfler la durée jusqu'à « maintenant » (cf. `autoCloseStaleWorkout`).
     */
    finishedAt?: string;
  },
): Promise<void> {
  const row = await powerSync.getOptional<{
    started_at: string;
    planned_session_id: string | null;
    status: string;
    deleted_at: string | null;
  }>(
    `SELECT started_at, planned_session_id, status, deleted_at FROM workouts WHERE id = ?`,
    [id],
  );

  // Garde d'idempotence (miroir de `finishRun`) : on ne clôture qu'une séance **active**
  // non supprimée. Séance introuvable / déjà `completed`/`cancelled` / supprimée → no-op
  // (un double-tap « Terminer » ne re-stampe pas `finished_at`/durée et ne ré-émet pas
  // `workout_completed`).
  if (!row || row.status !== 'active' || row.deleted_at !== null) {
    return;
  }

  const finishedAt = opts?.finishedAt ?? nowUtc();
  const durationSeconds = Math.max(
    0,
    Math.round((new Date(finishedAt).getTime() - new Date(row.started_at).getTime()) / 1000),
  );

  const columns: Record<string, unknown> = {
    status: 'completed',
    finished_at: finishedAt,
    duration_seconds: durationSeconds,
  };
  if (opts && 'rpe' in opts) columns['rpe'] = opts.rpe;
  if (opts && 'notes' in opts) columns['notes'] = opts.notes;

  await patch('workouts', id, columns);

  // Analytics : séance terminée. Fire-and-forget.
  void track(ANALYTICS_EVENTS.workoutCompleted);

  // US LAUNCHER-01 : rafraîchit le widget d'écran d'accueil (D5). Fire-and-forget.
  refreshHomeWidget();

  // Health Connect (US CONF-06) : écrit la séance dans le hub santé d'Android. Fire-and-forget,
  // comme `track` — le service est no-op si l'opt-in est OFF, les permissions absentes ou la
  // plateforme non Android, et il ne jette jamais : la clôture ne doit dépendre de rien de tout ça.
  void pushWorkout(id, i18n.t('settings.healthConnect.defaultWorkoutTitle'));

  // Best-effort : marque l'occurrence planifiée liée comme faite. Ne doit jamais
  // faire échouer la clôture de la séance (offline-first : la séance est déjà
  // close localement, cette étape est une synchronisation secondaire).
  if (row.planned_session_id) {
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
 * Clôture automatique d'une séance **périmée** (spec 3.37) : si une séance est encore `active`
 * depuis plus de `WORKOUT_AUTO_CLOSE_SECONDS` (3 h), on la termine — mais en datant la fin à la
 * **dernière activité réelle** (dernier `updated_at` de ses séries non supprimées, sinon `started_at`)
 * pour ne pas enregistrer une durée gonflée jusqu'à « maintenant » (sinon les stats/records/widgets de
 * temps seraient faussés). Idempotent (délègue à `finishWorkout`), best-effort (jamais bloquant).
 * Appelée **une fois au démarrage de l'app** — évite les séances « zombie » qui restent actives à vie
 * (le widget « Séance du jour » afficherait « Reprendre » indéfiniment et bloquerait un nouveau départ).
 */
export async function autoCloseStaleWorkout(): Promise<void> {
  try {
    const active = await powerSync.getOptional<{ id: string; started_at: string }>(
      `SELECT id, started_at FROM workouts
       WHERE status = 'active' AND deleted_at IS NULL
       ORDER BY started_at DESC LIMIT 1`,
    );
    if (!active || !isWorkoutStale(active.started_at, Date.now())) return;

    const lastAct = await powerSync.getOptional<{ ts: string | null }>(
      `SELECT MAX(updated_at) AS ts FROM workout_sets WHERE workout_id = ? AND deleted_at IS NULL`,
      [active.id],
    );
    await finishWorkout(active.id, { finishedAt: lastAct?.ts ?? active.started_at });
  } catch (error) {
    console.warn('Clôture auto de séance périmée ignorée (best-effort) :', error);
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

// ---------------------------------------------------------------------------
// Réorganisation des exercices (US Refonte-C3 §2.1/§4.3)
// ---------------------------------------------------------------------------

/** Ligne brute minimale pour dériver l'ordre courant des exercices d'une séance. */
type WorkoutSetOrderDbRow = {
  exercise_id: string;
  done: number;
  order_index: number;
};

/**
 * Groupe des séries (déjà triées par `order_index`) par exercice pour dériver
 * l'état `done` global de chaque exercice — `done = true` seulement si TOUTES
 * ses séries sont validées. Ordre des groupes = première apparition, en miroir
 * de `groupSetsByExercise`.
 */
function groupExerciseDoneState(
  rows: WorkoutSetOrderDbRow[],
): { exerciseId: string; done: boolean }[] {
  const order: string[] = [];
  const allDone = new Map<string, boolean>();

  for (const row of rows) {
    if (!allDone.has(row.exercise_id)) {
      order.push(row.exercise_id);
      allDone.set(row.exercise_id, true);
    }
    if (row.done !== 1) {
      allDone.set(row.exercise_id, false);
    }
  }

  return order.map((exerciseId) => ({ exerciseId, done: allDone.get(exerciseId) ?? false }));
}

/** Lit l'état courant (ordre + validation) des exercices d'une séance. */
async function readExerciseOrderState(
  workoutId: string,
): Promise<{ exerciseId: string; done: boolean }[]> {
  const rows = await powerSync.getAll<WorkoutSetOrderDbRow>(
    `SELECT exercise_id, done, order_index FROM workout_sets
     WHERE workout_id = ? AND deleted_at IS NULL
     ORDER BY order_index`,
    [workoutId],
  );
  return groupExerciseDoneState(rows);
}

/**
 * Renumérote intégralement les `order_index` des séries d'une séance suivant
 * l'ordre d'exercices fourni (`orderedExerciseIds`) : pour chaque exercice, dans
 * l'ordre du tableau, ses séries existantes gardent leur ordre relatif mais
 * reçoivent un `order_index` séquentiel qui continue de s'incrémenter d'un
 * exercice à l'autre (pas de remise à zéro). Opération atomique (transaction).
 */
async function renumberWorkout(
  workoutId: string,
  orderedExerciseIds: string[],
): Promise<void> {
  await powerSync.writeTransaction(async (tx) => {
    let cursor = 0;
    for (const exerciseId of orderedExerciseIds) {
      const setIds = await tx.getAll<{ id: string }>(
        `SELECT id FROM workout_sets
         WHERE workout_id = ? AND exercise_id = ? AND deleted_at IS NULL
         ORDER BY order_index`,
        [workoutId, exerciseId],
      );
      for (const { id } of setIds) {
        await tx.execute(`UPDATE workout_sets SET order_index = ? WHERE id = ?`, [
          cursor,
          id,
        ]);
        cursor += 1;
      }
    }
  });
}

/**
 * Échange la position d'un exercice avec son voisin (`direction`) parmi les
 * exercices non validés de la séance ; les exercices déjà validés gardent leur
 * position absolue (voir `computeReorderedExerciseOrder`).
 */
export async function reorderExercise(
  workoutId: string,
  exerciseId: string,
  direction: 'up' | 'down',
): Promise<void> {
  const exercises = await readExerciseOrderState(workoutId);
  const operation: ReorderOperation = { type: 'swap', exerciseId, direction };
  const orderedIds = computeReorderedExerciseOrder(exercises, operation);
  await renumberWorkout(workoutId, orderedIds);
}

/**
 * Envoie un exercice en fin de séance, parmi les exercices non validés ; les
 * exercices déjà validés gardent leur position absolue.
 */
export async function sendExerciseToEnd(
  workoutId: string,
  exerciseId: string,
): Promise<void> {
  const exercises = await readExerciseOrderState(workoutId);
  const operation: ReorderOperation = { type: 'toEnd', exerciseId };
  const orderedIds = computeReorderedExerciseOrder(exercises, operation);
  await renumberWorkout(workoutId, orderedIds);
}

// ---------------------------------------------------------------------------
// Remplacement d'un exercice (US Refonte-C3)
// ---------------------------------------------------------------------------

/**
 * Remplace un exercice par un autre au sein d'une séance, mais UNIQUEMENT sur
 * les séries pas encore validées (`done = 0`) : les séries déjà validées gardent
 * l'exercice d'origine pour ne pas réécrire l'historique (garde métier).
 */
export async function replaceExercise(
  workoutId: string,
  exerciseId: string,
  newExerciseId: string,
): Promise<void> {
  await powerSync.execute(
    `UPDATE workout_sets SET exercise_id = ?, updated_at = ?
     WHERE workout_id = ? AND exercise_id = ? AND done = 0 AND deleted_at IS NULL`,
    [newExerciseId, nowUtc(), workoutId, exerciseId],
  );
}

// ---------------------------------------------------------------------------
// Note par exercice (table `exercise_notes`, US Refonte-C3)
// ---------------------------------------------------------------------------

/** Ligne brute d'une note d'exercice. */
type ExerciseNoteDbRow = {
  exercise_id: string;
  note: string | null;
};

/**
 * Note personnelle de l'utilisateur courant sur un exercice (ou `null` si
 * aucune note), réactive aux changements de la base locale.
 *
 * La ligne porte son exercice : au passage d'un exercice à l'autre, `useQuery` rend encore un
 * instant la note du **précédent**, et un simple focus/blur du champ l'aurait recopiée sur le
 * suivant (MUSCU-FIX02).
 */
export function useExerciseNote(exerciseId: string): {
  note: string | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery<ExerciseNoteDbRow>(
    'SELECT exercise_id, note FROM exercise_notes WHERE exercise_id = ? AND deleted_at IS NULL LIMIT 1',
    [exerciseId],
  );

  const row = data[0];
  return { note: row && row.exercise_id === exerciseId ? row.note : null, isLoading };
}

/** Ligne brute pour la map complète des notes (toutes, utilisateur courant). */
type ExerciseNoteRow = { exercise_id: string; note: string | null };

/**
 * Toutes les notes d'exercice de l'utilisateur courant, sous forme de map
 * `exerciseId → note`. Sert à afficher la note en lecture pour CHAQUE exercice
 * de la liste de séance sans appeler un hook par exercice (règle des hooks —
 * le nombre d'exercices varie). La table `exercise_notes` est naturellement
 * petite (une ligne par exercice noté, par utilisateur).
 */
export function useExerciseNotes(): Record<string, string | null> {
  const { data } = useQuery<ExerciseNoteRow>(
    'SELECT exercise_id, note FROM exercise_notes WHERE deleted_at IS NULL',
  );
  const map: Record<string, string | null> = {};
  for (const row of data) map[row.exercise_id] = row.note;
  return map;
}

/**
 * Écrit (ou met à jour) la note de l'utilisateur courant sur un exercice.
 * Une note vide/blanche est normalisée en `null` (mais la ligne n'est jamais
 * soft-deleted : `note = null` est une valeur valide en base).
 */
export async function setExerciseNote(
  exerciseId: string,
  note: string | null,
): Promise<void> {
  const trimmed = note?.trim();
  const value = trimmed && trimmed.length > 0 ? trimmed : null;

  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM exercise_notes WHERE user_id = ? AND exercise_id = ? AND deleted_at IS NULL`,
    [currentUserId(), exerciseId],
  );

  if (existing) {
    await patch('exercise_notes', existing.id, { note: value });
  } else {
    await insertWithSyncFields('exercise_notes', {
      user_id: currentUserId(),
      exercise_id: exerciseId,
      note: value,
    });
  }
}

// ---------------------------------------------------------------------------
// Liaison superset (table `workout_superset_pairs`, US Refonte-C3 révisée)
// ---------------------------------------------------------------------------
//
// Révision recette (20/07/2026) : le mécanisme initial (adjacence + même rang,
// déduit du seul `set_type`) obligeait les 2 exercices à être voisins dans la
// liste — jugé trop contraignant par Florian. Remplacé par un lien EXPLICITE,
// choisi librement par l'utilisateur (n'importe quel exercice de la séance),
// valable pour toute la séance (tous les rangs suivants, pas juste la série en
// cours). `set_type = 'superset'` (C2) n'est plus utilisé comme signal de
// liaison — laissé en place dans l'enum, simplement inerte pour ce mécanisme.

/** Ligne brute d'une paire superset. */
type SupersetPairRow = { exercise_id_a: string; exercise_id_b: string };

/**
 * Paires superset actives de la séance, sous forme de map BIDIRECTIONNELLE
 * `exerciseId → exerciseId du partenaire` (si A↔B, la map contient à la fois
 * `map[A]=B` et `map[B]=A`). Au plus une paire par exercice à la fois (pas de
 * circuits à 3+, cf. spec) — garanti par `linkSupersetPair`.
 */
export function useSupersetPairs(workoutId: string): Record<string, string> {
  const { data } = useQuery<SupersetPairRow>(
    'SELECT exercise_id_a, exercise_id_b FROM workout_superset_pairs WHERE workout_id = ? AND deleted_at IS NULL',
    [workoutId],
  );
  const map: Record<string, string> = {};
  for (const row of data) {
    map[row.exercise_id_a] = row.exercise_id_b;
    map[row.exercise_id_b] = row.exercise_id_a;
  }
  return map;
}

/**
 * Lie deux exercices en superset pour toute la séance. Un exercice ne pouvant
 * être lié qu'à un seul partenaire à la fois (pas de circuits), toute paire
 * existante impliquant `exerciseIdA` OU `exerciseIdB` est d'abord rompue
 * (soft delete) avant de créer la nouvelle paire — transaction atomique.
 */
export async function linkSupersetPair(
  workoutId: string,
  exerciseIdA: string,
  exerciseIdB: string,
): Promise<void> {
  const userId = currentUserId();
  await powerSync.writeTransaction(async (tx) => {
    const existing = await tx.getAll<{ id: string }>(
      `SELECT id FROM workout_superset_pairs
       WHERE workout_id = ? AND deleted_at IS NULL
         AND (exercise_id_a IN (?, ?) OR exercise_id_b IN (?, ?))`,
      [workoutId, exerciseIdA, exerciseIdB, exerciseIdA, exerciseIdB],
    );
    const now = nowUtc();
    for (const row of existing) {
      await tx.execute(
        `UPDATE workout_superset_pairs SET deleted_at = ?, updated_at = ? WHERE id = ?`,
        [now, now, row.id],
      );
    }
    await tx.execute(
      `INSERT INTO workout_superset_pairs
         (id, user_id, workout_id, exercise_id_a, exercise_id_b, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
      [generateId(), userId, workoutId, exerciseIdA, exerciseIdB, now, now],
    );
  });
}

/** Rompt la paire superset (s'il y en a une) impliquant cet exercice, pour cette séance. */
export async function unlinkSupersetPair(workoutId: string, exerciseId: string): Promise<void> {
  const now = nowUtc();
  await powerSync.execute(
    `UPDATE workout_superset_pairs SET deleted_at = ?, updated_at = ?
     WHERE workout_id = ? AND deleted_at IS NULL AND (exercise_id_a = ? OR exercise_id_b = ?)`,
    [now, now, workoutId, exerciseId, exerciseId],
  );
}

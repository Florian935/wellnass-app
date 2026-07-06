/**
 * Repository des records personnels muscu (table `personal_records`) et des
 * agrégats de progression / volume dérivés de l'historique des séances.
 *
 * Responsabilité unique : lire/écrire la table locale PowerSync `personal_records`,
 * évaluer les records d'une séance à sa clôture, et exposer des vues prêtes pour
 * l'UI (records battus d'une séance, meilleurs records par exercice, séries
 * temporelles de progression, volume par groupe musculaire, détail d'une séance).
 *
 * Modèle de données (voir docs/specs/technical/schema-donnees-muscu.md §4.4 et
 * supabase/migrations/20260706140000_personal_records.sql) :
 *  - `personal_records` : une ligne par record battu ; `(user_id, exercise_id, type)`
 *    identifie une famille de records, `value` la valeur atteinte, `workout_id` la
 *    séance qui l'a produit, `achieved_at` l'horodatage UTC de réalisation.
 *
 * Trois types de records (voir `RECORD_TYPES` dans `@wellness/shared`) :
 *  - `max_weight`    : charge maximale d'une série.
 *  - `estimated_1rm` : 1RM estimé (Epley).
 *  - `best_volume`   : meilleur volume d'une seule série (reps × charge).
 *
 * Règles offline-first (voir docs/specs/technical/offline-sync.md) :
 *  - UUID généré côté client (via `txInsert`).
 *  - Timestamps en UTC ; suppression = soft delete (jamais de hard delete client).
 *  - `user_id` = utilisateur de la session courante à l'écriture.
 *
 * ⚠️ Bornes temporelles : toutes les colonnes de dates sont des timestamps UTC ISO.
 * Les bornes « depuis lundi » / « N derniers jours » sont calculées en JS (fuseau
 * local pour le lundi) puis converties en ISO UTC et passées en paramètre lié — on
 * ne fait jamais de comparaison `date()` SQL sur des valeurs UTC.
 */

import { useQuery } from '@powersync/react';
import {
  computeVolume,
  computeWorkoutRecords,
  type MuscleGroup,
  type RecordType,
} from '@wellness/shared';
import { useTranslation } from 'react-i18next';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { getAppLanguage } from '@/i18n';
import { generateId } from '@/lib/id';
import { nowUtc } from './_sql';
import {
  getWorkoutSets,
  type WorkoutEntry,
  type WorkoutSetItem,
} from './workout-repository';

// ---------------------------------------------------------------------------
// Types de domaine exposés à l'UI
// ---------------------------------------------------------------------------

/** Un record (battu ou courant) rattaché à un exercice, prêt pour l'UI. */
export type BeatenRecord = {
  exerciseId: string;
  exerciseName: string;
  type: RecordType;
  value: number;
  reps: number | null;
  weightKg: number | null;
  achievedAt: string;
};

/** Métrique d'une série temporelle de progression. */
export type ProgressionMetric = 'max_weight' | 'volume';

/** Période d'une série temporelle de progression. */
export type ProgressionPeriod = '30d' | '90d' | '1y';

/** Un point d'une série temporelle (date UTC ISO + valeur). */
export type ProgressionPoint = {
  date: string;
  value: number;
};

/** Volume hebdomadaire agrégé par groupe musculaire. */
export type MuscleVolume = {
  muscle: MuscleGroup;
  volume: number;
};

/** Détail complet d'une séance terminée, prêt pour l'écran d'historique. */
export type WorkoutDetail = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
  rpe: number | null;
  notes: string | null;
  volume: number;
  entries: WorkoutEntry[];
};

// ---------------------------------------------------------------------------
// Lignes brutes SQLite (colonnes snake_case)
// ---------------------------------------------------------------------------

/** Ligne brute d'un record avec nom d'exercice résolu (langue courante → fr). */
type RecordDbRow = {
  exercise_id: string;
  type: string;
  value: number;
  reps: number | null;
  weight_kg: number | null;
  achieved_at: string;
  /** Nom résolu par COALESCE(langue courante, fr) — peut être null si aucune traduction. */
  exercise_name: string | null;
};

/** Ligne brute d'une séance terminée (entête). */
type WorkoutHeaderDbRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  rpe: number | null;
  notes: string | null;
};

// ---------------------------------------------------------------------------
// Requêtes SQL (noms de tables/colonnes statiques ; valeurs liées via ?)
// ---------------------------------------------------------------------------

/**
 * Records d'une séance donnée, avec nom d'exercice résolu (langue courante → fr).
 * Premier `?` = langue courante ; second `?` = id de la séance.
 * Utilisé par `useWorkoutRecords` (résumé de fin de séance).
 */
const SELECT_RECORDS_FOR_WORKOUT = `
  SELECT r.exercise_id, r.type, r.value, r.reps, r.weight_kg, r.achieved_at,
         COALESCE(tl.name, tfr.name) AS exercise_name
  FROM personal_records r
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = r.exercise_id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = r.exercise_id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE r.workout_id = ? AND r.deleted_at IS NULL
  ORDER BY r.type
`;

/**
 * Meilleur record par type pour un exercice donné : la ligne de valeur maximale
 * de chaque `(exercise_id, type)`. Premier `?` = langue courante ; second `?` = exercice.
 *
 * On sélectionne, pour chaque type, la ligne dont la `value` égale le max du type
 * (sous-requête corrélée) ; `LIMIT`-libre car un seul max par type en pratique — le
 * `GROUP BY type` garantit au plus une ligne par type.
 */
const SELECT_BEST_RECORDS_FOR_EXERCISE = `
  SELECT r.exercise_id, r.type, MAX(r.value) AS value,
         NULL AS reps, NULL AS weight_kg,
         MAX(r.achieved_at) AS achieved_at,
         COALESCE(tl.name, tfr.name) AS exercise_name
  FROM personal_records r
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = r.exercise_id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = r.exercise_id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE r.exercise_id = ? AND r.deleted_at IS NULL
  GROUP BY r.type
  ORDER BY r.type
`;

/**
 * Séance terminée (entête). Premier `?` = id de la séance.
 * Le statut `completed` garantit une séance close.
 */
const SELECT_WORKOUT_HEADER = `
  SELECT id, started_at, finished_at, duration_seconds, rpe, notes
  FROM workouts
  WHERE id = ? AND status = 'completed' AND deleted_at IS NULL
  LIMIT 1
`;

/**
 * Séries d'une séance donnée, avec nom d'exercice résolu (langue courante → fr).
 * Premier `?` = langue courante ; second `?` = id de la séance. Tri par `order_index`
 * (ordre de saisie / première apparition des exercices lors du regroupement).
 * Réplique la requête `SELECT_SETS_FOR_WORKOUT` du workout-repository (file-private).
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

/** Ligne brute d'une série (nom d'exercice résolu), pour le regroupement du détail. */
type WorkoutSetDbRow = {
  id: string;
  exercise_id: string;
  order_index: number;
  set_type: string;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  done: number;
  exercise_name: string | null;
};

// ---------------------------------------------------------------------------
// Mapping snake_case ↔ camelCase
// ---------------------------------------------------------------------------

/** Convertit une ligne record SQLite → record de domaine (camelCase). */
function rowToBeatenRecord(row: RecordDbRow): BeatenRecord {
  return {
    exerciseId: row.exercise_id,
    // Repli ultime : chaîne vide si aucune traduction (ne devrait pas arriver).
    exerciseName: row.exercise_name ?? '',
    type: row.type as RecordType,
    value: row.value,
    reps: row.reps,
    weightKg: row.weight_kg,
    achievedAt: row.achieved_at,
  };
}

/** Convertit une ligne série SQLite → item de domaine (camelCase). */
function rowToSetItem(row: WorkoutSetDbRow): WorkoutSetItem {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    setType: row.set_type as WorkoutSetItem['setType'],
    reps: row.reps,
    weightKg: row.weight_kg,
    durationSeconds: row.duration_seconds,
    done: row.done === 1,
    orderIndex: row.order_index,
  };
}

/**
 * Regroupe des lignes séries (déjà triées par `order_index`) par exercice.
 * L'ordre des groupes suit la première apparition de chaque exercice ; l'ordre
 * des séries au sein d'un groupe est préservé. Réplique la logique du
 * workout-repository (file-private).
 */
function groupSetsByExercise(rows: WorkoutSetDbRow[]): WorkoutEntry[] {
  const entries: WorkoutEntry[] = [];
  const byExercise = new Map<string, WorkoutEntry>();

  for (const row of rows) {
    let entry = byExercise.get(row.exercise_id);
    if (!entry) {
      entry = {
        exerciseId: row.exercise_id,
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
// Bornes temporelles (calculées en JS → ISO UTC, jamais en SQL sur de l'UTC)
// ---------------------------------------------------------------------------

/** Nombre de jours d'une période de progression. */
const PERIOD_DAYS: Record<ProgressionPeriod, number> = {
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

/** Borne basse ISO UTC d'une période « N derniers jours » (now − N jours). */
function periodLowerBound(period: ProgressionPeriod): string {
  const days = PERIOD_DAYS[period];
  const bound = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return bound.toISOString();
}

/**
 * Borne « lundi 00:00 heure locale » de la semaine courante, convertie en ISO UTC.
 *
 * On raisonne en heure locale pour déterminer le début de semaine perçu par
 * l'utilisateur (lundi), puis on convertit en UTC pour comparer aux `finished_at`
 * (stockés en UTC). `getDay()` : dimanche = 0 → on ramène à 6 jours d'écart.
 */
function startOfWeekLocalUtc(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = dimanche … 6 = samedi (heure locale)
  const daysSinceMonday = (day + 6) % 7;
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysSinceMonday,
    0,
    0,
    0,
    0,
  );
  return monday.toISOString();
}

// ---------------------------------------------------------------------------
// Écritures / évaluation (hors contexte hook)
// ---------------------------------------------------------------------------

/** Identifiant de l'utilisateur de la session courante (lève si déconnecté). */
function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    throw new Error("Aucune session active : impossible d'écrire un record.");
  }
  return userId;
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
 * Évalue les records d'une séance terminée et insère les records battus.
 *
 * Déroulé :
 *  1. lit les séries de la séance (`getWorkoutSets`, nom résolu inclus) ;
 *  2. les regroupe par exercice et appelle `computeWorkoutRecords` (ne considère
 *     que les séries validées non-échauffement, un candidat par (exercice, type)) ;
 *  3. dans une transaction atomique, pour chaque candidat, lit le meilleur `value`
 *     courant de l'utilisateur pour ce `(exercise_id, type)` ; si le candidat est
 *     **strictement supérieur** (ou s'il n'existe aucun record), insère une nouvelle
 *     ligne `personal_records`.
 *
 * Retourne la liste des records battus (avec nom d'exercice résolu) — consommée
 * par le résumé de fin de séance.
 */
export async function evaluateWorkoutRecords(
  workoutId: string,
): Promise<BeatenRecord[]> {
  const userId = currentUserId();
  const lang = getAppLanguage();

  const sets = await getWorkoutSets(workoutId);

  // Regroupement par exercice (nom résolu conservé pour l'affichage des records).
  const byExercise = new Map<
    string,
    { exerciseName: string; sets: WorkoutSetItem[] }
  >();
  const nameById = new Map<string, string>();
  for (const set of sets) {
    let group = byExercise.get(set.exerciseId);
    if (!group) {
      group = { exerciseName: '', sets: [] };
      byExercise.set(set.exerciseId, group);
    }
    group.sets.push(set);
  }

  // Résolution du nom d'exercice (langue courante → fr) pour les records battus.
  for (const exerciseId of byExercise.keys()) {
    const row = await powerSync.getOptional<{ name: string | null }>(
      `SELECT COALESCE(tl.name, tfr.name) AS name
       FROM exercises e
       LEFT JOIN exercise_translations tl  ON tl.exercise_id = e.id AND tl.lang = ?      AND tl.deleted_at IS NULL
       LEFT JOIN exercise_translations tfr ON tfr.exercise_id = e.id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
       WHERE e.id = ? AND e.deleted_at IS NULL
       LIMIT 1`,
      [lang, exerciseId],
    );
    nameById.set(exerciseId, row?.name ?? '');
  }

  const candidates = computeWorkoutRecords(
    [...byExercise.entries()].map(([exerciseId, group]) => ({
      exerciseId,
      sets: group.sets,
    })),
  );

  const beaten: BeatenRecord[] = [];
  const achievedAt = nowUtc();

  await powerSync.writeTransaction(async (tx) => {
    for (const candidate of candidates) {
      const current = await tx.getOptional<{ best: number | null }>(
        `SELECT MAX(value) AS best FROM personal_records
         WHERE user_id = ? AND exercise_id = ? AND type = ? AND deleted_at IS NULL`,
        [userId, candidate.exerciseId, candidate.type],
      );
      const best = current?.best;
      const isNewRecord =
        best === null || best === undefined || candidate.value > best;
      if (!isNewRecord) {
        continue;
      }

      await txInsert(tx, 'personal_records', {
        user_id: userId,
        exercise_id: candidate.exerciseId,
        type: candidate.type,
        value: candidate.value,
        reps: candidate.reps,
        weight_kg: candidate.weightKg,
        workout_id: workoutId,
        achieved_at: achievedAt,
      });

      beaten.push({
        exerciseId: candidate.exerciseId,
        exerciseName: nameById.get(candidate.exerciseId) ?? '',
        type: candidate.type,
        value: candidate.value,
        reps: candidate.reps,
        weightKg: candidate.weightKg,
        achievedAt,
      });
    }
  });

  return beaten;
}

// ---------------------------------------------------------------------------
// Lecture réactive (hooks)
// ---------------------------------------------------------------------------

/**
 * Records battus lors d'une séance donnée, réactifs (filtre sur `workout_id`).
 * C'est la source d'affichage des records dans le résumé — jamais via l'état
 * du routeur. `isLoading` ne dépend que de la résolution de la requête locale.
 */
export function useWorkoutRecords(workoutId: string): {
  records: BeatenRecord[];
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const { data, isLoading: queryLoading } = useQuery<RecordDbRow>(
    SELECT_RECORDS_FOR_WORKOUT,
    [lang, workoutId],
  );

  const isLoading = queryLoading;
  const records = data.map(rowToBeatenRecord);

  return { records, isLoading };
}

/**
 * Meilleur record courant par type pour un exercice donné (max `value` par type),
 * réactif. `reps` / `weightKg` ne sont pas restitués ici (agrégat par type).
 */
export function useExerciseRecords(exerciseId: string): {
  records: BeatenRecord[];
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const { data, isLoading: queryLoading } = useQuery<RecordDbRow>(
    SELECT_BEST_RECORDS_FOR_EXERCISE,
    [lang, exerciseId],
  );

  const isLoading = queryLoading;
  const records = data.map(rowToBeatenRecord);

  return { records, isLoading };
}

/**
 * Série temporelle de progression d'un exercice pour l'affichage de courbes.
 *
 * - `max_weight` : records `max_weight` de l'exercice, ordonnés par `achieved_at`,
 *   sur la période — chaque point = un record battu (charge max).
 * - `volume`     : pour chaque séance terminée de l'utilisateur sur la période
 *   contenant l'exercice, somme `reps × weight_kg` des séries validées non-échauffement
 *   de cet exercice ; date du point = `finished_at` de la séance.
 *
 * La borne basse de la période est un timestamp UTC calculé en JS (now − N jours)
 * et passé en paramètre lié.
 */
export function useExerciseProgression(
  exerciseId: string,
  metric: ProgressionMetric,
  period: ProgressionPeriod,
): { points: ProgressionPoint[]; isLoading: boolean } {
  const lowerBound = periodLowerBound(period);

  const isVolume = metric === 'volume';

  // Deux requêtes statiques ; on choisit le SQL et les params selon la métrique.
  // La requête « inactive » est neutralisée par une borne qui ne matche rien
  // (impossible ici) — on préfère lier un id vide pour l'exclure proprement.
  const maxWeightSql = `
    SELECT achieved_at AS date, value
    FROM personal_records
    WHERE exercise_id = ? AND type = 'max_weight'
      AND achieved_at >= ? AND deleted_at IS NULL
    ORDER BY achieved_at
  `;

  const volumeSql = `
    SELECT w.finished_at AS date,
           SUM(s.reps * s.weight_kg) AS value
    FROM workout_sets s
    JOIN workouts w ON w.id = s.workout_id
      AND w.status = 'completed' AND w.deleted_at IS NULL
    WHERE s.exercise_id = ? AND s.deleted_at IS NULL
      AND s.done = 1 AND s.set_type <> 'warmup'
      AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
      AND w.finished_at >= ?
    GROUP BY s.workout_id, w.finished_at
    ORDER BY w.finished_at
  `;

  const sql = isVolume ? volumeSql : maxWeightSql;

  const { data, isLoading: queryLoading } = useQuery<{
    date: string | null;
    value: number | null;
  }>(sql, [exerciseId, lowerBound]);

  const isLoading = queryLoading;
  const points: ProgressionPoint[] = data
    .filter(
      (row): row is { date: string; value: number } =>
        row.date != null && row.value != null,
    )
    .map((row) => ({ date: row.date, value: row.value }));

  return { points, isLoading };
}

/**
 * Volume par groupe musculaire sur la semaine courante (depuis lundi 00:00 local).
 *
 * Joint `workout_sets` → `exercises.muscle_primary`, somme `reps × weight_kg` des
 * séries validées non-échauffement des séances terminées dont `finished_at` est
 * postérieur au lundi local (converti en ISO UTC, passé en paramètre lié), regroupe
 * par `muscle_primary`.
 */
export function useMuscleVolumeThisWeek(): {
  volumes: MuscleVolume[];
  isLoading: boolean;
} {
  const weekStart = startOfWeekLocalUtc();

  const sql = `
    SELECT e.muscle_primary AS muscle,
           SUM(s.reps * s.weight_kg) AS volume
    FROM workout_sets s
    JOIN workouts w  ON w.id = s.workout_id
      AND w.status = 'completed' AND w.deleted_at IS NULL
    JOIN exercises e ON e.id = s.exercise_id AND e.deleted_at IS NULL
    WHERE s.deleted_at IS NULL
      AND s.done = 1 AND s.set_type <> 'warmup'
      AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
      AND w.finished_at >= ?
    GROUP BY e.muscle_primary
  `;

  const { data, isLoading: queryLoading } = useQuery<{
    muscle: string;
    volume: number | null;
  }>(sql, [weekStart]);

  const isLoading = queryLoading;
  const volumes: MuscleVolume[] = data.map((row) => ({
    muscle: row.muscle as MuscleGroup,
    volume: row.volume ?? 0,
  }));

  return { volumes, isLoading };
}

/**
 * Détail complet d'une séance terminée (entête + séries regroupées par exercice +
 * volume calculé), réactif. Les noms d'exercice sont résolus dans la langue
 * applicative. Deux requêtes toujours appelées (règle des hooks) : quand
 * `workoutId` est vide/inconnu, elles renvoient des résultats vides.
 */
export function useWorkoutDetail(workoutId: string): {
  detail: WorkoutDetail | null;
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const { data: headerRows, isLoading: headerLoading } =
    useQuery<WorkoutHeaderDbRow>(SELECT_WORKOUT_HEADER, [workoutId]);
  const { data: setRows, isLoading: setsLoading } = useQuery<WorkoutSetDbRow>(
    SELECT_SETS_FOR_WORKOUT,
    [lang, workoutId],
  );

  const isLoading = headerLoading || setsLoading;

  const header = headerRows[0];
  if (!header) {
    return { detail: null, isLoading };
  }

  const entries = groupSetsByExercise(setRows);
  const volume = computeVolume(
    setRows.map((row) => ({
      setType: row.set_type,
      reps: row.reps,
      weightKg: row.weight_kg,
      done: row.done === 1,
    })),
  );

  const detail: WorkoutDetail = {
    id: header.id,
    startedAt: header.started_at,
    finishedAt: header.finished_at,
    durationSeconds: header.duration_seconds,
    rpe: header.rpe,
    notes: header.notes,
    volume,
    entries,
  };

  return { detail, isLoading };
}

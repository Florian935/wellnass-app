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

import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import {
  computeMuscleBalance,
  computeVolume,
  computeWeeklyTrainingNutrition,
  computeWorkoutRecords,
  localDayKey,
  localMidnightDaysAgo,
  localStartOfYear,
  rollingWeekStarts,
  ROLLING_WEEK_DAYS,
  resolveActivePillars,
  pickOneRepMax,
  resolveRepBucketRecords,
  sessionBestEstimated1RM,
  type OneRepMaxSample,
  type MuscleBalance,
  type MuscleGroup,
  type RecordType,
  type RepBucketRecord,
  type WeeklyTrainingNutrition,
  computeExecutionCompliance,
  computeSessionDuration,
  computeSetTypeMix,
  findNeglectedExercises,
  type ComplianceResult,
  type CompliancePlannedSet,
  type DurationResult,
  type SetTypeShare,
  type NeglectedExercise,
  type FavoriteExercise,
} from '@wellness/shared';
import { useTranslation } from 'react-i18next';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { getAppLanguage } from '@/i18n';
import { generateId } from '@/lib/id';
import { nowUtc } from './_sql';
import { useDailyTotals } from './journal-repository';
import { useSettings } from './settings-repository';
import {
  getWorkoutSets,
  type WorkoutEntry,
  type WorkoutSetItem,
} from './workout-repository';
import { useTodayDate, useTodayKey, useWindowStartUtc } from '@/hooks/useTodayKey';

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
export type ProgressionMetric = 'max_weight' | 'volume' | 'estimated_1rm';

/** Période d'une série temporelle de progression. */
export type ProgressionPeriod = '30d' | '90d' | '1y' | 'all';

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
         s.duration_seconds, s.done, s.rpe, s.planned_weight_kg,
         COALESCE(tl.name, tfr.name) AS exercise_name
  FROM workout_sets s
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = s.exercise_id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = s.exercise_id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE s.workout_id = ? AND s.deleted_at IS NULL
  ORDER BY s.order_index
`;

/**
 * 1RM « réel » d'un exercice : charge max d'une série réellement effectuée à
 * 1 répétition (validée, hors échauffement/durée), + la date de la séance qui
 * la détient. `?` = id de l'exercice. `null` si aucune telle série.
 */
const SELECT_EXERCISE_TOP_SINGLE = `
  SELECT s.weight_kg AS value, w.finished_at AS achieved_at
  FROM workout_sets s
  JOIN workouts w ON w.id = s.workout_id AND w.status = 'completed' AND w.deleted_at IS NULL AND w.finished_at IS NOT NULL
  WHERE s.exercise_id = ?
    AND s.deleted_at IS NULL
    AND s.done = 1
    AND s.reps = 1
    AND s.weight_kg IS NOT NULL
    AND s.set_type NOT IN ('warmup','duration')
  ORDER BY s.weight_kg DESC, w.finished_at DESC
  LIMIT 1
`;

/**
 * Toutes les séries éligibles d'un exercice (reps + charge + date de séance), tous temps —
 * US MUSC-09. Même éligibilité que le reste du système de records (spec R3), **sans** filtre sur
 * `reps` : le bucketing par plage se fait en JS (`resolveRepBucketRecords`).
 */
const SELECT_EXERCISE_SETS_FOR_REP_BUCKETS = `
  SELECT s.reps AS reps, s.weight_kg AS weight_kg, w.finished_at AS achieved_at
  FROM workout_sets s
  JOIN workouts w ON w.id = s.workout_id AND w.status = 'completed' AND w.deleted_at IS NULL AND w.finished_at IS NOT NULL
  WHERE s.exercise_id = ?
    AND s.deleted_at IS NULL
    AND s.done = 1
    AND s.reps IS NOT NULL
    AND s.weight_kg IS NOT NULL
    AND s.set_type NOT IN ('warmup','duration')
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
  rpe: number | null;
  planned_weight_kg: number | null;
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
    rpe: row.rpe,
    plannedWeightKg: row.planned_weight_kg,
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

/** Nombre de jours d'une période de progression bornée (hors « tout »). */
const PERIOD_DAYS: Record<Exclude<ProgressionPeriod, 'all'>, number> = {
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

/**
 * Borne basse ISO UTC d'une période de progression.
 * - `all` : « depuis toujours » → epoch (1970-01-01T00:00:00.000Z).
 * - autres : « N derniers jours » (now − N jours).
 */
function periodLowerBound(period: ProgressionPeriod, ref: Date): string {
  if (period === 'all') {
    return new Date(0).toISOString();
  }
  const days = PERIOD_DAYS[period];
  const bound = new Date(ref.getTime() - days * 24 * 60 * 60 * 1000);
  return bound.toISOString();
}

/**
 * Borne basse ISO UTC d'une fenêtre glissante de `days` jours, à partir de `ref`.
 *
 * ⚠️ `ref` est **injectée** et non lue de l'horloge. Le commentaire précédent affirmait qu'extraire
 * l'appel dans une fonction dédiée suffisait à « respecter la règle de pureté du rendu » : c'est
 * faux sous React Compiler, qui mémoïse **l'appel** dans un slot mount-only quand ses arguments ne
 * sont pas réactifs. La fenêtre cessait donc de glisser.
 *
 * ⚠️ **Changement de comportement assumé** : la borne était calculée depuis l'**instant** courant
 * (`Date.now()`), elle l'est désormais depuis **minuit local** du jour de `ref`. La fenêtre est donc
 * jour-alignée, comme `rollingWeekStartLocalUtc` et comme toutes les autres fenêtres du dépôt
 * (`localMidnightDaysAgo`, `ROLLING_WEEK_DAYS - 1`). C'était l'outlier ; une borne à l'instant
 * faisait bouger les stats au fil de la journée.
 */
function rollingWindowLowerBound(days: number, ref: Date): string {
  return new Date(ref.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Borne basse de la **fenêtre glissante « semaine »** (7 derniers jours, aujourd'hui inclus),
 * en ISO UTC : minuit local de `aujourd'hui − 6`. Remplace l'ancienne semaine calendaire
 * (lundi→dimanche) — décision produit : toutes les stats « semaine » raisonnent en 7 jours
 * glissants. Jour-alignée en heure locale puis convertie en UTC pour comparer aux
 * `finished_at` (stockés en UTC).
 */
// `rollingWeekStartLocalUtc()` a été retirée : les hooks utilisent `useWindowStartUtc(ROLLING_WEEK_DAYS)`,
// qui dérive de la clé de jour **réactive**. Une fonction de module lisant l'horloge était figée au
// montage par React Compiler.

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
      // US ADMIN-01 : ni `e.deleted_at` ni les traductions ne sont filtrés — un record est un fait
      // passé, son libellé doit survivre à l'archivage de l'exercice au catalogue.
      `SELECT COALESCE(tl.name, tfr.name) AS name
       FROM exercises e
       LEFT JOIN exercise_translations tl  ON tl.exercise_id = e.id AND tl.lang = ?
       LEFT JOIN exercise_translations tfr ON tfr.exercise_id = e.id AND tfr.lang = 'fr'
       WHERE e.id = ?
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
 * 1RM réel (charge max d'une série à 1 rep) d'un exercice, réactif. `null` si
 * l'utilisateur n'a jamais validé de série à 1 rep pour cet exercice.
 */
export function useExerciseTopSingle(
  exerciseId: string,
): { topSingle: OneRepMaxSample | null; isLoading: boolean } {
  const { data, isLoading } = useQuery<{ value: number; achieved_at: string }>(
    SELECT_EXERCISE_TOP_SINGLE,
    [exerciseId],
  );
  const row = data[0];
  const topSingle = row ? { value: row.value, date: row.achieved_at } : null;
  return { topSingle, isLoading };
}

/**
 * Records par plage de reps d'un exercice, tous temps (US MUSC-09) — réactif. Bucketing pur
 * (`resolveRepBucketRecords`), la requête ne fait que l'éligibilité (spec R3).
 */
export function useExerciseRepRanges(
  exerciseId: string,
): { repRanges: RepBucketRecord[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<{ reps: number; weight_kg: number; achieved_at: string }>(
    SELECT_EXERCISE_SETS_FOR_REP_BUCKETS,
    [exerciseId],
  );
  const repRanges = resolveRepBucketRecords(
    data.map((r) => ({ reps: r.reps, weightKg: r.weight_kg, achievedAt: r.achieved_at })),
  );
  return { repRanges, isLoading };
}

/** Vue records prête pour la fiche exercice (F10b). Chaque entrée : valeur + date ISO. */
export type ExerciseFicheRecords = {
  oneRepMax: { value: number; date: string; real: boolean } | null;
  maxWeight: { value: number; date: string } | null;
  bestVolume: { value: number; date: string } | null;
  /** Charge max par plage de reps (US MUSC-09) — `[]` si aucune série éligible. */
  repRanges: RepBucketRecord[];
};

/**
 * Records d'un exercice pour la fiche : 1RM (réel si dispo, sinon estimé),
 * charge max, meilleur volume, charge par plage de reps — chacun avec sa date. Compose
 * `useExerciseRecords` (personal_records) + `useExerciseTopSingle` (1RM réel dérivé) +
 * `useExerciseRepRanges` + `pickOneRepMax`.
 */
export function useExerciseFicheRecords(
  exerciseId: string,
): { records: ExerciseFicheRecords; isLoading: boolean } {
  const { records: best, isLoading: bestLoading } = useExerciseRecords(exerciseId);
  const { topSingle, isLoading: singleLoading } = useExerciseTopSingle(exerciseId);
  const { repRanges, isLoading: repRangesLoading } = useExerciseRepRanges(exerciseId);

  const byType = (t: RecordType) => best.find((r) => r.type === t) ?? null;
  const maxW = byType('max_weight');
  const est = byType('estimated_1rm');
  const vol = byType('best_volume');

  const records: ExerciseFicheRecords = {
    oneRepMax: pickOneRepMax(
      topSingle,
      est ? { value: est.value, date: est.achievedAt } : null,
    ),
    maxWeight: maxW ? { value: maxW.value, date: maxW.achievedAt } : null,
    bestVolume: vol ? { value: vol.value, date: vol.achievedAt } : null,
    repRanges,
  };

  return { records, isLoading: bestLoading || singleLoading || repRangesLoading };
}

/**
 * Série temporelle de progression d'un exercice pour l'affichage de courbes.
 *
 * - `max_weight`    : records `max_weight` de l'exercice, ordonnés par `achieved_at`,
 *   sur la période — chaque point = un record battu (charge max).
 * - `volume`        : pour chaque séance terminée de l'utilisateur sur la période
 *   contenant l'exercice, somme `reps × weight_kg` des séries validées non-échauffement
 *   de cet exercice ; date du point = `finished_at` de la séance.
 * - `estimated_1rm` : pour chaque séance terminée sur la période contenant l'exercice,
 *   meilleur 1RM estimé (`sessionBestEstimated1RM`) parmi les séries qualifiantes de
 *   cet exercice ; date du point = `finished_at` de la séance (le calcul du max des
 *   1RM Epley est fait en JS pour rester cohérent avec le domaine partagé).
 *
 * La borne basse de la période est un timestamp UTC calculé en JS (now − N jours, ou
 * epoch pour « tout ») et passé en paramètre lié.
 */
export function useExerciseProgression(
  exerciseId: string,
  metric: ProgressionMetric,
  period: ProgressionPeriod,
): { points: ProgressionPoint[]; isLoading: boolean } {
  const today = useTodayDate();
  const lowerBound = periodLowerBound(period, today);

  // Trois requêtes statiques ; on choisit le SQL selon la métrique. Le `useQuery`
  // reste un unique appel (règle des hooks), avec les mêmes params liés.
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

  // Séries qualifiantes (mêmes filtres que le volume) ; le meilleur 1RM par séance
  // est calculé en JS après regroupement par `workout_id`.
  const estimated1RmSql = `
    SELECT w.id AS workout_id, w.finished_at AS date,
           s.reps AS reps, s.weight_kg AS weight_kg
    FROM workout_sets s
    JOIN workouts w ON w.id = s.workout_id
      AND w.status = 'completed' AND w.deleted_at IS NULL
    WHERE s.exercise_id = ? AND s.deleted_at IS NULL
      AND s.done = 1 AND s.set_type <> 'warmup'
      AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
      AND w.finished_at >= ?
    ORDER BY w.finished_at
  `;

  const sql =
    metric === 'volume'
      ? volumeSql
      : metric === 'estimated_1rm'
        ? estimated1RmSql
        : maxWeightSql;

  // Type union couvrant les colonnes des trois requêtes (toutes optionnelles /
  // nullables) : `date` + `value` (max_weight/volume) ; `workout_id`/`reps`/
  // `weight_kg` (estimated_1rm). On branche au mapping selon la métrique.
  const { data, isLoading: queryLoading } = useQuery<{
    date: string | null;
    value?: number | null;
    workout_id?: string | null;
    reps?: number | null;
    weight_kg?: number | null;
  }>(sql, [exerciseId, lowerBound]);

  const isLoading = queryLoading;

  let points: ProgressionPoint[];
  if (metric === 'estimated_1rm') {
    // Regroupement par séance : un point par séance = meilleur 1RM estimé de la séance.
    const byWorkout = new Map<
      string,
      { date: string; sets: { reps: number | null; weightKg: number | null }[] }
    >();
    for (const row of data) {
      if (row.workout_id == null || row.date == null) continue;
      let group = byWorkout.get(row.workout_id);
      if (!group) {
        group = { date: row.date, sets: [] };
        byWorkout.set(row.workout_id, group);
      }
      group.sets.push({ reps: row.reps ?? null, weightKg: row.weight_kg ?? null });
    }

    points = [...byWorkout.values()]
      .map((group) => ({
        date: group.date,
        value: sessionBestEstimated1RM(group.sets),
      }))
      .filter((point) => point.value > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  } else {
    points = data
      .filter(
        (row): row is { date: string; value: number } =>
          row.date != null && row.value != null,
      )
      .map((row) => ({ date: row.date, value: row.value }));
  }

  return { points, isLoading };
}

/**
 * Volume par groupe musculaire sur les **7 derniers jours glissants** (aujourd'hui inclus).
 *
 * Joint `workout_sets` → `exercises.muscle_primary`, somme `reps × weight_kg` des
 * séries validées non-échauffement des séances terminées dont `finished_at` est
 * postérieur à minuit local de J−6 (converti en ISO UTC, passé en paramètre lié), regroupe
 * par `muscle_primary`.
 */
export function useMuscleVolumeThisWeek(): {
  volumes: MuscleVolume[];
  isLoading: boolean;
} {
  const weekStart = useWindowStartUtc(ROLLING_WEEK_DAYS);

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
 * Équilibre du volume d'entraînement par groupe musculaire sur 14 jours glissants
 * (spec MUSC-05), réactif.
 *
 * Fenêtre **glissante** (pas calendaire) : borne basse = `now − 14 jours`, calculée
 * en JS puis convertie en ISO UTC (voir en-tête de fichier — jamais de comparaison
 * `date()` SQL sur de l'UTC). Mêmes filtres que `useMuscleVolumeThisWeek` (séries
 * validées non-échauffement de séances terminées), mais compte aussi le nombre de
 * séries (`sets`) par groupe en plus du tonnage, et regroupe par `muscle_primary`.
 *
 * `sets` par groupe est ensuite transmis à `computeMuscleBalance` (`@wellness/shared`)
 * qui compare chaque groupe à une cible uniforme (1/6 du volume total) pour
 * détecter les groupes délaissés / sur-représentés.
 */
export function useMuscleBalance(): {
  balance: MuscleBalance;
  volumes: { muscle: MuscleGroup; sets: number; tonnage: number }[];
  isLoading: boolean;
} {
  const today = useTodayDate();
  const since = rollingWindowLowerBound(14, today);

  const sql = `
    SELECT e.muscle_primary AS muscle,
           COUNT(*) AS sets,
           SUM(s.reps * s.weight_kg) AS tonnage
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

  const { data, isLoading } = useQuery<{
    muscle: string;
    sets: number | null;
    tonnage: number | null;
  }>(sql, [since]);

  const volumes = data.map((row) => ({
    muscle: row.muscle as MuscleGroup,
    sets: row.sets ?? 0,
    tonnage: row.tonnage ?? 0,
  }));

  const balance = computeMuscleBalance(
    volumes.map((v) => ({ muscle: v.muscle, sets: v.sets })),
  );

  return { balance, volumes, isLoading };
}

/**
 * Tonnage cumulé à vie et sur l'année civile en cours (US MUSC-19), réactif.
 *
 * Même patron SQL que `useMuscleBalance` (`SUM(s.reps * s.weight_kg)`, mêmes filtres — séries
 * validées non-échauffement de séances terminées), sans `GROUP BY` : deux sommes globales dans
 * une seule requête (`this_year` conditionné par `w.finished_at >= ?`, `lifetime` sans borne
 * basse). Borne « cette année » : minuit local du 1er janvier (spec D1/R2), jamais de comparaison
 * `date()` SQL sur de l'UTC (voir en-tête de fichier).
 */
export function useLifetimeTonnage(): {
  lifetimeKg: number;
  thisYearKg: number;
  isLoading: boolean;
} {
  const today = useTodayDate();
  const yearStartIso = localStartOfYear(today).toISOString();

  const sql = `
    SELECT
      SUM(s.reps * s.weight_kg) AS lifetime,
      SUM(CASE WHEN w.finished_at >= ? THEN s.reps * s.weight_kg ELSE 0 END) AS this_year
    FROM workout_sets s
    JOIN workouts w ON w.id = s.workout_id
      AND w.status = 'completed' AND w.deleted_at IS NULL
    WHERE s.deleted_at IS NULL
      AND s.done = 1 AND s.set_type <> 'warmup'
      AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
  `;

  const { data, isLoading } = useQuery<{ lifetime: number | null; this_year: number | null }>(
    sql,
    [yearStartIso],
  );
  const row = data[0];

  return { lifetimeKg: row?.lifetime ?? 0, thisYearKg: row?.this_year ?? 0, isLoading };
}

/**
 * Volume total (kg) des **7 derniers jours glissants** vs les 7 jours précédents, réactif.
 *
 * Mêmes filtres que `useMuscleVolumeThisWeek` (séries validées non-échauffement
 * de séances terminées), mais sans `GROUP BY muscle_primary` : une somme globale.
 * - `current`  : `finished_at >= weekStart` (minuit local de J−6, ISO UTC).
 * - `previous` : `finished_at` dans `[prevWeekStart, weekStart[` — la fenêtre de 7 jours
 *   précédente (J−13 à J−7), `prevWeekStart` dérivé de `weekStart` moins 7 jours.
 *
 * Deux `useQuery` inconditionnels (règle des hooks) ; `isLoading` est vrai si
 * l'une des deux requêtes est encore en cours.
 */
export function useWeeklyVolumeComparison(): {
  current: number;
  previous: number;
  isLoading: boolean;
} {
  const weekStart = useWindowStartUtc(ROLLING_WEEK_DAYS);
  const prevWeekStart = new Date(
    new Date(weekStart).getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const currentSql = `
    SELECT SUM(s.reps * s.weight_kg) AS v
    FROM workout_sets s
    JOIN workouts w ON w.id = s.workout_id
      AND w.status = 'completed' AND w.deleted_at IS NULL
    JOIN exercises e ON e.id = s.exercise_id AND e.deleted_at IS NULL
    WHERE s.deleted_at IS NULL
      AND s.done = 1 AND s.set_type <> 'warmup'
      AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
      AND w.finished_at >= ?
  `;

  const previousSql = `
    SELECT SUM(s.reps * s.weight_kg) AS v
    FROM workout_sets s
    JOIN workouts w ON w.id = s.workout_id
      AND w.status = 'completed' AND w.deleted_at IS NULL
    JOIN exercises e ON e.id = s.exercise_id AND e.deleted_at IS NULL
    WHERE s.deleted_at IS NULL
      AND s.done = 1 AND s.set_type <> 'warmup'
      AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
      AND w.finished_at >= ? AND w.finished_at < ?
  `;

  const { data: currentData, isLoading: currentLoading } = useQuery<{ v: number | null }>(
    currentSql,
    [weekStart],
  );
  const { data: previousData, isLoading: previousLoading } = useQuery<{ v: number | null }>(
    previousSql,
    [prevWeekStart, weekStart],
  );

  const current = currentData[0]?.v ?? 0;
  const previous = previousData[0]?.v ?? 0;
  const isLoading = currentLoading || previousLoading;

  return { current, previous, isLoading };
}

/**
 * Range des séries dans des seaux de 7 jours (seau 0 = semaine courante) et renvoie le
 * **tonnage par semaine**, la plus ancienne d'abord. Entièrement **pure** : `nowMs` est injecté —
 * le lire ici l'aurait figé avec la mémoïsation de l'appel.
 */
function bucketWeeklyVolume(
  rows: { finished_at: string | null; reps: number | null; weight_kg: number | null }[],
  weeks: number,
  nowMs: number,
): number[] {
  const buckets = new Array(Math.max(1, weeks)).fill(0) as number[];
  const now = nowMs;
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  for (const r of rows) {
    if (!r.finished_at) continue;
    const t = new Date(r.finished_at).getTime();
    if (Number.isNaN(t)) continue;
    const wi = Math.floor((now - t) / WEEK_MS); // 0 = semaine courante
    const idx = buckets.length - 1 - wi;
    if (idx < 0 || idx >= buckets.length) continue;
    buckets[idx] = (buckets[idx] ?? 0) + (r.reps ?? 0) * (r.weight_kg ?? 0);
  }
  return buckets;
}

/**
 * Série de **tonnage hebdomadaire** (kg) sur les `weeks` dernières semaines glissantes, la plus
 * ancienne d'abord — pour la sparkline de progression (widget muscu). Mêmes filtres que les
 * autres calculs de volume (séries validées non-échauffement de séances terminées).
 */
export function useWeeklyVolumeSeries(weeks = 8): { series: number[]; isLoading: boolean } {
  const today = useTodayDate();
  const since = rollingWindowLowerBound(weeks * 7, today);
  const sql = `
    SELECT w.finished_at AS finished_at, s.reps AS reps, s.weight_kg AS weight_kg
    FROM workout_sets s
    JOIN workouts w ON w.id = s.workout_id
      AND w.status = 'completed' AND w.deleted_at IS NULL
    WHERE s.deleted_at IS NULL
      AND s.done = 1 AND s.set_type <> 'warmup'
      AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
      AND w.finished_at >= ?
  `;
  const { data, isLoading } = useQuery<{
    finished_at: string | null;
    reps: number | null;
    weight_kg: number | null;
  }>(sql, [since]);

  return { series: bucketWeeklyVolume(data, weeks, today.getTime()), isLoading };
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

// ---------------------------------------------------------------------------
// useTrainingNutritionCross — vue croisée charge muscu ↔ apports (MN-03)
// ---------------------------------------------------------------------------

const CROSS_WEEKS = 8;

/**
 * 8 **fenêtres glissantes de 7 jours** (récent → ancien) + bornes basses (ISO UTC minuit
 * local, et dayKey). Chaque fenêtre couvre 7 jours consécutifs ; la plus récente démarre à
 * J−6. Remplace les 8 semaines calendaires (décision produit : stats en 7 jours glissants).
 */
function last8RollingWeeksLocal(ref: Date): { weekStarts: string[]; oldestIsoUtc: string; oldestDayKey: string } {
  const starts = rollingWeekStarts(CROSS_WEEKS, ref); // récent → ancien, minuit local
  const oldest = starts[starts.length - 1]!;
  return {
    weekStarts: starts.map(localDayKey),
    oldestIsoUtc: oldest.toISOString(),
    oldestDayKey: localDayKey(oldest),
  };
}

/**
 * Vue croisée « charge muscu ↔ apports » sur 8 **fenêtres glissantes de 7 jours** (MN-03,
 * descriptif), réactive. Lecture seule. Tous les hooks sont appelés inconditionnellement (règle
 * des hooks) ; le gating (muscu ET nutrition actifs) est appliqué AU RETOUR (renvoie `[]` sinon →
 * le composant rend `null`).
 */
export function useTrainingNutritionCross(): {
  weeks: WeeklyTrainingNutrition[];
  isLoading: boolean;
} {
  const today = useTodayDate();
  const { weekStarts, oldestIsoUtc, oldestDayKey } = last8RollingWeeksLocal(today);
  const { settings } = useSettings();
  const activePillars = resolveActivePillars(settings?.activePillars);
  const active = activePillars.includes('strength') && activePillars.includes('nutrition');

  // Muscu : une ligne par séance terminée (LEFT JOIN → séances sans série qualifiante comptées, tonnage 0).
  const sql = `
    SELECT w.id AS workout_id, w.finished_at AS finished_at,
           COALESCE(SUM(CASE WHEN s.done = 1 AND s.set_type <> 'warmup'
                              AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
                         THEN s.reps * s.weight_kg ELSE 0 END), 0) AS tonnage
    FROM workouts w
    LEFT JOIN workout_sets s ON s.workout_id = w.id AND s.deleted_at IS NULL
    WHERE w.status = 'completed' AND w.deleted_at IS NULL AND w.finished_at >= ?
    GROUP BY w.id, w.finished_at
  `;
  const { data: workoutRows, isLoading: wLoading } = useQuery<{
    workout_id: string; finished_at: string; tonnage: number | null;
  }>(sql, [oldestIsoUtc]);

  const { totals, isLoading: nLoading } = useDailyTotals(oldestDayKey);

  const isLoading = wLoading || nLoading;

  const weeks = active
    ? computeWeeklyTrainingNutrition({
        weekStarts,
        workouts: workoutRows.map((r) => ({
          dayKey: localDayKey(new Date(r.finished_at)),
          tonnage: r.tonnage ?? 0,
        })),
        dailyKcals: totals.map((d) => ({ dayKey: d.logDate, kcal: d.kcal, proteinG: d.proteinG })),
      })
    : [];

  return { weeks, isLoading };
}

// ---------------------------------------------------------------------------
// US EXEC-01 — écart entre le prévu et le réalisé (roadmap 3.58)
// ---------------------------------------------------------------------------

/**
 * Fenêtre d'analyse du lot EXEC-01, en jours : **12 semaines** (spec D2, validée le 07/08/2026).
 *
 * Cohérente avec les autres sections de l'écran de progression, et assez longue pour qu'un
 * pratiquant à 3 séances par semaine franchisse tous les seuils de données.
 */
export const EXECUTION_WINDOW_DAYS = 12 * 7;

/**
 * Séries validées des séances **de programme**, avec leur prescription (US EXEC-01, MUSC-33).
 *
 * ⚠️ **`w.session_id IS NOT NULL`** : seules les séances issues d'un programme entrent (spec R4).
 * Une séance libre n'a aucune prescription — l'inclure ferait chuter le taux d'exécution de
 * quelqu'un qui s'entraîne beaucoup **hors** programme, soit l'inverse exact du signal.
 *
 * ⚠️ **`LEFT JOIN` sur `exercise_plans`, jamais `JOIN`** : un exercice ajouté en cours de séance n'a
 * pas de plan. Un `JOIN` strict le ferait disparaître du taux de **charge** aussi, alors que sa
 * `planned_weight_kg` est parfaitement exploitable.
 *
 * ⚠️ **Les échauffements sont exclus.** Ils sont improvisés au feeling, et leur prescription — quand
 * elle existe — n'est pas ce qu'on cherche à mesurer. Même filtre que `useLifetimeTonnage` et
 * `useMuscleVolumeThisWeek` sur ce même fichier.
 *
 * ⚠️ **Pas de filtre `user_id`** : c'est la convention de **lecture** de ce fichier — la base locale
 * PowerSync ne contient que les lignes de l'utilisateur connecté (sync rules), et `user_id` n'est
 * posé qu'à l'écriture, comme le dit l'en-tête. *(Le plan d'EXEC-01 affirmait le contraire, à tort.)*
 */
export const SELECT_EXECUTION_COMPLIANCE = `
  SELECT s.workout_id, s.planned_weight_kg, s.weight_kg, s.reps, s.done,
         ep.target_reps
  FROM workout_sets s
  JOIN workouts w ON w.id = s.workout_id
    AND w.status = 'completed' AND w.deleted_at IS NULL
    AND w.session_id IS NOT NULL
    AND w.finished_at >= ?
  LEFT JOIN exercise_plans ep ON ep.session_id = w.session_id
                             AND ep.exercise_id = s.exercise_id
                             AND ep.deleted_at IS NULL
  WHERE s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup'
`;

type ComplianceDbRow = {
  workout_id: string;
  planned_weight_kg: number | null;
  weight_kg: number | null;
  reps: number | null;
  done: number;
  target_reps: string | null;
};

/**
 * Le taux d'exécution du programme sur la fenêtre (US EXEC-01, MUSC-33).
 *
 * Rend `null` sous le seuil de données du moteur — l'écran se tait alors (spec R3).
 *
 * 🔴 **Un exercice présent deux fois dans une même séance de programme produit deux lignes de plan**,
 * donc la jointure duplique la série. On **déduplique** en ne gardant qu'une occurrence par série :
 * la compter deux fois gonflerait le dénominateur et laisserait croire que le taux porte sur plus
 * d'observations qu'en réalité — or ce dénominateur est **affiché** (spec R2).
 */
export function useExecutionCompliance(): {
  compliance: ComplianceResult | null;
  isLoading: boolean;
} {
  const windowStart = useWindowStartUtc(EXECUTION_WINDOW_DAYS);

  const { data, isLoading } = useQuery<ComplianceDbRow>(SELECT_EXECUTION_COMPLIANCE, [windowStart]);

  const compliance = useMemo(() => {
    const bySession = new Map<string, CompliancePlannedSet[]>();
    // Deux lignes issues de la duplication de jointure sont rigoureusement identiques : la clé les
    // confond, ce qui est exactement le but.
    const seen = new Set<string>();

    for (const row of data) {
      const key = `${row.workout_id}|${row.planned_weight_kg}|${row.weight_kg}|${row.reps}|${row.target_reps}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const sets = bySession.get(row.workout_id) ?? [];
      sets.push({
        plannedWeightKg: row.planned_weight_kg,
        weightKg: row.weight_kg,
        reps: row.reps,
        targetReps: row.target_reps,
        done: row.done === 1,
      });
      bySession.set(row.workout_id, sets);
    }

    return computeExecutionCompliance({
      sessions: [...bySession.values()].map((sets) => ({ sets })),
    });
  }, [data]);

  return { compliance, isLoading };
}

/**
 * Durées des séances terminées de la fenêtre, **du plus ancien au plus récent** (MUSC-26).
 *
 * L'ordre n'est pas cosmétique : c'est lui qui définit les deux moitiés de la tendance dans
 * `computeSessionDuration`. Le `ORDER BY` est donc une **dépendance du calcul**, pas un confort
 * d'affichage.
 */
export const SELECT_SESSION_DURATIONS = `
  SELECT w.duration_seconds
  FROM workouts w
  WHERE w.status = 'completed' AND w.deleted_at IS NULL
    AND w.finished_at >= ?
  ORDER BY w.started_at ASC
`;

/** Médiane, tendance et séances aberrantes écartées (US EXEC-01, MUSC-26). */
export function useSessionDurationStats(): {
  duration: DurationResult | null;
  isLoading: boolean;
} {
  const windowStart = useWindowStartUtc(EXECUTION_WINDOW_DAYS);

  const { data, isLoading } = useQuery<{ duration_seconds: number | null }>(
    SELECT_SESSION_DURATIONS,
    [windowStart],
  );

  const duration = useMemo(
    () => computeSessionDuration({ sessions: data.map((r) => r.duration_seconds) }),
    [data],
  );

  return { duration, isLoading };
}

/**
 * Séries validées de la fenêtre, avec leur type (MUSC-13).
 *
 * ⚠️ **Les échauffements sont gardés ici**, contrairement à `SELECT_EXECUTION_COMPLIANCE` : c'est
 * précisément ce que l'analyse montre (« 21 % d'échauffement »). Les exclure viderait la carte de son
 * intérêt — la contradiction apparente entre les deux requêtes est **voulue**.
 */
export const SELECT_SET_TYPE_MIX = `
  SELECT s.set_type
  FROM workout_sets s
  JOIN workouts w ON w.id = s.workout_id
    AND w.status = 'completed' AND w.deleted_at IS NULL
    AND w.finished_at >= ?
  WHERE s.deleted_at IS NULL AND s.done = 1
`;

/** Répartition des séries validées par type (US EXEC-01, MUSC-13). */
export function useSetTypeMix(): { mix: SetTypeShare[] | null; isLoading: boolean } {
  const windowStart = useWindowStartUtc(EXECUTION_WINDOW_DAYS);

  const { data, isLoading } = useQuery<{ set_type: string }>(SELECT_SET_TYPE_MIX, [windowStart]);

  const mix = useMemo(
    // `done = 1` est déjà garanti par la requête : le moteur reçoit `done: true` sans qu'on mente.
    () => computeSetTypeMix({ sets: data.map((r) => ({ setType: r.set_type, done: true })) }),
    [data],
  );

  return { mix, isLoading };
}

/**
 * Favoris de l'utilisateur, avec leur dernière pratique validée (MUSC-21).
 *
 * ⚠️ **`e.deleted_at IS NULL` sur `exercises`** — et c'est le seul endroit du lot où ce filtre est
 * souhaitable : proposer de reprendre un exercice retiré de la bibliothèque serait absurde.
 * (COLLIS-01 ne le filtre **pas**, pour la raison inverse : une séance planifiée qui contient un
 * exercice archivé sera quand même faite.)
 *
 * ⚠️ **Aucune borne de fenêtre ici** : un favori délaissé depuis 8 mois doit être trouvé. Borner à
 * 12 semaines ferait disparaître les plus délaissés — exactement ceux qu'on cherche.
 *
 * Le nom suit le repli de traduction du fichier : langue demandée, puis français.
 */
export const SELECT_FAVORITE_PRACTICE = `
  SELECT f.exercise_id,
         COALESCE(tl.name, tfr.name) AS exercise_name,
         f.created_at AS favorited_at,
         MAX(w.finished_at) AS last_practiced_at
  FROM exercise_favorites f
  JOIN exercises e ON e.id = f.exercise_id AND e.deleted_at IS NULL
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = f.exercise_id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = f.exercise_id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  LEFT JOIN workout_sets s ON s.exercise_id = f.exercise_id AND s.done = 1 AND s.deleted_at IS NULL
  LEFT JOIN workouts w ON w.id = s.workout_id
    AND w.status = 'completed' AND w.deleted_at IS NULL
  WHERE f.deleted_at IS NULL
  GROUP BY f.exercise_id, exercise_name, f.created_at
`;

type FavoritePracticeDbRow = {
  exercise_id: string;
  exercise_name: string | null;
  favorited_at: string;
  last_practiced_at: string | null;
};

/**
 * Les favoris non pratiqués depuis `NEGLECTED_AFTER_WEEKS` semaines (US EXEC-01, MUSC-21).
 *
 * 🔴 `todayKey` vient du hook dédié, **jamais** d'une lecture d'horloge dans ce corps : React
 * Compiler gèlerait la valeur dans un slot mount-only et la liste resterait figée jusqu'au
 * redémarrage de l'app. Même raison que dans `useInsights` et `useSessionConflicts`.
 *
 * Les horodatages UTC sont convertis en **clés de jour locales** ici, pas dans le moteur : un calcul
 * pur ne doit pas dépendre du fuseau de la machine.
 */
export function useNeglectedFavorites(): {
  neglected: NeglectedExercise[];
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const todayKey = useTodayKey();

  const { data, isLoading } = useQuery<FavoritePracticeDbRow>(SELECT_FAVORITE_PRACTICE, [lang]);

  const neglected = useMemo(() => {
    const favorites: FavoriteExercise[] = data.map((row) => ({
      exerciseId: row.exercise_id,
      // Un favori sans traduction ne disparaît pas de la liste : son id fait un libellé laid mais
      // honnête, et l'absence de traduction est un défaut de contenu, pas de calcul.
      name: row.exercise_name ?? row.exercise_id,
      favoritedOn: localDayKey(new Date(row.favorited_at)),
      lastPracticedOn:
        row.last_practiced_at === null ? null : localDayKey(new Date(row.last_practiced_at)),
    }));

    return findNeglectedExercises({ favorites, todayKey });
  }, [data, todayKey]);

  return { neglected, isLoading };
}

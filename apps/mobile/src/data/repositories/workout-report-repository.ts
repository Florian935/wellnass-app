/**
 * US MUSCU-UX02 — la donnée du **bilan de séance**, en une passe.
 *
 * ── Pourquoi ce fichier existe ───────────────────────────────────────────────────────────────────
 * L'ancien récap appelait `useWorkoutRecords` **trois fois** (bandeau de célébration, section
 * « records », écran lui-même) et `useWorkoutDetail` **deux fois** (dont une à travers
 * `useExerciseDeltas`). Chaque appel est une requête surveillée par PowerSync. Le niveau Avancé,
 * qui ajoute une dizaine de blocs, aurait multiplié ce gaspillage par autant.
 *
 * Ici : un hook, des requêtes déclarées une fois, et un unique `useMemo` qui appelle le calcul pur
 * `computeWorkoutReport`. L'écran ne connaît plus la base.
 *
 * ⚠️ **Les requêtes ne sont pas conditionnées au niveau d'affichage.** Les règles des hooks
 * l'interdisent (on ne peut pas appeler `useQuery` dans un `if`), et le contourner avec des
 * requêtes bidon serait pire que le mal : tout est local, indexé, et une séance porte quelques
 * dizaines de lignes. C'est le nombre de **surveillances** qu'on réduit, pas le volume lu.
 *
 * ⚠️ **Pas de filtre `user_id` en lecture** : convention de tout ce dossier — la base locale
 * PowerSync ne contient que les lignes de l'utilisateur connecté (sync rules) ; `user_id` n'est
 * posé qu'à l'écriture.
 */

import { useMemo } from 'react';
import { useQuery } from '@powersync/react-native';
import { useTranslation } from 'react-i18next';
import {
  computeWorkoutReport,
  type ComparableSet,
  type MuscleGroup,
  type OneRmRecord,
  type ReferenceSession,
  type ReportRecord,
  type ReportSet,
  type WorkoutReport,
} from '@wellness/shared';
import { useAuthStore } from '@/stores/auth-store';
import { SELECT_PREVIOUS_SETS } from './records-repository';

// ---------------------------------------------------------------------------
// Requêtes — exportées pour être testables contre le harness SQLite (§3.3)
//
// Ces constantes ne sont consommées que par le hook de ce fichier : l'`export` n'existe que pour
// les tests, qui les exécutent sur du vrai SQLite. Ne pas les importer depuis du code applicatif.
// ---------------------------------------------------------------------------

/**
 * Entête de la séance **et son titre**. Le titre vient de `sessions.name` : c'est lui qui rend les
 * comparaisons honnêtes plus bas — comparer un « Haut du corps » à un « Jambes » ferait osciller le
 * tonnage de ±40 % au gré de l'alternance, et l'écart ne dirait plus rien de la performance.
 *
 * `?` = id de la séance.
 */
export const SELECT_HEADER = `
  SELECT w.id, w.started_at, w.finished_at, w.duration_seconds, w.rpe, w.notes,
         w.session_id, se.name AS session_name
  FROM workouts w
  LEFT JOIN sessions se ON se.id = w.session_id AND se.deleted_at IS NULL
  WHERE w.id = ? AND w.status = 'completed' AND w.deleted_at IS NULL
  LIMIT 1
`;

/**
 * Séries de la séance, avec le nom de l'exercice (langue courante → repli fr), son **groupe
 * musculaire primaire**, et la **cible de répétitions du plan** quand la séance vient d'un programme.
 *
 * 🔴 `ep.target_reps` est joint depuis `exercise_plans` via `w.session_id`. Un exercice présent
 * **deux fois** dans la même séance de programme produirait deux lignes de plan et donc des doublons
 * de séries : le `GROUP BY s.id` referme ce cas en gardant une cible arbitraire mais unique — c'est
 * le même piège que `SELECT_EXECUTION_COMPLIANCE` documente pour EXEC-01.
 *
 * Paramètres : `[lang, workoutId]`.
 */
export const SELECT_SETS = `
  SELECT s.id, s.exercise_id, s.order_index, s.set_type, s.reps, s.weight_kg,
         s.duration_seconds, s.done, s.rpe, s.planned_weight_kg,
         COALESCE(tl.name, tfr.name) AS exercise_name,
         e.muscle_primary AS muscle_primary,
         MIN(ep.target_reps) AS target_reps
  FROM workout_sets s
  JOIN workouts w ON w.id = s.workout_id
  LEFT JOIN exercises e ON e.id = s.exercise_id AND e.deleted_at IS NULL
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = s.exercise_id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = s.exercise_id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  LEFT JOIN exercise_plans ep ON ep.session_id = w.session_id
                             AND ep.exercise_id = s.exercise_id
                             AND ep.deleted_at IS NULL
  WHERE s.workout_id = ? AND s.deleted_at IS NULL
  GROUP BY s.id
  ORDER BY s.order_index
`;

/** Records battus pendant cette séance. Paramètres : `[lang, workoutId]`. */
export const SELECT_RECORDS = `
  SELECT r.exercise_id, r.type, r.value,
         COALESCE(tl.name, tfr.name) AS exercise_name
  FROM personal_records r
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = r.exercise_id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = r.exercise_id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE r.workout_id = ? AND r.deleted_at IS NULL
  ORDER BY r.type
`;

/**
 * Meilleure valeur connue **avant** cette séance, par (exercice, type) — ce que le record vient de
 * battre. Sans elle, « 82,5 kg » ne dit pas de combien on a progressé.
 *
 * Le filtre porte sur `achieved_at < started_at` de la séance courante : comparer à l'ensemble des
 * records inclurait celui qu'on vient de poser, et l'écart serait toujours nul.
 *
 * `?` = id de la séance.
 */
export const SELECT_PREVIOUS_BESTS = `
  SELECT r.exercise_id, r.type, MAX(r.value) AS value
  FROM personal_records r
  WHERE r.deleted_at IS NULL
    AND r.achieved_at < (SELECT started_at FROM workouts WHERE id = ?)
  GROUP BY r.exercise_id, r.type
`;

/**
 * Meilleur 1RM estimé connu par exercice — la référence de l'intensité relative (%1RM).
 *
 * **Le plus élevé, pas le plus récent** : c'est la règle R1 de `strength-intensity.ts`. Prendre le
 * plus récent ferait bondir les pourcentages après une séance légère.
 */
export const SELECT_ONE_RM = `
  SELECT r.exercise_id, 'estimated_1rm' AS type, MAX(r.value) AS value
  FROM personal_records r
  WHERE r.deleted_at IS NULL AND r.type = 'estimated_1rm'
  GROUP BY r.exercise_id
`;

/**
 * Les séances **de même titre** qui précèdent celle-ci, de la plus récente à la plus ancienne, avec
 * leur tonnage, leur durée et leur ressenti.
 *
 * `COALESCE(se.name, '')` fait correspondre les séances **libres** entre elles (toutes à `''`) : une
 * séance libre se compare aux autres séances libres, ce qui reste plus juste que de la comparer à
 * tout l'historique.
 *
 * Paramètres : `[workoutId, title]`.
 */
export const SELECT_REFERENCES = `
  SELECT w.duration_seconds, w.rpe,
         (SELECT COALESCE(SUM(s.reps * s.weight_kg), 0)
          FROM workout_sets s
          WHERE s.workout_id = w.id AND s.deleted_at IS NULL
            AND s.done = 1 AND s.set_type <> 'warmup') AS volume
  FROM workouts w
  LEFT JOIN sessions se ON se.id = w.session_id AND se.deleted_at IS NULL
  WHERE w.status = 'completed' AND w.deleted_at IS NULL
    AND w.started_at < (SELECT started_at FROM workouts WHERE id = ?)
    AND COALESCE(se.name, '') = ?
  ORDER BY w.started_at DESC
  LIMIT 5
`;

/**
 * Meilleur tonnage jamais réalisé sur une séance de même titre, **hors celle-ci**. Sert au verdict
 * « ton plus gros volume sur un Haut du corps » — qui doit porter sur toute l'histoire, pas sur la
 * fenêtre de comparaison des cinq dernières.
 *
 * Paramètres : `[workoutId, title]`.
 */
export const SELECT_BEST_PREVIOUS_VOLUME = `
  SELECT MAX(volume) AS best FROM (
    SELECT (SELECT COALESCE(SUM(s.reps * s.weight_kg), 0)
            FROM workout_sets s
            WHERE s.workout_id = w.id AND s.deleted_at IS NULL
              AND s.done = 1 AND s.set_type <> 'warmup') AS volume
    FROM workouts w
    LEFT JOIN sessions se ON se.id = w.session_id AND se.deleted_at IS NULL
    WHERE w.status = 'completed' AND w.deleted_at IS NULL
      AND w.started_at < (SELECT started_at FROM workouts WHERE id = ?)
      AND COALESCE(se.name, '') = ?
  )
`;

/**
 * Séances et tonnage de la semaine calendaire de la séance, celle-ci comprise, plus le tonnage à
 * vie. Trois chiffres du même acabit, donc une seule requête.
 *
 * 🔴 **Les DEUX bornes sur les deux sous-requêtes.** Sans la borne haute sur le tonnage, un
 * bilan de mars ouvert depuis l'historique afficherait, sous « Cette semaine · 3ᵉ séance », le
 * tonnage cumulé **de mars à aujourd'hui** : les deux chiffres de la même ligne se
 * contrediraient, et l'écart grandirait avec l'ancienneté de la séance.
 *
 * Paramètres : `[weekStart, weekEnd, weekStart, weekEnd]`.
 */
export const SELECT_WEIGHT = `
  SELECT
    (SELECT COUNT(*) FROM workouts w
     WHERE w.status = 'completed' AND w.deleted_at IS NULL
       AND w.started_at >= ? AND w.started_at < ?) AS week_sessions,
    (SELECT COALESCE(SUM(s.reps * s.weight_kg), 0)
     FROM workout_sets s
     JOIN workouts w ON w.id = s.workout_id AND w.status = 'completed' AND w.deleted_at IS NULL
     WHERE s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup'
       AND w.started_at >= ? AND w.started_at < ?) AS week_volume,
    (SELECT COALESCE(SUM(s.reps * s.weight_kg), 0)
     FROM workout_sets s
     JOIN workouts w ON w.id = s.workout_id AND w.status = 'completed' AND w.deleted_at IS NULL
     WHERE s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup') AS lifetime_volume
`;

// ---------------------------------------------------------------------------
// Lignes brutes
// ---------------------------------------------------------------------------

type HeaderRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  rpe: number | null;
  notes: string | null;
  session_id: string | null;
  session_name: string | null;
};

type SetRow = {
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
  muscle_primary: string | null;
  target_reps: string | null;
};

type RecordRow = { exercise_id: string; type: string; value: number; exercise_name: string | null };
type BestRow = { exercise_id: string; type: string; value: number };
type ReferenceRow = { duration_seconds: number | null; rpe: number | null; volume: number | null };
type PreviousSetRow = {
  exercise_id: string;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  set_type: string;
  done: number;
};
type WeightRow = {
  week_sessions: number | null;
  week_volume: number | null;
  lifetime_volume: number | null;
};

// ---------------------------------------------------------------------------
// Bornes de la semaine
// ---------------------------------------------------------------------------

/**
 * Lundi 00 h 00 **local** de la semaine contenant `iso`, et le lundi suivant.
 *
 * Bornes locales et non UTC : « cette semaine » est une notion du calendrier de l'utilisateur, et
 * une séance du dimanche soir bascule de semaine si on raisonne en UTC depuis un fuseau à l'est.
 */
export function localWeekBounds(iso: string): { start: string; end: string } {
  const date = new Date(iso);
  const day = date.getDay(); // 0 = dimanche
  const offsetToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - offsetToMonday);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return { start: start.toISOString(), end: end.toISOString() };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Le bilan complet d'une séance terminée.
 *
 * `report` est `null` tant que l'entête n'est pas chargée, ou si la séance n'existe pas / n'est pas
 * terminée — l'écran affiche alors son état « introuvable », comme le fait déjà l'historique.
 */
export function useWorkoutReport(workoutId: string): {
  report: WorkoutReport | null;
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const userId = useAuthStore((s) => s.session?.user.id ?? '');

  const { data: headerRows, isLoading: headerLoading } = useQuery<HeaderRow>(SELECT_HEADER, [workoutId]);
  const header = headerRows[0] ?? null;
  const title = header?.session_name?.trim() || null;
  // `''` et non `null` : c'est la clé de rapprochement des séances libres (voir SELECT_REFERENCES).
  const titleKey = title ?? '';
  const week = localWeekBounds(header?.started_at ?? new Date().toISOString());

  const { data: setRows, isLoading: setsLoading } = useQuery<SetRow>(SELECT_SETS, [lang, workoutId]);
  const { data: recordRows, isLoading: recordsLoading } = useQuery<RecordRow>(SELECT_RECORDS, [lang, workoutId]);
  const { data: previousBestRows } = useQuery<BestRow>(SELECT_PREVIOUS_BESTS, [workoutId]);
  const { data: oneRmRows } = useQuery<BestRow>(SELECT_ONE_RM, []);
  const { data: previousSetRows } = useQuery<PreviousSetRow>(SELECT_PREVIOUS_SETS, [
    workoutId,
    userId,
    workoutId,
  ]);
  const { data: referenceRows } = useQuery<ReferenceRow>(SELECT_REFERENCES, [workoutId, titleKey]);
  const { data: bestVolumeRows } = useQuery<{ best: number | null }>(SELECT_BEST_PREVIOUS_VOLUME, [
    workoutId,
    titleKey,
  ]);
  const { data: weightRows } = useQuery<WeightRow>(SELECT_WEIGHT, [
    week.start,
    week.end,
    week.start,
    week.end,
  ]);

  const isLoading = headerLoading || setsLoading || recordsLoading;

  const report = useMemo<WorkoutReport | null>(() => {
    if (!header) return null;

    const sets: ReportSet[] = setRows.map((row) => ({
      id: row.id,
      exerciseId: row.exercise_id,
      setType: row.set_type,
      reps: row.reps,
      weightKg: row.weight_kg,
      durationSeconds: row.duration_seconds,
      rpe: row.rpe,
      plannedWeightKg: row.planned_weight_kg,
      targetReps: row.target_reps,
      done: row.done === 1,
      orderIndex: row.order_index,
    }));

    const exerciseNames = new Map<string, string>();
    const exerciseMuscle = new Map<string, MuscleGroup>();
    for (const row of setRows) {
      if (row.exercise_name) exerciseNames.set(row.exercise_id, row.exercise_name);
      // Un `muscle_primary` inconnu du référentiel est laissé de côté plutôt que forcé dans un
      // groupe : `computeSessionMuscleSplit` ignore alors l'exercice, et le total reste juste.
      if (row.muscle_primary) exerciseMuscle.set(row.exercise_id, row.muscle_primary as MuscleGroup);
    }

    const previousBest = new Map<string, number>();
    for (const row of previousBestRows) previousBest.set(`${row.exercise_id}:${row.type}`, row.value);

    const records: ReportRecord[] = recordRows.map((row) => ({
      exerciseId: row.exercise_id,
      exerciseName: row.exercise_name ?? row.exercise_id,
      type: row.type,
      value: row.value,
      previousValue: previousBest.get(`${row.exercise_id}:${row.type}`) ?? null,
    }));

    const oneRmRecords: OneRmRecord[] = oneRmRows.map((row) => ({
      exerciseId: row.exercise_id,
      type: row.type,
      value: row.value,
    }));

    const previousSetsByExercise = new Map<string, ComparableSet[]>();
    for (const row of previousSetRows) {
      const list = previousSetsByExercise.get(row.exercise_id) ?? [];
      list.push({
        weightKg: row.weight_kg,
        reps: row.reps,
        durationSeconds: row.duration_seconds,
        setType: row.set_type,
        done: row.done === 1,
      });
      previousSetsByExercise.set(row.exercise_id, list);
    }

    const referenceSessions: ReferenceSession[] = referenceRows.map((row) => ({
      volumeKg: row.volume ?? 0,
      durationSeconds: row.duration_seconds,
      rpe: row.rpe,
    }));

    const weight = weightRows[0];

    return computeWorkoutReport({
      workoutId: header.id,
      title,
      startedAt: header.started_at,
      durationSeconds: header.duration_seconds,
      feelingRpe: header.rpe,
      notes: header.notes,
      sets,
      exerciseNames,
      exerciseMuscle,
      oneRmRecords,
      records,
      previousSetsByExercise,
      referenceSessions,
      bestPreviousVolumeSameTitle: bestVolumeRows[0]?.best ?? null,
      // `?? 1` : la séance qu'on est en train de lire compte toujours pour elle-même. Un 0 ferait
      // dire « 0ᵉ séance cette semaine » au verdict de régularité.
      weekSessionCount: weight?.week_sessions ?? 1,
      weekVolumeKg: weight?.week_volume ?? 0,
      lifetimeVolumeKg: weight?.lifetime_volume ?? 0,
    });
  }, [
    header,
    title,
    setRows,
    recordRows,
    previousBestRows,
    oneRmRows,
    previousSetRows,
    referenceRows,
    bestVolumeRows,
    weightRows,
  ]);

  return { report, isLoading };
}

/**
 * US MUSCU-UX01 — les données de la **zone Agir** du hub muscu.
 *
 * Le hub décidait lui-même, dans son JSX, quoi afficher : une cascade de ternaires imbriqués avec
 * deux notes greffées dans la dernière branche. Trois états visibles, un quatrième (jour de repos)
 * qui n'existait pas, et aucun moyen de vérifier la priorité autrement qu'en relisant le rendu.
 *
 * Ce module rassemble ce qu'il faut savoir, et délègue la décision à `resolveHubState`
 * (`packages/shared`), qui est testée. Le hub ne fait plus qu'afficher l'état rendu.
 *
 * Il apporte aussi les deux informations qui manquaient à la carte :
 *  - **le contenu de la séance** (premiers exercices, durée estimée) — on savait qu'on avait
 *    « 5 exercices », jamais lesquels ;
 *  - **l'avancement du programme** (semaine X sur Y, séances faites) — que MUSC-F15 calculait déjà
 *    pour moduler la suggestion de charge, sans jamais l'afficher.
 */

import { useQuery } from '@powersync/react-native';
import {
  estimateSessionMinutes,
  MUSCLE_GROUPS,
  resolveHubState,
  resolveProgramProgress,
  type HubState,
  type MuscleGroup,
} from '@wellness/shared';
import { getAppLanguage } from '@/i18n';
import { useAuthStore } from '@/stores/auth-store';
import { useTodayKey } from '@/hooks/useTodayKey';
import { useActiveProgram } from '@/data/repositories/program-repository';
import { useActiveWorkout } from '@/data/repositories/workout-repository';

/** Nombre d'exercices nommés sur la carte du jour ; au-delà, « + N autres ». */
const PREVIEW_EXERCISE_COUNT = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Requêtes — exportées pour être testables contre le harness SQLite, comme les
// `SELECT_*` de `dashboard-repository` (jointures multi-tables : une erreur de
// `deleted_at` ou de propriétaire produit un hub faux sans jamais planter).
// ─────────────────────────────────────────────────────────────────────────────

type TodayPlanRow = {
  planned_session_id: string;
  session_id: string;
  /** US MUSCU-UX07 — programme de l'occurrence : la suggestion du hub en a besoin (R11). */
  program_id: string;
  /** US MUSCU-UX07 — l'exercice planifié : « la dernière fois » se lit par exercice. */
  exercise_id: string;
  /** US MUSCU-UX07 — équipement : une charge suggérée à la barre est arrondie au chargeable (R11). */
  equipment: string | null;
  session_name: string | null;
  order_index: number;
  program_name: string | null;
  week_index: number | null;
  /** `null` si l'exercice n'a de traduction ni dans la langue courante ni en français. */
  exercise_name: string | null;
  exercise_order: number;
  target_sets: number | null;
  rest_seconds: number | null;
  /** Groupe musculaire principal — la silhouette de la scène (US DASH-01) s'allume dessus. */
  muscle_primary: string | null;
};

/**
 * Occurrence `planned` d'aujourd'hui, **une ligne par exercice planifié** — c'est ce qui permet
 * d'en tirer l'aperçu et la durée estimée sans seconde requête.
 *
 * Paramètres : `[lang, userId, todayKey]`. Le pilier est figé à `strength` : ce hub n'affiche que
 * la musculation, et le passer en paramètre laisserait croire qu'il est réutilisable côté course
 * alors que la carte de course a ses propres champs (allure, blocs).
 */
export const SELECT_TODAY_PLAN = `
  SELECT ps.id AS planned_session_id, ps.session_id, ps.program_id, ps.week_index,
         s.name AS session_name, s.order_index,
         COALESCE(tl.name, tfr.name) AS program_name,
         COALESCE(etl.name, etfr.name) AS exercise_name,
         ep.order_index AS exercise_order, ep.target_sets, ep.rest_seconds,
         e.id AS exercise_id, e.equipment, e.muscle_primary
  FROM planned_sessions ps
  JOIN sessions s ON s.id = ps.session_id AND s.deleted_at IS NULL
  JOIN programs  p ON p.id = ps.program_id AND p.deleted_at IS NULL
  LEFT JOIN program_translations tl  ON tl.program_id  = p.id AND tl.lang  = ?  AND tl.deleted_at IS NULL
  LEFT JOIN program_translations tfr ON tfr.program_id = p.id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  JOIN exercise_plans ep ON ep.session_id = ps.session_id AND ep.deleted_at IS NULL
  JOIN exercises e ON e.id = ep.exercise_id AND e.deleted_at IS NULL
  LEFT JOIN exercise_translations etl  ON etl.exercise_id  = e.id AND etl.lang  = ?  AND etl.deleted_at IS NULL
  LEFT JOIN exercise_translations etfr ON etfr.exercise_id = e.id AND etfr.lang = 'fr' AND etfr.deleted_at IS NULL
  WHERE ps.owner_id = ? AND ps.deleted_at IS NULL AND p.pillar = 'strength'
    AND ps.scheduled_date = ? AND ps.status = 'planned'
  ORDER BY s.order_index, ep.order_index
`;

/**
 * Les lignes de la **première** occurrence du jour seulement — US MUSCU-UX07, règle R9.
 *
 * `SELECT_TODAY_PLAN` rend une ligne par exercice de **toutes** les occurrences du jour. Avec deux
 * séances muscu prévues le même jour, la carte additionnait leurs exercices (« 3 exercices » pour
 * une séance de 2) alors que Démarrer ne lance que la première. La première est celle de la
 * première ligne : la requête trie par rang de séance dans le programme.
 */
export function rowsOfFirstOccurrence<T extends { planned_session_id: string }>(
  rows: readonly T[],
): T[] {
  const first = rows[0];
  return first ? rows.filter((r) => r.planned_session_id === first.planned_session_id) : [];
}

/** US MUSCU-UX07 — le nom de la séance en cours, repris de sa séance de programme d'origine. */
export const SELECT_SESSION_NAME = `
  SELECT s.name FROM sessions s WHERE s.id = ? AND s.deleted_at IS NULL
`;

type TodayDoneRow = { session_name: string | null };

/** Occurrence muscu déjà terminée aujourd'hui — nuance l'état « repos ». */
export const SELECT_TODAY_DONE = `
  SELECT s.name AS session_name
  FROM planned_sessions ps
  JOIN sessions s ON s.id = ps.session_id AND s.deleted_at IS NULL
  JOIN programs  p ON p.id = ps.program_id AND p.deleted_at IS NULL
  WHERE ps.owner_id = ? AND ps.deleted_at IS NULL AND p.pillar = 'strength'
    AND ps.scheduled_date = ? AND ps.status = 'done'
  LIMIT 1
`;

type NextRow = { scheduled_date: string; session_name: string | null };

/** Prochaine occurrence muscu à venir, la plus proche. */
export const SELECT_NEXT_STRENGTH = `
  SELECT ps.scheduled_date, s.name AS session_name
  FROM planned_sessions ps
  JOIN sessions s ON s.id = ps.session_id AND s.deleted_at IS NULL
  JOIN programs  p ON p.id = ps.program_id AND p.deleted_at IS NULL
  WHERE ps.owner_id = ? AND ps.deleted_at IS NULL AND p.pillar = 'strength'
    AND ps.status = 'planned' AND ps.scheduled_date > ?
  ORDER BY ps.scheduled_date, s.order_index
  LIMIT 1
`;

type ProgressRow = { done_count: number; total_count: number; current_week: number | null };

/**
 * Avancement du programme actif : occurrences faites, total, et semaine en cours.
 *
 * `current_week` est l'index de la **prochaine occurrence non faite** — c'est là qu'on en est.
 * Quand tout est fait, on retombe sur le dernier index rencontré (`MAX`), sinon le programme
 * terminé afficherait « semaine 1 ».
 */
export const SELECT_PROGRAM_PROGRESS = `
  SELECT
    SUM(CASE WHEN ps.status = 'done' THEN 1 ELSE 0 END) AS done_count,
    COUNT(*) AS total_count,
    COALESCE(
      MIN(CASE WHEN ps.status = 'planned' THEN ps.week_index END),
      MAX(ps.week_index)
    ) AS current_week
  FROM planned_sessions ps
  WHERE ps.owner_id = ? AND ps.deleted_at IS NULL AND ps.program_id = ?
`;

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export type StrengthHubData = {
  state: HubState;
  /**
   * Groupes musculaires travaillés par la séance du jour — vide s'il n'y en a pas.
   *
   * US DASH-01 : c'est ce qui allume la silhouette de la scène. Rendu à côté de l'état plutôt que
   * dans `HubTodaySession` : la décision (`resolveHubState`) n'en a pas besoin, et la charger dans
   * son entrée obligerait chaque test de la brique à inventer des muscles.
   */
  todayMuscles: MuscleGroup[];
  /** Avancement du programme actif, `null` si aucun programme ou durée inconnue. */
  progress: ReturnType<typeof resolveProgramProgress>;
  /** Nom du programme actif, pour la barre de progression. */
  programName: string | null;
  /**
   * US MUSCU-UX07 — les exercices de la séance du jour, dans l'ordre du plan : « la dernière fois »
   * de la carte les lit un par un. Vide sans séance du jour.
   */
  todayExercises: { exerciseId: string; name: string | null; equipment: string | null }[];
  /**
   * US MUSCU-UX07 — programme et semaine de l'occurrence du jour : la suggestion du hub les passe à
   * `usePriorWeekAdherence`, comme la séance (R11). `null` sans séance du jour.
   */
  todayProgram: { programId: string; weekIndex: number | null } | null;
  isLoading: boolean;
};

/**
 * Tout ce que la zone Agir du hub muscu a besoin de savoir, plus l'avancement du programme.
 *
 * Tous les hooks sont appelés inconditionnellement (règle des hooks / React Compiler) : les
 * requêtes reçoivent une chaîne vide quand leur paramètre n'est pas encore résolu, ce qui ne
 * ramène aucune ligne — le patron déjà employé par `useSupersetPairs` et `useLastPerformance`.
 */
export function useStrengthHub(): StrengthHubData {
  const userId = useAuthStore((s) => s.session?.user.id ?? '');
  const lang = getAppLanguage() === 'en' ? 'en' : 'fr';
  const today = useTodayKey();

  const { workout, isLoading: workoutLoading } = useActiveWorkout();
  const { program, isLoading: programLoading } = useActiveProgram('strength');

  const { data: planRows, isLoading: planLoading } = useQuery<TodayPlanRow>(SELECT_TODAY_PLAN, [
    lang,
    lang,
    userId,
    today,
  ]);
  const { data: doneRows, isLoading: doneLoading } = useQuery<TodayDoneRow>(SELECT_TODAY_DONE, [
    userId,
    today,
  ]);
  const { data: nextRows, isLoading: nextLoading } = useQuery<NextRow>(SELECT_NEXT_STRENGTH, [
    userId,
    today,
  ]);
  const { data: progressRows, isLoading: progressLoading } = useQuery<ProgressRow>(
    SELECT_PROGRAM_PROGRESS,
    [userId, program?.id ?? ''],
  );
  // Une séance libre n'a pas de séance d'origine : la chaîne vide ne ramène aucune ligne.
  const { data: activeNameRows } = useQuery<{ name: string | null }>(SELECT_SESSION_NAME, [
    workout?.sessionId ?? '',
  ]);

  const isLoading =
    workoutLoading || programLoading || planLoading || doneLoading || nextLoading || progressLoading;

  // ── Séance du jour : une ligne par exercice, à replier en une carte ────────────────────────
  // R9 : la première occurrence seulement — deux séances le même jour ne s'additionnent plus.
  const todayRows = rowsOfFirstOccurrence(planRows);
  const first = todayRows[0];
  const todaySession = first
    ? {
        sessionId: first.session_id,
        plannedSessionId: first.planned_session_id,
        name: first.session_name,
        orderIndex: first.order_index,
        exerciseCount: todayRows.length,
        programName: first.program_name,
        // Les noms manquants sont écartés AVANT la troncature : un exercice créé dans une langue
        // et relu dans l'autre n'a de traduction ni en courant ni en français, et sa puce serait
        // vide. Mieux vaut nommer deux exercices sur trois que d'afficher un blanc.
        previewExercises: todayRows
          .map((r) => r.exercise_name)
          .filter((name): name is string => (name ?? '').trim() !== '')
          .slice(0, PREVIEW_EXERCISE_COUNT),
        estimatedMinutes: estimateSessionMinutes(
          todayRows.map((r) => ({ targetSets: r.target_sets, restSeconds: r.rest_seconds })),
        ),
      }
    : null;

  // ── Séance en cours : l'avancement réel, pour que la carte de reprise le montre ────────────
  const activeWorkout = workout
    ? {
        exerciseCount: workout.entries.length,
        doneSets: workout.entries.reduce(
          (n, e) => n + e.sets.filter((s) => s.done).length,
          0,
        ),
        totalSets: workout.entries.reduce((n, e) => n + e.sets.length, 0),
        // US MUSCU-UX07 : le nom de la séance d'origine ; `null` pour une séance libre.
        name: activeNameRows[0]?.name ?? null,
      }
    : null;

  const done = doneRows[0];
  const next = nextRows[0];
  const progressRow = progressRows[0];

  // Ordre canonique plutôt qu'ordre d'apparition : la silhouette ne doit pas changer d'aspect
  // parce qu'un exercice a été remonté dans la séance.
  const muscles = new Set(todayRows.map((r) => r.muscle_primary));
  const todayMuscles = MUSCLE_GROUPS.filter((group) => muscles.has(group));

  return {
    state: resolveHubState({
      activeWorkout,
      todaySession,
      hasActiveProgram: program != null,
      doneToday: done ? { name: done.session_name } : null,
      nextUpcoming: next
        ? { scheduledDate: next.scheduled_date, name: next.session_name }
        : null,
    }),
    progress:
      program && progressRow
        ? resolveProgramProgress({
            currentWeekIndex: progressRow.current_week,
            durationWeeks: program.durationWeeks ?? null,
            doneSessions: progressRow.done_count ?? 0,
            totalSessions: progressRow.total_count ?? 0,
          })
        : null,
    todayMuscles,
    programName: program?.name ?? null,
    todayExercises: todayRows.map((r) => ({
      exerciseId: r.exercise_id,
      name: r.exercise_name,
      equipment: r.equipment,
    })),
    todayProgram: first ? { programId: first.program_id, weekIndex: first.week_index } : null,
    isLoading,
  };
}

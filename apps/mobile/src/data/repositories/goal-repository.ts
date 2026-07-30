/**
 * Repository des objectifs personnels à échéance (US OBJ-01) : table `personal_goals`.
 *
 * Toute la logique de progression et de verdict vit dans `@wellness/shared` (`goals.ts`, 21 tests) :
 * ici, uniquement des entrées/sorties SQL et l'assemblage des sources d'activité.
 *
 * ── Conséquence de la décision D5 ──────────────────────────────────────────────────────────────
 * Aucune progression n'est stockée : elle est **recalculée à chaque affichage** à partir des courses
 * et des séries déjà en base. Il n'y a donc **rien à écrire** pour tenir un objectif à jour — ni
 * cron, ni job au démarrage — et l'écran fonctionne hors ligne à l'identique.
 *
 * ── Jours locaux, pas UTC ──────────────────────────────────────────────────────────────────────
 * Les timestamps sont lus bruts (UTC) puis convertis en clé de jour **locale** en JS via
 * `localDayKey`, comme le fait `useStreakData`. Passer par `date()` en SQLite donnerait le jour
 * **UTC** : une course de 23 h le 31 juillet basculerait au 1ᵉʳ août et sortirait de la fenêtre.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useQuery } from '@powersync/react';
import {
  computeGoalProgress,
  estimate1RM,
  localDayKey,
  MAX_ACTIVE_GOALS,
  type GoalKind,
  type GoalLift,
  type GoalProgress,
  type GoalRun,
  type PersonalGoal,
} from '@wellness/shared';

import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, softDelete } from './_sql';
import { useTodayDate, useTodayKey, useWindowStartKey, useWindowStartUtc } from '@/hooks/useTodayKey';

/** Un objectif enrichi de sa progression calculée et du nom de l'exercice visé. */
export type GoalWithProgress = PersonalGoal & {
  progress: GoalProgress;
  /** Nom résolu de l'exercice visé, `null` pour un objectif de course. */
  exerciseName: string | null;
};

type GoalDbRow = {
  id: string;
  kind: string;
  target_value: number;
  start_value: number | null;
  exercise_id: string | null;
  start_date: string;
  deadline: string;
  exercise_name: string | null;
};

/**
 * Objectifs de l'utilisateur, du plus urgent au moins urgent.
 *
 * ⚠️ Les jointures de traduction **ne filtrent pas `deleted_at`** — même correctif qu'ADMIN-01 sur
 * l'historique des séances. Un exercice archivé côté back-office doit continuer d'afficher **son
 * nom** dans un objectif qui le vise ; le filtrer ferait tomber le `COALESCE` sur `null` et
 * l'objectif s'afficherait sans libellé.
 */
const SELECT_GOALS = `
  SELECT g.id, g.kind, g.target_value, g.start_value, g.exercise_id,
         g.start_date, g.deadline,
         COALESCE(tl.name, tfr.name) AS exercise_name
  FROM personal_goals g
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = g.exercise_id AND tl.lang = ?
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = g.exercise_id AND tfr.lang = 'fr'
  WHERE g.deleted_at IS NULL
  ORDER BY g.deadline ASC
`;

/** Courses terminées : `finished_at` brut (UTC), converti en jour local côté JS. */
const SELECT_RUNS = `
  SELECT finished_at, distance_m
  FROM runs
  WHERE status = 'completed' AND deleted_at IS NULL
    AND finished_at IS NOT NULL AND distance_m IS NOT NULL
`;

function rowToGoal(row: GoalDbRow): PersonalGoal {
  return {
    id: row.id,
    kind: row.kind as GoalKind,
    targetValue: row.target_value,
    startValue: row.start_value,
    exerciseId: row.exercise_id,
    startDate: row.start_date,
    deadline: row.deadline,
  };
}

/**
 * Séries de musculation utiles au calcul des objectifs de force.
 *
 * Un `GoalLift` est produit **par série**, pas par séance : `computeGoalProgress` ne retient que le
 * maximum sur la fenêtre, et `max(estimate1RM par série)` est exactement `sessionBestEstimated1RM`.
 * Le regroupement par séance serait donc du travail sans effet sur le résultat.
 *
 * Les séries d'échauffement sont exclues : un 1RM estimé sur un échauffement n'a pas de sens.
 */
function useGoalLifts(exerciseIds: string[]): { lifts: GoalLift[]; isLoading: boolean } {
  // Aucun objectif de force → requête inutile. `useQuery` doit rester appelé (règle des hooks), donc
  // on l'exécute sur une clause impossible plutôt que de sortir tôt.
  const placeholders = exerciseIds.length ? exerciseIds.map(() => '?').join(', ') : `''`;
  const sql = `
    SELECT s.exercise_id, s.reps, s.weight_kg, w.finished_at
    FROM workout_sets s
    JOIN workouts w ON w.id = s.workout_id
      AND w.status = 'completed' AND w.deleted_at IS NULL AND w.finished_at IS NOT NULL
    WHERE s.exercise_id IN (${placeholders})
      AND s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup'
      AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
  `;

  const { data, isLoading } = useQuery<{
    exercise_id: string;
    reps: number;
    weight_kg: number;
    finished_at: string;
  }>(sql, exerciseIds);

  const lifts = useMemo(
    () =>
      data.map((row) => ({
        dayKey: localDayKey(new Date(row.finished_at)),
        exerciseId: row.exercise_id,
        estimated1RM: estimate1RM(row.weight_kg, row.reps),
      })),
    [data],
  );

  return { lifts, isLoading };
}

/**
 * Tous les objectifs, séparés en **actifs** et **terminés**, progression comprise.
 *
 * Le tri des terminés est inversé (échéance la plus récente d'abord) : un objectif clos il y a
 * trois jours intéresse plus que celui d'il y a six mois.
 */
export function useGoals(): {
  active: GoalWithProgress[];
  finished: GoalWithProgress[];
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const { data: goalRows, isLoading: goalsLoading } = useQuery<GoalDbRow>(SELECT_GOALS, [lang]);
  const { data: runRows, isLoading: runsLoading } = useQuery<{
    finished_at: string;
    distance_m: number;
  }>(SELECT_RUNS);

  const exerciseIds = useMemo(
    () =>
      [
        ...new Set(
          goalRows
            .filter((r) => r.kind === 'exercise_1rm' && r.exercise_id != null)
            .map((r) => r.exercise_id as string),
        ),
      ].sort(),
    [goalRows],
  );

  const { lifts, isLoading: liftsLoading } = useGoalLifts(exerciseIds);

  const todayKey = useTodayKey();

  return useMemo(() => {
    const runs: GoalRun[] = runRows.map((r) => ({
      dayKey: localDayKey(new Date(r.finished_at)),
      distanceM: r.distance_m,
    }));

    const enriched = goalRows.map((row) => {
      const goal = rowToGoal(row);
      return {
        ...goal,
        exerciseName: row.exercise_name,
        progress: computeGoalProgress({ goal, runs, lifts, todayKey }),
      };
    });

    return {
      active: enriched.filter((g) => g.progress.status === 'active'),
      finished: enriched
        .filter((g) => g.progress.status !== 'active')
        .sort((a, b) => b.deadline.localeCompare(a.deadline)),
      isLoading: goalsLoading || runsLoading || liftsLoading,
    };
  }, [goalRows, runRows, lifts, todayKey, goalsLoading, runsLoading, liftsLoading]);
}

/** Nombre d'objectifs encore en cours — sert à appliquer le plafond de `MAX_ACTIVE_GOALS`. */
export function useActiveGoalCount(): { count: number; isLoading: boolean } {
  const { active, isLoading } = useGoals();
  return { count: active.length, isLoading };
}

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible de créer un objectif.');
  return userId;
}

/**
 * Meilleur 1RM estimé **actuel** sur un exercice, toutes séances confondues.
 *
 * Sert à figer `start_value` au moment de la création (décision D6). Renvoie `null` si l'exercice
 * n'a jamais été travaillé : l'objectif part alors de zéro, et l'UI doit le dire — poser
 * « +5 kg » sur un mouvement jamais chargé n'a pas de référence.
 */
export async function currentBest1RM(exerciseId: string): Promise<number | null> {
  const rows = await powerSync.getAll<{ reps: number; weight_kg: number }>(
    `SELECT s.reps, s.weight_kg
     FROM workout_sets s
     JOIN workouts w ON w.id = s.workout_id
       AND w.status = 'completed' AND w.deleted_at IS NULL
     WHERE s.exercise_id = ? AND s.deleted_at IS NULL AND s.done = 1
       AND s.set_type <> 'warmup' AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL`,
    [exerciseId],
  );
  if (rows.length === 0) return null;

  const best = Math.max(...rows.map((r) => estimate1RM(r.weight_kg, r.reps)));
  return best > 0 ? Math.round(best * 100) / 100 : null;
}

export type CreateGoalInput = {
  kind: GoalKind;
  /** Mètres pour `run_distance`, kilogrammes pour `exercise_1rm`. */
  targetValue: number;
  /** Requis pour `exercise_1rm`. */
  exerciseId?: string | null;
  /** 1RM de départ figé (D6). `null` pour un cumul. */
  startValue?: number | null;
  startDate: string;
  deadline: string;
};

/**
 * Crée un objectif.
 *
 * Le plafond est **relu ici**, pas repris de l'affichage : entre le moment où l'écran s'affiche et
 * la validation du formulaire, un autre appareil peut avoir créé un objectif. Même raisonnement que
 * le quota de jokers (STREAK-01).
 */
export async function createGoal(input: CreateGoalInput): Promise<string> {
  const activeRows = await powerSync.getAll<{ deadline: string }>(
    `SELECT deadline FROM personal_goals WHERE deleted_at IS NULL`,
  );
  const todayKey = localDayKey(new Date());
  const activeCount = activeRows.filter((r) => r.deadline >= todayKey).length;
  if (activeCount >= MAX_ACTIVE_GOALS) {
    throw new Error(`Plafond atteint : ${MAX_ACTIVE_GOALS} objectifs actifs au maximum.`);
  }

  return insertWithSyncFields('personal_goals', {
    user_id: currentUserId(),
    kind: input.kind,
    target_value: input.targetValue,
    start_value: input.startValue ?? null,
    exercise_id: input.exerciseId ?? null,
    start_date: input.startDate,
    deadline: input.deadline,
  });
}

/**
 * Supprime un objectif (soft delete).
 *
 * Volontairement disponible **aussi sur un objectif terminé** : garder la trace d'un échec est utile
 * (décision D3), l'imposer indéfiniment ne l'est pas.
 */
export async function deleteGoal(id: string): Promise<void> {
  await softDelete('personal_goals', id);
}

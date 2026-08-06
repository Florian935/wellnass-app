/**
 * Repository du bilan hebdomadaire (US BILAN-01).
 *
 * Toute la synthèse — chiffres, signaux ordonnés, décision unique — vit dans `@wellness/shared`
 * (`weekly-review.ts`, 26 tests). Ici : uniquement des requêtes SQL et l'assemblage de l'input.
 *
 * ── Pourquoi des requêtes dédiées et non les hooks existants (décision D6) ────────────────────────
 * `useWeeklyVolumeComparison` porte sur **7 jours glissants** et `useMuscleBalance` sur **14 jours**.
 * Les réutiliser afficherait, sous un titre « semaine du 20 au 26 juillet », des chiffres portant sur
 * une **autre période** — exactement la narration non adossée aux chiffres que la roadmap interdit.
 * Le coût est quelques requêtes bornées de plus ; le bénéfice est un bilan qui ne mente pas.
 *
 * ── Aucune écriture ───────────────────────────────────────────────────────────────────────────────
 * Le bilan est **entièrement dérivé** (D1/D7) : rien n'est stocké, donc rien à synchroniser, et tout
 * fonctionne hors ligne. C'est aussi ce qui rend la consultation d'une autre semaine gratuite plus
 * tard — il suffirait de changer la fenêtre passée en paramètre.
 */

import { useMemo } from 'react';

import { useQuery } from '@powersync/react';
import {
  buildWeeklyReview,
  computeMuscleBalance,
  lastClosedWeek,
  localDayKey,
  normalizeFineMuscles,
  normalizeSecondaryMuscles,
  parseJsonColumn,
  previousWeek,
  resolveActivePillars,
  resolveTonnageFineMuscles,
  type FineMuscle,
  type MuscleGroup,
  type PillarWeek,
  type ReviewGoal,
  type ReviewPeriod,
  type WeeklyReview,
} from '@wellness/shared';

import { useSettings } from './settings-repository';
import { useGoals } from './goal-repository';
import { useGoalAdherenceForRange } from './dashboard-repository';
import { useStepGoal } from './daily-steps-repository';
import { useRealLifeDaysInWeek } from './real-life-repository';
import { useTodayDate, useTodayKey, useWindowStartKey, useWindowStartUtc } from '@/hooks/useTodayKey';

// ─────────────────────────────────────────────────────────────────────────────
// Requêtes — exportées pour être testables
//
// Les constantes SQL et `utcBounds` ci-dessous sont `export` **uniquement pour les tests** : elles
// ne sont consommées ailleurs que par les hooks de ce fichier. Un bilan est fait de chiffres qu'on
// affiche sous un titre de semaine ; une borne fausse ou un `deleted_at` oublié produit un bilan
// qui ment sans jamais planter. Les exécuter pour de bon contre le harness SQLite
// (`@/test-utils/sqlite-harness`) est le seul moyen de le voir — les hooks, eux, ne sont pas
// exécutables hors React.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bornes UTC d'une fenêtre de jours **locaux**.
 *
 * Les timestamps sont stockés en UTC ; comparer une clé de jour locale à un instant UTC déborderait
 * d'un côté ou de l'autre selon le fuseau. On convertit donc la fenêtre locale en instants UTC —
 * borne haute exclusive au minuit du lendemain.
 */
export function utcBounds(period: ReviewPeriod): { from: string; toExclusive: string } {
  const parse = (key: string): Date => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y!, m! - 1, d!, 0, 0, 0, 0);
  };
  const from = parse(period.start);
  const to = parse(period.end);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), toExclusive: to.toISOString() };
}

/** Séances terminées + tonnage, bornés sur la fenêtre. */
export const SELECT_STRENGTH = `
  SELECT COUNT(DISTINCT w.id) AS workouts,
         COALESCE(SUM(s.reps * s.weight_kg), 0) AS tonnage
  FROM workouts w
  LEFT JOIN workout_sets s ON s.workout_id = w.id
    AND s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup'
    AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
  WHERE w.status = 'completed' AND w.deleted_at IS NULL
    AND w.finished_at >= ? AND w.finished_at < ?
`;

/** Séries par groupe musculaire sur la fenêtre — alimente `computeMuscleBalance`. */
export const SELECT_MUSCLE_SETS = `
  SELECT e.muscle_primary AS muscle, COUNT(*) AS sets
  FROM workout_sets s
  JOIN workouts w ON w.id = s.workout_id
    AND w.status = 'completed' AND w.deleted_at IS NULL
  JOIN exercises e ON e.id = s.exercise_id
  WHERE s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup'
    AND w.finished_at >= ? AND w.finished_at < ?
  GROUP BY e.muscle_primary
`;

/**
 * Tonnage par exercice sur la fenêtre, avec l'anatomie de l'exercice — US MUSC-F1b (roadmap 6.2).
 * **Additive, indépendante de `SELECT_MUSCLE_SETS`** (spec §0) : celle-ci alimente
 * `computeMuscleBalance` sur les 6 groupes larges et ne doit pas être touchée. Groupée par exercice
 * (pas par muscle) : l'agrégation vers les muscles fins se fait en JS via `resolveFineMuscles`, un
 * exercice pouvant contribuer à plusieurs muscles.
 */
export const SELECT_EXERCISE_TONNAGE = `
  SELECT e.id AS exercise_id, e.muscle_primary, e.muscles_secondary, e.muscles_fine,
         COALESCE(SUM(s.reps * s.weight_kg), 0) AS tonnage
  FROM workout_sets s
  JOIN workouts w ON w.id = s.workout_id
    AND w.status = 'completed' AND w.deleted_at IS NULL
  JOIN exercises e ON e.id = s.exercise_id
  WHERE s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup'
    AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
    AND w.finished_at >= ? AND w.finished_at < ?
  GROUP BY e.id
`;

/** Sorties terminées + distance, bornées sur la fenêtre. */
export const SELECT_RUNS = `
  SELECT COUNT(*) AS runs, COALESCE(SUM(distance_m), 0) AS distance
  FROM runs
  WHERE status = 'completed' AND deleted_at IS NULL
    AND finished_at >= ? AND finished_at < ?
`;

/** Records battus dans la fenêtre. */
export const SELECT_RECORDS = `
  SELECT COUNT(*) AS records
  FROM personal_records
  WHERE deleted_at IS NULL AND achieved_at >= ? AND achieved_at < ?
`;

/** Jours de journal alimentaire (au moins 1 kcal) dans la fenêtre — bornes sur `log_date` local. */
export const SELECT_LOGGED_DAYS = `
  SELECT log_date, SUM(kcal) AS kcal
  FROM food_entries
  WHERE deleted_at IS NULL AND log_date >= ? AND log_date <= ?
  GROUP BY log_date
  HAVING SUM(kcal) > 0
`;

/** Jours d'activité (muscu / course) de la fenêtre, en clés de jour locales. */
export const SELECT_ACTIVITY_DAYS = `
  SELECT finished_at FROM workouts
  WHERE status = 'completed' AND deleted_at IS NULL
    AND finished_at >= ? AND finished_at < ?
  UNION ALL
  SELECT finished_at FROM runs
  WHERE status = 'completed' AND deleted_at IS NULL
    AND finished_at >= ? AND finished_at < ?
`;

/** Pas de la fenêtre (bornes sur `log_date`). */
export const SELECT_STEPS = `
  SELECT log_date, steps FROM daily_steps
  WHERE deleted_at IS NULL AND log_date >= ? AND log_date <= ?
`;

/**
 * Chiffres d'une semaine.
 *
 * ⚠️ **Les jokers de série ne comptent PAS** comme jours actifs. Un joker protège **le compteur de
 * série et rien d'autre** (STREAK-01, décision D3) : le bilan doit voir la semaine telle qu'elle a
 * été vécue, sinon il féliciterait pour un jour où rien n'a eu lieu.
 */
function useWeekMetrics(
  period: ReviewPeriod,
  stepGoal: number,
): { metrics: PillarWeek; muscleSets: { muscle: MuscleGroup; sets: number }[]; isLoading: boolean } {
  const { from, toExclusive } = utcBounds(period);
  const tsParams = [from, toExclusive];

  const strength = useQuery<{ workouts: number; tonnage: number }>(SELECT_STRENGTH, tsParams);
  const runs = useQuery<{ runs: number; distance: number }>(SELECT_RUNS, tsParams);
  const muscles = useQuery<{ muscle: MuscleGroup; sets: number }>(SELECT_MUSCLE_SETS, tsParams);
  const logged = useQuery<{ log_date: string; kcal: number }>(SELECT_LOGGED_DAYS, [
    period.start,
    period.end,
  ]);
  const activity = useQuery<{ finished_at: string }>(SELECT_ACTIVITY_DAYS, [
    ...tsParams,
    ...tsParams,
  ]);
  const steps = useQuery<{ log_date: string; steps: number }>(SELECT_STEPS, [
    period.start,
    period.end,
  ]);

  const isLoading =
    strength.isLoading ||
    runs.isLoading ||
    muscles.isLoading ||
    logged.isLoading ||
    activity.isLoading ||
    steps.isLoading;

  const metrics = useMemo<PillarWeek>(() => {
    const activeDays = new Set<string>();
    for (const row of activity.data) activeDays.add(localDayKey(new Date(row.finished_at)));
    for (const row of logged.data) activeDays.add(row.log_date);
    // Comme pour la série (PAS-01), seul l'objectif de pas ATTEINT compte : « au moins un pas »
    // rendrait la semaine active en laissant le téléphone dans sa poche.
    for (const row of steps.data) if (row.steps >= stepGoal) activeDays.add(row.log_date);

    return {
      workouts: strength.data[0]?.workouts ?? 0,
      tonnageKg: Math.round(strength.data[0]?.tonnage ?? 0),
      runs: runs.data[0]?.runs ?? 0,
      distanceM: Math.round(runs.data[0]?.distance ?? 0),
      loggedDays: logged.data.length,
      // Renseigné par l'appelant : l'adhérence dépend d'une cible calorique, calculée ailleurs.
      daysInTarget: null,
      activeDays: activeDays.size,
    };
  }, [strength.data, runs.data, logged.data, activity.data, steps.data, stepGoal]);

  return { metrics, muscleSets: muscles.data, isLoading };
}

/** Ligne brute de `SELECT_EXERCISE_TONNAGE`. */
type ExerciseTonnageDbRow = {
  exercise_id: string;
  muscle_primary: string;
  muscles_secondary: string | null;
  muscles_fine: string | null;
  tonnage: number;
};

/**
 * Schéma corporel du bilan hebdomadaire (US MUSC-F1b, R3) : agrège le tonnage de la **même
 * semaine ISO close** que le reste du bilan (D6, voir en-tête du fichier) par muscle fin, via
 * `resolveTonnageFineMuscles`. Semaine vide → `{ full: [], reduced: [] }` (silhouette neutre).
 */
export function useWeeklyMuscleTonnage(): {
  full: FineMuscle[];
  reduced: FineMuscle[];
  isLoading: boolean;
} {
  const today = useTodayDate();
  const period = lastClosedWeek(today);
  const { from, toExclusive } = utcBounds(period);

  const { data, isLoading } = useQuery<ExerciseTonnageDbRow>(SELECT_EXERCISE_TONNAGE, [
    from,
    toExclusive,
  ]);

  const result = useMemo(
    () =>
      resolveTonnageFineMuscles(
        data.map((row) => {
          const musclePrimary = row.muscle_primary as MuscleGroup;
          return {
            tonnageKg: row.tonnage,
            musclePrimary,
            musclesSecondary: normalizeSecondaryMuscles(
              parseJsonColumn<unknown>(row.muscles_secondary, []),
              musclePrimary,
            ),
            musclesFine: normalizeFineMuscles(parseJsonColumn<unknown>(row.muscles_fine, [])),
          };
        }),
      ),
    [data],
  );

  return { ...result, isLoading };
}

/**
 * Bilan de la dernière semaine ISO **close** (décision D5).
 *
 * Recalculé à chaque affichage : c'est le cœur de D1, et c'est ce qui garantit que les chiffres sont
 * toujours exacts — y compris quand la notification arrive en retard à cause du doze mode Android.
 */
export function useWeeklyReview(): { review: WeeklyReview; isLoading: boolean } {
  const { settings } = useSettings();
  const { goal: stepGoal, isLoading: stepGoalLoading } = useStepGoal();

  const today = useTodayDate();
  const period = lastClosedWeek(today);
  const prevPeriod = previousWeek(period);

  const current = useWeekMetrics(period, stepGoal);
  const previous = useWeekMetrics(prevPeriod, stepGoal);

  const { from, toExclusive } = utcBounds(period);
  const records = useQuery<{ records: number }>(SELECT_RECORDS, [from, toExclusive]);

  const { active: activeGoals, isLoading: goalsLoading } = useGoals();
  // Adhérence bornée sur **la même semaine** que le reste (D6). `useGoalAdherenceForRange` a été
  // extrait de `useGoalAdherence` pour ça : la version glissante sur 7 jours aurait affiché, sous le
  // titre « semaine du 20 au 26 », un chiffre portant sur une autre période.
  const adherence = useGoalAdherenceForRange(period.start, period.end);

  const activePillars = useMemo(() => {
    const pillars = resolveActivePillars(settings?.activePillars);
    return {
      strength: pillars.includes('strength'),
      running: pillars.includes('running'),
      nutrition: pillars.includes('nutrition'),
    };
  }, [settings?.activePillars]);

  // `todayKey` doit figurer dans les dépendances : sans lui, `elapsedRatio` restait figé sur le jour
  // du calcul. Cette péremption-là est antérieure à React Compiler — c'est un `useMemo` écrit à la
  // main dont la liste de dépendances était incomplète.
  const todayKey = useTodayKey();
  const goals = useMemo<ReviewGoal[]>(
    () =>
      activeGoals.map((goal) => {
        const total = Math.max(1, daysInclusive(goal.startDate, goal.deadline));
        const elapsed = Math.min(total, daysInclusive(goal.startDate, todayKey));
        return {
          id: goal.id,
          label: goal.exerciseName ?? goal.kind,
          ratio: goal.progress.ratio,
          elapsedRatio: elapsed / total,
        };
      }),
    [activeGoals, todayKey],
  );

  // US VIE-01 (R7) : jours de LA SEMAINE BILANTÉE couverts par une période — pas ceux d'aujourd'hui.
  // Le bilan porte sur la semaine close, et une période à cheval doit donner un décompte par semaine.
  const realLifeDays = useRealLifeDaysInWeek(period.start, period.end);

  const isLoading =
    current.isLoading ||
    previous.isLoading ||
    records.isLoading ||
    goalsLoading ||
    stepGoalLoading ||
    adherence.isLoading;

  const review = useMemo(() => {
    const balance = computeMuscleBalance(current.muscleSets);
    // Un seul groupe est nommé : « tu délaisses le dos » est actionnable, une liste de quatre groupes
    // ne l'est pas — et le format « une seule décision » l'interdit.
    const underworked =
      balance.hasEnoughData && balance.neglected.length > 0 ? (balance.neglected[0] ?? null) : null;

    const withTarget = (week: PillarWeek, daysInTarget: number | null): PillarWeek => ({
      ...week,
      daysInTarget,
    });

    return buildWeeklyReview({
      period,
      current: withTarget(
        current.metrics,
        adherence.hasTarget && activePillars.nutrition ? adherence.daysInTarget : null,
      ),
      // Première semaine d'utilisation : aucune donnée avant, donc **aucune comparaison** — un
      // « +100 % » depuis zéro serait une flatterie mensongère.
      previous: isFirstWeek(previous.metrics) ? null : withTarget(previous.metrics, null),
      recordsBeaten: records.data[0]?.records ?? 0,
      goals,
      underworkedMuscle: underworked,
      activePillars,
      // US VIE-01 (R7) : double rôle. Il **annote** le bilan (« 4 jours en mode vie réelle ») et,
      // dès qu'il est > 0, il fait **taire les décisions de reproche** — sinon le bilan aurait titré
      // « ton volume a chuté de 40 % » sur une semaine que l'utilisateur a lui-même déclarée allégée.
      // 🔴 `goal_behind` reste affiché, volontairement (décision D6).
      realLifeDays,
    });
  }, [
    period,
    current.metrics,
    current.muscleSets,
    previous.metrics,
    records.data,
    goals,
    activePillars,
    adherence.hasTarget,
    adherence.daysInTarget,
    realLifeDays,
  ]);

  return { review, isLoading };
}

/** Nombre de jours de `fromKey` à `toKey`, bornes incluses (donc ≥ 1 si `to ≥ from`). */
function daysInclusive(fromKey: string, toKey: string): number {
  const toMs = (key: string): number => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y!, m! - 1, d!, 12);
  };
  return Math.round((toMs(toKey) - toMs(fromKey)) / 86_400_000) + 1;
}

/**
 * Vrai si la semaine précédente est **entièrement** vide.
 *
 * On l'interprète comme « il n'y avait rien avant » plutôt que comme une chute : au premier usage,
 * comparer à zéro produirait des variations spectaculaires et fausses.
 */
function isFirstWeek(week: PillarWeek): boolean {
  return (
    week.workouts === 0 &&
    week.runs === 0 &&
    week.loggedDays === 0 &&
    week.activeDays === 0 &&
    week.tonnageKg === 0
  );
}

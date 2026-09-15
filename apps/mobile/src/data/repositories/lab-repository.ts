/**
 * US LABO-01 (roadmap 7.30) — l'assembleur du Labo : il branche les moteurs purs de
 * `@wellness/shared` (`lab-week`, `lab-investigations`, `lab-experiments`, `lab-composer`) sur les
 * données réelles de l'app.
 *
 * ⚠️ **Aucune règle métier ici**, même discipline qu'`insights-repository` : si vous vous apprêtez à
 * écrire une condition qui décide de quelque chose (un seuil, un tri, un verdict), elle est au
 * mauvais endroit. Ce fichier lit, convertit, et passe.
 *
 * ⚠️ **Deux requêtes neuves seulement** — les meilleures charges par semaine et les séries par
 * séance pour « jambes lourdes ». Tout le reste réutilise les hooks déjà montés ailleurs
 * (`useWeekPlan`, `useSessionConflicts`, `useRunHistory`, `useWorkoutHistory`, `useDailyTotals`,
 * `useWellbeingEntries`…), pour ne pas instancier deux fois les mêmes lectures.
 *
 * 🔴 **Aucune lecture d'horloge dans ces hooks** : `useTodayKey` / `useWindowStartKey` sont les
 * seules sources (React Compiler — voir `hooks/useTodayKey.ts`).
 */

import { useQuery } from '@powersync/react';
import {
  ACWR_LOW_THRESHOLD,
  ACWR_RISK_THRESHOLD,
  CARB_TARGETS_G_PER_KG,
  GOOD_NIGHT_MINUTES,
  LAB_EXPERIMENT_TEMPLATES,
  PROTEIN_TARGETS_G_PER_KG,
  addDays,
  buildLabKnowledge,
  buildLabQuestions,
  buildLabWeek,
  estimate1RM,
  experimentAdherence,
  experimentVerdict,
  isHeavyLegSession,
  localDateFromDayKey,
  localDayKey,
  objectiveCalorieDelta,
  objectiveFromGoal,
  projectSbd,
  resolveActivePillars,
  sessionLoad,
  startOfWeek,
  type AcwrResult,
  type LabComposerContext,
  type LabDoses,
  type LabExperimentRecord,
  type LabHistoryInput,
  type LabKnowledgeCard,
  type LabQuestion,
  type LabSessionInput,
  type LabWeek,
  type MuscleGroup,
  type NutritionObjective,
  type Pillar,
} from '@wellness/shared';

import { useTodayKey, useWindowStartKey } from '@/hooks/useTodayKey';
import { useLatestWeight, useWeightEntries } from './bodyweight-repository';
import {
  useDeficitVolumeAlert,
  useNutritionSummary,
  useOvertrainingGuardAlert,
  useTrainingLoadAlert,
} from './dashboard-repository';
import { useWellbeingEntries } from './daily-wellbeing-repository';
import { useDailyTotals } from './journal-repository';
import { useLabExperiments } from './lab-experiment-repository';
import { useCarbsPerKg, useNutritionProfile } from './nutrition-repository';
import { useSessionConflicts, useWeekPlan } from './planned-session-repository';
import { useProfile } from './profile-repository';
import { useRunnerProfile } from './running-profile-repository';
import { useRunHistory } from './run-repository';
import { useSettings } from './settings-repository';
import { useStrengthSection } from './strength-repository';
import { useWorkoutHistory } from './workout-repository';

/** Fenêtre d'historique du Labo : huit semaines, l'horizon des enquêtes et des acquis. */
export const LAB_HISTORY_DAYS = 56;

// ---------------------------------------------------------------------------
// Requêtes neuves
// ---------------------------------------------------------------------------

/**
 * Séries qualifiantes des trois mouvements désignés (SBD) sur la fenêtre, pour reconstituer le
 * meilleur 1RM estimé **par semaine**. Le calcul d'Epley reste en JS (`estimate1RM`), comme
 * `useExerciseProgression` : une formule, un seul endroit.
 */
export const SELECT_LAB_LIFT_SETS = `
  SELECT s.exercise_id, w.finished_at, s.reps, s.weight_kg
  FROM workout_sets s
  JOIN workouts w ON w.id = s.workout_id AND w.status = 'completed' AND w.deleted_at IS NULL
  WHERE s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup'
    AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
    AND w.finished_at >= ?
    AND s.exercise_id IN (?, ?, ?)
  ORDER BY w.finished_at
`;

/**
 * Séries par groupe musculaire et par séance terminée, sur la fenêtre : de quoi rejouer
 * `isHeavyLegSession` (COLLIS-01) sur ce qui a **réellement** été fait, et pas seulement sur ce qui
 * était planifié.
 */
export const SELECT_LAB_WORKOUT_MUSCLES = `
  SELECT w.id AS workout_id, w.finished_at, e.muscle_primary AS muscle, COUNT(*) AS sets
  FROM workout_sets s
  JOIN workouts w ON w.id = s.workout_id AND w.status = 'completed' AND w.deleted_at IS NULL
  JOIN exercises e ON e.id = s.exercise_id
  WHERE s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup'
    AND w.finished_at >= ?
  GROUP BY w.id, w.finished_at, e.muscle_primary
`;

// ---------------------------------------------------------------------------
// Outils de conversion
// ---------------------------------------------------------------------------

/** `ratio` du widget de charge → résultat d'ACWR, ou `null` sans historique (mêmes seuils). */
function toAcwr(load: { show: boolean; ratio: number | null }): AcwrResult | null {
  if (load.ratio === null) return null;
  const zone = load.ratio < ACWR_LOW_THRESHOLD ? 'low' : load.ratio > ACWR_RISK_THRESHOLD ? 'risk' : 'safe';
  return { ratio: load.ratio, zone, showAlert: load.show };
}

/** Horodatage ISO → clé de jour locale ; `null` si la séance n'est pas terminée. */
function dayKeyOf(iso: string | null): string | null {
  return iso === null ? null : localDayKey(new Date(iso));
}

/** L'objectif nutritionnel effectif, avec le même repli qu'ailleurs dans l'app. */
export function useLabObjective(): NutritionObjective {
  const { nutritionProfile } = useNutritionProfile();
  const { profile } = useProfile();
  return nutritionProfile?.objective ?? objectiveFromGoal(profile?.mainGoal ?? null);
}

// ---------------------------------------------------------------------------
// Onglet « Semaine »
// ---------------------------------------------------------------------------

export function useLabWeek(): { week: LabWeek; weekStartKey: string; isLoading: boolean } {
  const todayKey = useTodayKey();
  const weekStartKey = localDayKey(startOfWeek(localDateFromDayKey(todayKey)));
  const weekEndKey = localDayKey(addDays(localDateFromDayKey(weekStartKey), 6));

  const { settings, isLoading: settingsLoading } = useSettings();
  const { items, isLoading: planLoading } = useWeekPlan(weekStartKey);
  const { conflicts, isLoading: conflictsLoading } = useSessionConflicts(weekStartKey);
  const { runs, isLoading: runsLoading } = useRunHistory();
  const { totals, isLoading: totalsLoading } = useDailyTotals(weekStartKey);
  const { entries: nights, isLoading: nightsLoading } = useWellbeingEntries(weekStartKey);
  const { latest, isLoading: weightLoading } = useLatestWeight();
  const objective = useLabObjective();
  const overtraining = useOvertrainingGuardAlert();
  const load = useTrainingLoadAlert();
  const deficitVolume = useDeficitVolumeAlert();
  const { result: carbs, isLoading: carbsLoading } = useCarbsPerKg('7d');

  const sessions: LabSessionInput[] = items.map((item) => ({
    id: item.id,
    dayKey: item.scheduledDate,
    pillar: item.pillar,
    status: item.status,
    name: item.sessionName,
    sessionType: item.sessionType,
    targetDistanceM: item.targetDistanceM,
  }));

  const week = buildLabWeek({
    weekStartKey,
    todayKey,
    activePillars: resolveActivePillars(settings?.activePillars),
    sessions,
    runs: runs
      .map((run) => ({ dayKey: dayKeyOf(run.finishedAt), distanceM: run.distanceM ?? 0 }))
      .filter((run): run is { dayKey: string; distanceM: number } => run.dayKey !== null && run.dayKey >= weekStartKey && run.dayKey <= weekEndKey),
    proteinByDay: totals.map((t) => ({ dayKey: t.logDate, proteinG: t.proteinG })),
    weightKg: latest?.weightKg ?? null,
    proteinTarget: PROTEIN_TARGETS_G_PER_KG[objective],
    nights: nights.map((n) => ({ dayKey: n.logDate, sleepMinutes: n.sleepMinutes })),
    conflicts,
    overtraining,
    acwr: toAcwr(load),
    deficitVolume,
    carbs,
  });

  return {
    week,
    weekStartKey,
    isLoading: settingsLoading || planLoading || conflictsLoading || runsLoading || totalsLoading || nightsLoading || weightLoading || carbsLoading,
  };
}

// ---------------------------------------------------------------------------
// Historique commun aux onglets « Pourquoi ? » et « Acquis »
// ---------------------------------------------------------------------------

type LabHistory = {
  input: LabHistoryInput;
  /** Jours de séance à jambes lourdes, pour l'adhérence des expériences. */
  heavyLegDays: string[];
  qualityRunDays: string[];
  carbsByDay: { dayKey: string; gPerKg: number }[];
  energyByDay: { dayKey: string; value: number }[];
  isLoading: boolean;
};

function useLabHistory(): LabHistory {
  const todayKey = useTodayKey();
  const sinceKey = useWindowStartKey(LAB_HISTORY_DAYS);
  const sinceUtc = localDateFromDayKey(sinceKey).toISOString();

  const { settings, isLoading: settingsLoading } = useSettings();
  const { lifts, isLoading: liftsLoading } = useStrengthSection();
  const { entries: weights, isLoading: weightsLoading } = useWeightEntries(sinceKey);
  const { latest, isLoading: latestLoading } = useLatestWeight();
  const { runs, isLoading: runsLoading } = useRunHistory();
  const { workouts, isLoading: workoutsLoading } = useWorkoutHistory();
  const { totals, isLoading: totalsLoading } = useDailyTotals(sinceKey);
  const { entries: nights, isLoading: nightsLoading } = useWellbeingEntries(sinceKey);
  const { target: targetKcal, isLoading: summaryLoading } = useNutritionSummary();
  const { result: carbs, isLoading: carbsLoading } = useCarbsPerKg('7d');
  const objective = useLabObjective();

  const designated = lifts.filter((lift) => lift.exerciseId !== null);
  const { data: liftSets, isLoading: liftSetsLoading } = useQuery<{
    exercise_id: string;
    finished_at: string;
    reps: number;
    weight_kg: number;
  }>(SELECT_LAB_LIFT_SETS, [
    sinceUtc,
    designated[0]?.exerciseId ?? '',
    designated[1]?.exerciseId ?? '',
    designated[2]?.exerciseId ?? '',
  ]);
  const { data: muscleRows, isLoading: musclesLoading } = useQuery<{
    workout_id: string;
    finished_at: string;
    muscle: string;
    sets: number;
  }>(SELECT_LAB_WORKOUT_MUSCLES, [sinceUtc]);

  // Meilleur 1RM estimé par semaine et par mouvement, de la plus ancienne à la plus récente.
  const weekStarts = Array.from({ length: 8 }, (_, i) => localDayKey(addDays(localDateFromDayKey(todayKey), -7 * (7 - i))));
  const labLifts = designated.map((lift) => {
    const sets = liftSets.filter((row) => row.exercise_id === lift.exerciseId);
    const weeks = weekStarts.map((weekEnd, index) => {
      const from = index === 0 ? sinceKey : localDayKey(addDays(localDateFromDayKey(weekStarts[index - 1]!), 1));
      const best = sets
        .filter((row) => {
          const day = dayKeyOf(row.finished_at);
          return day !== null && day >= from && day <= weekEnd;
        })
        .reduce<number | null>((max, row) => {
          const value = estimate1RM(row.weight_kg, row.reps);
          return max === null || value > max ? value : max;
        }, null);
      return best === null ? null : Math.round(best);
    });
    return { exerciseId: lift.exerciseId!, name: lift.name ?? lift.lift, weeks };
  });

  // « Jambes lourdes » rejoué sur les séances faites (COLLIS-01).
  const byWorkout = new Map<string, { dayKey: string | null; sets: Partial<Record<MuscleGroup, number>> }>();
  for (const row of muscleRows) {
    const entry = byWorkout.get(row.workout_id) ?? { dayKey: dayKeyOf(row.finished_at), sets: {} };
    entry.sets[row.muscle as MuscleGroup] = row.sets;
    byWorkout.set(row.workout_id, entry);
  }
  const strengthDays = [...byWorkout.values()]
    .filter((entry): entry is { dayKey: string; sets: Partial<Record<MuscleGroup, number>> } => entry.dayKey !== null)
    .map((entry) => ({ dayKey: entry.dayKey, heavyLegs: isHeavyLegSession(entry.sets) }));

  const qualityRuns = runs
    .map((run) => ({ dayKey: dayKeyOf(run.finishedAt), paceSPerKm: run.avgPaceSPerKm, sessionType: run.sessionType }))
    .filter((run): run is { dayKey: string; paceSPerKm: number; sessionType: 'fractionne' } =>
      run.dayKey !== null && run.dayKey >= sinceKey && run.paceSPerKm !== null && run.sessionType === 'fractionne',
    )
    .map((run) => ({ dayKey: run.dayKey, paceSPerKm: run.paceSPerKm }));

  const loads = [
    ...workouts.map((w) => ({ dayKey: dayKeyOf(w.finishedAt), load: sessionLoad({ rpe: w.rpe, durationSeconds: w.durationSeconds }) })),
    ...runs.map((r) => ({ dayKey: dayKeyOf(r.finishedAt), load: sessionLoad({ rpe: r.rpe, durationSeconds: r.durationSeconds }) })),
  ].filter((entry): entry is { dayKey: string; load: number } => entry.dayKey !== null && entry.load > 0);

  const weightKg = latest?.weightKg ?? null;
  const nutritionDays = totals.map((t) => ({ dayKey: t.logDate, kcal: t.kcal, proteinG: t.proteinG, carbsG: t.carbsG }));
  const loggedNights = nights
    .filter((n): n is typeof n & { sleepMinutes: number } => n.sleepMinutes !== null)
    .map((n) => ({ dayKey: n.logDate, sleepMinutes: n.sleepMinutes }));

  return {
    input: {
      todayKey,
      activePillars: resolveActivePillars(settings?.activePillars),
      objective,
      weightKg,
      proteinMinGPerKg: PROTEIN_TARGETS_G_PER_KG[objective].min,
      targetKcal,
      carbsHardMinGPerKg: carbs?.target.min ?? null,
      lifts: labLifts,
      weights: weights.map((w) => ({ dayKey: w.logDate, weightKg: w.weightKg })),
      qualityRuns,
      strengthDays,
      nutritionDays,
      nights: loggedNights,
      loads,
    },
    heavyLegDays: strengthDays.filter((d) => d.heavyLegs).map((d) => d.dayKey),
    qualityRunDays: qualityRuns.map((r) => r.dayKey),
    carbsByDay: weightKg === null ? [] : nutritionDays.map((d) => ({ dayKey: d.dayKey, gPerKg: d.carbsG / weightKg })),
    energyByDay: nights
      .filter((n): n is typeof n & { energy: number } => n.energy !== null)
      .map((n) => ({ dayKey: n.logDate, value: n.energy })),
    isLoading:
      settingsLoading || liftsLoading || weightsLoading || latestLoading || runsLoading || workoutsLoading ||
      totalsLoading || nightsLoading || summaryLoading || carbsLoading || liftSetsLoading || musclesLoading,
  };
}

// ---------------------------------------------------------------------------
// Onglet « Pourquoi ? »
// ---------------------------------------------------------------------------

export function useLabQuestions(): { questions: LabQuestion[]; isLoading: boolean } {
  const history = useLabHistory();
  return { questions: history.isLoading ? [] : buildLabQuestions(history.input), isLoading: history.isLoading };
}

// ---------------------------------------------------------------------------
// Onglet « Acquis »
// ---------------------------------------------------------------------------

export type LabExperimentView = {
  record: LabExperimentRecord;
  verdict: ReturnType<typeof experimentVerdict>;
};

export function useLabKnowledge(): {
  cards: LabKnowledgeCard[];
  experiments: LabExperimentView[];
  isLoading: boolean;
} {
  const todayKey = useTodayKey();
  const history = useLabHistory();
  const { experiments: records, isLoading: experimentsLoading } = useLabExperiments();
  const isLoading = history.isLoading || experimentsLoading;

  const experiments: LabExperimentView[] = records.map((record) => {
    const metric = LAB_EXPERIMENT_TEMPLATES[record.kind].metric;
    const observations =
      metric === 'qualityPace'
        ? history.input.qualityRuns.map((run) => ({ dayKey: run.dayKey, value: run.paceSPerKm }))
        : history.energyByDay;
    const adherence = experimentAdherence({
      record,
      heavyLegDays: history.heavyLegDays,
      qualityRunDays: history.qualityRunDays,
      carbsByDay: history.carbsByDay,
      carbsHardMinGPerKg: history.input.carbsHardMinGPerKg,
      nights: history.input.nights,
    });
    return { record, verdict: experimentVerdict({ record, todayKey, observations, adherence }) };
  });

  const cards = isLoading
    ? []
    : buildLabKnowledge({
        activePillars: history.input.activePillars,
        weightKg: history.input.weightKg,
        carbsHardMinGPerKg: history.input.carbsHardMinGPerKg,
        qualityRuns: history.input.qualityRuns,
        nights: history.input.nights,
        heavyLegDays: history.heavyLegDays,
        carbsByDay: history.input.nutritionDays.map((d) => ({ dayKey: d.dayKey, carbsG: d.carbsG })),
        experiments,
      });

  return { cards, experiments, isLoading };
}

// ---------------------------------------------------------------------------
// Onglet « Composer »
// ---------------------------------------------------------------------------

export function useLabComposer(): { context: LabComposerContext; isLoading: boolean } {
  const todayKey = useTodayKey();
  const weekStartKey = localDayKey(startOfWeek(localDateFromDayKey(todayKey)));
  const sevenDaysKey = useWindowStartKey(7);

  const { settings, isLoading: settingsLoading } = useSettings();
  const { items, isLoading: planLoading } = useWeekPlan(weekStartKey);
  const { runnerProfile, isLoading: runnerLoading } = useRunnerProfile();
  const { nutritionProfile, isLoading: nutritionLoading } = useNutritionProfile();
  const { latest, isLoading: weightLoading } = useLatestWeight();
  const { entries: nights, isLoading: nightsLoading } = useWellbeingEntries(sevenDaysKey);
  const { history, isLoading: strengthLoading } = useStrengthSection();
  const { target, isLoading: summaryLoading } = useNutritionSummary();
  const { runs, isLoading: runsLoading } = useRunHistory();
  const load = useTrainingLoadAlert();
  const objective = useLabObjective();

  const weightKg = latest?.weightKg ?? null;
  const strengthSessions = items.filter((i) => i.pillar === 'strength' && i.status !== 'skipped').length;
  const runningSessions = items.filter((i) => i.pillar === 'running' && i.status !== 'skipped').length;
  const manualProteinG = nutritionProfile?.manualProteinG ?? null;
  const proteinGPerKg =
    manualProteinG !== null && weightKg !== null && weightKg > 0
      ? Math.round((manualProteinG / weightKg) * 10) / 10
      : PROTEIN_TARGETS_G_PER_KG[objective].min;

  const loggedNights = nights.filter((n): n is typeof n & { sleepMinutes: number } => n.sleepMinutes !== null);
  const avgNight = loggedNights.length > 0 ? loggedNights.reduce((s, n) => s + n.sleepMinutes, 0) / loggedNights.length : null;

  const baseline: LabDoses = {
    strengthSessions,
    runningFrequency: runnerProfile?.weeklyFrequency ?? runningSessions,
    proteinGPerKg,
    objective,
    // Sans nuit saisie, on n'invente pas : « court » est l'hypothèse prudente du moteur « Et si… ».
    sleep: avgNight !== null && avgNight >= GOOD_NIGHT_MINUTES ? 'long' : 'short',
  };

  const projection = projectSbd(history, 8);
  const recentRuns = runs.filter((run) => {
    const day = dayKeyOf(run.finishedAt);
    return day !== null && day >= sevenDaysKey && run.durationSeconds !== null;
  });
  const hoursPerRun =
    recentRuns.length > 0 ? recentRuns.reduce((s, r) => s + (r.durationSeconds ?? 0), 0) / recentRuns.length / 3600 : null;

  return {
    context: {
      activePillars: resolveActivePillars(settings?.activePillars),
      baseline,
      weightKg,
      // La cible calorique est TDEE + delta de l'objectif : on remonte au TDEE pour pouvoir
      // recalculer la cible d'un autre objectif. ⚠️ Avec une cible saisie à la main, cette inversion
      // est approximative — l'écran le dit.
      tdeeKcal: target === null ? null : target - objectiveCalorieDelta(objective),
      sbd: projection.ok
        ? { lastTotalKg: projection.projectedKg - projection.slopePerWeek * projection.weeks, slopePerWeek: projection.slopePerWeek }
        : null,
      loadRatio: load.ratio,
      hoursPerRun,
    },
    isLoading:
      settingsLoading || planLoading || runnerLoading || nutritionLoading || weightLoading || nightsLoading ||
      strengthLoading || summaryLoading || runsLoading,
  };
}

/** Les piliers activés, pour les écrans du Labo (même repli que partout). */
export function useLabPillars(): Pillar[] {
  const { settings } = useSettings();
  return resolveActivePillars(settings?.activePillars);
}

/** Le lundi de la semaine prochaine : le seul début possible pour une expérience. */
export function nextMondayKey(todayKey: string): string {
  const monday = startOfWeek(localDateFromDayKey(todayKey));
  return localDayKey(addDays(monday, 7));
}

/** Cible de glucides d'un jour dur, pour l'écran (FUEL-01) — `null` sans niveau de charge. */
export function hardDayCarbTarget(level: keyof typeof CARB_TARGETS_G_PER_KG | null) {
  return level === null ? null : CARB_TARGETS_G_PER_KG[level];
}

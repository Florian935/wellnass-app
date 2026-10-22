/**
 * US CIBLE-01 — la **cible du jour** pour une plage de jours, par les compositions de NORYN-02.
 *
 * L'historique (calendrier, page d'un jour passé, adhérence, bilans, APPORT-01), le planning repas, la
 * carte de régularité et le widget d'écran d'accueil demandent la cible de **plusieurs** jours à la fois.
 * Ils la recalculaient chacun à leur façon, et leurs règles avaient dérivé (autres activités oubliées,
 * socle `tdee` quel que soit le mode, séances sautées comptées). Cette brique ne calcule **rien** : pour
 * chaque jour, elle appelle `trainedOnDay` puis `composeDayCalorieTarget` — la cible d'Aujourd'hui et de
 * Noryn —, avec les seules lignes de ce jour.
 *
 * ── Pourquoi ranger les lignes par jour d'abord ──────────────────────────────────────────────────
 * Appelées telles quelles pour chaque jour, les deux compositions parcourraient tout l'historique et
 * rattacheraient chaque instant à son jour autant de fois qu'il y a de jours (spec D6). Le rangement est
 * donc fait une fois — et c'est le **seul** point repris de `trainedOnDay` et de
 * `composeDayCalorieTarget` : une séance et une course appartiennent au jour de leur **fin**, une
 * activité au jour de son **début**. Le test d'équivalence (`day-target-range.test.ts`) compare chaque
 * jour au résultat des compositions appelées sur les tableaux entiers : il attrape toute divergence.
 *
 * ⚠️ Aucune horloge, aucun fuseau : `dayKeyOf`, `todayKey` et `at` sont passés (voir `day-energy.ts`).
 * Ce module n'est **pas** importé par `noryn/` : la fonction `noryn-context` n'en dépend pas.
 */

import type { DayKeyOf } from './day-energy';
import {
  composeDayCalorieTarget,
  trainedOnDay,
  type DayCalorieTargetResult,
  type RealLifeSpan,
  type TargetNutritionProfile,
  type TargetProfile,
} from './day-target';
import type { Pillar } from './pillar';

/** Comment un jour est devenu un jour d'entraînement : par ce qui a été fait, ou seulement prévu. */
export type TrainedBy = 'done' | 'planned' | null;

/** La cible d'un jour de la plage, et ce qui la compose. */
export type RangeDayTarget = DayCalorieTargetResult & {
  /**
   * Le jour est-il un **jour d'entraînement** (`trainedOnDay`) — séance, course, autre activité, ou
   * séance planifiée aujourd'hui et après —, **indépendamment** du bonus. ≠ `isTrainingDay`, qui veut
   * dire « jour d'entraînement **et** bonus appliqué ».
   */
  trainedThatDay: boolean;
  trainedBy: TrainedBy;
};

type FinishedRow = { finishedAt: string | null };
type CompletedRun = FinishedRow & { distanceM: number | null; durationSeconds: number | null };

function bucketBy<T>(rows: ReadonlyArray<T>, instantOf: (row: T) => string | null, dayKeyOf: DayKeyOf): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const instant = instantOf(row);
    if (instant == null) continue;
    const dayKey = dayKeyOf(instant);
    const list = out.get(dayKey);
    if (list) list.push(row);
    else out.set(dayKey, [row]);
  }
  return out;
}

/**
 * La cible de chaque jour de `dayKeys` — exactement celle que `useDayCalorieTarget` rendrait pour ce
 * jour avec les mêmes lignes.
 *
 * - `workouts` : séances de muscu **terminées** (le jour de la fin compte) ;
 * - `completedRuns` : courses **terminées** (`status = 'completed'`) — jour d'entraînement et dépense
 *   des courses du mode `auto` ;
 * - `activities` : autres activités (le jour du début compte) ;
 * - `plannedDayKeys` : les jours portant une séance planifiée `planned`/`done` ; seuls ceux d'aujourd'hui
 *   et après comptent (anticipation, 4.7b) ;
 * - `energyKcalByDay` : la dépense réelle retenue par jour (bas des fourchettes), mode `activities`.
 */
export function composeCalorieTargetsForDays(input: {
  dayKeys: readonly string[];
  todayKey: string;
  profile: TargetProfile | null;
  nutritionProfile: TargetNutritionProfile | null;
  /** Dernière pesée (`ORDER BY log_date DESC LIMIT 1`), sans borne de date. */
  latestWeightKg: number | null;
  activePillars: readonly Pillar[] | null | undefined;
  realLifePeriods: ReadonlyArray<RealLifeSpan>;
  workouts: ReadonlyArray<FinishedRow>;
  completedRuns: ReadonlyArray<CompletedRun>;
  activities: ReadonlyArray<{ startedAt: string }>;
  plannedDayKeys: ReadonlySet<string>;
  energyKcalByDay: ReadonlyMap<string, number>;
  dayKeyOf: DayKeyOf;
  at: Date;
}): Map<string, RangeDayTarget> {
  const { dayKeys, todayKey, dayKeyOf } = input;
  const workoutsByDay = bucketBy(input.workouts, (w) => w.finishedAt, dayKeyOf);
  const runsByDay = bucketBy(input.completedRuns, (r) => r.finishedAt, dayKeyOf);
  const activitiesByDay = bucketBy(input.activities, (a) => a.startedAt, dayKeyOf);

  const out = new Map<string, RangeDayTarget>();
  for (const dayKey of dayKeys) {
    if (out.has(dayKey)) continue;
    const day = {
      dayKey,
      todayKey,
      workouts: workoutsByDay.get(dayKey) ?? [],
      completedRuns: runsByDay.get(dayKey) ?? [],
      activities: activitiesByDay.get(dayKey) ?? [],
      dayKeyOf,
    };
    const trainedThatDay = trainedOnDay({ ...day, hasPlanned: input.plannedDayKeys.has(dayKey) });
    // Le « comment », sans recopier la règle : le même appel, sans les séances planifiées.
    const trainedBy: TrainedBy = trainedOnDay({ ...day, hasPlanned: false })
      ? 'done'
      : trainedThatDay
        ? 'planned'
        : null;

    const target = composeDayCalorieTarget({
      dayKey,
      profile: input.profile,
      nutritionProfile: input.nutritionProfile,
      latestWeightKg: input.latestWeightKg,
      activePillars: input.activePillars,
      realLifePeriods: input.realLifePeriods,
      trainedThatDay,
      completedRuns: day.completedRuns,
      energyKcal: input.energyKcalByDay.get(dayKey) ?? 0,
      dayKeyOf,
      at: input.at,
    });
    out.set(dayKey, { ...target, trainedThatDay, trainedBy });
  }
  return out;
}

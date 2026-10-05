/**
 * US PRISME-01 — les faits du soir, rassemblés pour la carte « Ta journée ».
 *
 * Même patron que `useHomeScene` : **les hooks collectent, la brique décide, l'écran peint.** Ce hook
 * ne fait que réunir des sources que l'app calcule déjà ; ce qui entre dans les faits est décidé par
 * `assembleEveningFacts` (pur, testé), et ce qui part chez le fournisseur par la liste blanche de
 * `@wellness/shared`.
 *
 * ⚠️ Le jour vient de `useTodayKey` / `useTodayDate` : jamais `new Date()` dans le corps d'un hook
 * (slot mount-only de React Compiler, voir `useTodayKey`).
 */

import {
  addDays,
  formatDayFull,
  isLowMoodOngoing,
  localDayKey,
  resolveActivePillars,
  type EveningFacts,
} from '@wellness/shared';

import { useActivitiesOnDay } from '@/data/repositories/activity-repository';
import { useNutritionSummary, useProteinTarget, useStreakData } from '@/data/repositories/dashboard-repository';
import { useWellbeingRows } from '@/data/repositories/daily-wellbeing-repository';
import { useDayEntries } from '@/data/repositories/journal-repository';
import { useUpcomingSessions } from '@/data/repositories/planned-session-repository';
import { useRealLifeState } from '@/data/repositories/real-life-repository';
import { useRunHistory } from '@/data/repositories/run-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';
import { useTodayDate, useTodayKey } from '@/hooks/useTodayKey';
import { assembleEveningFacts } from '@/lib/ai/evening-facts';

/** L'humeur basse se lit sur 14 jours (seuil de BIEN-02). */
const MOOD_LOOKBACK_DAYS = 14;

export function useEveningFacts(): { facts: EveningFacts; todayKey: string; lowMood: boolean; isLoading: boolean } {
  const todayKey = useTodayKey();
  const todayDate = useTodayDate();
  const tomorrowKey = localDayKey(addDays(todayDate, 1));
  const moodSinceKey = localDayKey(addDays(todayDate, -MOOD_LOOKBACK_DAYS));

  const { workouts, isLoading: workoutsLoading } = useWorkoutHistory();
  const { runs, isLoading: runsLoading } = useRunHistory();
  const { activities, isLoading: activitiesLoading } = useActivitiesOnDay(todayKey);
  const nutrition = useNutritionSummary();
  const proteinTarget = useProteinTarget();
  const { entries, isLoading: entriesLoading } = useDayEntries(todayKey);
  const { items: upcoming, isLoading: upcomingLoading } = useUpcomingSessions(2);
  const { weekly, isLoading: streakLoading } = useStreakData();
  const { inRealLifePeriod } = useRealLifeState();
  const { rows: moodRows } = useWellbeingRows(moodSinceKey);
  const { settings } = useSettings();

  const active = resolveActivePillars(settings?.activePillars);

  const facts = assembleEveningFacts({
    todayKey,
    tomorrowKey,
    dayLabel: formatDayFull(todayKey),
    workouts,
    runs,
    activities,
    nutrition: {
      kcal: nutrition.kcal,
      target: nutrition.effectiveTarget ?? nutrition.target,
      proteinG: nutrition.macros.p,
      proteinTarget,
      carbsG: nutrition.macros.g,
      meals: new Set(entries.map((entry) => entry.mealType)).size,
    },
    plannedTomorrow: upcoming.filter((session) => session.scheduledDate === tomorrowKey),
    week: { done: weekly.doneThisWeek, goal: weekly.goal },
    realLife: inRealLifePeriod,
    activePillars: {
      strength: active.includes('strength'),
      running: active.includes('running'),
      nutrition: active.includes('nutrition'),
    },
  });

  return {
    facts,
    todayKey,
    lowMood: isLowMoodOngoing(moodRows, todayKey),
    isLoading:
      workoutsLoading ||
      runsLoading ||
      activitiesLoading ||
      nutrition.isLoading ||
      entriesLoading ||
      upcomingLoading ||
      streakLoading,
  };
}

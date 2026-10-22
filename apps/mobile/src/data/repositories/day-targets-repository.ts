/**
 * US CIBLE-01 — la **cible du jour** de plusieurs jours à la fois, par les compositions de NORYN-02.
 *
 * Un hook de **lecture** : il lit ce que la cible d'un jour demande (profil, profil nutritionnel,
 * dernière pesée, piliers, séances, courses, activités, périodes « vie réelle », dépenses, séances
 * planifiées de la plage), puis appelle `composeCalorieTargetsForDays` (`@wellness/shared`), qui ne fait
 * qu'appeler `trainedOnDay` et `composeDayCalorieTarget` pour chaque jour. **Aucune formule ici.**
 *
 * Ses appelants : `useDailyCalorieTargets` (calendrier, page d'un jour passé, adhérence, bilans,
 * APPORT-01), le planning repas, la carte de régularité. `useDayCalorieTarget` (Aujourd'hui, « Ta journée
 * en énergie », Noryn) reste la référence d'un jour : un test fige leur égalité jour par jour
 * (`day-target-parity.test.tsx`).
 *
 * ⚠️ Vit à part de `dashboard-repository.ts` (qui charge `@/i18n`) : le planning et la carte de
 * régularité l'importent sans tirer le reste.
 *
 * ── Une lecture par plage (spec D6) ─────────────────────────────────────────────────────────────
 * Les séances planifiées se lisent en **une** requête bornée à `[max(premier jour, aujourd'hui),
 * dernier jour]` : seuls ces jours peuvent être anticipés (4.7b), et une plage passée ne rend rien.
 */

import { useMemo } from 'react';
import { composeCalorieTargetsForDays, localDayKeyOf, nutritionSocle, type RangeDayTarget } from '@wellness/shared';

import { useTodayDate, useTodayKey } from '@/hooks/useTodayKey';

import { useActivities } from './activity-repository';
import { useLatestWeight } from './bodyweight-repository';
import { useEnergyTargetByDay } from './energy-repository';
import { useNutritionProfile } from './nutrition-repository';
import { usePlannedDayKeys } from './planned-session-repository';
import { useProfile } from './profile-repository';
import { useRealLifePeriods } from './real-life-repository';
import { useRunHistory } from './run-repository';
import { useSettings } from './settings-repository';
import { useWorkoutHistory } from './workout-repository';

export type { RangeDayTarget };

export type CalorieTargetsForDays = {
  /** La cible de chaque jour demandé. */
  byDay: ReadonlyMap<string, RangeDayTarget>;
  /** Le profil permet-il une cible (poids, taille, âge) ? */
  hasTarget: boolean;
  /** Dernière pesée, sinon le poids du profil — pour les calculs par kg des appelants. */
  weightKg: number | null;
  isLoading: boolean;
};

/** La cible de chaque jour de `dayKeys` — celle que `useDayCalorieTarget` rendrait pour ce jour. */
export function useCalorieTargetsForDays(dayKeys: readonly string[]): CalorieTargetsForDays {
  const { nutritionProfile, isLoading: nutritionLoading } = useNutritionProfile();
  const { profile, isLoading: profileLoading } = useProfile();
  const { latest, isLoading: weightLoading } = useLatestWeight();
  const { settings } = useSettings();
  const { workouts, isLoading: workoutsLoading } = useWorkoutHistory();
  const { runs, isLoading: runsLoading } = useRunHistory();
  const { activities, isLoading: activitiesLoading } = useActivities();
  const { periods } = useRealLifePeriods();
  // La dépense réelle retenue par jour (bas des fourchettes) : le même hook que « Ta journée en énergie ».
  const { byDay: energyByDay, isLoading: energyLoading } = useEnergyTargetByDay();
  const todayKey = useTodayKey();
  const today = useTodayDate();

  // Les jours, par leur contenu : une liste neuve à chaque rendu relancerait la requête.
  const daysSignature = dayKeys.join(',');
  const days = useMemo(() => (daysSignature === '' ? [] : daysSignature.split(',')), [daysSignature]);
  const first = days.reduce((min, d) => (d < min ? d : min), days[0] ?? todayKey);
  const last = days.reduce((max, d) => (d > max ? d : max), days[0] ?? '');
  // Plage des séances planifiées : à partir d'aujourd'hui seulement ; vide si tout est passé (ou si
  // aucun jour n'est demandé).
  const { dayKeys: plannedDayKeys, isLoading: plannedLoading } = usePlannedDayKeys(
    first > todayKey ? first : todayKey,
    last,
  );

  const activePillars = settings?.activePillars;
  const latestWeightKg = latest?.weightKg ?? null;

  const byDay = useMemo(
    () =>
      composeCalorieTargetsForDays({
        dayKeys: days,
        todayKey,
        profile,
        nutritionProfile,
        latestWeightKg,
        activePillars,
        realLifePeriods: periods,
        workouts,
        completedRuns: runs,
        activities,
        plannedDayKeys,
        energyKcalByDay: energyByDay,
        dayKeyOf: localDayKeyOf,
        at: today,
      }),
    [
      days,
      todayKey,
      profile,
      nutritionProfile,
      latestWeightKg,
      activePillars,
      periods,
      workouts,
      runs,
      activities,
      plannedDayKeys,
      energyByDay,
      today,
    ],
  );

  const hasTarget = nutritionSocle({ profile, nutritionProfile, at: today }).socle != null;

  return {
    byDay,
    hasTarget,
    weightKg: latestWeightKg ?? profile?.weightKg ?? null,
    isLoading:
      nutritionLoading ||
      profileLoading ||
      weightLoading ||
      workoutsLoading ||
      runsLoading ||
      activitiesLoading ||
      energyLoading ||
      plannedLoading,
  };
}

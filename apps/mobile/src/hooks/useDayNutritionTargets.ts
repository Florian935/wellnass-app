/**
 * La cible d'un jour et ses macros — sorti de `app/(tabs)/nutrition.tsx` par NUTRI-UX03, sans
 * changement de calcul (même logique que le profil nutritionnel).
 *
 * - Objectif de base : TDEE × objectif, ramené au maintien pendant une période « vie réelle »
 *   (US VIE-01, R4), évalué **sur le jour demandé**.
 * - Cible effective et bonus du jour : `useDayCalorieTarget` (RN-02, forfait / auto, dépense des
 *   courses et des autres activités).
 * - Macros cibles : manuelles si l'utilisateur en a posé une, sinon `trainingDayMacroGrams`, qui
 *   redirige le bonus de séance vers les glucides (US MN-04).
 *
 * US NORYN-02 — la composition vit dans `composeDayNutritionTargets` (@wellness/shared) ; ce hook n'en
 * garde que les lectures.
 */

import { useMemo } from 'react';
import { composeDayNutritionTargets, localDateFromDayKey } from '@wellness/shared';
import { useDayCalorieTarget } from '@/data/repositories/dashboard-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { useRealLifePeriods } from '@/data/repositories/real-life-repository';
import { useTodayKey } from '@/hooks/useTodayKey';

export type Macros = { protein: number; carbs: number; fat: number };

export function useDayNutritionTargets(day: string) {
  const { profile } = useProfile();
  const { nutritionProfile } = useNutritionProfile();
  const { periods: realLifePeriods } = useRealLifePeriods();
  // L'âge se prend à la date du jour (réactive) : même résultat que `new Date()`, sans horloge lue ici.
  const todayKey = useTodayKey();
  const today = useMemo(() => localDateFromDayKey(todayKey), [todayKey]);

  const {
    effectiveTarget,
    trainingBonus,
    isTrainingDay: trainingApplies,
    isLoading: targetLoading,
  } = useDayCalorieTarget(day);

  const { tdeeValue, target, targetMacros, profileComplete } = composeDayNutritionTargets({
    dayKey: day,
    profile,
    nutritionProfile,
    realLifePeriods,
    dayTarget: { effectiveTarget },
    at: today,
  });

  return {
    tdeeValue,
    target,
    effectiveTarget,
    trainingBonus,
    trainingApplies,
    targetLoading,
    targetMacros: targetMacros as Macros | null,
    profileComplete,
  };
}

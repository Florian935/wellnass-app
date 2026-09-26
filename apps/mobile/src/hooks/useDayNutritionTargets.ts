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
 */

import {
  computeAge,
  effectiveActivityLevel,
  effectiveNutritionObjective,
  isRealLifeDay,
  objectiveFromGoal,
  targetCalories,
  tdee,
  trainingDayMacroGrams,
} from '@wellness/shared';
import { useDayCalorieTarget } from '@/data/repositories/dashboard-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { useRealLifePeriods } from '@/data/repositories/real-life-repository';

export type Macros = { protein: number; carbs: number; fat: number };

export function useDayNutritionTargets(day: string) {
  const { profile } = useProfile();
  const { nutritionProfile } = useNutritionProfile();
  const { periods: realLifePeriods } = useRealLifePeriods();

  const objective = nutritionProfile?.objective ?? objectiveFromGoal(profile?.mainGoal ?? null);
  const age = profile?.birthDate ? computeAge(new Date(profile.birthDate)) : null;
  const tdeeValue = tdee({
    sex: profile?.sex ?? 'unspecified',
    weightKg: profile?.weightKg ?? undefined,
    heightCm: profile?.heightCm ?? undefined,
    age: age ?? undefined,
    activityLevel: effectiveActivityLevel(nutritionProfile),
  });
  const target =
    tdeeValue != null
      ? targetCalories(
          tdeeValue,
          effectiveNutritionObjective(objective, isRealLifeDay(realLifePeriods, day)),
          nutritionProfile?.manualCalories ?? null,
        )
      : null;

  const {
    effectiveTarget,
    trainingBonus,
    isTrainingDay: trainingApplies,
    isLoading: targetLoading,
  } = useDayCalorieTarget(day);

  const manualSet =
    nutritionProfile?.manualProteinG != null ||
    nutritionProfile?.manualCarbsG != null ||
    nutritionProfile?.manualFatG != null;
  const targetMacros: Macros | null = manualSet
    ? {
        protein: nutritionProfile?.manualProteinG ?? 0,
        carbs: nutritionProfile?.manualCarbsG ?? 0,
        fat: nutritionProfile?.manualFatG ?? 0,
      }
    : target != null && effectiveTarget != null
      ? trainingDayMacroGrams({ targetBase: target, effectiveTarget, objective })
      : null;

  return {
    tdeeValue,
    target,
    effectiveTarget,
    trainingBonus,
    trainingApplies,
    targetLoading,
    targetMacros,
    profileComplete: profile?.weightKg != null && profile?.heightCm != null && age != null,
  };
}

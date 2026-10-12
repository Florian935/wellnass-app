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
 * garde que les lectures. **D1-A** : le socle et la base sont ceux de la cible du jour — en mode
 * `activities`, le socle hors sport. Avant, l'onglet les recalculait sur `tdee` quel que soit le mode :
 * les macros dépassaient la cible affichée et l'explication de la cible n'additionnait plus (écart E4).
 */

import { useMemo } from 'react';
import { composeDayNutritionTargets, localDateFromDayKey } from '@wellness/shared';
import { useDayCalorieTarget } from '@/data/repositories/dashboard-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { useTodayKey } from '@/hooks/useTodayKey';

export type Macros = { protein: number; carbs: number; fat: number };

export function useDayNutritionTargets(day: string) {
  const { profile } = useProfile();
  const { nutritionProfile } = useNutritionProfile();
  // L'âge se prend à la date du jour (réactive) : même résultat que `new Date()`, sans horloge lue ici.
  const todayKey = useTodayKey();
  const today = useMemo(() => localDateFromDayKey(todayKey), [todayKey]);

  const dayTarget = useDayCalorieTarget(day);
  const {
    effectiveTarget,
    trainingBonus,
    isTrainingDay: trainingApplies,
    isLoading: targetLoading,
  } = dayTarget;

  const { tdeeValue, socleKind, target, targetMacros, profileComplete } = composeDayNutritionTargets({
    profile,
    nutritionProfile,
    dayTarget,
    at: today,
  });

  return {
    tdeeValue,
    socleKind,
    target,
    effectiveTarget,
    trainingBonus,
    trainingApplies,
    targetLoading,
    targetMacros: targetMacros as Macros | null,
    profileComplete,
  };
}

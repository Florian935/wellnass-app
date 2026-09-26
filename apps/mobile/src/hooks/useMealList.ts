/**
 * Les repas configurés de l'utilisateur, avec leur libellé d'affichage (4.14 / 4.15).
 *
 * Un repas personnalisé sans nom retombe sur « Repas N » (et non sur sa clé technique `custom-…`).
 * Sorti de `app/(tabs)/nutrition.tsx` par NUTRI-UX03 : le hub, la page d'un jour et l'Historique
 * en ont besoin.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_MEAL_KEYS, resolveMealConfig } from '@wellness/shared';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';

export type MealOption = { key: string; label: string };

export function useMealList(): MealOption[] {
  const { t } = useTranslation();
  const { nutritionProfile } = useNutritionProfile();
  return useMemo(
    () =>
      resolveMealConfig(nutritionProfile?.meals).map((m, i) => ({
        key: m.key,
        label:
          m.label ??
          (DEFAULT_MEAL_KEYS.includes(m.key as never) ? t(`journal.meals.${m.key}`) : t('meals.mealN', { n: i + 1 })),
      })),
    [nutritionProfile?.meals, t],
  );
}

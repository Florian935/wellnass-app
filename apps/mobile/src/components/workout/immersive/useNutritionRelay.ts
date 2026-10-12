/**
 * Le relais nutrition — US MUSCU-UX03, spec §5.13.
 *
 * ── Ce que cette ligne fait vraiment ────────────────────────────────────────────────────────────
 * C'est le **seul endroit de la séance où les piliers se parlent à voix haute**, et c'est la raison
 * d'être du produit : « tu viens de t'entraîner, la nutrition a déjà ajusté ta journée ». La règle
 * de calcul n'est pas inventée ici — elle vient de MN-04 (`trainingDayMacroGrams`), qui redirige le
 * bonus calorique du jour de séance vers les **glucides**. On l'affiche, on ne la refait pas.
 *
 * ── Intégration sans imposition (décision H) ────────────────────────────────────────────────────
 * Pilier Nutrition désactivé → `null`, et pas une ligne grisée « activez la nutrition ». Un pilier
 * qu'on n'a pas choisi ne vient pas faire de la publicité dans un écran de musculation.
 */

import { useMemo } from 'react';
import { dayMacroTargets, hasManualMacros, resolveActivePillars } from '@wellness/shared';
import { useDayCalorieTarget } from '@/data/repositories/dashboard-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { useSettings } from '@/data/repositories/settings-repository';

/** Jour ISO local (`YYYY-MM-DD`) — le même découpage que le journal alimentaire. */
function todayKey(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * Glucides supplémentaires accordés aujourd'hui parce que c'est un jour de séance, ou `null` quand
 * il n'y a rien à dire (pilier coupé, profil incomplet, macros saisies à la main, bonus nul).
 */
export function useNutritionRelay(): { extraCarbsG: number } | null {
  const { settings } = useSettings();
  const { profile } = useProfile();
  const { nutritionProfile } = useNutritionProfile();
  const day = useMemo(() => todayKey(), []);
  const { target, effectiveTarget, trainingBonus, isTrainingDay } = useDayCalorieTarget(day);

  const active = resolveActivePillars(settings?.activePillars).includes('nutrition');
  if (!active || !isTrainingDay || trainingBonus <= 0) return null;
  if (target === null || effectiveTarget === null) return null;

  // Macros fixées à la main : le bonus ne les touche pas, il n'y a donc aucun relais à annoncer.
  if (hasManualMacros(nutritionProfile)) return null;

  // US NORYN-02 (D1-A) — la règle unique de l'app (`dayMacroTargets`), celle de l'écran nutrition :
  // le même jour sans bonus, puis avec. Diverger ici afficherait un chiffre que le journal contredit.
  const base = dayMacroTargets({ profile, nutritionProfile, dayTarget: { target, effectiveTarget: target } });
  const boosted = dayMacroTargets({ profile, nutritionProfile, dayTarget: { target, effectiveTarget } });
  const extraCarbsG = Math.round((boosted?.carbs ?? 0) - (base?.carbs ?? 0));

  return extraCarbsG > 0 ? { extraCarbsG } : null;
}

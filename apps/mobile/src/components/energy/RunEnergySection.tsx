/**
 * US DEPENSE-02 — la dépense d'une **course**, en fin de sortie et dans l'historique.
 *
 * Elle corrige trois trous de RN-01, constatés à l'analyse :
 *  - **le dénivelé comptait pour rien** (constat C5) : 100 m de montée valent désormais 1 km
 *    d'effort ;
 *  - **le tapis valait zéro** (constat C4) : sans distance, l'estimation passe par le MET de course
 *    et la durée, avec une fourchette plus large et une confiance moindre ;
 *  - **le poids était celui d'aujourd'hui** (constat C6), même pour une sortie d'il y a deux mois.
 *
 * Et surtout, elle **affiche** le chiffre : jusqu'ici l'estimation existait (elle nourrissait le
 * bonus calorique en mode Auto) mais n'apparaissait nulle part dans le résumé de course.
 */

import { useTranslation } from 'react-i18next';
import { estimateRunEnergy, localDayKey, resolveActivePillars } from '@wellness/shared';

import { EnergyCard } from '@/components/energy/EnergyCard';
import { useDayCalorieTarget } from '@/data/repositories/dashboard-repository';
import { useRestingMetabolismAt } from '@/data/repositories/energy-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useSettings } from '@/data/repositories/settings-repository';

export function RunEnergySection({
  finishedAt,
  distanceM,
  durationSeconds,
  elevationGainM,
  rpe,
}: {
  finishedAt: string | null;
  distanceM: number | null;
  durationSeconds: number | null;
  elevationGainM: number | null;
  rpe: number | null;
}) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { nutritionProfile } = useNutritionProfile();

  const dayKey = localDayKey(finishedAt ? new Date(finishedAt) : new Date());
  const { resting, weightKg } = useRestingMetabolismAt(dayKey);
  const { effectiveTarget } = useDayCalorieTarget(dayKey);

  if (!(settings?.showEnergyEstimates ?? true)) return null;

  const estimate = estimateRunEnergy({
    distanceM,
    durationSeconds,
    elevationGainM,
    rpe,
    weightKg,
    resting,
  });

  const hasGps = distanceM != null && distanceM > 0;
  const climb = elevationGainM != null && elevationGainM > 0 ? Math.round(elevationGainM) : 0;
  const nutritionActive = resolveActivePillars(settings?.activePillars).includes('nutrition');
  const followsEnergy = (nutritionProfile?.trainingBonusMode ?? 'fixed') === 'activities';

  return (
    <EnergyCard
      estimate={estimate}
      resting={resting}
      activeMinutes={durationSeconds != null ? durationSeconds / 60 : 0}
      detail={
        hasGps
          ? climb > 0
            ? t('energy.run.detailClimb', { km: ((distanceM ?? 0) / 1000).toFixed(1), climb })
            : t('energy.run.detail', { km: ((distanceM ?? 0) / 1000).toFixed(1) })
          : t('energy.run.detailNoGps')
      }
      dayEffect={
        nutritionActive && followsEnergy && estimate && effectiveTarget != null
          ? t('energy.dayEffect', { kcal: estimate.low, target: effectiveTarget })
          : null
      }
    />
  );
}

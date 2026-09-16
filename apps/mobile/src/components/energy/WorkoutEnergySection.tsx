/**
 * US DEPENSE-02 — la dépense d'une **séance de musculation**, telle qu'elle s'affiche en fin de
 * séance et dans l'historique.
 *
 * Elle assemble ce que le bilan mesure déjà (durée, séries, ressenti) et le passe au moteur.
 * Aucun calcul ici : `estimateStrengthEnergy` est pur et testé.
 *
 * 🔴 `totalSets` compte **les échauffements**. Le volume les exclut (à juste titre : ils ne sont pas
 * du travail), mais ils coûtent du temps et de l'énergie. Les deux notions ne se recouvrent pas, et
 * les confondre sous-estimerait toutes les séances à échauffement long.
 *
 * ⚠️ Rendu `null` quand l'utilisateur a masqué les calories dépensées (réglage DEPENSE-02) : la
 * cible, elle, continue de les compter — on retire l'affichage, pas le moteur.
 */

import { useTranslation } from 'react-i18next';
import {
  averageRestSeconds,
  estimateStrengthEnergy,
  localDayKey,
  resolveActivePillars,
  strengthActiveMinutes,
} from '@wellness/shared';

import { EnergyCard } from '@/components/energy/EnergyCard';
import { useDayCalorieTarget } from '@/data/repositories/dashboard-repository';
import { useRestingMetabolismAt } from '@/data/repositories/energy-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useSettings } from '@/data/repositories/settings-repository';

export function WorkoutEnergySection({
  finishedAt,
  durationSeconds,
  totalSets,
  rpe,
}: {
  workoutId: string;
  finishedAt: string | null;
  durationSeconds: number;
  totalSets: number;
  rpe: number | null;
}) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { nutritionProfile } = useNutritionProfile();

  // Le jour de la séance, pas aujourd'hui : l'historique rouvre des bilans anciens, et le poids
  // d'alors n'est pas celui d'aujourd'hui (constat C6).
  const dayKey = localDayKey(finishedAt ? new Date(finishedAt) : new Date());
  const { resting } = useRestingMetabolismAt(dayKey);
  const { effectiveTarget } = useDayCalorieTarget(dayKey);

  if (!(settings?.showEnergyEstimates ?? true)) return null;

  const estimate = estimateStrengthEnergy({ durationSeconds, totalSets, rpe, resting });
  const activeMinutes = strengthActiveMinutes({ durationSeconds, totalSets });
  const rest = averageRestSeconds({ durationSeconds, totalSets });

  const nutritionActive = resolveActivePillars(settings?.activePillars).includes('nutrition');
  const followsEnergy = (nutritionProfile?.trainingBonusMode ?? 'fixed') === 'activities';

  return (
    <EnergyCard
      estimate={estimate}
      resting={resting}
      activeMinutes={activeMinutes}
      detail={t('energy.strength.detail', {
        duration: Math.round(activeMinutes),
        rpe: rpe ?? '—',
        rest: rest != null ? Math.round(rest / 60) : '—',
      })}
      // La ligne « ta journée » n'a de sens que si la nutrition est active ET que la cible suit
      // réellement les dépenses : sinon elle promettrait un effet qui n'a pas lieu (décision H).
      dayEffect={
        nutritionActive && followsEnergy && estimate && effectiveTarget != null
          ? t('energy.dayEffect', { kcal: estimate.low, target: effectiveTarget })
          : null
      }
    />
  );
}

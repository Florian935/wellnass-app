/**
 * Map `id → composant` des widgets du dashboard (US 7.1 ; étendue au fil des US).
 *
 * Centralise le rendu d'un widget à partir de son identifiant de layout et de
 * sa taille, pour que l'écran d'accueil et le conteneur d'édition parcourent la
 * disposition résolue sans connaître chaque composant individuellement.
 */

import type { HomeWidgetId, WidgetSize } from '@wellness/shared';
import { TodaySessionCard } from '@/components/dashboard/TodaySessionCard';
import { NutritionSummaryCard } from '@/components/dashboard/NutritionSummaryCard';
import { StreakCard } from '@/components/dashboard/StreakCard';
import { WeightCard } from '@/components/dashboard/WeightCard';
import { RecordRecentCard } from '@/components/dashboard/RecordRecentCard';
import { MuscleVolumeCard } from '@/components/dashboard/MuscleVolumeCard';
import { RunningWeekCard } from '@/components/dashboard/RunningWeekCard';
import { DeficitVolumeAlertCard } from '@/components/dashboard/DeficitVolumeAlertCard';
import { TrainingTimeCard } from '@/components/dashboard/TrainingTimeCard';
import { StepsCard } from '@/components/dashboard/StepsCard';
import { WellbeingCard } from '@/components/dashboard/WellbeingCard';
import { GoalsCard } from '@/components/dashboard/GoalsCard';
import { ReviewCard } from '@/components/dashboard/ReviewCard';
import { CycleCard } from '@/components/dashboard/CycleCard';
import { TrainingLoadAlertCard } from '@/components/dashboard/TrainingLoadAlertCard';

type WidgetComponent = (props: { size?: WidgetSize }) => React.ReactElement | null;

const WIDGET_COMPONENTS: Record<HomeWidgetId, WidgetComponent> = {
  'today-session': TodaySessionCard,
  'nutrition-summary': NutritionSummaryCard,
  streak: StreakCard,
  weight: WeightCard,
  'record-recent': RecordRecentCard,
  'muscle-volume': MuscleVolumeCard,
  'running-week': RunningWeekCard,
  'deficit-volume': DeficitVolumeAlertCard,
  'training-time': TrainingTimeCard,
  steps: StepsCard,
  wellbeing: WellbeingCard,
  goals: GoalsCard,
  review: ReviewCard,
  cycle: CycleCard,
  'training-load': TrainingLoadAlertCard,
};

/** Rend le widget `id` à la taille demandée. */
export function DashboardWidget({ id, size }: { id: HomeWidgetId; size: WidgetSize }) {
  const Component = WIDGET_COMPONENTS[id];
  return <Component size={size} />;
}

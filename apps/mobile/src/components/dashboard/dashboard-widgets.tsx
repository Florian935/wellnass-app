/**
 * Map `id → composant` des 7 widgets du dashboard (US 7.1).
 *
 * Centralise le rendu d'un widget à partir de son identifiant de layout et de
 * sa taille, pour que l'écran d'accueil et le conteneur d'édition parcourent la
 * disposition résolue sans connaître chaque composant individuellement.
 */

import type { DashboardWidgetId, WidgetSize } from '@wellness/shared';
import { TodaySessionCard } from '@/components/dashboard/TodaySessionCard';
import { NutritionSummaryCard } from '@/components/dashboard/NutritionSummaryCard';
import { StreakCard } from '@/components/dashboard/StreakCard';
import { WeightCard } from '@/components/dashboard/WeightCard';
import { RecordRecentCard } from '@/components/dashboard/RecordRecentCard';
import { MuscleVolumeCard } from '@/components/dashboard/MuscleVolumeCard';
import { RunningWeekCard } from '@/components/dashboard/RunningWeekCard';

type WidgetComponent = (props: { size?: WidgetSize }) => React.ReactElement | null;

const WIDGET_COMPONENTS: Record<DashboardWidgetId, WidgetComponent> = {
  'today-session': TodaySessionCard,
  'nutrition-summary': NutritionSummaryCard,
  streak: StreakCard,
  weight: WeightCard,
  'record-recent': RecordRecentCard,
  'muscle-volume': MuscleVolumeCard,
  'running-week': RunningWeekCard,
};

/** Rend le widget `id` à la taille demandée. */
export function DashboardWidget({ id, size }: { id: DashboardWidgetId; size: WidgetSize }) {
  const Component = WIDGET_COMPONENTS[id];
  return <Component size={size} />;
}

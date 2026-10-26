/**
 * Map `id → composant` des widgets du dashboard (US 7.1 ; étendue au fil des US).
 *
 * Centralise le rendu d'un widget à partir de son identifiant de layout et de
 * sa taille, pour que l'écran d'accueil et le conteneur d'édition parcourent la
 * disposition résolue sans connaître chaque composant individuellement.
 */

import type { HomeWidgetId, WidgetSize } from '@wellness/shared';
import { WeightCard } from '@/components/dashboard/WeightCard';
import { StepsCard } from '@/components/dashboard/StepsCard';
import { CycleCard } from '@/components/dashboard/CycleCard';
import { SleepCard } from '@/components/dashboard/SleepCard';
import { WaterCard } from '@/components/dashboard/WaterCard';

type WidgetComponent = (props: { size?: WidgetSize }) => React.ReactElement | null;

const WIDGET_COMPONENTS: Record<HomeWidgetId, WidgetComponent> = {
  // US INSIGHTS-02 (05/08/2026) : 21 → 7 entrées. Les 14 autres ont chacune une destination
  // vérifiée par test (`widget-destinations.ts`, `packages/shared`) — aucun signal n'a disparu.
  // Le typage `Record<HomeWidgetId, …>` est ici un garde-fou : retirer un id du registre sans
  // retirer son entrée casse la compilation.
  // US ACCUEIL-08 (25/10/2026) : la grille devient « Tes repères ». La nutrition, la régularité,
  // les insights, le parcours et la vie réelle sont devenus des zones fixes de l'accueil (cadrans,
  // Ta semaine, Du nouveau, Premiers pas, pied de page) ; le sommeil et l'eau entrent.
  steps: StepsCard,
  // US ACCUEIL-04 : de retour, en `small`, pour partager sa ligne avec les pas.
  weight: WeightCard,
  sleep: SleepCard,
  water: WaterCard,
  cycle: CycleCard,
};

/** Rend le widget `id` à la taille demandée. */
export function DashboardWidget({ id, size }: { id: HomeWidgetId; size: WidgetSize }) {
  const Component = WIDGET_COMPONENTS[id];
  return <Component size={size} />;
}

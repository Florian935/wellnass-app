/**
 * US INSIGHTS-01 — partage d'un **unique** calcul d'insights à l'intérieur de l'écran d'accueil.
 *
 * Pourquoi ce fichier existe. L'accueil a besoin de la sélection **à deux endroits** : `isWidgetActive`
 * (pour exclure le widget de la grille quand il n'y a rien à dire — sinon `WidgetGrid` réserve une
 * cellule vide) et `InsightsCard` (pour l'afficher). Appeler `useInsights()` des deux côtés monterait
 * **deux fois** l'union de huit hooks, dont `useWeeklyReview`, `useMuscleBalance` et `useGoals` qui ne
 * sont pas déjà sur l'accueil — sur l'écran le plus ouvert de l'app.
 *
 * C'est exactement la duplication que GARDE-01 a dû défaire (`dashboard-repository.ts:1129-1132`) et
 * que la spec §6 interdit d'ignorer. L'accueil calcule donc **une fois**, en haut, et diffuse.
 *
 * ⚠️ Les widgets conditionnels plus anciens (`deficit-volume`, `training-load`…) n'ont pas ce
 * traitement : ils appellent leur hook deux fois, une fois dans `isWidgetActive` et une fois dans leur
 * carte. C'est supportable pour un hook simple, ça ne l'est pas pour l'agrégateur.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { SelectedInsight } from '@wellness/shared';

export type InsightsValue = { insights: SelectedInsight[]; isLoading: boolean };

const InsightsContext = createContext<InsightsValue | null>(null);

/**
 * Diffuse une sélection **déjà calculée** par le parent. Volontairement sans hook de calcul propre :
 * le parent (l'accueil) a lui-même besoin de la valeur pour `isWidgetActive`, et un composant ne peut
 * pas consommer le contexte qu'il fournit.
 */
export function InsightsProvider({
  value,
  children,
}: {
  value: InsightsValue;
  children: ReactNode;
}) {
  return <InsightsContext.Provider value={value}>{children}</InsightsContext.Provider>;
}

/**
 * Sélection partagée, ou `null` hors d'un `InsightsProvider`.
 *
 * Rend `null` plutôt que de calculer en repli : un repli silencieux rétablirait exactement le double
 * montage que ce fichier existe pour éviter, sans que personne ne le voie.
 */
export function useSharedInsights(): InsightsValue | null {
  return useContext(InsightsContext);
}

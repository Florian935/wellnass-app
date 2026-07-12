/**
 * Repository de personnalisation du dashboard (US 7.1/7.2/7.3/7.11/7.12).
 *
 * Réutilise entièrement `settings-repository` pour la persistance : la colonne
 * `user_settings.dashboard_layout` existe déjà (JSON TEXT côté PowerSync,
 * sérialisée dans `updateSettings`). AUCUNE migration, offline-first.
 *
 * - Lecture : `useDashboardLayout()` parse tolérant le JSON stocké, puis résout
 *   la disposition en fonction des piliers actifs (filtrage affichage).
 * - Écriture : les mutateurs construisent le layout complet NON filtré (toutes
 *   les entrées connues, y compris masquées et de piliers inactifs — le filtrage
 *   est une préoccupation d'affichage, pas de stockage) puis appellent
 *   `updateSettings({ dashboardLayout })`.
 * - Le réordonnancement (drag) est débouncé (~400 ms) pour ne pas marteler la
 *   base pendant le glissement.
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  DASHBOARD_WIDGET_IDS,
  defaultDashboardLayout,
  moveWidget,
  parseDashboardLayout,
  resolveDashboardLayout,
  PILLARS,
  type DashboardLayout,
  type DashboardWidgetId,
  type WidgetSize,
} from '@wellness/shared';
import { updateSettings, useSettings } from './settings-repository';

/** Délai de débounce de l'écriture du réordonnancement pendant le drag (ms). */
const REORDER_DEBOUNCE_MS = 400;

/**
 * Construit le layout complet NON filtré (les 7 entrées connues) à stocker,
 * à partir du JSON brut stocké. Sert de base aux mutateurs : on ne persiste
 * jamais une version filtrée par piliers.
 *
 * On applique `resolveDashboardLayout` avec TOUS les piliers → aucun filtrage,
 * mais bénéfice du forward-compat (ajout des widgets connus manquants) et du
 * nettoyage des IDs inconnus.
 */
function fullLayoutFrom(storedRaw: unknown): DashboardLayout {
  const parsed = parseDashboardLayout(storedRaw);
  return resolveDashboardLayout(parsed ?? defaultDashboardLayout(), [...PILLARS]);
}

/**
 * Disposition résolue du dashboard de l'utilisateur courant + mutateurs
 * persistants.
 *
 * `layout` est déjà filtré par piliers actifs (prêt à rendre) ; les mutateurs,
 * eux, opèrent sur le layout complet non filtré pour ne rien perdre.
 */
export function useDashboardLayout(): {
  layout: DashboardLayout;
  isLoading: boolean;
  toggleVisible: (id: DashboardWidgetId) => void;
  setSize: (id: DashboardWidgetId, size: WidgetSize) => void;
  reorder: (id: DashboardWidgetId, toIndex: number) => void;
  setLayout: (next: DashboardLayout) => void;
} {
  const { settings, isLoading } = useSettings();

  const activePillars = settings?.activePillars ?? [...PILLARS];
  const storedRaw = settings?.dashboardLayout ?? null;

  // Résolu (filtré piliers) pour l'affichage.
  const parsed = parseDashboardLayout(storedRaw);
  const layout = resolveDashboardLayout(parsed, activePillars);

  // Le layout brut le plus récent est gardé dans une ref pour que les mutateurs
  // débouncés composent sur l'état courant sans dépendre de la fermeture.
  // Synchronisée dans un effet (interdiction d'écrire un ref pendant le rendu).
  const storedRawRef = useRef<unknown>(storedRaw);

  // --- Débounce du réordonnancement pendant le drag ---
  const reorderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLayout = useRef<DashboardLayout | null>(null);

  useEffect(() => {
    storedRawRef.current = storedRaw;
  }, [storedRaw]);

  useEffect(() => {
    return () => {
      if (reorderTimer.current) clearTimeout(reorderTimer.current);
    };
  }, []);

  const persist = useCallback((next: DashboardLayout) => {
    // Écriture offline-first : erreur très improbable (SQLite local).
    void updateSettings({ dashboardLayout: next });
  }, []);

  const setLayout = useCallback(
    (next: DashboardLayout) => {
      storedRawRef.current = next;
      persist(next);
    },
    [persist],
  );

  const toggleVisible = useCallback(
    (id: DashboardWidgetId) => {
      const full = fullLayoutFrom(storedRawRef.current);
      const next: DashboardLayout = {
        widgets: full.widgets.map((w) =>
          w.id === id ? { ...w, visible: !w.visible } : w,
        ),
      };
      setLayout(next);
    },
    [setLayout],
  );

  const setSize = useCallback(
    (id: DashboardWidgetId, size: WidgetSize) => {
      const full = fullLayoutFrom(storedRawRef.current);
      const next: DashboardLayout = {
        widgets: full.widgets.map((w) => (w.id === id ? { ...w, size } : w)),
      };
      setLayout(next);
    },
    [setLayout],
  );

  const reorder = useCallback(
    (id: DashboardWidgetId, toIndex: number) => {
      // Le drag manipule la vue filtrée (indices contigus des widgets affichés).
      // On reporte le mouvement sur le layout complet en préservant la position
      // relative des widgets filtrés parmi les widgets stockés.
      const full = fullLayoutFrom(storedRawRef.current);
      const visibleOrder = layout.widgets.map((w) => w.id);
      const targetId = visibleOrder[toIndex];

      let next: DashboardLayout;
      if (targetId == null) {
        next = moveWidget(full, id, full.widgets.length - 1);
      } else {
        const fullTargetIndex = full.widgets.findIndex((w) => w.id === targetId);
        next = moveWidget(full, id, fullTargetIndex === -1 ? toIndex : fullTargetIndex);
      }

      // Mise à jour immédiate de la ref (les mouvements successifs composent) +
      // écriture débouncée pour ne pas marteler la base pendant le drag.
      storedRawRef.current = next;
      pendingLayout.current = next;
      if (reorderTimer.current) clearTimeout(reorderTimer.current);
      reorderTimer.current = setTimeout(() => {
        if (pendingLayout.current) {
          persist(pendingLayout.current);
          pendingLayout.current = null;
        }
      }, REORDER_DEBOUNCE_MS);
    },
    [layout.widgets, persist],
  );

  return { layout, isLoading, toggleVisible, setSize, reorder, setLayout };
}

/** Ré-export pratique de l'ordre canonique (consommé par la map de rendu). */
export { DASHBOARD_WIDGET_IDS };

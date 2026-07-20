/**
 * Repository de personnalisation des grilles de widgets, par hub (accueil / muscu / course).
 *
 * Généralise l'ancien `dashboard-layout-repository` : la même colonne
 * `user_settings.dashboard_layout` (JSON TEXT PowerSync) stocke désormais **les 3
 * dispositions** au format multi-écrans `{ screens: { home, strength, running } }`.
 * AUCUNE migration SQL (parseur rétro-compatible côté `@wellness/shared`), offline-first.
 *
 * - Lecture : `useScreenLayout(screen)` parse tolérant le JSON, extrait le hub demandé et
 *   résout sa disposition en fonction des piliers actifs (filtrage affichage).
 * - Écriture : les mutateurs construisent le layout **complet non filtré** du hub muté (toutes
 *   les entrées connues, masquées comprises — le filtrage est un souci d'affichage) puis
 *   **fusionnent** ce hub dans le multi-layout stocké (les 2 autres hubs sont préservés) via
 *   `updateSettings({ dashboardLayout })`.
 * - Réordonnancement (drag) et changement de forme/visibilité écrivent **immédiatement** (pas
 *   de débounce) — même raisonnement que l'ancien repository (cohérence du re-render réactif).
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  defaultScreenLayout,
  moveWidgetToCell,
  parseMultiScreenLayout,
  resolveScreenLayout,
  PILLARS,
  WIDGET_SCREENS,
  type MultiScreenLayout,
  type ScreenLayout,
  type WidgetId,
  type WidgetScreen,
  type WidgetSize,
} from '@wellness/shared';
import { updateSettings, useSettings } from './settings-repository';

/** Cycle des 3 formes pour le sélecteur d'édition : small → wide → large → small. */
const SIZE_CYCLE: Record<WidgetSize, WidgetSize> = {
  small: 'wide',
  wide: 'large',
  large: 'small',
};

/**
 * Layout **complet non filtré** d'un hub à partir du JSON brut stocké : on résout avec TOUS
 * les piliers → aucun filtrage, mais bénéfice du forward-compat (widgets connus manquants
 * ajoutés) et du nettoyage des IDs inconnus. Sert de base aux mutateurs.
 */
function fullScreenFrom(storedRaw: unknown, screen: WidgetScreen): ScreenLayout {
  const parsed = parseMultiScreenLayout(storedRaw);
  return resolveScreenLayout(parsed?.screens[screen] ?? null, screen, [...PILLARS]);
}

/**
 * Reconstruit le multi-layout complet en remplaçant le hub `screen` par `nextScreen`, tout en
 * **préservant** les autres hubs tels que stockés (résolus non filtrés pour rester complets).
 */
function mergeScreen(
  storedRaw: unknown,
  screen: WidgetScreen,
  nextScreen: ScreenLayout,
): MultiScreenLayout {
  const parsed = parseMultiScreenLayout(storedRaw);
  const screens: MultiScreenLayout['screens'] = {};
  for (const s of WIDGET_SCREENS) {
    screens[s] =
      s === screen ? nextScreen : (parsed?.screens[s] ?? undefined);
  }
  return { screens };
}

/**
 * Disposition résolue (prête à rendre, filtrée par piliers actifs) du hub `screen` +
 * mutateurs persistants. Les mutateurs opèrent sur le layout complet non filtré pour ne
 * rien perdre, et ne touchent qu'au hub concerné.
 */
export function useScreenLayout(screen: WidgetScreen): {
  layout: ScreenLayout;
  isLoading: boolean;
  toggleVisible: (id: WidgetId) => void;
  setSize: (id: WidgetId, size: WidgetSize) => void;
  cycleSize: (id: WidgetId) => void;
  /** Déplace le widget vers la case (col, ligne) ; pousse les widgets chevauchés. */
  moveToCell: (id: WidgetId, col: number, row: number) => void;
} {
  const { settings, isLoading } = useSettings();

  const activePillars = useMemo(
    () => settings?.activePillars ?? [...PILLARS],
    [settings?.activePillars],
  );
  const storedRaw = settings?.dashboardLayout ?? null;

  // Résolu (filtré piliers) pour l'affichage.
  const parsed = parseMultiScreenLayout(storedRaw);
  const layout = resolveScreenLayout(parsed?.screens[screen] ?? null, screen, activePillars);

  // Ref du JSON brut le plus récent : les mutateurs composent sur l'état courant sans dépendre
  // de la fermeture (mutations successives enchaînées avant le rafraîchissement de `useQuery`).
  const storedRawRef = useRef<unknown>(storedRaw);
  useEffect(() => {
    storedRawRef.current = storedRaw;
  }, [storedRaw]);

  const persistScreen = useCallback(
    (nextScreen: ScreenLayout) => {
      const next = mergeScreen(storedRawRef.current, screen, nextScreen);
      storedRawRef.current = next;
      // Écriture offline-first : erreur très improbable (SQLite local).
      void updateSettings({ dashboardLayout: next });
    },
    [screen],
  );

  const toggleVisible = useCallback(
    (id: WidgetId) => {
      const full = fullScreenFrom(storedRawRef.current, screen);
      persistScreen({
        widgets: full.widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)),
      });
    },
    [screen, persistScreen],
  );

  // Applique une nouvelle forme puis re-résout les collisions (agrandir peut chevaucher les
  // voisins) : on replace le widget sur sa propre case, ce qui pousse les chevauchés.
  const applySize = useCallback(
    (id: WidgetId, size: WidgetSize) => {
      const full = fullScreenFrom(storedRawRef.current, screen);
      const resized: ScreenLayout = {
        widgets: full.widgets.map((w) => (w.id === id ? { ...w, size } : w)),
      };
      const target = resized.widgets.find((w) => w.id === id);
      persistScreen(target ? moveWidgetToCell(resized, id, target.col, target.row) : resized);
    },
    [screen, persistScreen],
  );

  const setSize = useCallback((id: WidgetId, size: WidgetSize) => applySize(id, size), [applySize]);

  const cycleSize = useCallback(
    (id: WidgetId) => {
      const full = fullScreenFrom(storedRawRef.current, screen);
      const current = full.widgets.find((w) => w.id === id);
      if (current) applySize(id, SIZE_CYCLE[current.size]);
    },
    [screen, applySize],
  );

  const moveToCell = useCallback(
    (id: WidgetId, col: number, row: number) => {
      const full = fullScreenFrom(storedRawRef.current, screen);
      persistScreen(moveWidgetToCell(full, id, col, row));
    },
    [screen, persistScreen],
  );

  return { layout, isLoading, toggleVisible, setSize, cycleSize, moveToCell };
}

// Repli explicite : layout par défaut d'un hub (consommé hors hook si besoin).
export { defaultScreenLayout };

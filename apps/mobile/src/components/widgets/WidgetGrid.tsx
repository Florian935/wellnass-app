/**
 * Grille de widgets multi-formes (vrai quadrillage 2 colonnes), partagée par les 3 hubs.
 *
 * Chaque widget est **positionné par coordonnées de grille** (`col`, `row`) + empreinte dérivée
 * de sa forme (`sizeSpan` : small 1×1, wide 2×1, large 2×2). Case unité = ½ largeur d'écran
 * (hauteur de ligne = largeur de colonne). Placement libre (trous autorisés).
 *
 * - **Affichage** : widgets visibles positionnés en absolu selon leur case.
 * - **Édition** : `SortableWidgetGrid` (glisser-déposer aimanté à la case, appui long ~0,7 s).
 *
 * Consomme `useScreenLayout(screen)` ; chaque hub fournit son `renderWidget`.
 */

import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  compactLayout,
  GRID_COLS,
  gridRowCount,
  sizeSpan,
  type WidgetId,
  type WidgetLayoutEntry,
  type WidgetScreen,
  type WidgetSize,
} from '@wellness/shared';
import { SortableWidgetGrid } from '@/components/widgets/SortableWidgetGrid';
import { useScreenLayout } from '@/data/repositories/widget-layout-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { WidgetIdentityProvider } from '@/components/widgets/widget-identity';

/** Gouttière entre cases (px). */
export const GRID_GAP = 12;

/** Rectangle pixel d'une case (col/row + empreinte) selon la largeur de colonne. */
export function cellRect(entry: WidgetLayoutEntry, colW: number, gap: number) {
  const { w, h } = sizeSpan(entry.size);
  const cellH = colW; // case unité carrée
  return {
    left: entry.col * (colW + gap),
    top: entry.row * (cellH + gap),
    width: w * colW + (w - 1) * gap,
    height: h * cellH + (h - 1) * gap,
  };
}

/** Hauteur totale de la grille (px) pour une largeur de colonne donnée. */
export function gridHeight(widgets: WidgetLayoutEntry[], colW: number, gap: number): number {
  const rows = gridRowCount(widgets);
  return rows > 0 ? rows * colW + (rows - 1) * gap : 0;
}

export function WidgetGrid({
  screen,
  editing,
  renderWidget,
  onDragActiveChange,
  isActive,
}: {
  screen: WidgetScreen;
  editing: boolean;
  renderWidget: (id: WidgetId, size: WidgetSize) => ReactNode;
  onDragActiveChange?: (active: boolean) => void;
  /**
   * Prédicat d'**activité** d'un widget conditionnel (défaut : toujours actif). Un widget inactif
   * (ex. `deficit-volume` sans alerte, qui rendrait `null`) est **exclu de la grille** au lieu de
   * réserver une cellule vide (sinon : un « trou » dans la disposition). Appliqué en affichage ET
   * en édition — un widget absent n'a pas à être positionné/déplacé ; il réapparaît quand il redevient actif.
   */
  isActive?: (id: WidgetId) => boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { layout, toggleVisible, cycleSize, moveToCell } = useScreenLayout(screen);
  const [width, setWidth] = useState(0);

  const rendered = (editing ? layout.widgets : layout.widgets.filter((w) => w.visible)).filter(
    (w) => (isActive ? isActive(w.id) : true),
  );
  const colW = width > 0 ? (width - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS : 0;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (rendered.length === 0 && !editing) {
    return (
      <Text style={[styles.empty, { color: colors.textMuted }]}>
        {t('home.customize.empty')}
      </Text>
    );
  }

  if (editing) {
    return (
      <View onLayout={onLayout}>
        {colW > 0 ? (
          <SortableWidgetGrid
            items={rendered}
            colW={colW}
            gap={GRID_GAP}
            renderWidget={renderWidget}
            onMoveToCell={moveToCell}
            onToggleVisible={toggleVisible}
            onCycleSize={cycleSize}
            onDragActiveChange={onDragActiveChange}
          />
        ) : null}
      </View>
    );
  }

  // Affichage : positions absolues dérivées de (col, row). On **recompacte les widgets
  // visibles** pour qu'un widget masqué ne laisse pas de trou (sa case n'est pas rendue).
  const positioned = compactLayout(rendered);
  return (
    <View onLayout={onLayout} style={{ height: gridHeight(positioned, colW, GRID_GAP) }}>
      {colW > 0
        ? positioned.map((w) => {
            const r = cellRect(w, colW, GRID_GAP);
            return (
              <View
                key={w.id}
                style={{
                  position: 'absolute',
                  left: r.left,
                  top: r.top,
                  width: r.width,
                  height: r.height,
                  borderRadius: 22,
                  overflow: 'hidden',
                }}
              >
                <WidgetIdentityProvider id={w.id}>
                  {renderWidget(w.id, w.size)}
                </WidgetIdentityProvider>
              </View>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});

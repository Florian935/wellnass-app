/**
 * Grille de widgets multi-formes, partagée par les 3 hubs (accueil / muscu / course).
 *
 * - **Affichage** : coule la disposition résolue en lignes de grille 2 colonnes via
 *   `packWidgets` (deux `small` consécutifs côte à côte ; `wide`/`large` pleine largeur ;
 *   `small` isolé → colonne gauche, droite vide). Les formes carrées imposent leur ratio.
 * - **Édition** : rend la **même grille 2 colonnes** avec **glisser-déposer 2D**
 *   (`SortableWidgetGrid`) — appui long ~1 s, fantôme + barre d'insertion, dépôt libre.
 *   Chaque cellule porte son cadre pointillé + ses pastilles de coin (œil / forme).
 *
 * Consomme `useScreenLayout(screen)` : chaque hub fournit seulement son `renderWidget`
 * (map `id → composant`) et l'état `editing`.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { packWidgets, type WidgetId, type WidgetScreen, type WidgetSize } from '@wellness/shared';
import { SortableWidgetGrid } from '@/components/widgets/SortableWidgetGrid';
import { useScreenLayout } from '@/data/repositories/widget-layout-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Espacement des lignes/cellules (doit correspondre au `gap` de la grille triable). */
const SPACING = 14;
/** Ratio largeur/hauteur du grand carré pleine largeur (pas un carré strict : trop haut sinon). */
const LARGE_ASPECT = 1.35;

export function WidgetGrid({
  screen,
  editing,
  renderWidget,
  onDragActiveChange,
}: {
  screen: WidgetScreen;
  editing: boolean;
  /** Rend le widget `id` à la forme `size` (fourni par le registre du hub). */
  renderWidget: (id: WidgetId, size: WidgetSize) => ReactNode;
  onDragActiveChange?: (active: boolean) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { layout, toggleVisible, cycleSize, reorder } = useScreenLayout(screen);

  // Hors édition : uniquement les widgets visibles. En édition : tous (déjà filtrés par
  // piliers dans le layout résolu), les masqués marqués.
  const rendered = editing ? layout.widgets : layout.widgets.filter((w) => w.visible);

  if (rendered.length === 0 && !editing) {
    return (
      <Text style={[styles.empty, { color: colors.textMuted }]}>
        {t('home.customize.empty')}
      </Text>
    );
  }

  // Édition : grille 2 colonnes réordonnable par glisser-déposer (appui long ~1 s).
  if (editing) {
    return (
      <SortableWidgetGrid
        items={rendered}
        renderWidget={renderWidget}
        onReorder={reorder}
        onToggleVisible={toggleVisible}
        onCycleSize={cycleSize}
        onDragActiveChange={onDragActiveChange}
      />
    );
  }

  // Affichage : grille 2 colonnes dérivée de l'ordre.
  const rows = packWidgets(rendered);

  return (
    <View style={styles.grid}>
      {rows.map((row) => {
        const key = row.cells.map((c) => c.id).join('+');
        if (row.full) {
          const cell = row.cells[0]!;
          return (
            <View key={key} style={cell.size === 'large' ? styles.largeCell : undefined}>
              {renderWidget(cell.id, cell.size)}
            </View>
          );
        }
        // Ligne de petits carrés : 1 ou 2 cellules ½ largeur (spacer si isolé).
        return (
          <View key={key} style={styles.row}>
            {row.cells.map((cell) => (
              <View key={cell.id} style={styles.smallCell}>
                {renderWidget(cell.id, cell.size)}
              </View>
            ))}
            {row.cells.length === 1 ? <View style={styles.smallCell} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: SPACING },
  row: { flexDirection: 'row', gap: SPACING },
  smallCell: { flex: 1, aspectRatio: 1 },
  largeCell: { width: '100%', aspectRatio: LARGE_ASPECT },
  empty: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});

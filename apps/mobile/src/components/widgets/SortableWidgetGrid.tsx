/**
 * Grille de widgets **réordonnable par glisser-déposer aimanté à la case** (mode édition).
 *
 * Vrai quadrillage 2 colonnes : chaque widget est positionné en absolu selon sa case
 * (`col`, `row`) + empreinte (`sizeSpan`). Interaction : **appui long ~0,7 s** → le widget se
 * soulève et suit le doigt (translation) ; une **case fantôme** accent prévisualise l'emplacement
 * cible (aimanté à la grille, empreinte de la forme) ; au relâchement, `onMoveToCell(id, col, row)`
 * place le widget et **pousse** les widgets chevauchés (logique pure `moveWidgetToCell`).
 *
 * La cible est calculée en JS à partir de la **position visuelle** du widget (rect d'origine +
 * translation du geste), donc WYSIWYG — pas de mesure d'origine écran nécessaire. Les callbacks
 * du geste (worklets) ne passent que des primitives via `runOnJS` (jamais d'appel JS synchrone).
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import {
  clampCol,
  GRID_COLS,
  gridRowCount,
  sizeSpan,
  type WidgetId,
  type WidgetLayoutEntry,
  type WidgetSize,
} from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const LONG_PRESS_MS = 700;

/** Rect pixel d'une case (col/row + empreinte). */
function rectOf(entry: WidgetLayoutEntry, colW: number, gap: number) {
  const { w, h } = sizeSpan(entry.size);
  return {
    left: entry.col * (colW + gap),
    top: entry.row * (colW + gap),
    width: w * colW + (w - 1) * gap,
    height: h * colW + (h - 1) * gap,
  };
}

export function SortableWidgetGrid({
  items,
  colW,
  gap,
  renderWidget,
  onMoveToCell,
  onToggleVisible,
  onCycleSize,
  onDragActiveChange,
}: {
  items: WidgetLayoutEntry[];
  colW: number;
  gap: number;
  renderWidget: (id: WidgetId, size: WidgetSize) => ReactNode;
  onMoveToCell: (id: WidgetId, col: number, row: number) => void;
  onToggleVisible: (id: WidgetId) => void;
  onCycleSize: (id: WidgetId) => void;
  onDragActiveChange?: (active: boolean) => void;
}) {
  const { colors } = useTheme();
  const [activeId, setActiveId] = useState<WidgetId | null>(null);
  const [preview, setPreview] = useState<{ col: number; row: number; size: WidgetSize } | null>(null);

  const step = colW + gap;
  const height = useMemo(() => {
    const rows = gridRowCount(items);
    return rows > 0 ? rows * colW + (rows - 1) * gap : 0;
  }, [items, colW, gap]);

  /** Case cible à partir de la position visuelle (rect d'origine + translation). */
  const targetCell = useCallback(
    (entry: WidgetLayoutEntry, tx: number, ty: number) => {
      const r = rectOf(entry, colW, gap);
      const { w } = sizeSpan(entry.size);
      const col = clampCol(Math.round((r.left + tx) / step), w);
      const row = Math.max(0, Math.round((r.top + ty) / step));
      return { col, row };
    },
    [colW, gap, step],
  );

  const begin = useCallback(
    (id: WidgetId) => {
      setActiveId(id);
      onDragActiveChange?.(true);
    },
    [onDragActiveChange],
  );

  const update = useCallback(
    (id: WidgetId, tx: number, ty: number) => {
      const entry = items.find((w) => w.id === id);
      if (!entry) return;
      const { col, row } = targetCell(entry, tx, ty);
      setPreview({ col, row, size: entry.size });
    },
    [items, targetCell],
  );

  const settle = useCallback(() => {
    setActiveId(null);
    setPreview(null);
    onDragActiveChange?.(false);
  }, [onDragActiveChange]);

  const end = useCallback(
    (id: WidgetId, tx: number, ty: number) => {
      const entry = items.find((w) => w.id === id);
      if (entry) {
        const { col, row } = targetCell(entry, tx, ty);
        if (col !== entry.col || row !== entry.row) onMoveToCell(id, col, row);
      }
    },
    [items, targetCell, onMoveToCell],
  );

  const previewRect =
    preview != null
      ? rectOf({ id: 'x' as WidgetId, visible: true, size: preview.size, col: preview.col, row: preview.row }, colW, gap)
      : null;

  return (
    <View style={{ height, position: 'relative' }}>
      {/* Case fantôme cible. */}
      {previewRect ? (
        <View
          pointerEvents="none"
          style={[
            styles.previewCell,
            {
              left: previewRect.left,
              top: previewRect.top,
              width: previewRect.width,
              height: previewRect.height,
              borderColor: colors.accent,
              backgroundColor: colors.surfaceAlt,
            },
          ]}
        />
      ) : null}

      {items.map((entry) => (
        <Cell
          key={entry.id}
          entry={entry}
          rect={rectOf(entry, colW, gap)}
          isActive={activeId === entry.id}
          onBegin={begin}
          onUpdate={update}
          onEnd={end}
          onSettle={settle}
          onToggleVisible={onToggleVisible}
          onCycleSize={onCycleSize}
          renderWidget={renderWidget}
        />
      ))}
    </View>
  );
}

function Cell({
  entry,
  rect,
  isActive,
  onBegin,
  onUpdate,
  onEnd,
  onSettle,
  onToggleVisible,
  onCycleSize,
  renderWidget,
}: {
  entry: WidgetLayoutEntry;
  rect: { left: number; top: number; width: number; height: number };
  isActive: boolean;
  onBegin: (id: WidgetId) => void;
  /** Reçoit la **translation** du geste (primitives) ; cible calculée côté JS. */
  onUpdate: (id: WidgetId, tx: number, ty: number) => void;
  onEnd: (id: WidgetId, tx: number, ty: number) => void;
  onSettle: () => void;
  onToggleVisible: (id: WidgetId) => void;
  onCycleSize: (id: WidgetId) => void;
  renderWidget: (id: WidgetId, size: WidgetSize) => ReactNode;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dragging = useSharedValue(false);

  const pan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      dragging.value = true;
      runOnJS(onBegin)(entry.id);
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
      runOnJS(onUpdate)(entry.id, e.translationX, e.translationY);
    })
    .onEnd((e) => {
      runOnJS(onEnd)(entry.id, e.translationX, e.translationY);
    })
    .onFinalize(() => {
      dragging.value = false;
      tx.value = withTiming(0, { duration: 160 });
      ty.value = withTiming(0, { duration: 160 });
      runOnJS(onSettle)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: dragging.value ? 1.05 : 1 },
      { rotateZ: dragging.value ? '-2deg' : '0deg' },
    ],
    zIndex: dragging.value ? 20 : 1,
    elevation: dragging.value ? 12 : 0,
    shadowColor: '#000',
    shadowOpacity: dragging.value ? 0.28 : 0,
    shadowRadius: dragging.value ? 16 : 0,
    shadowOffset: { width: 0, height: dragging.value ? 12 : 0 },
  }));

  const shapeIcon =
    entry.size === 'small'
      ? 'square-outline'
      : entry.size === 'wide'
        ? 'tablet-landscape-outline'
        : 'grid-outline';
  const shapeKey = entry.size === 'small' ? 'shapeSmall' : entry.size === 'wide' ? 'shapeWide' : 'shapeLarge';

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.cell,
          { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          styles.frame,
          { borderColor: colors.accent },
          !entry.visible && styles.hidden,
          animatedStyle,
        ]}
      >
        <View pointerEvents="none" style={styles.fill}>
          {renderWidget(entry.id, entry.size)}
        </View>

        <View style={styles.chips}>
          <Pressable
            onPress={() => onToggleVisible(entry.id)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={entry.visible ? t('home.customize.hide') : t('home.customize.show')}
            style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          >
            <Ionicons
              name={entry.visible ? 'eye-outline' : 'eye-off-outline'}
              size={14}
              color={entry.visible ? colors.accent : colors.textMuted}
            />
          </Pressable>
          <Pressable
            onPress={() => onCycleSize(entry.id)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('widgets.customize.shapeCycle', {
              shape: t(`widgets.customize.${shapeKey}`),
            })}
            style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.accent }]}
          >
            <Ionicons name={shapeIcon} size={14} color={colors.accent} />
          </Pressable>
        </View>

        {!entry.visible ? (
          <Text style={[styles.hiddenBadge, { color: colors.textMuted }]}>
            {t('home.customize.hiddenBadge')}
          </Text>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  cell: { position: 'absolute' },
  frame: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 22, padding: 4 },
  fill: { flex: 1 },
  hidden: { opacity: 0.5 },
  previewCell: { position: 'absolute', borderWidth: 2, borderStyle: 'dashed', borderRadius: 22, opacity: 0.7 },
  chips: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 5, zIndex: 2 },
  chip: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenBadge: {
    position: 'absolute',
    top: 10,
    left: 14,
    fontFamily: fontFamily.bodySemi,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

// Réexport implicite d'une constante utile au conteneur (nombre de colonnes).
export { GRID_COLS };

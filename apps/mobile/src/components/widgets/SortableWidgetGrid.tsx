/**
 * Grille de widgets **réordonnable par glisser-déposer aimanté à la case**, avec **reflow live**
 * (mode édition).
 *
 * Vrai quadrillage 2 colonnes : chaque widget est positionné selon sa case (`col`, `row`) +
 * empreinte (`sizeSpan`). Interaction : **appui long ~0,7 s** → le widget se soulève et suit le
 * doigt ; pendant le déplacement, on recalcule en continu la disposition résultante
 * (`moveWidgetToCell`, avec poussée des chevauchés) et **les autres modules glissent en temps réel**
 * vers leur nouvelle case (animation). Une case fantôme discrète marque l'emplacement d'atterrissage.
 * Au relâchement, `onMoveToCell(id, col, row)` persiste la disposition prévisualisée.
 *
 * Cible calculée en JS depuis la position visuelle (rect d'origine + translation) → WYSIWYG. Les
 * worklets du geste ne passent que des primitives via `runOnJS`.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  gridRowCount,
  moveWidgetToCell,
  sizeSpan,
  type WidgetId,
  type WidgetLayoutEntry,
  type WidgetSize,
} from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const LONG_PRESS_MS = 700;
const REFLOW_MS = 180;

type Rect = { left: number; top: number; width: number; height: number };

/** Rect pixel d'une case (col/row + empreinte). */
function rectOf(entry: WidgetLayoutEntry, colW: number, gap: number): Rect {
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
  // Disposition prévisualisée pendant le drag (résultat de moveWidgetToCell), ou null au repos.
  const [preview, setPreview] = useState<WidgetLayoutEntry[] | null>(null);
  // Disposition **optimiste** appliquée dès le drop : base de rendu = position finale immédiate
  // (pas de retour à l'état d'origine avant que la persistance ne se propage → pas de « replay »).
  // Relâchée après un court délai, quand `items` (repository) a rattrapé.
  const [committed, setCommitted] = useState<WidgetLayoutEntry[] | null>(null);
  // Dernière case cible visée (throttle : on ne recalcule le preview qu'au changement de case).
  const lastTarget = useRef<{ col: number; row: number } | null>(null);

  // Layout de base courant : optimiste si présent, sinon la source (repository).
  const layout = committed ?? items;

  // Réconciliation : après le drop, on lâche l'optimiste (la persistance a eu le temps d'arriver ;
  // `items` reflète alors la même disposition → transition transparente).
  useEffect(() => {
    if (!committed) return;
    const h = setTimeout(() => setCommitted(null), 350);
    return () => clearTimeout(h);
  }, [committed]);

  const step = colW + gap;

  /** Case cible à partir de la position visuelle (rect d'origine + translation). */
  const targetCell = useCallback(
    (entry: WidgetLayoutEntry, tx: number, ty: number) => {
      const r = rectOf(entry, colW, gap);
      const { w } = sizeSpan(entry.size);
      return {
        col: clampCol(Math.round((r.left + tx) / step), w),
        row: Math.max(0, Math.round((r.top + ty) / step)),
      };
    },
    [colW, gap, step],
  );

  const begin = useCallback(
    (id: WidgetId) => {
      lastTarget.current = null;
      setActiveId(id);
      onDragActiveChange?.(true);
    },
    [onDragActiveChange],
  );

  const update = useCallback(
    (id: WidgetId, tx: number, ty: number) => {
      const entry = layout.find((w) => w.id === id);
      if (!entry) return;
      const t = targetCell(entry, tx, ty);
      // Throttle : ne recalcule (et re-rend) que si la case cible a changé.
      if (lastTarget.current && lastTarget.current.col === t.col && lastTarget.current.row === t.row) {
        return;
      }
      lastTarget.current = t;
      // Disposition résultante (compactée) → les autres modules s'y déplacent en live.
      setPreview(moveWidgetToCell({ widgets: layout }, id, t.col, t.row).widgets);
    },
    [layout, targetCell],
  );

  const settle = useCallback(() => {
    setActiveId(null);
    setPreview(null);
    lastTarget.current = null;
    onDragActiveChange?.(false);
  }, [onDragActiveChange]);

  const end = useCallback(
    (id: WidgetId, tx: number, ty: number) => {
      const entry = layout.find((w) => w.id === id);
      if (!entry) return;
      const t = targetCell(entry, tx, ty);
      if (t.col !== entry.col || t.row !== entry.row) {
        // Applique la disposition finale en local (base immédiate) PUIS persiste.
        setCommitted(moveWidgetToCell({ widgets: layout }, id, t.col, t.row).widgets);
        onMoveToCell(id, t.col, t.row);
      }
    },
    [layout, targetCell, onMoveToCell],
  );

  // Positions courantes (preview pendant le drag, sinon le layout de base) indexées par id.
  const posById = useMemo(() => {
    const m = new Map<WidgetId, WidgetLayoutEntry>();
    for (const e of preview ?? layout) m.set(e.id, e);
    return m;
  }, [preview, layout]);

  const height = useMemo(() => {
    const rows = gridRowCount(preview ?? layout);
    return rows > 0 ? rows * colW + (rows - 1) * gap : 0;
  }, [preview, layout, colW, gap]);

  // Case fantôme = emplacement d'atterrissage du module tiré (dans la disposition prévisualisée).
  const previewRect =
    activeId != null && preview != null
      ? (() => {
          const dragged = preview.find((e) => e.id === activeId);
          return dragged ? rectOf(dragged, colW, gap) : null;
        })()
      : null;

  return (
    <View style={{ height, position: 'relative' }}>
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
            },
          ]}
        />
      ) : null}

      {layout.map((entry) => {
        const base = rectOf(entry, colW, gap); // position de montage (absolue, d'après `layout`)
        const target = posById.get(entry.id) ?? entry;
        const tRect = rectOf(target, colW, gap);
        return (
          <Cell
            key={entry.id}
            entry={entry}
            base={base}
            reflowX={tRect.left - base.left}
            reflowY={tRect.top - base.top}
            onBegin={begin}
            onUpdate={update}
            onEnd={end}
            onSettle={settle}
            onToggleVisible={onToggleVisible}
            onCycleSize={onCycleSize}
            renderWidget={renderWidget}
          />
        );
      })}
    </View>
  );
}

function Cell({
  entry,
  base,
  reflowX,
  reflowY,
  onBegin,
  onUpdate,
  onEnd,
  onSettle,
  onToggleVisible,
  onCycleSize,
  renderWidget,
}: {
  entry: WidgetLayoutEntry;
  base: Rect;
  /** Décalage (px) vers la case cible pendant un drag (reflow live des autres modules). */
  reflowX: number;
  reflowY: number;
  onBegin: (id: WidgetId) => void;
  onUpdate: (id: WidgetId, tx: number, ty: number) => void;
  onEnd: (id: WidgetId, tx: number, ty: number) => void;
  onSettle: () => void;
  onToggleVisible: (id: WidgetId) => void;
  onCycleSize: (id: WidgetId) => void;
  renderWidget: (id: WidgetId, size: WidgetSize) => ReactNode;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const reflowXv = useSharedValue(0);
  const reflowYv = useSharedValue(0);
  const active = useSharedValue(false);

  // Anime le module (non tiré) vers sa case cible quand la prévisualisation change.
  // `active` n'est piloté QUE par les worklets du geste (jamais par un effet) → pas de conflit.
  useEffect(() => {
    reflowXv.value = withTiming(reflowX, { duration: REFLOW_MS });
    reflowYv.value = withTiming(reflowY, { duration: REFLOW_MS });
  }, [reflowX, reflowY, reflowXv, reflowYv]);

  const pan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      active.value = true;
      runOnJS(onBegin)(entry.id);
    })
    .onUpdate((e) => {
      dragX.value = e.translationX;
      dragY.value = e.translationY;
      runOnJS(onUpdate)(entry.id, e.translationX, e.translationY);
    })
    .onEnd((e) => {
      runOnJS(onEnd)(entry.id, e.translationX, e.translationY);
    })
    .onFinalize(() => {
      active.value = false;
      dragX.value = 0;
      dragY.value = 0;
      runOnJS(onSettle)();
    });

  const animatedStyle = useAnimatedStyle(() => {
    // Module tiré → suit le doigt ; autres → glissent vers leur case cible (reflow).
    if (active.value) {
      return {
        transform: [
          { translateX: dragX.value },
          { translateY: dragY.value },
          { scale: 1.05 },
          { rotateZ: '-2deg' },
        ],
        zIndex: 20,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 12 },
      };
    }
    return {
      transform: [{ translateX: reflowXv.value }, { translateY: reflowYv.value }],
      zIndex: 1,
      elevation: 0,
      shadowOpacity: 0,
    };
  });

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
          { left: base.left, top: base.top, width: base.width, height: base.height },
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
  previewCell: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 22,
    opacity: 0.55,
  },
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

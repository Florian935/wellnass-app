/**
 * Grille de widgets **réordonnable par glisser-déposer 2D** (mode édition).
 *
 * Interaction (retour Damien) : **appui long ~1 s** sur un module → il se soulève (fantôme
 * qui suit le doigt, léger tilt + ombre) ; une **barre d'insertion** accent montre où il
 * atterrira dans la grille 2 colonnes ; au relâchement, le module se pose à cette position
 * (deux petits carrés consécutifs = même ligne). Les contrôles d'édition (œil = masquer,
 * ◻/▭/▣ = forme) sont des **pastilles de coin** pour tenir même sur un petit carré.
 *
 * Géométrie : chaque ligne mesure son `y`/hauteur (`onLayout`) et chaque cellule son
 * `x`/largeur → on reconstitue le rectangle de chaque module dans le repère du conteneur.
 * Pendant le drag, l'index d'insertion est calculé par hit-test du doigt contre ces
 * rectangles **figés au démarrage** (pas de reflow live → mesures stables). L'écriture
 * (`onReorder`) n'a lieu **qu'au drop**, une seule fois.
 */

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import {
  packWidgets,
  type WidgetId,
  type WidgetLayoutEntry,
  type WidgetSize,
} from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Délai d'appui long avant activation du drag (ms). */
const LONG_PRESS_MS = 700;
const SPACING = 14;

type Rect = { left: number; top: number; width: number; height: number };

export function SortableWidgetGrid({
  items,
  renderWidget,
  onReorder,
  onToggleVisible,
  onCycleSize,
  onDragActiveChange,
}: {
  items: WidgetLayoutEntry[];
  renderWidget: (id: WidgetId, size: WidgetSize) => ReactNode;
  onReorder: (id: WidgetId, toIndex: number) => void;
  onToggleVisible: (id: WidgetId) => void;
  onCycleSize: (id: WidgetId) => void;
  onDragActiveChange?: (active: boolean) => void;
}) {
  const { colors } = useTheme();

  const rows = useMemo(() => packWidgets(items), [items]);

  // Rectangles mesurés (repère conteneur), par id. Alimentés par onLayout des lignes/cellules.
  const rowGeom = useRef<Map<number, { top: number; height: number }>>(new Map());
  const cellGeom = useRef<Map<string, { left: number; width: number; row: number }>>(new Map());
  const frozen = useRef<{ id: WidgetId; rect: Rect }[]>([]);

  const [activeId, setActiveId] = useState<WidgetId | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  // Copie render-safe des rectangles figés (la ref reste pour le hit-test en event handler).
  const [frozenList, setFrozenList] = useState<{ id: WidgetId; rect: Rect }[]>([]);

  const setRowGeom = useCallback((row: number, top: number, height: number) => {
    rowGeom.current.set(row, { top, height });
  }, []);
  const setCellGeom = useCallback((id: string, left: number, width: number, row: number) => {
    cellGeom.current.set(id, { left, width, row });
  }, []);

  /** Reconstruit et fige les rectangles de tous les modules (repère conteneur). */
  const freezeRects = useCallback(() => {
    const list: { id: WidgetId; rect: Rect }[] = [];
    for (const it of items) {
      const c = cellGeom.current.get(it.id);
      if (!c) continue;
      const r = rowGeom.current.get(c.row);
      if (!r) continue;
      list.push({
        id: it.id,
        rect: { left: c.left, top: r.top, width: c.width, height: r.height },
      });
    }
    // Ordonné selon `items` (ordre logique courant).
    frozen.current = list;
    setFrozenList(list);
  }, [items]);

  /** Index d'insertion dans la séquence à partir de la position du doigt (repère conteneur). */
  const computeIndex = useCallback((px: number, py: number, draggedId: WidgetId): number => {
    let idx = 0;
    for (const { id, rect } of frozen.current) {
      if (id === draggedId) continue;
      const cx = rect.left + rect.width / 2;
      // Module sur une ligne au-dessus du doigt → compte ; même ligne et à gauche → compte.
      // (Module d'une ligne en dessous → n'incrémente pas.)
      if (rect.top + rect.height <= py) {
        idx += 1;
      } else if (py >= rect.top && py <= rect.top + rect.height && cx < px) {
        idx += 1;
      }
    }
    return idx;
  }, []);

  const begin = useCallback(
    (id: WidgetId) => {
      freezeRects();
      setActiveId(id);
      onDragActiveChange?.(true);
    },
    [freezeRects, onDragActiveChange],
  );

  // Position/mesure du conteneur pour convertir le doigt (absolu → repère local). Déclaré
  // avant les callbacks qui l'utilisent.
  const containerOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<View>(null);
  const onContainerLayout = useCallback(() => {
    containerRef.current?.measureInWindow((x, y) => {
      containerOrigin.current = { x, y };
    });
  }, []);

  // NB : ces callbacks tournent sur le thread JS (appelés via `runOnJS` depuis le worklet du
  // geste). La conversion absolu → local se fait ICI, jamais dans le worklet (sinon crash
  // « Tried to synchronously call a Remote Function »).
  const updateTarget = useCallback(
    (id: WidgetId, absX: number, absY: number) => {
      const { x, y } = containerOrigin.current;
      setTargetIndex(computeIndex(absX - x, absY - y, id));
    },
    [computeIndex],
  );

  const settle = useCallback(() => {
    setActiveId(null);
    setTargetIndex(null);
    onDragActiveChange?.(false);
  }, [onDragActiveChange]);

  const end = useCallback(
    (id: WidgetId, absX: number, absY: number) => {
      const { x, y } = containerOrigin.current;
      const to = computeIndex(absX - x, absY - y, id);
      const from = items.findIndex((w) => w.id === id);
      // `to` est l'index d'insertion en excluant l'élément tiré : si on insère après sa
      // position d'origine, l'indice cible dans le tableau final reste `to` (moveWidget borne).
      if (from !== -1 && to !== from) onReorder(id, to);
    },
    [computeIndex, items, onReorder],
  );

  // Barre d'insertion : géométrie dérivée de l'index cible et des rectangles figés.
  const insertBar = useMemo(() => {
    if (activeId == null || targetIndex == null) return null;
    const seq = frozenList.filter((f) => f.id !== activeId);
    const at = seq[targetIndex]?.rect ?? seq[seq.length - 1]?.rect;
    if (!at) return null;
    const afterLast = targetIndex >= seq.length;
    return {
      left: afterLast ? at.left + at.width - 2 : at.left - SPACING / 2 - 1,
      top: at.top,
      height: at.height,
    };
  }, [activeId, targetIndex, frozenList]);

  return (
    <View ref={containerRef} onLayout={onContainerLayout} style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View
          key={row.cells.map((c) => c.id).join('+')}
          style={[styles.row, row.full ? styles.fullRow : null]}
          onLayout={(e: LayoutChangeEvent) =>
            setRowGeom(rowIndex, e.nativeEvent.layout.y, e.nativeEvent.layout.height)
          }
        >
          {row.cells.map((cell) => (
            <Cell
              key={cell.id}
              entry={cell}
              full={row.full}
              rowIndex={rowIndex}
              isActive={activeId === cell.id}
              onMeasure={setCellGeom}
              onBegin={begin}
              onUpdate={updateTarget}
              onEnd={end}
              onSettle={settle}
              onToggleVisible={onToggleVisible}
              onCycleSize={onCycleSize}
              renderWidget={renderWidget}
            />
          ))}
          {/* Colonne droite vide pour un petit carré isolé (aligné à gauche). */}
          {!row.full && row.cells.length === 1 ? <View style={styles.spacer} /> : null}
        </View>
      ))}

      {insertBar ? (
        <View
          pointerEvents="none"
          style={[
            styles.insertBar,
            {
              left: insertBar.left,
              top: insertBar.top,
              height: insertBar.height,
              backgroundColor: colors.accent,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

function Cell({
  entry,
  full,
  rowIndex,
  isActive,
  onMeasure,
  onBegin,
  onUpdate,
  onEnd,
  onSettle,
  onToggleVisible,
  onCycleSize,
  renderWidget,
}: {
  entry: WidgetLayoutEntry;
  full: boolean;
  rowIndex: number;
  isActive: boolean;
  onMeasure: (id: string, left: number, width: number, row: number) => void;
  onBegin: (id: WidgetId) => void;
  /** Reçoit les coordonnées **absolues** (page) du doigt ; conversion en local côté parent. */
  onUpdate: (id: WidgetId, absX: number, absY: number) => void;
  onEnd: (id: WidgetId, absX: number, absY: number) => void;
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

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      onMeasure(entry.id, x, width, rowIndex);
    },
    [entry.id, rowIndex, onMeasure],
  );

  // IMPORTANT : les callbacks du geste sont des *worklets* (thread UI). On n'y appelle QUE
  // des shared values et `runOnJS` avec des primitives brutes — jamais une fonction JS
  // synchrone (sinon crash « Tried to synchronously call a Remote Function »). La conversion
  // absolu → repère conteneur est faite côté JS dans `onUpdate`/`onEnd` (parent).
  const pan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      dragging.value = true;
      runOnJS(onBegin)(entry.id);
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
      runOnJS(onUpdate)(entry.id, e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      runOnJS(onEnd)(entry.id, e.absoluteX, e.absoluteY);
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
    zIndex: dragging.value ? 20 : 0,
    elevation: dragging.value ? 12 : 0,
    shadowColor: '#000',
    shadowOpacity: dragging.value ? 0.28 : 0,
    shadowRadius: dragging.value ? 16 : 0,
    shadowOffset: { width: 0, height: dragging.value ? 12 : 0 },
    opacity: isActive ? 0.97 : 1,
  }));

  const shapeIcon =
    entry.size === 'small'
      ? 'square-outline'
      : entry.size === 'wide'
        ? 'tablet-landscape-outline'
        : 'grid-outline';

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        onLayout={onLayout}
        style={[
          full ? styles.fullCell : styles.smallCell,
          entry.size === 'small' ? styles.aspectSquare : null,
          entry.size === 'large' ? styles.aspectLarge : null,
          styles.cellFrame,
          { borderColor: colors.accent },
          !entry.visible && styles.hidden,
          animatedStyle,
        ]}
      >
        {/* Widget non interactif en édition (les contrôles priment). */}
        <View pointerEvents="none" style={styles.fill}>
          {renderWidget(entry.id, entry.size)}
        </View>

        {/* Pastilles de coin : masquer / changer de forme. */}
        <View style={styles.chips}>
          <Pressable
            onPress={() => onToggleVisible(entry.id)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={
              entry.visible ? t('home.customize.hide') : t('home.customize.show')
            }
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
              shape: t(`widgets.customize.shape${entry.size === 'small' ? 'Small' : entry.size === 'wide' ? 'Wide' : 'Large'}`),
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
  grid: { gap: SPACING, position: 'relative' },
  row: { flexDirection: 'row', gap: SPACING },
  fullRow: {},
  smallCell: { flex: 1 },
  fullCell: { width: '100%' },
  aspectSquare: { aspectRatio: 1 },
  aspectLarge: { aspectRatio: 1.35 },
  spacer: { flex: 1 },
  cellFrame: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 22, padding: 4, position: 'relative' },
  fill: { flex: 1 },
  hidden: { opacity: 0.5 },
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
  insertBar: { position: 'absolute', width: 4, borderRadius: 3, zIndex: 15 },
});

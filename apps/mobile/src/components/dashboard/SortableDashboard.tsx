/**
 * Conteneur de réorganisation par drag & drop du dashboard (US 7.2).
 *
 * Utilisé UNIQUEMENT en mode édition. Chaque ligne expose une poignée
 * (`react-native-gesture-handler` `Pan`) ; pendant le glissement, la carte
 * active suit le doigt (translateY animé via `react-native-reanimated`) et les
 * voisines se décalent pour matérialiser l'insertion. Au relâchement, l'index
 * cible est calculé à partir des hauteurs mesurées et remonté via `onReorder`.
 *
 * Le défilement du `ScrollView` parent est neutralisé pendant un drag actif via
 * `onDragActiveChange` (cf. maquette : « le défilement est neutralisé pendant
 * le glissement »).
 *
 * Hauteurs variables : chaque ligne mesure sa hauteur (`onLayout`) ; le calcul
 * d'index se fait sur les positions cumulées, pas sur une hauteur fixe.
 */

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { DashboardWidgetId } from '@wellness/shared';

const SPACING = 14; // doit correspondre au `gap` de la liste (styles.blocks)

export type SortableItem = { id: DashboardWidgetId };

/**
 * `renderItem` reçoit une `handle` : un noeud à insérer comme poignée de
 * déplacement. La poignée embarque le `GestureDetector` ; l'appelant la place
 * où il veut (dans `DashboardEditControls`).
 */
export function SortableDashboard<T extends SortableItem>({
  items,
  renderItem,
  onReorder,
  onDragActiveChange,
}: {
  items: T[];
  renderItem: (item: T, handle: ReactNode) => ReactNode;
  onReorder: (id: DashboardWidgetId, toIndex: number) => void;
  onDragActiveChange?: (active: boolean) => void;
}) {
  // Hauteurs mesurées par id (mises à jour à chaque onLayout).
  const heights = useRef<Map<string, number>>(new Map());
  // Index de la ligne en cours de drag (null = aucun). Pilote le rendu du ghost.
  const [activeId, setActiveId] = useState<DashboardWidgetId | null>(null);

  const setHeight = useCallback((id: string, h: number) => {
    heights.current.set(id, h);
  }, []);

  const beginDrag = useCallback(
    (id: DashboardWidgetId) => {
      setActiveId(id);
      onDragActiveChange?.(true);
    },
    [onDragActiveChange],
  );

  const endDrag = useCallback(
    (id: DashboardWidgetId, translationY: number) => {
      const order = items.map((it) => it.id);
      const fromIndex = order.indexOf(id);
      if (fromIndex === -1) {
        setActiveId(null);
        onDragActiveChange?.(false);
        return;
      }

      // Convertit le déplacement vertical en nombre de crans franchis, en
      // parcourant les voisins dans le sens du drag et en cumulant leur hauteur.
      let toIndex = fromIndex;
      let remaining = translationY;
      const step = (i: number) => (heights.current.get(order[i]!) ?? 0) + SPACING;

      if (translationY > 0) {
        // Vers le bas : franchir les voisins suivants.
        let i = fromIndex + 1;
        while (i < order.length && remaining > step(i) / 2) {
          remaining -= step(i);
          toIndex = i;
          i += 1;
        }
      } else if (translationY < 0) {
        // Vers le haut : franchir les voisins précédents.
        let i = fromIndex - 1;
        while (i >= 0 && -remaining > step(i) / 2) {
          remaining += step(i);
          toIndex = i;
          i -= 1;
        }
      }

      setActiveId(null);
      onDragActiveChange?.(false);
      if (toIndex !== fromIndex) {
        onReorder(id, toIndex);
      }
    },
    [items, onReorder, onDragActiveChange],
  );

  return (
    <View style={styles.list}>
      {items.map((item) => (
        <SortableRow
          key={item.id}
          id={item.id}
          isActive={activeId === item.id}
          onMeasure={setHeight}
          onBegin={beginDrag}
          onEnd={endDrag}
          renderItem={renderItem}
          item={item}
        />
      ))}
    </View>
  );
}

function SortableRow<T extends SortableItem>({
  id,
  item,
  isActive,
  onMeasure,
  onBegin,
  onEnd,
  renderItem,
}: {
  id: DashboardWidgetId;
  item: T;
  isActive: boolean;
  onMeasure: (id: string, h: number) => void;
  onBegin: (id: DashboardWidgetId) => void;
  onEnd: (id: DashboardWidgetId, translationY: number) => void;
  renderItem: (item: T, handle: ReactNode) => ReactNode;
}) {
  const translateY = useSharedValue(0);
  const dragging = useSharedValue(false);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      onMeasure(id, e.nativeEvent.layout.height);
    },
    [id, onMeasure],
  );

  const pan = Gesture.Pan()
    .activateAfterLongPress(120)
    .onStart(() => {
      dragging.value = true;
      runOnJS(onBegin)(id);
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(onEnd)(id, e.translationY);
    })
    .onFinalize(() => {
      dragging.value = false;
      translateY.value = withTiming(0, { duration: 160 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: dragging.value ? 1.02 : 1 }],
    zIndex: dragging.value ? 10 : 0,
    // Élévation Android + opacité pour matérialiser le « ghost ».
    elevation: dragging.value ? 8 : 0,
    opacity: dragging.value ? 0.96 : 1,
  }));

  const handle = (
    <GestureDetector gesture={pan}>
      <Animated.View style={styles.handle} accessibilityRole="adjustable">
        <View style={styles.handleGlyph}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </Animated.View>
    </GestureDetector>
  );

  return (
    <Animated.View
      onLayout={onLayout}
      style={[animatedStyle, isActive && styles.activeShadow]}
    >
      {renderItem(item, handle)}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACING },
  activeShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
  },
  handle: { paddingVertical: 4, paddingRight: 4, justifyContent: 'center' },
  // Glyphe « ⠿ » approximé par 6 points (2 colonnes × 3 lignes).
  handleGlyph: {
    width: 14,
    height: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'space-between',
    justifyContent: 'space-between',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8a7a63',
  },
});

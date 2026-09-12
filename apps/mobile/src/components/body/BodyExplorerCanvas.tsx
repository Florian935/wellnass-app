import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, runOnUI, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { FineMuscle } from '@wellness/shared';
import { AnatomyFigure } from './AnatomyFigure';
import { ANATOMY_ASPECT_RATIO } from './anatomy-geometry';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const FIGURE_HEIGHT = 328;
const STAGE_HEIGHT = 352;
const MAX_ZOOM = 2.5;

/** Remounted on a new selection/view: camera state never leaks between body regions. */
export function BodyExplorerCanvas({ side, selected, full, reduced, onSelect }: {
  side: 'front' | 'back'; selected: FineMuscle | null;
  full: FineMuscle[]; reduced: FineMuscle[]; onSelect: (muscle: FineMuscle) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [zoomLabel, setZoomLabel] = useState(1);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const width = useSharedValue(300);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const boundPosition = () => {
    'worklet';
    const maxX = Math.max(0, (FIGURE_HEIGHT * ANATOMY_ASPECT_RATIO * scale.get() - width.get()) / 2);
    const maxY = Math.max(0, (FIGURE_HEIGHT * scale.get() - STAGE_HEIGHT) / 2);
    x.set(Math.max(-maxX, Math.min(maxX, x.get())));
    y.set(Math.max(-maxY, Math.min(maxY, y.get())));
  };
  const pinch = Gesture.Pinch()
    .onStart(() => { startScale.set(scale.get()); })
    .onUpdate((event) => {
      scale.set(Math.min(MAX_ZOOM, Math.max(1, startScale.get() * event.scale)));
      boundPosition();
    })
    .onFinalize(() => { runOnJS(setZoomLabel)(scale.get()); });
  // Two fingers keep one-finger page scrolling and simple muscle taps available.
  const pan = Gesture.Pan().minPointers(2)
    .onStart(() => { startX.set(x.get()); startY.set(y.get()); })
    .onUpdate((event) => {
      x.set(startX.get() + event.translationX);
      y.set(startY.get() + event.translationY);
      boundPosition();
    });
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }],
  }));
  // Keep button and gesture updates on the UI thread, where shared reads/writes are synchronous.
  const changeZoom = (delta: number) => runOnUI((change: number) => {
    'worklet';
    const next = Math.min(MAX_ZOOM, Math.max(1, scale.get() + change));
    scale.set(next);
    boundPosition();
    runOnJS(setZoomLabel)(next);
  })(delta);
  const reset = () => runOnUI(() => {
    'worklet';
    scale.set(1);
    x.set(0);
    y.set(0);
    runOnJS(setZoomLabel)(1);
  })();
  const move = (dx: number, dy: number) => runOnUI((horizontal: number, vertical: number) => {
    'worklet';
    x.set(x.get() + horizontal * 88);
    y.set(y.get() + vertical * 88);
    boundPosition();
  })(dx, dy);
  const resize = (nextWidth: number) => runOnUI((measured: number) => {
    'worklet';
    width.set(measured);
    boundPosition();
  })(nextWidth);

  const zoomButton = (direction: 'in' | 'out') => {
    const disabled = direction === 'in' ? zoomLabel >= MAX_ZOOM : zoomLabel <= 1;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(`bodyExplorer.zoom.${direction}`)}
        accessibilityState={{ disabled }} disabled={disabled}
        onPress={() => changeZoom(direction === 'in' ? 0.5 : -0.5)}
        style={[styles.iconButton, { borderColor: colors.borderStrong, opacity: disabled ? 0.45 : 1 }]}
      >
        <Ionicons name={direction === 'in' ? 'add' : 'remove'} size={22} color={colors.text} />
      </Pressable>
    );
  };
  return (
    <View style={[styles.canvas, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
        <View style={styles.stage} onLayout={(event) => resize(event.nativeEvent.layout.width)}>
          <Animated.View testID="body-explorer-figure" style={animatedStyle}>
            <AnatomyFigure side={side} height={FIGURE_HEIGHT} selected={selected} full={full} reduced={reduced} onSelect={onSelect} />
          </Animated.View>
        </View>
      </GestureDetector>
      <View style={styles.tools}>
        {zoomButton('out')}
        <Text style={[styles.zoomText, { color: colors.textMuted }]}>{t('bodyExplorer.zoom.value', { value: zoomLabel.toFixed(1) })}</Text>
        {zoomButton('in')}
        <Pressable accessibilityRole="button" accessibilityLabel={t('bodyExplorer.zoom.reset')} onPress={reset} style={styles.reset}>
          <Ionicons name="locate-outline" color={colors.text} size={18} />
          <Text style={[styles.resetText, { color: colors.text }]}>{t('bodyExplorer.zoom.reset')}</Text>
        </Pressable>
      </View>
      {zoomLabel > 1 ? <View style={styles.panTools}>
        {([
          ['left', -1, 0], ['up', 0, -1], ['down', 0, 1], ['right', 1, 0],
        ] as const).map(([direction, dx, dy]) => (
          <Pressable key={direction} accessibilityRole="button" accessibilityLabel={t(`bodyExplorer.pan.${direction}`)}
            onPress={() => move(dx, dy)} style={[styles.iconButton, { borderColor: colors.borderStrong }]}>
            <Ionicons name={direction === 'left' ? 'arrow-back' : direction === 'right' ? 'arrow-forward' : `arrow-${direction}`} size={20} color={colors.text} />
          </Pressable>
        ))}
      </View> : null}
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('bodyExplorer.gestureHint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { borderWidth: 1, borderRadius: 24, overflow: 'hidden' },
  stage: { height: STAGE_HEIGHT, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10, flexWrap: 'wrap' },
  panTools: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 8 },
  iconButton: { minWidth: 44, minHeight: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  zoomText: { fontFamily: fontFamily.mono, fontSize: 12 },
  reset: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 },
  resetText: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  hint: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16 },
});

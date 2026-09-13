import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { fontFamily } from '@/theme/fonts';

export function BodyShapeControl({ label, value, goal, disabled, onChange }: {
  label: string; value: number; goal: boolean; disabled: boolean; onChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [width, setWidth] = useState(1);
  const min = goal ? 0 : -2;
  const max = goal ? 4 : 2;
  const step = goal ? 1 : 0.25;
  const change = (next: number) => { if (!disabled) onChange(Math.min(max, Math.max(min, Math.round(next / step) * step))); };
  const moveTo = (x: number) => change(min + (x / Math.max(1, width)) * (max - min));
  const pan = Gesture.Pan().runOnJS(true).enabled(!disabled).activeOffsetX([-4, 4]).failOffsetY([-12, 12])
    .onStart((e) => moveTo(e.x)).onUpdate((e) => moveTo(e.x));
  const tap = Gesture.Tap().runOnJS(true).enabled(!disabled).onEnd((e, success) => { if (success) moveTo(e.x); });
  const description = goal ? t(`bodyShape.goalLevels.${Math.round(value)}`)
    : t(`bodyShape.shapeLevels.${value < -0.75 ? 'narrow' : value > 0.75 ? 'wide' : value === 0 ? 'base' : value < 0 ? 'slightlyNarrow' : 'slightlyWide'}`);
  const percent = ((value - min) / (max - min)) * 100;
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <View style={styles.heading}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.description, { color: colors.accent }]}>{description}</Text>
    </View>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('bodyShape.decrease', { zone: label })}
        accessibilityState={{ disabled: disabled || value <= min }} disabled={disabled || value <= min}
        onPress={() => change(value - step)} style={[styles.step, { borderColor: colors.borderStrong }]}>
        <Ionicons name="remove" size={22} color={colors.text} />
      </Pressable>
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <View accessible accessibilityRole="adjustable" accessibilityLabel={t(goal ? 'bodyShape.goalControl' : 'bodyShape.shapeControl', { zone: label })}
          accessibilityState={{ disabled }} accessibilityValue={{ min, max, now: value, text: description }}
          accessibilityActions={[{ name: 'increment', label: t('bodyShape.increase', { zone: label }) }, { name: 'decrement', label: t('bodyShape.decrease', { zone: label }) }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'increment') change(value + step);
            if (e.nativeEvent.actionName === 'decrement') change(value - step);
          }}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.slider}>
          <View style={[styles.track, { backgroundColor: colors.borderStrong }]} />
          <View style={[styles.track, { backgroundColor: colors.accent, width: `${percent}%` }]} />
          <View style={[styles.thumb, { left: `${percent}%`, backgroundColor: colors.accent, borderColor: colors.surface }]} />
        </View>
      </GestureDetector>
      <Pressable accessibilityRole="button" accessibilityLabel={t('bodyShape.increase', { zone: label })}
        accessibilityState={{ disabled: disabled || value >= max }} disabled={disabled || value >= max}
        onPress={() => change(value + step)} style={[styles.step, { borderColor: colors.borderStrong }]}>
        <Ionicons name="add" size={22} color={colors.text} />
      </Pressable>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={t('bodyShape.resetZone')} disabled={disabled}
      onPress={() => change(0)} style={styles.reset}>
      <Text style={[styles.resetText, { color: colors.textMuted }]}>{t('bodyShape.resetZone')}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 14, paddingTop: 10, borderWidth: 1, borderRadius: 20 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  label: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  description: { fontFamily: fontFamily.bodyMedium, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 22, paddingTop: 6 },
  step: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 22 },
  slider: { flex: 1, height: 48, justifyContent: 'center' },
  track: { position: 'absolute', height: 6, width: '100%', borderRadius: 3 },
  thumb: { position: 'absolute', width: 24, height: 24, marginLeft: -12, borderRadius: 12, borderWidth: 3 },
  reset: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  resetText: { fontFamily: fontFamily.body, fontSize: 12 },
});

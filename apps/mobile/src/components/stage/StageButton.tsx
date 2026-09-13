/**
 * US DASH-01 — le bouton posé sur une scène.
 *
 * `solid` : le geste principal de la scène (fond clair, encre du pilier). `glass` : le geste
 * secondaire, translucide. 50 px de haut, au-dessus des 44 px exigés (WCAG 2.5.5).
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale, type PressHaptic } from '@/components/motion/PressableScale';
import { fontFamily } from '@/theme/fonts';
import type { StageKey } from '@/theme/stage';
import { useStageTheme } from './PillarStage';

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  pillar: StageKey;
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'glass';
  icon?: IconName;
  disabled?: boolean;
  haptic?: PressHaptic;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function StageButton({
  pillar,
  label,
  onPress,
  variant = 'solid',
  icon,
  disabled = false,
  haptic = 'confirm',
  accessibilityHint,
  style,
  testID,
}: Props) {
  const stage = useStageTheme(pillar);
  const solid = variant === 'solid';
  const ink = solid ? stage.onSolid : stage.ink;

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      haptic={haptic}
      onPress={onPress}
      style={[
        styles.button,
        solid
          ? { backgroundColor: stage.solid }
          : { backgroundColor: stage.glass, borderColor: stage.glassBorder, borderWidth: 1 },
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={ink} /> : null}
      <Text style={[styles.label, { color: ink }]} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: { fontFamily: fontFamily.bodyBold, fontSize: 15, flexShrink: 1 },
  disabled: { opacity: 0.55 },
});

/**
 * US DASH-01 — la scène d'un pilier (spec §3).
 *
 * Pleine largeur, sous la barre d'état, coins bas arrondis, dégradé propre au pilier, et un emplacement
 * « matière » peint derrière le contenu. C'est le seul endroit de l'écran où l'on dépense de l'encre.
 *
 * ── L'arrivée ─────────────────────────────────────────────────────────────────────────────────────
 * À chaque prise de focus, le contenu **remonte de 8 px et s'éclaircit** en `DURATION.base`. Il part de
 * 35 % d'opacité, pas de 0 : repartir du vide à chaque changement d'onglet se lisait comme un
 * clignotement — c'est exactement le « bug visuel » relevé sur la maquette (D6).
 */

import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { useMenuAccent } from '@/stores/menu-accent-store';
import { DURATION, EASING } from '@/theme/motion';
import { stageTheme, type StageKey, type StageTheme } from '@/theme/stage';
import { useTheme } from '@/theme/useTheme';

const ARRIVAL_FROM_OPACITY = 0.35;
const ARRIVAL_OFFSET = 8;

export function useStageTheme(pillar: StageKey): StageTheme {
  const { scheme } = useTheme();
  return stageTheme(pillar, scheme);
}

type Props = {
  pillar: StageKey;
  children: ReactNode;
  /** Peint derrière le contenu, sans capter les gestes. */
  matter?: ReactNode;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
};

export function PillarStage({ pillar, children, matter, style, onLayout, testID }: Props) {
  const stage = useStageTheme(pillar);
  const insets = useSafeAreaInsets();
  const focused = useMenuAccent((s) => s.focusedMenu === pillar);
  const reduced = useAppReducedMotion();
  const arrival = useSharedValue(1);

  useEffect(() => {
    if (!focused || reduced) {
      arrival.value = 1;
      return;
    }
    arrival.value = 0;
    arrival.value = withTiming(1, { duration: DURATION.base, easing: EASING.fill });
  }, [arrival, focused, reduced]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: ARRIVAL_FROM_OPACITY + (1 - ARRIVAL_FROM_OPACITY) * arrival.value,
    transform: [{ translateY: (1 - arrival.value) * ARRIVAL_OFFSET }],
  }));

  return (
    <View
      testID={testID}
      onLayout={onLayout}
      style={[styles.stage, { paddingTop: insets.top + 14, backgroundColor: stage.surfaces[0] }, style]}
    >
      <LinearGradient
        colors={stage.gradient}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {matter ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {matter}
        </View>
      ) : null}
      <Animated.View style={[styles.content, contentStyle]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    overflow: 'hidden',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  content: { gap: 14 },
});

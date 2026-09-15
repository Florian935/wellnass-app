/**
 * US DASH-01 — l'écran d'un pilier : la scène, puis le corps, et le repli au défilement (D2).
 *
 * ── Ce que le repli est, et ce qu'il n'est pas ────────────────────────────────────────────────────
 * La scène défile **normalement**, à la même vitesse que le corps : rien de ce qu'on lit ne se déplace
 * à une autre vitesse, ce n'est donc pas la parallaxe exclue par MOTION-01 §5. Quand elle sort de
 * l'écran, un en-tête compact apparaît en haut, porteur du titre et du chiffre clé : on garde le
 * contexte sans sacrifier la place des données.
 *
 * Le calcul tourne sur le thread UI (`useAnimatedScrollHandler`, R3). Mouvement coupé : l'en-tête
 * apparaît d'un coup au franchissement du seuil, sans fondu (R1).
 */

import { useState, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, Text, View, type RefreshControlProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { fontFamily } from '@/theme/fonts';
import type { StageKey } from '@/theme/stage';
import { useTheme } from '@/theme/useTheme';
import { useStageTheme } from './PillarStage';

const COMPACT_BAR_HEIGHT = 52;
const FADE_SPAN = 36;

type Props = {
  pillar: StageKey;
  stage: ReactNode;
  compactTitle: string;
  compactValue?: string;
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  scrollEnabled?: boolean;
  bodyStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

export function StageScrollView({
  pillar,
  stage,
  compactTitle,
  compactValue,
  children,
  refreshControl,
  scrollEnabled = true,
  bodyStyle,
  testID,
}: Props) {
  const { colors } = useTheme();
  const theme = useStageTheme(pillar);
  const insets = useSafeAreaInsets();
  const reduced = useAppReducedMotion();
  const scrollY = useSharedValue(0);
  const [stageHeight, setStageHeight] = useState(0);
  const [compactVisible, setCompactVisible] = useState(false);

  // Seuil : la scène est presque entièrement sortie, sous la barre compacte.
  const threshold = Math.max(0, stageHeight - insets.top - COMPACT_BAR_HEIGHT - 12);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const headerStyle = useAnimatedStyle(() => {
    const p = reduced
      ? scrollY.value >= threshold && threshold > 0
        ? 1
        : 0
      : interpolate(scrollY.value, [threshold - FADE_SPAN, threshold], [0, 1], Extrapolation.CLAMP);
    return { opacity: stageHeight === 0 ? 0 : p, transform: [{ translateY: (1 - p) * -6 }] };
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID={testID}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setCompactVisible(e.nativeEvent.contentOffset.y >= threshold && threshold > 0)}
        onScrollEndDrag={(e) => setCompactVisible(e.nativeEvent.contentOffset.y >= threshold && threshold > 0)}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        refreshControl={refreshControl}
      >
        <View onLayout={(e) => setStageHeight(e.nativeEvent.layout.height)}>{stage}</View>
        <View style={[styles.body, bodyStyle]}>{children}</View>
      </Animated.ScrollView>

      <Animated.View
        testID="stage-compact-header"
        pointerEvents="none"
        // Invisible pour l'œil tant que la scène est dépliée : il doit l'être aussi pour TalkBack.
        importantForAccessibility={compactVisible ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!compactVisible}
        style={[
          styles.compact,
          { paddingTop: insets.top, height: insets.top + COMPACT_BAR_HEIGHT, backgroundColor: theme.surfaces[0] },
          headerStyle,
        ]}
      >
        <Text style={[styles.compactTitle, { color: theme.ink }]} numberOfLines={1}>
          {compactTitle}
        </Text>
        {compactValue ? (
          <Text style={[styles.compactValue, { color: theme.ink }]} numberOfLines={1}>
            {compactValue}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, gap: 12 },
  compact: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  compactTitle: { fontFamily: fontFamily.displayBold, fontSize: 17, letterSpacing: -0.4, flexShrink: 1 },
  compactValue: { fontFamily: fontFamily.displayXBold, fontSize: 17, letterSpacing: -0.4 },
});

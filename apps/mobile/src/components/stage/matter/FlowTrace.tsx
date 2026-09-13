/**
 * US DASH-01 — la matière de la course : une trace parcourue sans fin (physique « flux »).
 *
 * Une comète glisse le long d'un tracé, à vitesse constante, sans départ ni arrivée. Le décalage du
 * trait est animé sur le thread UI (`animatedProps`, R3), et la boucle ne tourne que si `active` :
 * pendant une sortie d'une heure, une trace oubliée sous un écran empilé se paierait en batterie (R4).
 */

import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const TRACE = 'M-16 262C34 214 58 300 106 258S176 128 226 176s58 152 116 108 74-146 130-118';
/**
 * Motif du trait en unités réelles : une comète de 90, puis un vide plus long que le tracé (~800). Une
 * période complète fait défiler une comète d'un bout à l'autre. (`pathLength` normaliserait la longueur,
 * mais `react-native-svg` ne le prend pas en charge.)
 */
const COMET = 90;
const PERIOD = 990;
const LOOP_MS = 3200;

type Props = { active: boolean; color: string; width: number; height: number };

export function FlowTrace({ active, color, width, height }: Props) {
  const offset = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(offset);
      offset.value = 0;
      return;
    }
    offset.value = withRepeat(withTiming(-PERIOD, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(offset);
  }, [active, offset]);

  const cometProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <Svg width={width} height={height} viewBox="0 0 390 360" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
      <Path d={TRACE} fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" opacity={0.14} />
      <AnimatedPath
        d={TRACE}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={`${COMET} ${PERIOD - COMET}`}
        animatedProps={cometProps}
        opacity={active ? 0.95 : 0}
      />
    </Svg>
  );
}

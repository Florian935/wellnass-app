/**
 * US DASH-01 — la matière de la musculation : la silhouette, et les muscles de la séance qui encaissent
 * un impact (physique « impact »).
 *
 * ── Le correctif D6 ───────────────────────────────────────────────────────────────────────────────
 * La maquette faisait clignoter les muscles **deux fois, en boucle** (0,22 → 0,92 → 0,5 → 0,8 en 450 ms,
 * toutes les 2,6 s) : relu sur device, ça ressemblait à un néon qui grésille, donc à un bug. L'impact
 * joue désormais **une seule fois**, à l'arrivée sur l'écran (`play` passe à vrai), puis se pose. Montée
 * courte, retour amorti sans rebond visible : le geste est fini quand l'œil arrive.
 */

import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { SPRING } from '@/theme/motion';

const AnimatedG = Animated.createAnimatedComponent(G);

export type SilhouetteZone = 'chest' | 'shoulders' | 'arms' | 'back' | 'legs' | 'core';

const REST_OPACITY = 0.38;
const PEAK_OPACITY = 0.9;

type Props = { zones: readonly SilhouetteZone[]; play: boolean; color: string };

export function ImpactSilhouette({ zones, play, color }: Props) {
  const reduced = useAppReducedMotion();
  const glow = useSharedValue(REST_OPACITY);

  useEffect(() => {
    if (!play || reduced) {
      glow.value = REST_OPACITY;
      return;
    }
    glow.value = withSequence(withTiming(PEAK_OPACITY, { duration: 140 }), withSpring(REST_OPACITY, SPRING.settle));
  }, [glow, play, reduced]);

  const glowProps = useAnimatedProps(() => ({ opacity: glow.value }));
  const has = (z: SilhouetteZone) => zones.includes(z);

  return (
    <Svg width={176} height={280} viewBox="0 0 120 190" style={styles.silhouette}>
      <G fill="#ffffff" opacity={0.1}>
        <Circle cx={60} cy={17} r={12} />
        <Path d="M54 30h12l18 8 6 20-5 4-6-18-2 40H35l-2-40-6 18-5-4 6-20z" />
        <Path d="M27 46l-6 40 4 26 7-1-2-26 6-32z" />
        <Path d="M93 46l6 40-4 26-7-1 2-26-6-32z" />
        <Path d="M39 88h16l-2 50 2 44h-11l-4-44z" />
        <Path d="M81 88H65l2 50-2 44h11l4-44z" />
      </G>
      <AnimatedG fill={color} animatedProps={glowProps}>
        {has('shoulders') ? (
          <>
            <Ellipse cx={34} cy={48} rx={9} ry={8} />
            <Ellipse cx={86} cy={48} rx={9} ry={8} />
          </>
        ) : null}
        {has('chest') || has('back') ? (
          <>
            <Path d="M38 52c8-3 14-3 20 0l-1 16c-6 3-12 3-18 0z" />
            <Path d="M82 52c-8-3-14-3-20 0l1 16c6 3 12 3 18 0z" />
          </>
        ) : null}
        {has('arms') ? (
          <>
            <Path d="M27 58l-4 24 7 2 4-24z" />
            <Path d="M93 58l4 24-7 2-4-24z" />
          </>
        ) : null}
        {has('core') ? <Path d="M48 72h24l-2 16H50z" /> : null}
        {has('legs') ? (
          <>
            <Path d="M41 92h13l-2 40h-9z" />
            <Path d="M79 92H66l2 40h9z" />
          </>
        ) : null}
      </AnimatedG>
    </Svg>
  );
}

const styles = StyleSheet.create({
  silhouette: { position: 'absolute', right: -22, top: 22, opacity: 0.6 },
});

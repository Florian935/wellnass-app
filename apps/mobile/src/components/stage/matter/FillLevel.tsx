/**
 * US DASH-01 — la matière de la nutrition : le niveau qui monte (physique « remplissage »).
 *
 * La journée **est** le niveau : la scène se remplit à hauteur de ce qui a été mangé. Deux règles non
 * négociables de MOTION-01 :
 *  - **décélération pure, dépassement zéro** (`EASING.fill`, jamais de ressort) — une jauge de calories
 *    qui dépasse puis revient affiche, une fraction de seconde, un chiffre faux ;
 *  - **plafond au filet de cible** : au-delà de la cible, le niveau s'arrête. Le texte dit l'excédent.
 *
 * La vague de surface boucle seulement si `active` (focus + app active + mouvement permis, R4).
 */

import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { DURATION, EASING } from '@/theme/motion';

/** Hauteur du niveau en % de la scène : `ratio` de la cible, sur la portion `gaugeSpan` de la scène. */
export function levelHeightPct(ratio: number, gaugeSpan: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return Math.min(ratio, 1) * gaugeSpan * 100;
}

const WAVE_WIDTH = 560;
const WAVE_PERIOD = 160;
const WAVE_PATH = Array.from({ length: Math.ceil(WAVE_WIDTH / (WAVE_PERIOD / 2)) }, (_, i) =>
  i === 0 ? 'M0 7' : `q${WAVE_PERIOD / 4} ${i % 2 === 1 ? -7 : 7} ${WAVE_PERIOD / 2} 0`,
).join(' ');

type Props = {
  ratio: number;
  /** Portion de la scène couverte par la jauge (le reste, en haut, porte le filet de cible). */
  gaugeSpan: number;
  active: boolean;
  fill: readonly [string, string];
  wave: string;
};

export function FillLevel({ ratio, gaugeSpan, active, fill, wave }: Props) {
  const reduced = useAppReducedMotion();
  const target = levelHeightPct(ratio, gaugeSpan);
  const height = useSharedValue(target);
  const waveX = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      height.value = target;
      return;
    }
    height.value = withTiming(target, { duration: DURATION.celebrate, easing: EASING.fill });
  }, [height, reduced, target]);

  useEffect(() => {
    if (!active) {
      cancelAnimation(waveX);
      waveX.value = 0;
      return;
    }
    waveX.value = withRepeat(withTiming(-WAVE_PERIOD, { duration: 7000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(waveX);
  }, [active, waveX]);

  const levelStyle = useAnimatedStyle(() => ({ height: `${height.value}%` }));
  const waveStyle = useAnimatedStyle(() => ({ transform: [{ translateX: waveX.value }] }));

  return (
    <Animated.View testID="fill-level" pointerEvents="none" style={[styles.level, levelStyle]}>
      <LinearGradient colors={fill} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.wave, waveStyle]}>
        <Svg width={WAVE_WIDTH} height={14} viewBox={`0 0 ${WAVE_WIDTH} 14`}>
          <Path d={WAVE_PATH} fill="none" stroke={wave} strokeWidth={2} opacity={0.85} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  level: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  wave: { position: 'absolute', top: -7, left: 0 },
});

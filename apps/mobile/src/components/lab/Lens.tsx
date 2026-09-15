/**
 * US LABO-01 — la lentille : deux cercles qui se chevauchent, aux couleurs des deux piliers en jeu.
 *
 * C'est l'icône de **tout** croisement dans le Labo (proposition, suspect, acquis) — la même
 * grammaire que les médailles de la scène 3D, en plus petit et en plat.
 */

import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { LabPair, LabPillar } from '@wellness/shared';

import { useTheme } from '@/theme/useTheme';

type Props = { pair: LabPair; size?: number };

export function Lens({ pair, size = 26 }: Props) {
  const { colors } = useTheme();
  const color: Record<LabPillar, string> = {
    strength: colors.pillarStrength,
    running: colors.pillarRunning,
    nutrition: colors.pillarNutrition,
    sleep: colors.pillarLab,
  };

  return (
    <View style={[styles.wrap, { width: size, height: size * 0.85 }]} accessibilityElementsHidden>
      <Svg viewBox="0 0 26 22" width="100%" height="100%">
        <Circle cx={9} cy={11} r={7.5} fill={color[pair[0]]} fillOpacity={0.2} stroke={color[pair[0]]} strokeWidth={1.6} />
        <Circle cx={17} cy={11} r={7.5} fill={color[pair[1]]} fillOpacity={0.2} stroke={color[pair[1]]} strokeWidth={1.6} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { marginTop: 1 } });

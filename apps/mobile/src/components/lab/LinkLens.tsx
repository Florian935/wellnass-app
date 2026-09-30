/**
 * US LABO-02 — la lentille d'un lien : deux ou trois cercles qui se chevauchent, aux couleurs de ce
 * que le lien croise (piliers, nuits, poids, cycle). Même grammaire que les disques de la scène : le
 * chevauchement, c'est le croisement. En pointillé pour un lien encore « à découvrir ».
 */

import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { CrossLinkLens } from '@wellness/shared';

import { useTheme } from '@/theme/useTheme';

type Props = { lens: readonly CrossLinkLens[]; size?: number; dashed?: boolean; onDark?: boolean };

export function LinkLens({ lens, size = 30, dashed = false, onDark = false }: Props) {
  const { colors } = useTheme();
  // Sur la scène sombre, les variantes lumineuses des piliers (celles de la 3D).
  const color: Record<CrossLinkLens, string> = onDark
    ? { strength: '#ff6b5e', running: '#6fa8ef', nutrition: '#9ed16a', sleep: '#e0b155', weight: '#d9c3a0', cycle: '#f09ac0' }
    : {
        strength: colors.pillarStrength,
        running: colors.pillarRunning,
        nutrition: colors.pillarNutrition,
        sleep: colors.pillarLab,
        weight: colors.textMuted,
        cycle: colors.danger,
      };
  const shown = lens.slice(0, 3);
  const pos = shown.length <= 2 ? [[11, 12, 8], [21, 12, 8]] : [[11, 9, 7], [21, 9, 7], [16, 17, 7]];

  return (
    <View style={{ width: size, height: size * 0.75 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg viewBox="0 0 32 24" width="100%" height="100%">
        {shown.map((l, i) => (
          <Circle
            key={`${l}-${i}`}
            cx={pos[i]![0]}
            cy={pos[i]![1]}
            r={pos[i]![2]}
            fill={dashed ? 'none' : color[l]}
            fillOpacity={dashed ? 0 : 0.8}
            stroke={color[l]}
            strokeWidth={dashed ? 1.4 : 0}
            strokeDasharray={dashed ? '2.5 2' : undefined}
          />
        ))}
      </Svg>
    </View>
  );
}

/**
 * US DASH-01 — la matière de l'accueil : un anneau par pilier actif, qui respire (physique « souffle »).
 *
 * Chaque anneau porte la progression de la semaine de son pilier. La respiration est lente et de faible
 * amplitude (≤ 6 %) : on remarquerait son absence, pas sa présence. Elle ne porte aucune information —
 * les anneaux fixes disent la même chose (R1).
 */

import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Breathe } from '@/components/motion/Breathe';
import { useTheme } from '@/theme/useTheme';

export type Ring = { key: string; progress: number; color: string; label: string };

const STROKE = 9;
const GAP = 6;

/** Décalage du trait pour qu'un arc couvre `progress` du cercle (progression bornée à [0, 1]). */
export function ringDashOffset(progress: number, radius: number): number {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  return 2 * Math.PI * radius * (1 - p);
}

type Props = {
  rings: readonly Ring[];
  size?: number;
  active: boolean;
};

export function BreathRings({ rings, size = 126, active }: Props) {
  const { scheme } = useTheme();
  const track = scheme === 'dark' ? 'rgba(244,236,221,0.10)' : 'rgba(51,41,31,0.10)';
  const center = size / 2;
  const outer = center - STROKE / 2 - 1;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={rings.map((r) => r.label).join(', ')}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {rings.map((ring, i) => (
          <Circle
            key={`track-${ring.key}`}
            cx={center}
            cy={center}
            r={outer - i * (STROKE + GAP)}
            stroke={track}
            strokeWidth={STROKE}
            fill="none"
          />
        ))}
      </Svg>
      <Breathe active={active} scaleTo={1.035} duration={4800} style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${center}, ${center}`}>
            {rings.map((ring, i) => {
              const r = outer - i * (STROKE + GAP);
              return (
                <Circle
                  key={ring.key}
                  cx={center}
                  cy={center}
                  r={r}
                  stroke={ring.color}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * r}`}
                  strokeDashoffset={ringDashOffset(ring.progress, r)}
                  fill="none"
                />
              );
            })}
          </G>
        </Svg>
      </Breathe>
    </View>
  );
}

import { useEffect, useId, type ReactNode } from 'react';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { FINE_MUSCLE_VIEWS, type FineMuscle } from '@wellness/shared';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { DURATION } from '@/theme/motion';
import { useTheme } from '@/theme/useTheme';
import {
  ANATOMY_ASPECT_RATIO, ANATOMY_HEAD, ANATOMY_OUTLINE, ANATOMY_REGIONS,
  ANATOMY_TRANSLATE_X, ANATOMY_VIEW_BOX,
} from './anatomy-geometry';

export type AnatomyFigureProps = {
  side: 'front' | 'back';
  height?: number;
  full?: FineMuscle[];
  reduced?: FineMuscle[];
  selected?: FineMuscle | null;
  onSelect?: (muscle: FineMuscle) => void;
  muscleColors?: Partial<Record<FineMuscle, string>>;
  muscleHaloColors?: Partial<Record<FineMuscle, string>>;
  pulse?: FineMuscle | null;
  palette?: { neutral: string; edge?: string; accent: string };
  children?: ReactNode;
  testID?: string;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

function MuscleHalo({
  d,
  color,
  pulsing,
  testID,
}: {
  d: string;
  color: string;
  pulsing: boolean;
  testID?: string;
}) {
  const reduced = useAppReducedMotion();
  const opacity = useSharedValue(0.34);

  useEffect(() => {
    if (!pulsing || reduced) return;
    opacity.value = withSequence(
      withTiming(0.85, { duration: DURATION.quick }),
      withTiming(0.34, { duration: DURATION.celebrate }),
    );
  }, [opacity, pulsing, reduced]);

  const animatedProps = useAnimatedProps(() => ({ strokeOpacity: opacity.value }));

  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={4}
      animatedProps={animatedProps}
      strokeOpacity={0.34}
      pointerEvents="none"
      testID={testID}
    />
  );
}

/** SVG embarqué, sans navigation ni lecture des exercices. La liste nommée de l'écran
 * fournit les contrôles accessibles ; les formes sont une alternative tactile visuelle. */
export function AnatomyFigure({
  side, height = 328, full = [], reduced = [], selected, onSelect,
  muscleColors = {}, muscleHaloColors = {}, pulse = null, palette, children, testID,
}: AnatomyFigureProps) {
  const { colors, scheme } = useTheme();
  const uid = `anatomy${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const dark = scheme === 'dark';
  const neutral = palette?.neutral ?? (dark ? '#b6a793' : '#e5dccd');
  const edge = palette?.edge ?? palette?.neutral ?? (dark ? '#776958' : '#b9aa96');
  const accent = palette?.accent ?? colors.accent;
  const hasContext = full.length + reduced.length > 0;
  const fill = (name: string) => `url(#${uid}-${name})`;

  return (
    <Svg width={height * ANATOMY_ASPECT_RATIO} height={height} viewBox={ANATOMY_VIEW_BOX}
      testID={testID} accessible={false}>
      <Defs>
        <RadialGradient id={`${uid}-neutral`} cx="35%" cy="27%" rx="78%" ry="80%">
          <Stop offset="0" stopColor={dark ? '#e3d9c9' : '#fffaf0'} />
          <Stop offset="0.55" stopColor={neutral} />
          <Stop offset="1" stopColor={edge} />
        </RadialGradient>
        <LinearGradient id={`${uid}-full`} x1="0%" y1="0%" x2="100%" y2="85%">
          <Stop offset="0" stopColor={dark ? '#efb299' : '#d69a7e'} />
          <Stop offset="0.5" stopColor={accent} />
          <Stop offset="1" stopColor={dark ? '#9d472a' : '#80391f'} />
        </LinearGradient>
        <LinearGradient id={`${uid}-reduced`} x1="0%" y1="0%" x2="100%" y2="85%">
          <Stop offset="0" stopColor={neutral} />
          <Stop offset="0.65" stopColor={dark ? '#c99a82' : '#d5ae98'} />
          <Stop offset="1" stopColor={dark ? '#a36f53' : '#b8886d'} />
        </LinearGradient>
        <LinearGradient id={`${uid}-volume`} x1="0%" y1="0%" x2="100%" y2="80%">
          <Stop offset="0" stopColor="#fffaf0" stopOpacity={0.3} />
          <Stop offset="0.48" stopColor="#fffaf0" stopOpacity={0} />
          <Stop offset="1" stopColor="#382a1c" stopOpacity={0.2} />
        </LinearGradient>
      </Defs>
      <G transform={`translate(${ANATOMY_TRANSLATE_X[side]} 0)`}>
        <Path d={ANATOMY_OUTLINE[side]} fill={neutral} stroke={edge} strokeWidth={1.2} />
        {ANATOMY_REGIONS[side].map((region) => {
          const muscle = region.muscle && FINE_MUSCLE_VIEWS[region.muscle].includes(side)
            ? region.muscle : undefined;
          const active = muscle !== undefined && selected === muscle;
          const custom = muscle ? muscleColors[muscle] : undefined;
          const halo = muscle ? muscleHaloColors[muscle] : undefined;
          // En contexte, le contour sélectionne sans modifier le niveau d'activité affiché.
          const level = (active && !hasContext) || (muscle && full.includes(muscle)) ? 'full'
            : muscle && reduced.includes(muscle) ? 'reduced' : 'neutral';
          const color = custom ?? (palette ? (level === 'neutral' ? neutral : accent) : fill(level));
          return region.paths.map((d, i) => (
            <G key={`${region.slug}-${i}`}>
              <Path d={d} fill={color} stroke={active ? colors.text : edge}
                strokeWidth={active ? 4.5 : 0.7} strokeLinejoin="round"
                opacity={palette && level === 'reduced' ? 0.35 : 1}
                testID={muscle ? `muscle-${muscle}` : undefined}
                onPress={muscle && onSelect ? () => onSelect(muscle) : undefined} />
              {custom && <Path d={d} fill={fill('volume')} pointerEvents="none" />}
              {muscle && halo ? (
                <MuscleHalo
                  d={d}
                  color={halo}
                  pulsing={pulse === muscle}
                  testID={pulse === muscle ? `muscle-${muscle}-pulse` : undefined}
                />
              ) : null}
            </G>
          ));
        })}
      </G>
      <Path d={ANATOMY_HEAD} fill={palette ? neutral : fill('neutral')} stroke={edge} strokeWidth={1} pointerEvents="none" />
      {children}
    </Svg>
  );
}

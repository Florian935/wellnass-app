import { useId, type ReactNode } from 'react';
import Svg, { Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { FINE_MUSCLE_VIEWS, type FineMuscle } from '@wellness/shared';
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
  children?: ReactNode;
  testID?: string;
};

/** SVG embarqué, sans navigation ni lecture des exercices. La liste nommée de l'écran
 * fournit les contrôles accessibles ; les formes sont une alternative tactile visuelle. */
export function AnatomyFigure({
  side, height = 328, full = [], reduced = [], selected, onSelect,
  muscleColors = {}, children, testID,
}: AnatomyFigureProps) {
  const { colors, scheme } = useTheme();
  const uid = `anatomy${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const dark = scheme === 'dark';
  const neutral = dark ? '#b6a793' : '#e5dccd';
  const edge = dark ? '#776958' : '#b9aa96';
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
          <Stop offset="0.5" stopColor={colors.accent} />
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
          // En contexte, le contour sélectionne sans modifier le niveau d'activité affiché.
          const color = custom ?? fill((active && !hasContext) || (muscle && full.includes(muscle)) ? 'full'
            : muscle && reduced.includes(muscle) ? 'reduced' : 'neutral');
          return region.paths.map((d, i) => (
            <G key={`${region.slug}-${i}`}>
              <Path d={d} fill={color} stroke={active ? colors.text : edge}
                strokeWidth={active ? 4.5 : 0.7} strokeLinejoin="round"
                testID={muscle ? `muscle-${muscle}` : undefined}
                onPress={muscle && onSelect ? () => onSelect(muscle) : undefined} />
              {custom && <Path d={d} fill={fill('volume')} pointerEvents="none" />}
            </G>
          ));
        })}
      </G>
      <Path d={ANATOMY_HEAD} fill={fill('neutral')} stroke={edge} strokeWidth={1} pointerEvents="none" />
      {children}
    </Svg>
  );
}

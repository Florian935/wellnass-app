import { useId } from 'react';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import type { BodyEmphasis, BodyShape, BodyVisualZone } from '@wellness/shared';
import { useTheme } from '@/theme/useTheme';
import { BODY_SHAPE_ASPECT_RATIO, BODY_SHAPE_VIEW_BOX, createBodyShapeGeometry } from './body-shape-geometry';

export type BodyShapeFigureProps = {
  shape: BodyShape;
  emphasis?: BodyEmphasis;
  side: 'front' | 'back';
  height?: number;
  selected?: BodyVisualZone | null;
  mode?: 'baseline' | 'goal';
  onSelect?: (zone: BodyVisualZone) => void;
  outlineOnly?: boolean;
};

/** Mannequin graphique original ; aucune mesure, donnée ni inférence corporelle.
 * Les contrôles nommés de l'éditeur fournissent l'alternative accessible aux zones. */
export function BodyShapeFigure({ shape, emphasis, side, height = 400, selected, mode = 'baseline', onSelect, outlineOnly = false }: BodyShapeFigureProps) {
  const { scheme, colors } = useTheme();
  const dark = scheme === 'dark';
  const uid = `shape${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const geo = createBodyShapeGeometry(shape, emphasis, side);
  const fill = (id: string) => `url(#${uid}-${id})`;
  const activeZones = mode === 'goal'
    ? ['shoulders', 'chest', 'back', 'arms', 'glutes', 'thighs', 'calves']
    : ['shoulders', 'chest', 'waist', 'hips', 'arms', 'thighs', 'calves'];
  const edge = dark ? '#92816b' : '#b9a992';

  return (
    <Svg width={height * BODY_SHAPE_ASPECT_RATIO} height={height} viewBox={BODY_SHAPE_VIEW_BOX}
      accessible={false} testID="body-shape-figure" pointerEvents={outlineOnly ? 'none' : 'auto'}>
      <Defs>
        <ClipPath id={`${uid}-clip`}><Path d={geo.outline} /></ClipPath>
        <LinearGradient id={`${uid}-skin`} x1="0%" y1="0%" x2="100%" y2="12%">
          <Stop offset="0" stopColor={dark ? '#9b8970' : '#c0af96'} />
          <Stop offset="0.3" stopColor={dark ? '#d6c8b2' : '#eee3d1'} />
          <Stop offset="0.48" stopColor={dark ? '#eee3d0' : '#fff7e8'} />
          <Stop offset="0.7" stopColor={dark ? '#c7b79e' : '#e5d6be'} />
          <Stop offset="1" stopColor={dark ? '#8f7d64' : '#b19b7e'} />
        </LinearGradient>
        <RadialGradient id={`${uid}-volume`} cx="40%" cy="42%" rx="60%" ry="65%">
          <Stop offset="0" stopColor="#fffaf0" stopOpacity={0.38} />
          <Stop offset="0.45" stopColor="#fffaf0" stopOpacity={0.15} />
          <Stop offset="1" stopColor="#fffaf0" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${uid}-selected`} cx="40%" cy="35%" rx="80%" ry="80%">
          <Stop offset="0" stopColor={dark ? '#e6b293' : '#eec1a0'} stopOpacity={0.75} />
          <Stop offset="1" stopColor={colors.accent} stopOpacity={0.6} />
        </RadialGradient>
      </Defs>
      <Path testID="shape-outline" d={geo.outline} fill={outlineOnly ? 'none' : fill('skin')}
        stroke={outlineOnly ? colors.accent : edge} strokeWidth={outlineOnly ? 1.8 : 0.9}
        strokeDasharray={outlineOnly ? '5 4' : undefined} strokeLinejoin="round" pointerEvents="none" />
      {!outlineOnly && <G clipPath={fill('clip')}>
        {[1, -1].map(direction => <G key={direction} transform={`translate(150 0) scale(${direction} 1)`}>
          {geo.regions.filter(region => region.zone !== 'hips' && (side === 'back' || (region.zone !== 'back' && region.zone !== 'glutes'))).map(region => (
            <Path key={`volume-${region.zone}`} d={region.d} fill={fill('volume')} pointerEvents="none" />
          ))}
          {geo.details.map((d, i) => <Path key={`detail-${i}`} d={d} fill="none" stroke={dark ? '#79654d' : '#a99071'}
            strokeOpacity={0.3} strokeWidth={1.05} strokeLinecap="round" pointerEvents="none" />)}
          {geo.regions.filter(region => activeZones.includes(region.zone)).map(region => (
            <Path key={region.zone} testID={`shape-zone-${region.zone}`} d={region.d}
              fill={selected === region.zone ? fill('selected') : 'transparent'}
              stroke={selected === region.zone ? colors.accent : 'none'} strokeOpacity={0.65} strokeWidth={1.1}
              onPress={onSelect ? () => onSelect(region.zone) : undefined} />
          ))}
        </G>)}
      </G>}
    </Svg>
  );
}

/**
 * US LABO-01 — les mêmes disques, en 2D, quand la 3D ne démarre pas (R10).
 *
 * Reprend le dessin du prototype (fonte, piste, assiette, anneau des nuits, médailles) en
 * `react-native-svg` : même grammaire — la taille dit la dose, le chevauchement dit le croisement,
 * la médaille dit le type de croisement. Rendu **statique** : pas de mouvement, c'est un repli.
 */

import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import type { LabSceneState, SceneCrossing, ScenePillar } from './scene-state';

const PILLAR_COLOR: Record<ScenePillar, string> = {
  muscu: '#e07a98',
  course: '#6fa8ef',
  nutrition: '#9ed16a', // = pillarNutrition (sombre), US NUTRI-UX02
  socle: '#e0b155',
};

const TONE: Record<SceneCrossing['kind'], { fill: string; ink: string }> = {
  syn: { fill: '#f2d28a', ink: '#6b4a12' },
  tension: { fill: '#d99a45', ink: '#3a2708' },
  guard: { fill: '#f08a7e', ink: '#5a1a10' },
};

/** Où se pose la médaille d'un croisement — comme en 3D, à la rencontre des deux disques. */
const ZONES: Record<string, [number, number]> = {
  'course|muscu': [175, 86],
  'muscu|nutrition': [146, 180],
  'course|nutrition': [204, 180],
  'muscu|socle': [58, 96],
  'course|socle': [292, 96],
  'nutrition|socle': [250, 262],
};

function zoneKey(pair: SceneCrossing['pair']): string {
  return [...pair].sort().join('|');
}

type Props = { state: LabSceneState };

export function LabScene2D({ state }: Props) {
  const { values, reality, pillars } = state;
  const sessions = reality?.sessions ?? values.fq;
  const done = reality?.sessionsDone ?? sessions;
  const km = reality ? reality.kmDone : values.km;
  const nights = reality?.nights ?? [];
  const lit = nights.filter((n) => n === 1).length;

  const medals = state.crossings
    .map((crossing) => ({ crossing, at: ZONES[zoneKey(crossing.pair)] }))
    .filter((m): m is { crossing: SceneCrossing; at: [number, number] } => m.at !== undefined);

  return (
    <View style={styles.wrap}>
      <Svg viewBox="0 0 350 300" width="100%" height="100%" accessibilityElementsHidden>
        <Defs>
          <RadialGradient id="rub" cx="0.36" cy="0.3" r="0.8">
            <Stop offset="0" stopColor="#f7a9c2" />
            <Stop offset="0.45" stopColor="#c9557d" />
            <Stop offset="1" stopColor="#5a0022" />
          </RadialGradient>
          <RadialGradient id="trk" cx="0.4" cy="0.35" r="0.8">
            <Stop offset="0" stopColor="#5a97e0" />
            <Stop offset="0.6" stopColor="#2a64ad" />
            <Stop offset="1" stopColor="#173a70" />
          </RadialGradient>
          <RadialGradient id="cer" cx="0.38" cy="0.32" r="0.85">
            <Stop offset="0" stopColor="#fffdf8" />
            <Stop offset="0.7" stopColor="#efe6d6" />
            <Stop offset="1" stopColor="#d6c8b0" />
          </RadialGradient>
        </Defs>

        {/* L'anneau des nuits */}
        <Path d="M28,126 A152,152 0 0,1 322,126" fill="none" stroke={PILLAR_COLOR.socle} strokeWidth={1.1} strokeDasharray="1.5 6" opacity={0.55} />
        {(nights.length > 0 ? nights : [null, null, null, null, null, null, null]).map((night, i) => {
          const angle = ((-150 + i * 20) * Math.PI) / 180;
          const x = 175 + 152 * Math.cos(angle);
          const y = 165 + 152 * Math.sin(angle);
          if (night === null) return <Circle key={i} cx={x} cy={y} r={4.5} fill="none" stroke={PILLAR_COLOR.socle} strokeWidth={1.2} opacity={0.5} />;
          return (
            <G key={i}>
              <Circle cx={x} cy={y} r={5} fill={night === 1 ? PILLAR_COLOR.socle : '#a8563a'} />
              <Circle cx={x + 2} cy={y - 1.5} r={4} fill="#1c150e" opacity={0.9} />
            </G>
          );
        })}
        <SvgText x={175} y={40} fill={PILLAR_COLOR.socle} fontSize={9} fontWeight="700" textAnchor="middle">
          {`${lit}/7`}
        </SvgText>

        {/* L'assiette */}
        {pillars.nutrition ? (
          <G>
            <Circle cx={175} cy={212} r={62} fill="url(#cer)" />
            <Circle cx={175} cy={212} r={51} fill="#efe4d1" />
            <Path d="M175,212 L175,165 A47,47 0 0,1 216,235 Z" fill="#e9825c" />
            <Path d="M175,212 L216,235 A47,47 0 0,1 134,235 Z" fill="#f4ebda" />
            <Path d="M175,212 L134,235 A47,47 0 0,1 175,165 Z" fill="#4f6b2f" />
          </G>
        ) : null}

        {/* La piste */}
        {pillars.course ? (
          <G>
            <Circle cx={228} cy={120} r={62} fill="url(#trk)" />
            {[57, 52, 47, 42, 37].map((r) => (
              <Circle key={r} cx={228} cy={120} r={r} fill="none" stroke="rgba(255,255,255,.6)" strokeWidth={0.8} />
            ))}
            <Circle cx={228} cy={120} r={33} fill="#4a6c2e" stroke="rgba(255,255,255,.7)" strokeWidth={1} />
            <SvgText x={228} y={126} fill="#ffffff" fontSize={18} fontWeight="800" textAnchor="middle">
              {String(Math.round(km))}
            </SvgText>
          </G>
        ) : null}

        {/* La pile de disques */}
        {pillars.muscu ? (
          <G>
            <Circle cx={122} cy={120} r={62} fill="url(#rub)" />
            <Circle cx={122} cy={120} r={49} fill="none" stroke="rgba(0,0,0,.28)" strokeWidth={1.2} />
            <SvgText x={122} y={112} fill="#ffffff" fontSize={20} fontWeight="800" textAnchor="middle">
              {`${done}/${sessions}`}
            </SvgText>
            <Circle cx={122} cy={132} r={16} fill="#d9d2c7" />
            <Circle cx={122} cy={132} r={7} fill="#1c150e" />
          </G>
        ) : null}

        {/* Les croisements */}
        {medals.map(({ crossing, at }, i) => (
          <G key={i}>
            <Circle cx={at[0]} cy={at[1]} r={11} fill={TONE[crossing.kind].fill} stroke="rgba(0,0,0,.35)" strokeWidth={1} />
            <Circle cx={at[0]} cy={at[1]} r={8} fill="none" stroke={TONE[crossing.kind].ink} strokeOpacity={0.45} strokeWidth={1} />
          </G>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' } });

/**
 * US LABO-01 — les mêmes disques, en 2D, quand la 3D ne démarre pas (R10).
 *
 * Reprend le dessin du prototype (fonte, piste, assiette, anneau des nuits, médailles) en
 * `react-native-svg` : même grammaire — la taille dit la dose, le chevauchement dit le croisement,
 * la médaille dit le type de croisement. Rendu **statique** : pas de mouvement, c'est un repli.
 *
 * US LABO-02 — en vue du dessus (onglet Croiser), une médaille **par zone** à l'état de son lien, et
 * chaque médaille se touche (`onPickZone`) : c'est le même geste qu'en 3D, repli compris (décision
 * Q6). Une zone « à découvrir » est un cercle en pointillé : rien n'y est encore établi.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import type { LabSceneState, SceneCrossing, ScenePillar, SceneZone } from './scene-state';

const PILLAR_COLOR: Record<ScenePillar, string> = {
  muscu: '#ff6b5e', // = pillarStrength (sombre), US MUSCU-UX06 — le rose #e07a98 avant
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

/** US LABO-02 — où se pose la médaille d'une zone, dans le repère du dessin (350 × 300). */
export function zoneAt(zone: SceneZone, pillars: LabSceneState['pillars']): [number, number] {
  if (zone === 'mc') return [175, 86];
  if (zone === 'mn') return [146, 180];
  if (zone === 'cn') return [204, 180];
  return pillars.muscu && pillars.course && pillars.nutrition ? [175, 150] : [175, 268];
}

const VIEW_W = 350;
const VIEW_H = 300;
const HIT = 44;

type Props = { state: LabSceneState; onPickZone?: (zone: SceneZone | null) => void };

export function LabScene2D({ state, onPickZone }: Props) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const { values, reality, pillars } = state;
  const sessions = reality?.sessions ?? values.fq;
  const done = reality?.sessionsDone ?? sessions;
  const km = reality ? reality.kmDone : values.km;
  const nights = reality?.nights ?? [];
  const lit = nights.filter((n) => n === 1).length;

  const top = state.view === 'top';
  const zoneMedals = top ? state.zones.map((z) => ({ ...z, at: zoneAt(z.zone, pillars) })) : [];
  // Le dessin est centré et mis à l'échelle (`meet`) : on refait le même calcul pour poser les
  // zones touchables exactement sur les médailles.
  const k = box === null ? 0 : Math.min(box.w / VIEW_W, box.h / VIEW_H);
  const ox = box === null ? 0 : (box.w - VIEW_W * k) / 2;
  const oy = box === null ? 0 : (box.h - VIEW_H * k) / 2;

  const medals = state.crossings
    .map((crossing) => ({ crossing, at: ZONES[zoneKey(crossing.pair)] }))
    .filter((m): m is { crossing: SceneCrossing; at: [number, number] } => m.at !== undefined);

  return (
    // `box-none` : le dessin laisse passer le toucher vers le fond (qui dit « revenir à l'ensemble »),
    // seules les médailles le prennent.
    <View style={styles.wrap} pointerEvents="box-none" onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {/* Le dessin ne prend aucun toucher (revue du 30/09/2026) : toucher le vide doit remonter au fond
          de la scène (`LabStage`), qui efface la zone choisie. Seules les médailles, par-dessus, se touchent. */}
      <Svg viewBox="0 0 350 300" width="100%" height="100%" accessibilityElementsHidden pointerEvents="none">
        <Defs>
          <RadialGradient id="rub" cx="0.36" cy="0.3" r="0.8">
            {/* Rouge fonte (US MUSCU-UX06) : le rose de l'ancien bordeaux restait ici, écart relevé par LABO-02. */}
            <Stop offset="0" stopColor="#d9544a" />
            <Stop offset="0.45" stopColor="#a8261d" />
            <Stop offset="1" stopColor="#4a0c09" />
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

        {/* LABO-02 — les zones de la vue du dessus */}
        {zoneMedals.map((m) => {
          const selected = state.zoneSelected === m.zone;
          const dim = state.zoneSelected !== null && !selected;
          if (m.kind === 'discover') {
            return (
              <Circle key={m.zone} cx={m.at[0]} cy={m.at[1]} r={11} fill="none" stroke={selected ? '#ffffff' : '#e6d8c4'} strokeWidth={selected ? 2.2 : 1.4} strokeDasharray="3 3" opacity={dim ? 0.5 : 1} />
            );
          }
          return (
            <G key={m.zone} opacity={dim ? 0.55 : 1}>
              <Circle cx={m.at[0]} cy={m.at[1]} r={selected ? 14 : 11.5} fill={TONE[m.kind].fill} stroke={selected ? '#ffffff' : 'rgba(0,0,0,.35)'} strokeWidth={selected ? 2.5 : 1} />
              <Circle cx={m.at[0]} cy={m.at[1]} r={selected ? 9.5 : 8} fill="none" stroke={TONE[m.kind].ink} strokeOpacity={0.45} strokeWidth={1} />
            </G>
          );
        })}

        {/* Les croisements */}
        {medals.map(({ crossing, at }, i) => (
          <G key={i}>
            <Circle cx={at[0]} cy={at[1]} r={11} fill={TONE[crossing.kind].fill} stroke="rgba(0,0,0,.35)" strokeWidth={1} />
            <Circle cx={at[0]} cy={at[1]} r={8} fill="none" stroke={TONE[crossing.kind].ink} strokeOpacity={0.45} strokeWidth={1} />
          </G>
        ))}
      </Svg>

      {box !== null && onPickZone
        ? zoneMedals.map((m) => (
            <Pressable
              key={m.zone}
              testID={`lab-zone-${m.zone}`}
              accessibilityRole="button"
              accessibilityLabel={m.label}
              accessibilityState={{ selected: state.zoneSelected === m.zone }}
              onPress={() => onPickZone(state.zoneSelected === m.zone ? null : m.zone)}
              style={[styles.hit, { left: ox + m.at[0] * k - HIT / 2, top: oy + m.at[1] * k - HIT / 2 }]}
            />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hit: { position: 'absolute', width: HIT, height: HIT, borderRadius: HIT / 2 },
});

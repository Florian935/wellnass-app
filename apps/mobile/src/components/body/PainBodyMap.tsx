/** Journal sensible : géométrie commune, couleurs et identifiants DOUL-01 conservés. */
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { PAIN_JOINT_ZONES, PAIN_MUSCLE_ZONES, type PainLevel, type PainZone } from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { AnatomyFigure } from './AnatomyFigure';
import { ANATOMY_JOINTS } from './anatomy-geometry';

type Props = {
  levels: Partial<Record<PainZone, PainLevel>>;
  onSelect: (zone: PainZone) => void;
  selected?: PainZone | null;
};

export const PainBodyMap = memo(function PainBodyMap({ levels, onSelect, selected }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const palette: Record<PainLevel, string> = {
    discomfort: colors.amber, pain: colors.accent, blocking: colors.danger,
  };
  const muscleColors = Object.fromEntries(PAIN_MUSCLE_ZONES.flatMap((muscle) => {
    const level = levels[muscle];
    // Une simple sélection ne doit jamais simuler un niveau de douleur déclaré.
    return level ? [[muscle, palette[level]]] : muscle === selected ? [[muscle, colors.surfaceAlt]] : [];
  }));
  const selectedMuscle = PAIN_MUSCLE_ZONES.find((muscle) => muscle === selected) ?? null;

  return (
    <View style={styles.row}>
      {(['front', 'back'] as const).map((side) => (
        <View key={side} style={styles.view}>
          <AnatomyFigure side={side} height={184} onSelect={onSelect}
            selected={selectedMuscle} muscleColors={muscleColors}>
            {PAIN_JOINT_ZONES.filter((zone) => ANATOMY_JOINTS[zone].sides.includes(side)).flatMap((zone) => {
              const dot = ANATOMY_JOINTS[zone];
              const level = levels[zone];
              const xs = dot.bilateral ? [dot.x, 724 - dot.x] : [dot.x];
              return xs.map((x) => (
                <Circle key={`${zone}-${x}`} testID={`joint-${zone}`} cx={x} cy={dot.y} r={32}
                  fill={level ? palette[level] : colors.surfaceAlt}
                  stroke={selected === zone ? colors.text : colors.textMuted}
                  strokeWidth={selected === zone ? 6 : 2}
                  onPress={() => onSelect(zone)}
                  accessibilityLabel={level ? `${t(`pain.zones.${zone}`)}, ${t(`pain.levels.${level}`)}` : t(`pain.zones.${zone}`)} />
              ));
            })}
          </AnatomyFigure>
          <Text style={[styles.caption, { color: colors.textMuted }]}>{t(`bodyMap.${side}`)}</Text>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  view: { alignItems: 'center', gap: 4 },
  caption: { fontFamily: fontFamily.body, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
});

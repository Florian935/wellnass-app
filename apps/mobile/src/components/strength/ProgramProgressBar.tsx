/**
 * US MUSCU-UX01 — l'avancement du programme, enfin visible.
 *
 * MUSC-F15 calcule l'adhérence à la semaine précédente depuis le 01/08/2026, mais son unique
 * appelant est `workout.tsx`, où elle sert à moduler la suggestion de charge. Nulle part — ni hub,
 * ni fiche programme, ni planning — on ne lisait « semaine 3 sur 8 ». Pour quelqu'un engagé dans
 * un cycle de deux mois, c'est pourtant le repère qui manque le plus : c'est lui qui transforme
 * une suite de séances en progression.
 *
 * Cette barre remplace au passage le widget `strength-programs` du hub, qui menait au même endroit
 * sans rien dire d'utile.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  programName: string;
  week: number;
  totalWeeks: number;
  done: number;
  total: number;
  ratio: number;
  onPress: () => void;
};

export function ProgramProgressBar({
  programName,
  week,
  totalWeeks,
  done,
  total,
  ratio,
  onPress,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const percent = Math.round(Math.min(Math.max(ratio, 0), 1) * 100);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('strengthHub.progress.a11y', {
        name: programName,
        week,
        totalWeeks,
        done,
        total,
      })}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.row}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {t('strengthHub.progress.week', { name: programName, week, totalWeeks })}
        </Text>
        <Text style={[styles.count, { color: colors.textMuted }]}>
          {t('strengthHub.progress.sessions', { done, total })}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.track }]}>
        <View
          style={[styles.fill, { width: `${percent}%`, backgroundColor: colors.accent }]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16, gap: 9 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  name: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 13.5 },
  count: { fontFamily: fontFamily.mono, fontSize: 12 },
  track: { height: 7, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4 },
  pressed: { opacity: 0.85 },
});

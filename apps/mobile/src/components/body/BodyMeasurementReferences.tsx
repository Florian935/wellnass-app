import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MEASUREMENT_KINDS } from '@wellness/shared';
import { useLatestMeasurements } from '@/data/repositories/body-measurement-repository';
import { useTheme } from '@/theme/useTheme';
import { fontFamily } from '@/theme/fonts';

export function BodyMeasurementReferences() {
  const { latest, isLoading, error } = useLatestMeasurements();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const hasMeasures = MEASUREMENT_KINDS.some((kind) => latest[kind]);
  return <View style={[styles.card, { borderColor: colors.border }]}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{t('bodyShape.references')}</Text>
    <Text style={[styles.note, { color: colors.textMuted }]}>{t('bodyShape.referencesHint')}</Text>
    {error ? <Text accessibilityRole="alert" style={[styles.note, { color: colors.textMuted }]}>{t('bodyShape.errors.measurements')}</Text>
      : isLoading ? <Text style={{ color: colors.textMuted }}>{t('bodyShape.loading')}</Text>
      : !hasMeasures ? <Text style={[styles.note, { color: colors.textMuted }]}>{t('bodyShape.noMeasurements')}</Text>
        : MEASUREMENT_KINDS.map((kind) => {
          const entry = latest[kind];
          if (!entry) return null;
          return <View key={kind} style={styles.row}>
            <Text style={[styles.name, { color: colors.text }]}>{t(`measurements.kinds.${kind}`)}</Text>
            <View style={styles.value}>
              <Text style={[styles.name, { color: colors.text }]}>{entry.valueCm} cm</Text>
              <Text style={[styles.date, { color: colors.textMuted }]}>{t('bodyShape.measuredOn', { date: new Date(`${entry.dayKey}T12:00:00`).toLocaleDateString(i18n.language) })}</Text>
            </View>
          </View>;
        })}
    <Pressable accessibilityRole="button" accessibilityLabel={t('bodyShape.openMeasurements')} onPress={() => router.push('/measurements')} style={styles.link}>
      <Text style={[styles.name, { color: colors.accent }]}>{t('bodyShape.openMeasurements')}</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 16, gap: 10, borderWidth: 1, borderRadius: 20 },
  title: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  note: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  name: { fontFamily: fontFamily.bodyMedium, fontSize: 14 },
  value: { alignItems: 'flex-end', gap: 3 },
  date: { fontFamily: fontFamily.body, fontSize: 12 },
  link: { minHeight: 44, justifyContent: 'center' },
});

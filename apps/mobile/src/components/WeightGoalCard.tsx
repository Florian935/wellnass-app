/**
 * WeightGoalCard — progression vers l'objectif de poids (NUTR-11).
 * Auto-portant : lit `useWeightGoalProgress`, aucune prop.
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Card';
import { useWeightGoalProgress } from '@/data/repositories/profile-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function WeightGoalCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const { progress, hasTarget, isLoading } = useWeightGoalProgress();

  if (isLoading) {
    return (
      <>
        <Text style={[styles.section, { color: colors.textMuted }]}>{t('stats.weightGoal.title')}</Text>
        <Card>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.accent} />
          </View>
        </Card>
      </>
    );
  }

  if (progress == null) {
    if (!hasTarget) {
      return (
        <>
          <Text style={[styles.section, { color: colors.textMuted }]}>{t('stats.weightGoal.title')}</Text>
          <Card>
            <Text style={[styles.hint, { color: colors.textMuted }]}>{t('stats.weightGoal.empty')}</Text>
          </Card>
        </>
      );
    }
    return null;
  }

  return (
    <>
      <Text style={[styles.section, { color: colors.textMuted }]}>{t('stats.weightGoal.title')}</Text>
      <Card>
        <View style={styles.valueRow}>
          <Text style={[styles.value, { color: colors.text }]}>{progress.pct} %</Text>
          {progress.reached ? (
            <Text style={[styles.reached, { color: colors.success }]}>{t('stats.weightGoal.reached')}</Text>
          ) : null}
        </View>
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View style={[styles.fill, { width: `${progress.pct}%`, backgroundColor: colors.accent }]} />
        </View>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('stats.weightGoal.progress', {
            done: units.formatWeight(progress.doneKg),
            total: units.formatWeight(progress.totalKg),
          })}
          {' · '}
          {t('stats.weightGoal.remaining', { remaining: units.formatWeight(progress.remainingKg) })}
        </Text>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: fontFamily.bodySemi, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  loadingRow: { paddingVertical: 16, alignItems: 'center' },
  hint: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 19, marginTop: 8 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  value: { fontFamily: fontFamily.displayBold, fontSize: 30 },
  reached: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  track: { height: 8, borderRadius: 999, overflow: 'hidden', marginTop: 10 },
  fill: { height: '100%', borderRadius: 999 },
});

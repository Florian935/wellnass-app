/**
 * TrainingNutritionCrossCard — tableau descriptif « charge muscu ↔ apports » sur 8 semaines
 * calendaires (MN-03). Auto-portant : lit lui-même `useTrainingNutritionCross`, aucune prop de
 * données. Rend `null` si le gating (muscu ET nutrition actifs) échoue côté hook (`weeks: []`).
 */
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { WeeklyTrainingNutrition } from '@wellness/shared';
import { Card } from '@/components/Card';
import { DeltaBadge } from '@/components/DeltaBadge';
import { useTrainingNutritionCross } from '@/data/repositories/records-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const pad = (n: number) => String(n).padStart(2, '0');

/** Plage d'affichage `JJ/MM–JJ/MM` (weekStart → weekStart + 6 j). Affichage uniquement. */
function weekRangeLabel(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  return `${fmt(start)}–${fmt(end)}`;
}

export function TrainingNutritionCrossCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const { weeks, isLoading } = useTrainingNutritionCross();

  if (isLoading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (weeks.length === 0) {
    return null;
  }

  const hasData = weeks.some((w) => w.sessions > 0 || w.avgKcal != null);

  return (
    <>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('stats.cross.title')}</Text>
      <Card>
        {!hasData ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('stats.cross.empty')}</Text>
        ) : (
          <View>
            <View style={styles.row}>
              <Text style={[styles.headerCell, styles.weekCell, { color: colors.textMuted }]}>
                {t('stats.cross.col.week')}
              </Text>
              <Text style={[styles.headerCell, styles.numCell, { color: colors.textMuted }]}>
                {t('stats.cross.col.sessions')}
              </Text>
              <Text style={[styles.headerCell, styles.numCell, { color: colors.textMuted }]}>
                {t('stats.cross.col.tonnage')} ({units.weightSymbol})
              </Text>
              <Text style={[styles.headerCell, styles.numCell, { color: colors.textMuted }]}>
                {t('stats.cross.col.kcal')}
              </Text>
              <Text style={[styles.headerCell, styles.numCell, { color: colors.textMuted }]}>
                {t('stats.cross.col.protein')}
              </Text>
            </View>
            {weeks.map((w: WeeklyTrainingNutrition, index: number) => (
              <View
                key={w.weekStart}
                style={[
                  styles.row,
                  styles.dataRow,
                  { borderColor: colors.border },
                  index === 0 ? { backgroundColor: colors.surfaceAlt } : null,
                ]}
              >
                <Text style={[styles.cell, styles.weekCell, { color: colors.text }]}>
                  {index === 0 ? t('stats.cross.thisWeek') : weekRangeLabel(w.weekStart)}
                </Text>
                <Text style={[styles.cell, styles.numCell, { color: colors.text }]}>{w.sessions}</Text>
                <View style={styles.numCell}>
                  <Text style={[styles.cell, { color: colors.text }]}>
                    {w.tonnage == null ? '—' : Math.round(units.toWeightValue(w.tonnage))}
                  </Text>
                  {w.tonnageChange != null ? (
                    <DeltaBadge change={w.tonnageChange} style={styles.deltaSpacing} />
                  ) : null}
                </View>
                <View style={styles.numCell}>
                  <Text style={[styles.cell, { color: colors.text }]}>
                    {w.avgKcal == null ? '—' : w.avgKcal}
                  </Text>
                  {w.kcalChange != null ? <DeltaBadge change={w.kcalChange} style={styles.deltaSpacing} /> : null}
                </View>
                <Text style={[styles.cell, styles.numCell, { color: colors.text }]}>
                  {w.avgProteinG == null ? '—' : w.avgProteinG}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  loadingRow: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 18,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dataRow: {
    borderTopWidth: 1,
    paddingVertical: 8,
    borderRadius: 8,
  },
  headerCell: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    paddingBottom: 8,
  },
  cell: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
  },
  weekCell: {
    flex: 1.4,
    paddingLeft: 4,
  },
  numCell: {
    flex: 1,
    alignItems: 'center',
  },
  deltaSpacing: {
    marginTop: 2,
  },
});

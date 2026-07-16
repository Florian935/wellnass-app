/**
 * ProteinPerKgCard — apport protéique g/kg de poids de corps vs cible de l'objectif (MN-06).
 * Auto-portant : lit `useProteinPerKg`, aucune prop. Bascule 7 j / 30 j.
 */
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ProteinPerKgStatus } from '@wellness/shared';
import { Card } from '@/components/Card';
import { Segment } from '@/components/Segment';
import { useProteinPerKg, type ProteinWindow } from '@/data/repositories/nutrition-repository';
import type { Palette } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const WINDOW_OPTIONS: readonly ProteinWindow[] = ['7d', '30d'];

/** Statut → couleur : low = doré littéral (comme MN-05) ; in = accent ; high = grisé. */
function statusColor(status: ProteinPerKgStatus, colors: Palette): string {
  if (status === 'low') return '#c9a96e';
  if (status === 'high') return colors.textMuted;
  return colors.accent;
}

/** Nombre FR : 1 décimale, virgule. */
function fmt1(n: number): string {
  return n.toFixed(1).replace('.', ',');
}

export function ProteinPerKgCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [window, setWindow] = useState<ProteinWindow>('7d');
  const { result, objective, hasWeight, isLoading } = useProteinPerKg(window);

  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
        </View>
      );
    }
    if (!hasWeight) {
      return <Text style={[styles.hint, { color: colors.textMuted }]}>{t('stats.protein.noWeight')}</Text>;
    }
    if (result == null) {
      return <Text style={[styles.hint, { color: colors.textMuted }]}>{t('stats.protein.noData')}</Text>;
    }
    const color = statusColor(result.status, colors);
    return (
      <>
        <View style={styles.valueRow}>
          <Text style={[styles.value, { color: colors.text }]}>
            {fmt1(result.gPerKg)} {t('stats.protein.perKgUnit')}
          </Text>
          <View style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: color }]}>
            <Text style={[styles.chipLabel, { color }]}>{t(`stats.protein.status.${result.status}`)}</Text>
          </View>
        </View>
        <Text style={[styles.target, { color: colors.textMuted }]}>
          {t('stats.protein.target', {
            min: fmt1(result.target.min),
            max: fmt1(result.target.max),
            objective: t(`stats.protein.objective.${objective}`),
          })}
        </Text>
      </>
    );
  };

  return (
    <>
      <Text style={[styles.section, { color: colors.textMuted }]}>{t('stats.protein.title')}</Text>
      <Card>
        <Segment
          options={WINDOW_OPTIONS}
          value={window}
          onChange={setWindow}
          label={(o) => t(`stats.ranges.${o}`)}
        />
        {renderBody()}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: fontFamily.bodySemi, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  loadingRow: { paddingVertical: 16, alignItems: 'center' },
  hint: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 19 },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  value: { fontFamily: fontFamily.displayBold, fontSize: 26, letterSpacing: -0.4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  chipLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  target: { fontFamily: fontFamily.body, fontSize: 13, marginTop: 6 },
});

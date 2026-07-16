import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { averageIntake, percentChange, weightTrend } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DeltaBadge } from '@/components/DeltaBadge';
import { Segment } from '@/components/Segment';
import { TextField } from '@/components/TextField';
import { ProgressLineChart } from '@/components/charts/ProgressLineChart';
import { ProteinPerKgCard } from '@/components/ProteinPerKgCard';
import { TrainingNutritionCrossCard } from '@/components/TrainingNutritionCrossCard';
import { logWeight, useLatestWeight, useWeightEntries } from '@/data/repositories/bodyweight-repository';
import { useDailyTotals } from '@/data/repositories/journal-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDay(d);
};
const shortLabel = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

const WEIGHT_RANGES = { '4w': 28, '3m': 90, '1y': 365 } as const;
type WeightRange = keyof typeof WEIGHT_RANGES;
const INTAKE_RANGES = { '7d': 7, '30d': 30 } as const;
type IntakeRange = keyof typeof INTAKE_RANGES;

export default function NutritionStatsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();

  const { latest } = useLatestWeight();
  const [weightInput, setWeightInput] = useState('');
  const [weightRange, setWeightRange] = useState<WeightRange>('3m');
  const { entries: weightEntries } = useWeightEntries(daysAgo(WEIGHT_RANGES[weightRange]));

  const [intakeRange, setIntakeRange] = useState<IntakeRange>('7d');
  const intakeWindowDays = INTAKE_RANGES[intakeRange];
  const { totals: totalsWithPrevious, isLoading: isIntakeLoading } = useDailyTotals(daysAgo(2 * intakeWindowDays));
  const intakeThreshold = daysAgo(intakeWindowDays);
  const totals = totalsWithPrevious.filter((d) => d.logDate >= intakeThreshold);
  const previousTotals = totalsWithPrevious.filter((d) => d.logDate < intakeThreshold);
  const avg = averageIntake(totals);
  const previousAvg = averageIntake(previousTotals);
  const kcalChange = percentChange(avg.kcal, previousAvg.kcal);

  const trend = weightTrend(weightEntries.map((e) => e.weightKg));
  const weightData = weightEntries.map((e) => ({ label: shortLabel(e.logDate), value: units.toWeightValue(e.weightKg) }));
  const intakeData = totals.map((d) => ({ label: shortLabel(d.logDate), value: d.kcal }));

  const saveWeight = async () => {
    const kg = units.parseWeightToKg(weightInput);
    if (kg == null || kg <= 0) return;
    await logWeight(isoDay(new Date()), kg);
    setWeightInput('');
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {/* Pesée du jour (1.13) */}
      <Text style={[styles.section, { color: colors.textMuted }]}>{t('stats.weight.title')}</Text>
      <Card>
        {latest ? (
          <View style={styles.latestRow}>
            <Text style={[styles.latestValue, { color: colors.text }]}>{units.formatWeight(latest.weightKg)}</Text>
            <Text style={[styles.trend, { color: trend === 'down' ? colors.success : trend === 'up' ? colors.danger : colors.textMuted }]}>
              {t(`stats.weight.trend.${trend}`)}
            </Text>
          </View>
        ) : (
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('stats.weight.empty')}</Text>
        )}
        <View style={styles.logRow}>
          <View style={{ flex: 1 }}>
            <TextField label={`${t('stats.weight.log')} (${units.weightSymbol})`} value={weightInput} onChangeText={setWeightInput} keyboardType="decimal-pad" placeholder={t(units.system === 'imperial' ? 'stats.weight.logPlaceholderImperial' : 'stats.weight.logPlaceholderMetric')} />
          </View>
          <View style={styles.logBtn}>
            <Button label={t('stats.weight.save')} onPress={() => void saveWeight()} disabled={!weightInput} />
          </View>
        </View>
      </Card>

      {/* Courbe poids (4.30) */}
      {weightData.length >= 2 ? (
        <Card>
          <Segment options={Object.keys(WEIGHT_RANGES) as WeightRange[]} value={weightRange} onChange={setWeightRange} label={(o) => t(`stats.ranges.${o}`)} />
          <ProgressLineChart data={weightData} unit={units.weightSymbol} />
        </Card>
      ) : null}

      {/* Apports moyens (4.31) */}
      <Text style={[styles.section, { color: colors.textMuted }]}>{t('stats.intake.title')}</Text>
      <Card>
        <Segment options={Object.keys(INTAKE_RANGES) as IntakeRange[]} value={intakeRange} onChange={setIntakeRange} label={(o) => t(`stats.ranges.${o}`)} />
        {totals.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('stats.intake.empty')}</Text>
        ) : (
          <>
            <View style={styles.avgRow}>
              <Text style={[styles.avgKcal, { color: colors.text }]}>{avg.kcal}</Text>
              <Text style={[styles.avgUnit, { color: colors.textMuted }]}>{t('nutrition.kcal')} · {t('stats.intake.perDay')}</Text>
              {!isIntakeLoading ? <DeltaBadge change={kcalChange} /> : null}
            </View>
            <Text style={[styles.macroLine, { color: colors.textMuted }]}>
              {t('nutrition.macros.protein')} {avg.proteinG} g · {t('nutrition.macros.carbs')} {avg.carbsG} g · {t('nutrition.macros.fat')} {avg.fatG} g
            </Text>
            {intakeData.length >= 2 ? <ProgressLineChart data={intakeData} unit={t('nutrition.kcal')} /> : null}
          </>
        )}
      </Card>

      {/* Apport protéique / poids (MN-06) — auto-portant */}
      <ProteinPerKgCard />

      {/* Vue croisée charge muscu ↔ apports (MN-03) — auto-portante, gating muscu+nutrition */}
      <TrainingNutritionCrossCard />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  section: { fontFamily: fontFamily.bodySemi, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  latestRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  latestValue: { fontFamily: fontFamily.displayBold, fontSize: 30 },
  trend: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  hint: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 19 },
  logRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  logBtn: { minWidth: 120 },
  avgRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  avgKcal: { fontFamily: fontFamily.displayBold, fontSize: 30 },
  avgUnit: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  macroLine: { fontFamily: fontFamily.mono, fontSize: 13 },
});

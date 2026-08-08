import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  averageIntake,
  DEFAULT_MEAL_KEYS,
  formatDayFull,
  OTHER_MEAL_KEY,
  percentChange,
  resolveMealConfig,
  resolveMealSplit,
  weightTrend,
  type MealSplitRow,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { CrossTrainingSection } from '@/components/nutrition/CrossTrainingSection';
import { Card } from '@/components/Card';
import { DeltaBadge } from '@/components/DeltaBadge';
import { Segment } from '@/components/Segment';
import { TextField } from '@/components/TextField';
import { ProgressLineChart } from '@/components/charts/ProgressLineChart';
import { ProteinPerKgCard } from '@/components/ProteinPerKgCard';
import { TrainingNutritionCrossCard } from '@/components/TrainingNutritionCrossCard';
import { WeightGoalCard } from '@/components/WeightGoalCard';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { logWeight, useLatestWeight, useWeightEntries } from '@/data/repositories/bodyweight-repository';
import { useDailyTotals, useJournalCompletion, useMealTotals } from '@/data/repositories/journal-repository';
import { useGoalAdherence } from '@/data/repositories/dashboard-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
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

/**
 * Bilan calorique signé (US NUTR-18), toujours avec un signe explicite (+/−) — `Intl.NumberFormat`
 * plutôt qu'une concaténation manuelle, séparateur de milliers correct selon la langue (même
 * patron que `formatSteps`, `StepsCard.tsx`).
 */
const formatSignedKcal = (value: number, language: string): string =>
  new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'fr-FR', { signDisplay: 'exceptZero' }).format(
    value,
  );

const WEIGHT_RANGES = { '4w': 28, '3m': 90, '1y': 365 } as const;
type WeightRange = keyof typeof WEIGHT_RANGES;
const INTAKE_RANGES = { '7d': 7, '30d': 30 } as const;
type IntakeRange = keyof typeof INTAKE_RANGES;

export default function NutritionStatsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();

  // Analytics : ouverture de l'écran de stats nutrition (une fois au montage). Fire-and-forget.
  useEffect(() => {
    void track(ANALYTICS_EVENTS.statsViewed, { pillar: 'nutrition' });
  }, []);

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
  const adherence = useGoalAdherence(intakeWindowDays);
  const completion = useJournalCompletion(intakeWindowDays);

  // Répartition par repas (US NUTR-16) — même fenêtre que « Apports moyens », pas un 2ᵉ toggle.
  // `totals.length` = jours effectivement renseignés dans la fenêtre (même diviseur qu'`averageIntake`).
  const { nutritionProfile } = useNutritionProfile();
  const configuredMeals = resolveMealConfig(nutritionProfile?.meals);
  const { mealTotals } = useMealTotals(intakeThreshold);
  const mealSplit = resolveMealSplit(mealTotals, configuredMeals, totals.length);

  // Même repli que le journal ((tabs)/nutrition.tsx) : repas custom sans nom → « Repas N » (position
  // parmi les repas configurés), jamais sa clé technique. Bucket « Autres » via sa propre clé i18n.
  const mealSplitLabel = (row: MealSplitRow): string => {
    if (row.mealKey === OTHER_MEAL_KEY) return t('journal.meals.other');
    if (row.label) return row.label;
    if (DEFAULT_MEAL_KEYS.includes(row.mealKey as never)) return t(`journal.meals.${row.mealKey}`);
    const idx = configuredMeals.findIndex((m) => m.key === row.mealKey);
    return t('meals.mealN', { n: idx + 1 });
  };

  const trend = weightTrend(weightEntries);
  // `label` = abrégé d'axe ; `detail` = date complète affichée dans l'infobulle (UX-01).
  const weightData = weightEntries.map((e) => ({
    label: shortLabel(e.logDate),
    detail: formatDayFull(e.logDate),
    value: units.toWeightValue(e.weightKg),
  }));
  const intakeData = totals.map((d) => ({
    label: shortLabel(d.logDate),
    detail: formatDayFull(d.logDate),
    value: d.kcal,
  }));

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
          <ProgressLineChart data={weightData} unit={units.weightSymbol} smooth />
        </Card>
      ) : null}

      {/* Progression vers l'objectif de poids (NUTR-11) — auto-portante */}
      <WeightGoalCard />

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
            {intakeData.length >= 2 ? <ProgressLineChart data={intakeData} unit={t('nutrition.kcal')} smooth /> : null}
          </>
        )}
      </Card>

      {/* Répartition par repas (US NUTR-16) — même fenêtre 7 j/30 j que les apports, pas de 2ᵉ toggle */}
      <Text style={[styles.section, { color: colors.textMuted }]}>{t('stats.mealSplit.title')}</Text>
      <Card>
        {mealSplit.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('stats.intake.empty')}</Text>
        ) : (
          <View style={styles.mealSplitList}>
            {mealSplit.map((row) => (
              <View key={row.mealKey} accessible style={styles.mealSplitRow}>
                <Text style={[styles.mealSplitName, { color: colors.text }]}>
                  {mealSplitLabel(row)}
                </Text>
                <View style={[styles.mealSplitBarTrack, { backgroundColor: colors.track }]}>
                  <View
                    style={[
                      styles.mealSplitBar,
                      {
                        width: `${row.pct}%`,
                        backgroundColor: row.mealKey === OTHER_MEAL_KEY ? colors.textMuted : colors.accent,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.mealSplitValue, { color: colors.textMuted }]}>
                  {t('stats.mealSplit.row', { pct: row.pct, kcal: row.avgKcalPerDay })}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Adhérence à l'objectif (NUTR-10) — même fenêtre 7 j/30 j que les apports */}
      <Text style={[styles.section, { color: colors.textMuted }]}>{t('stats.adherence.title')}</Text>
      <Card>
        {adherence.isLoading ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>…</Text>
        ) : !adherence.hasTarget ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('stats.adherence.noTarget')}</Text>
        ) : adherence.loggedDays === 0 ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('stats.adherence.empty')}</Text>
        ) : (
          <>
            <View style={styles.avgRow}>
              <Text style={[styles.avgKcal, { color: colors.text }]}>{adherence.pct} %</Text>
            </View>
            <Text style={[styles.macroLine, { color: colors.textMuted }]}>
              {t('stats.adherence.inTarget', { count: adherence.daysInTarget, total: adherence.loggedDays })}
            </Text>
            <Text style={[styles.macroLine, { color: colors.textMuted }]}>
              {t('stats.adherence.margin', { pct: adherence.marginPct })}
            </Text>
            {/* US NUTR-18 — regroupée ici plutôt qu'une nouvelle carte (ADR-007, voir spec §0) */}
            <Text style={[styles.macroLine, { color: colors.textMuted }]}>
              {t('stats.adherence.balance', {
                value: formatSignedKcal(adherence.balanceKcal, i18n.language),
              })}
            </Text>
            <Text style={[styles.macroLine, { color: colors.textMuted }]}>
              {t('stats.adherence.aboveBelow', {
                above: adherence.daysAbove,
                below: adherence.daysBelow,
              })}
            </Text>
          </>
        )}
      </Card>

      {/* Régularité du journal (NUTR-17) — même fenêtre 7 j/30 j */}
      <Text style={[styles.section, { color: colors.textMuted }]}>{t('stats.completion.title')}</Text>
      <Card>
        {completion.isLoading ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>…</Text>
        ) : completion.effectiveWindow === 0 ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('stats.completion.empty')}</Text>
        ) : (
          <>
            <View style={styles.avgRow}>
              <Text style={[styles.avgKcal, { color: colors.text }]}>{completion.pct} %</Text>
            </View>
            <Text style={[styles.macroLine, { color: colors.textMuted }]}>
              {t('stats.completion.logged', { count: completion.loggedDays, total: completion.effectiveWindow })}
            </Text>
          </>
        )}
      </Card>

      {/* Apport protéique / poids (MN-06) — auto-portant */}
      <ProteinPerKgCard />

      {/* Vue croisée charge muscu ↔ apports (MN-03) — auto-portante, gating muscu+nutrition */}
      <TrainingNutritionCrossCard />

      {/* US APPORT-01 — « manges-tu comme tu t'entraînes ? » (MN-20/16/15/10).
          Conditionnelle et repliée : rend `null` quand ses 4 analyses se taisent, donc un compte
          neuf ne voit rien de plus qu'avant. Même patron que StrengthSection, ExecutionSection et
          PolarisationSection — la place d'affichage est une ressource rare. */}
      <CrossTrainingSection />
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
  mealSplitList: { gap: 12 },
  mealSplitRow: { gap: 4 },
  mealSplitName: { fontFamily: fontFamily.bodySemi, fontSize: 13.5 },
  mealSplitBarTrack: { height: 10, borderRadius: 6, overflow: 'hidden' },
  mealSplitBar: { height: '100%', borderRadius: 6 },
  mealSplitValue: { fontFamily: fontFamily.mono, fontSize: 12.5 },
});

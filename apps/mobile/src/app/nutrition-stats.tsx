/**
 * Suivi nutritionnel (US NUTRI-UX01, R4).
 *
 * ── Le défaut corrigé ────────────────────────────────────────────────────────────────────────
 * L'écran empilait **8 sections permanentes et 4 cartes auto-portantes** dans un seul scroll —
 * poids, courbe, objectif de poids, apports moyens, répartition par repas, adhérence,
 * régularité, protéines/kg, puis les croisements. L'ADR-007 §2 plafonne pourtant le Tier 1 à
 * « ~4-5 sections » avant repli ou sous-onglets, **et nommait déjà cet écran** comme le point de
 * saturation à surveiller. Le seuil était franchi.
 *
 * Quatre sous-onglets, quatre questions distinctes :
 *   • Régularité — est-ce que je tiens le journal, et depuis quand ?
 *   • Apports    — combien je mange, et comment ça évolue ?
 *   • Poids      — où va la trajectoire ?
 *   • Qualité    — au-delà des calories, qu'est-ce qu'il y a dans l'assiette ?
 *
 * La **pesée quitte l'écran de consultation** (R4.4) : saisir son poids en premier bloc d'un
 * écran de lecture n'avait pas de sens. Elle vit dans l'onglet Poids, en action secondaire.
 */

import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_MEAL_KEYS,
  OTHER_MEAL_KEY,
  averageIntake,
  formatDayFull,
  percentChange,
  resolveMealConfig,
  resolveMealSplit,
  weightTrend,
  type MealSplitRow,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DeltaBadge } from '@/components/DeltaBadge';
import { Segment } from '@/components/Segment';
import { TextField } from '@/components/TextField';
import { ProgressLineChart } from '@/components/charts/ProgressLineChart';
import { ProteinPerKgCard } from '@/components/ProteinPerKgCard';
import { TrainingNutritionCrossCard } from '@/components/TrainingNutritionCrossCard';
import { WeightGoalCard } from '@/components/WeightGoalCard';
import { AdherenceChart, type AdherenceDay } from '@/components/nutrition/AdherenceChart';
import { CrossTrainingSection } from '@/components/nutrition/CrossTrainingSection';
import { QualityCard } from '@/components/nutrition/QualityCard';
import { RegularityCard } from '@/components/nutrition/RegularityCard';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { logWeight, useLatestWeight, useWeightEntries } from '@/data/repositories/bodyweight-repository';
import {
  useDailyTotals,
  useMealTotals,
  useQualityAverage,
} from '@/data/repositories/journal-repository';
import { useDailyCalorieTargets, useGoalAdherence } from '@/data/repositories/dashboard-repository';
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

/** Bilan calorique signé (US NUTR-18) — signe explicite, séparateur de milliers localisé. */
const formatSignedKcal = (value: number, language: string): string =>
  new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'fr-FR', { signDisplay: 'exceptZero' }).format(
    value,
  );

const WEIGHT_RANGES = { '4w': 28, '3m': 90, '1y': 365 } as const;
type WeightRange = keyof typeof WEIGHT_RANGES;
const INTAKE_RANGES = { '7d': 7, '30d': 30 } as const;
type IntakeRange = keyof typeof INTAKE_RANGES;

const TABS = ['regularity', 'intake', 'weight', 'quality'] as const;
type Tab = (typeof TABS)[number];

export default function NutritionStatsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [tab, setTab] = useState<Tab>('regularity');

  useEffect(() => {
    void track(ANALYTICS_EVENTS.statsViewed, { pillar: 'nutrition' });
  }, []);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Segment
        scrollable
        options={TABS}
        value={tab}
        onChange={(v) => setTab(v)}
        label={(o) => t(`stats.tabs.${o}`)}
      />

      {tab === 'regularity' ? <RegularityTab /> : null}
      {tab === 'intake' ? <IntakeTab /> : null}
      {tab === 'weight' ? <WeightTab /> : null}
      {tab === 'quality' ? <QualityTab /> : null}
    </ScrollView>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Régularité — tiens-je le journal, et depuis quand ?
// ───────────────────────────────────────────────────────────────────────────

function RegularityTab() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [range, setRange] = useState<IntakeRange>('30d');
  const windowDays = INTAKE_RANGES[range];

  const adherence = useGoalAdherence(windowDays);
  const { days: targets } = useDailyCalorieTargets(daysAgo(windowDays), null);

  /**
   * Un point par jour **renseigné**, avec son écart relatif à la cible du jour.
   *
   * Les jours vides sont exclus, pas comptés comme un déficit : ne rien avoir saisi n'est pas
   * la même chose qu'avoir peu mangé — c'est déjà la convention de `computeGoalAdherence`.
   */
  const days: AdherenceDay[] = useMemo(() => {
    const margin = adherence.marginPct / 100;
    return targets
      .filter((d) => d.kcal > 0 && d.effectiveTarget != null && d.effectiveTarget > 0)
      .map((d) => {
        const deviation = (d.kcal - d.effectiveTarget!) / d.effectiveTarget!;
        const status: AdherenceDay['status'] =
          deviation > margin ? 'over' : deviation < -margin ? 'under' : 'in';
        return { logDate: d.dayKey, deviation, status };
      });
  }, [targets, adherence.marginPct]);

  return (
    <>
      <Segment
        options={Object.keys(INTAKE_RANGES) as IntakeRange[]}
        value={range}
        onChange={setRange}
        label={(o) => t(`stats.ranges.${o}`)}
      />

      <RegularityCard targetKcal={null} windowDays={windowDays} />

      {adherence.isLoading ? null : !adherence.hasTarget ? (
        <Card>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t('stats.adherence.noTarget')}
          </Text>
        </Card>
      ) : adherence.loggedDays === 0 ? (
        <Card>
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('stats.adherence.empty')}</Text>
        </Card>
      ) : (
        <AdherenceChart
          days={days}
          marginPct={adherence.marginPct}
          inTarget={adherence.daysInTarget}
          loggedDays={adherence.loggedDays}
          balanceKcal={formatSignedKcal(adherence.balanceKcal, i18n.language)}
          daysAbove={adherence.daysAbove}
          daysBelow={adherence.daysBelow}
        />
      )}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Apports — combien, et comment ça évolue ?
// ───────────────────────────────────────────────────────────────────────────

function IntakeTab() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [range, setRange] = useState<IntakeRange>('7d');
  const windowDays = INTAKE_RANGES[range];

  const { totals: withPrevious, isLoading } = useDailyTotals(daysAgo(2 * windowDays));
  const threshold = daysAgo(windowDays);
  const totals = withPrevious.filter((d) => d.logDate >= threshold);
  const previous = withPrevious.filter((d) => d.logDate < threshold);
  const avg = averageIntake(totals);
  const previousAvg = averageIntake(previous);
  const kcalChange = percentChange(avg.kcal, previousAvg.kcal);

  const { nutritionProfile } = useNutritionProfile();
  const configuredMeals = resolveMealConfig(nutritionProfile?.meals);
  const { mealTotals } = useMealTotals(threshold);
  const mealSplit = resolveMealSplit(mealTotals, configuredMeals, totals.length);

  const mealSplitLabel = (row: MealSplitRow): string => {
    if (row.mealKey === OTHER_MEAL_KEY) return t('journal.meals.other');
    if (row.label) return row.label;
    if (DEFAULT_MEAL_KEYS.includes(row.mealKey as never)) return t(`journal.meals.${row.mealKey}`);
    const idx = configuredMeals.findIndex((m) => m.key === row.mealKey);
    return t('meals.mealN', { n: idx + 1 });
  };

  const intakeData = totals.map((d) => ({
    label: shortLabel(d.logDate),
    detail: formatDayFull(d.logDate),
    value: d.kcal,
  }));

  return (
    <>
      <Segment
        options={Object.keys(INTAKE_RANGES) as IntakeRange[]}
        value={range}
        onChange={setRange}
        label={(o) => t(`stats.ranges.${o}`)}
      />

      <Card>
        {totals.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('stats.intake.empty')}</Text>
        ) : (
          <>
            <View style={styles.avgRow}>
              <Text style={[styles.avgKcal, { color: colors.text }]}>{avg.kcal}</Text>
              <Text style={[styles.avgUnit, { color: colors.textMuted }]}>
                {t('nutrition.kcal')} · {t('stats.intake.perDay')}
              </Text>
              {!isLoading ? <DeltaBadge change={kcalChange} /> : null}
            </View>
            <Text style={[styles.macroLine, { color: colors.textMuted }]}>
              {t('nutrition.macros.protein')} {avg.proteinG} g · {t('nutrition.macros.carbs')}{' '}
              {avg.carbsG} g · {t('nutrition.macros.fat')} {avg.fatG} g
            </Text>
            {intakeData.length >= 2 ? (
              <ProgressLineChart data={intakeData} unit={t('nutrition.kcal')} smooth />
            ) : null}
          </>
        )}
      </Card>

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
                        backgroundColor:
                          row.mealKey === OTHER_MEAL_KEY ? colors.textMuted : colors.accent,
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
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Poids — où va la trajectoire ? (la saisie vit ici, R4.4)
// ───────────────────────────────────────────────────────────────────────────

function WeightTab() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();

  const { latest } = useLatestWeight();
  const [weightInput, setWeightInput] = useState('');
  const [range, setRange] = useState<WeightRange>('3m');
  const { entries } = useWeightEntries(daysAgo(WEIGHT_RANGES[range]));

  const trend = weightTrend(entries);
  const data = entries.map((e) => ({
    label: shortLabel(e.logDate),
    detail: formatDayFull(e.logDate),
    value: units.toWeightValue(e.weightKg),
  }));

  const saveWeight = async () => {
    const kg = units.parseWeightToKg(weightInput);
    if (kg == null || kg <= 0) return;
    await logWeight(isoDay(new Date()), kg);
    setWeightInput('');
  };

  return (
    <>
      <Card>
        {latest ? (
          <View style={styles.latestRow}>
            <Text style={[styles.latestValue, { color: colors.text }]}>
              {units.formatWeight(latest.weightKg)}
            </Text>
            <Text
              style={[
                styles.trend,
                {
                  color:
                    trend === 'down' ? colors.success : trend === 'up' ? colors.danger : colors.textMuted,
                },
              ]}
            >
              {t(`stats.weight.trend.${trend}`)}
            </Text>
          </View>
        ) : (
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('stats.weight.empty')}</Text>
        )}
        {data.length >= 2 ? (
          <>
            <Segment
              options={Object.keys(WEIGHT_RANGES) as WeightRange[]}
              value={range}
              onChange={setRange}
              label={(o) => t(`stats.ranges.${o}`)}
            />
            <ProgressLineChart data={data} unit={units.weightSymbol} smooth />
          </>
        ) : null}
      </Card>

      <WeightGoalCard />

      {/* R4.4 — la saisie descend en pied d'onglet : c'est une action, pas une lecture. */}
      <Card>
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('stats.weight.logHint')}</Text>
        <View style={styles.logRow}>
          <View style={{ flex: 1 }}>
            <TextField
              label={`${t('stats.weight.log')} (${units.weightSymbol})`}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholder={t(
                units.system === 'imperial'
                  ? 'stats.weight.logPlaceholderImperial'
                  : 'stats.weight.logPlaceholderMetric',
              )}
            />
          </View>
          <View style={styles.logBtn}>
            <Button label={t('stats.weight.save')} onPress={() => void saveWeight()} disabled={!weightInput} />
          </View>
        </View>
      </Card>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Qualité — qu'y a-t-il dans l'assiette, au-delà des calories ?
// ───────────────────────────────────────────────────────────────────────────

function QualityTab() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [range, setRange] = useState<IntakeRange>('7d');
  const windowDays = INTAKE_RANGES[range];

  const { quality, loggedDays } = useQualityAverage(daysAgo(windowDays));
  const { days: targets } = useDailyCalorieTargets(daysAgo(windowDays), null);

  // Cible moyenne de la fenêtre : les plafonds proportionnels (sucres, AGS) doivent suivre
  // l'objectif réel, y compris quand il varie d'un jour à l'autre (jours de séance, VIE-01).
  const avgTarget = useMemo(() => {
    const values = targets.map((d) => d.effectiveTarget).filter((v): v is number => v != null);
    if (values.length === 0) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }, [targets]);

  return (
    <>
      <Segment
        options={Object.keys(INTAKE_RANGES) as IntakeRange[]}
        value={range}
        onChange={setRange}
        label={(o) => t(`stats.ranges.${o}`)}
      />

      {loggedDays === 0 ? (
        <Card>
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('stats.intake.empty')}</Text>
        </Card>
      ) : (
        <>
          <QualityCard
            values={{
              fiber: quality.fiber,
              sugars: quality.sugars,
              saturatedFat: quality.saturatedFat,
            }}
            targetKcal={avgTarget}
          />
          {/* Honnêteté sur ce qui n'est pas mesurable : les sous-macros vivent sur l'aliment,
              donc un ajout rapide en calories n'y contribue pas (voir `useDayQuality`). */}
          {quality.coverageRatio < 0.9 ? (
            <Text style={[styles.coverage, { color: colors.textMuted }]}>
              {t('quality.coverage', { pct: Math.round(quality.coverageRatio * 100) })}
            </Text>
          ) : null}
        </>
      )}

      <ProteinPerKgCard />
      <TrainingNutritionCrossCard />
      <CrossTrainingSection />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  section: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
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
  coverage: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17, paddingHorizontal: 4 },
});

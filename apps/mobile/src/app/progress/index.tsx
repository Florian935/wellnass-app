/**
 * Écran de progression musculaire (US3 — 3.21 / 3.39 / 3.40).
 *
 * Trois sections :
 *  1. Volume par groupe musculaire (semaine courante) — histogramme.
 *  2. Sélecteur d'exercice (modal, via ExercisePicker).
 *  3. Per exercice sélectionné :
 *     - Records personnels (charge max, 1RM estimé, meilleur volume de série).
 *     - Courbe de progression avec toggles métrique (charge max / volume)
 *       et période (30j / 90j / 1 an).
 *
 * Conventions :
 *  - Aucune chaîne en dur — namespace i18n `progress.*`.
 *  - Dates au format JJ/MM.
 *  - Empty states : jamais de graphique vide rendu ; message + CTA affiché.
 *  - Offline-first : tout vient de PowerSync local ; isLoading géré.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MuscleGroup } from '@wellness/shared';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segment } from '@/components/Segment';
import { MuscleVolumeBarChart } from '@/components/charts/MuscleVolumeBarChart';
import { ProgressLineChart } from '@/components/charts/ProgressLineChart';
import { ExercisePicker } from '@/components/programs/ExercisePicker';
import {
  useExerciseRecords,
  useExerciseProgression,
  useMuscleVolumeThisWeek,
  type ProgressionMetric,
  type ProgressionPeriod,
} from '@/data/repositories/records-repository';
import type { ExerciseListItem } from '@/data/repositories/exercise-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useUnits } from '@/hooks/useUnits';

// ---------------------------------------------------------------------------
// Constantes de toggles
// ---------------------------------------------------------------------------

const METRIC_OPTIONS: readonly ProgressionMetric[] = ['max_weight', 'volume'];
const PERIOD_OPTIONS: readonly ProgressionPeriod[] = ['30d', '90d', '1y'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formate une date ISO en JJ/MM (label court pour les axes de graphique). */
function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

// ---------------------------------------------------------------------------
// Écran principal
// ---------------------------------------------------------------------------

export default function ProgressScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseListItem | null>(null);
  const [metric, setMetric] = useState<ProgressionMetric>('max_weight');
  const [period, setPeriod] = useState<ProgressionPeriod>('30d');

  const onPickExercise = (exercise: ExerciseListItem) => {
    setSelectedExercise(exercise);
    setPickerVisible(false);
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('progress.title')}
        subtitle={t('progress.subtitle')}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Section 1 — Volume hebdomadaire par groupe musculaire             */}
        {/* ---------------------------------------------------------------- */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('progress.weeklyVolume.title')}
        </Text>
        <WeeklyVolumeSection onStartWorkout={() => router.push('/workout')} />

        {/* ---------------------------------------------------------------- */}
        {/* Section 2 — Par exercice                                          */}
        {/* ---------------------------------------------------------------- */}
        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced, { color: colors.text }]}>
          {t('progress.exercise.title')}
        </Text>

        {/* Sélecteur d'exercice */}
        <Pressable
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={t('progress.exercise.selectA11y')}
          style={[styles.exerciseSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.exerciseSelectorInner}>
            <Ionicons name="barbell-outline" size={20} color={colors.accent} />
            <Text
              style={[
                styles.exerciseSelectorLabel,
                { color: selectedExercise ? colors.text : colors.textMuted },
              ]}
              numberOfLines={1}
            >
              {selectedExercise ? selectedExercise.name : t('progress.exercise.placeholder')}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Pressable>

        {/* Contenu per exercice */}
        {selectedExercise ? (
          <ExerciseSection
            exercise={selectedExercise}
            metric={metric}
            period={period}
            onMetricChange={setMetric}
            onPeriodChange={setPeriod}
            onStartWorkout={() => router.push('/workout')}
          />
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {t('progress.exercise.empty')}
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* Modal de sélection d'exercice */}
      <ExercisePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onPick={onPickExercise}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Section volume hebdomadaire
// ---------------------------------------------------------------------------

function WeeklyVolumeSection({ onStartWorkout }: { onStartWorkout: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const { volumes, isLoading } = useMuscleVolumeThisWeek();

  if (isLoading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const chartData = volumes.map((v) => ({
    label: t(`muscle.${v.muscle as MuscleGroup}`),
    value: units.toWeightValue(v.volume),
  }));

  if (chartData.length === 0) {
    return (
      <EmptyState
        icon="barbell-outline"
        title={t('progress.weeklyVolume.emptyTitle')}
        message={t('progress.weeklyVolume.emptyMessage')}
        cta={{ label: t('progress.cta.startWorkout'), onPress: onStartWorkout }}
      />
    );
  }

  return (
    <Card>
      <MuscleVolumeBarChart
        data={chartData}
        title={t('progress.weeklyVolume.chartTitle')}
        unit={units.weightSymbol}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section per exercice (records + courbe)
// ---------------------------------------------------------------------------

type ExerciseSectionProps = {
  exercise: ExerciseListItem;
  metric: ProgressionMetric;
  period: ProgressionPeriod;
  onMetricChange: (m: ProgressionMetric) => void;
  onPeriodChange: (p: ProgressionPeriod) => void;
  onStartWorkout: () => void;
};

function ExerciseSection({
  exercise,
  metric,
  period,
  onMetricChange,
  onPeriodChange,
  onStartWorkout,
}: ExerciseSectionProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();

  const { records, isLoading: recordsLoading } = useExerciseRecords(exercise.id);
  const { points, isLoading: pointsLoading } = useExerciseProgression(exercise.id, metric, period);

  // ---------- Records ----------
  const renderRecords = () => {
    if (recordsLoading) {
      return (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
        </View>
      );
    }
    if (records.length === 0) {
      return (
        <View style={styles.recordsEmpty}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('progress.records.empty')}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.recordsGrid}>
        {records.map((rec) => (
          <View
            key={rec.type}
            style={[styles.recordChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          >
            <Text style={[styles.recordLabel, { color: colors.textMuted }]}>
              {t(`progress.records.type.${rec.type}`)}
            </Text>
            <Text style={[styles.recordValue, { color: colors.text }]}>
              {rec.type === 'best_volume'
                ? rec.value.toFixed(0)
                : units.formatWeight(rec.value)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // ---------- Courbe ----------
  const renderCurve = () => {
    if (pointsLoading) {
      return (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
        </View>
      );
    }

    const chartData = points.map((p) => ({
      label: formatDateShort(p.date),
      value: units.toWeightValue(p.value),
    }));

    if (chartData.length === 0) {
      return (
        <View style={styles.curveEmpty}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('progress.curve.empty')}
          </Text>
          <Pressable
            onPress={onStartWorkout}
            accessibilityRole="button"
            style={[styles.ctaBtn, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.ctaBtnLabel, { color: colors.accentText }]}>
              {t('progress.cta.startWorkout')}
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <ProgressLineChart
        data={chartData}
        title={t(`progress.curve.metricLabel.${metric}`)}
        unit={units.weightSymbol}
      />
    );
  };

  return (
    <>
      {/* Records */}
      <Text style={[styles.subSectionTitle, { color: colors.text }]}>
        {t('progress.records.title')}
      </Text>
      <Card>{renderRecords()}</Card>

      {/* Courbe de progression */}
      <Text style={[styles.subSectionTitle, styles.subSectionTitleSpaced, { color: colors.text }]}>
        {t('progress.curve.title')}
      </Text>
      <Card style={styles.curveCard}>
        {/* Toggle métrique */}
        <Segment
          options={METRIC_OPTIONS}
          value={metric}
          onChange={onMetricChange}
          label={(m) => t(`progress.curve.metric.${m}`)}
        />
        {/* Toggle période */}
        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map((p) => {
            const selected = period === p;
            return (
              <Pressable
                key={p}
                onPress={() => onPeriodChange(p)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.periodChip,
                  {
                    backgroundColor: selected ? colors.accent : colors.surface,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.periodChipLabel,
                    { color: selected ? colors.accentText : colors.text },
                  ]}
                >
                  {t(`progress.curve.period.${p}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {renderCurve()}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 32,
  },
  sectionTitle: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 18,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  sectionTitleSpaced: {
    marginTop: 28,
  },
  subSectionTitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 15,
    marginBottom: 8,
    marginTop: 16,
  },
  subSectionTitleSpaced: {
    marginTop: 20,
  },
  loadingRow: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyCard: {
    padding: 20,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  exerciseSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 4,
  },
  exerciseSelectorInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exerciseSelectorLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 15,
    flex: 1,
  },
  recordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  recordChip: {
    flex: 1,
    minWidth: '28%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    alignItems: 'center',
  },
  recordLabel: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    textAlign: 'center',
  },
  recordValue: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  recordsEmpty: {
    paddingVertical: 8,
  },
  curveCard: {
    gap: 14,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  periodChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  periodChipLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
  },
  curveEmpty: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  ctaBtn: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 15,
  },
});

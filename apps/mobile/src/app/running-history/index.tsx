/**
 * Historique & progression de course (R4a — phase D).
 *
 * Écran en lecture seule, trois sections :
 *  1. Statistiques agrégées (distance / temps / nombre) par période (semaine / mois / début).
 *  2. Courbe d'allure moyenne sur 30 ou 90 jours + libellé de tendance.
 *  3. Liste des courses terminées (date, distance, durée, allure) → détail au tap.
 *
 * Conventions :
 *  - Aucune chaîne en dur — namespace i18n `running.history.*` (+ `running.active.noData`).
 *  - Distances / allures / durées formatées via `useUnits` + `formatDurationHms`.
 *  - Dates : `dayKey` (courbe) est déjà `AAAA-MM-JJ` → découpage direct en JJ/MM ;
 *    `finishedAt` est un timestamp ISO complet → `new Date(iso)` pour la liste.
 *  - Empty states : jamais de graphique vide rendu (ProgressLineChart rend null si vide,
 *    on affiche en plus une note) ; EmptyState quand aucune course.
 *  - Offline-first : tout vient de PowerSync local (via useRunHistory).
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  formatDurationHms,
  formatPaceMMSS,
  localDayKey,
  paceToSystem,
  formatDayFull,
  percentChange,
  previousPeriodTodayKey,
  RUNNING_RECORD_DISTANCES,
  type PaceTrendKind,
  type RecordDistanceKey,
  type StatPeriod,
} from '@wellness/shared';
import { Card } from '@/components/Card';
import { DeltaBadge } from '@/components/DeltaBadge';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segment } from '@/components/Segment';
import { ProgressLineChart } from '@/components/charts/ProgressLineChart';
import {
  usePaceTrend,
  useRunHistory,
  useRunStatsAt,
} from '@/data/repositories/run-repository';
import {
  backfillRunningRecords,
  useRunningRecords,
} from '@/data/repositories/running-record-repository';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

// ---------------------------------------------------------------------------
// Constantes de toggles
// ---------------------------------------------------------------------------

const PERIOD_OPTIONS: readonly StatPeriod[] = ['week', 'month', 'all'];
/** Fenêtres de la courbe d'allure (jours) et leur clé i18n. */
const PACE_WINDOWS = { days30: 30, days90: 90 } as const;
type PaceWindow = keyof typeof PACE_WINDOWS;
const PACE_WINDOW_OPTIONS: readonly PaceWindow[] = ['days30', 'days90'];

/** Clé i18n de tendance selon le sens de progression de l'allure. */
const TREND_KEY: Record<PaceTrendKind, string> = {
  improving: 'running.history.trendImproving',
  declining: 'running.history.trendDeclining',
  stable: 'running.history.trendStable',
};

/** Clé i18n du libellé de distance pour chaque record canonique. */
const RECORD_DISTANCE_KEY: Record<RecordDistanceKey, string> = {
  '1k': 'running.records.distance1k',
  '5k': 'running.records.distance5k',
  '10k': 'running.records.distance10k',
  semi: 'running.records.distanceSemi',
  marathon: 'running.records.distanceMarathon',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** `AAAA-MM-JJ` → `JJ/MM` (découpage direct, pas de `new Date`). */
function dayKeyToShort(dayKey: string): string {
  const [, mm, dd] = dayKey.split('-');
  return `${dd}/${mm}`;
}

/** Timestamp ISO complet → `JJ/MM/AAAA`. */
function isoToDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Écran principal
// ---------------------------------------------------------------------------

export default function RunningHistoryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  // Chargement consolidé au niveau écran : `useRunHistory` est la source unique des
  // trois sections (useRunStats / usePaceTrend en dépendent). On gate tout le corps sur
  // son `isLoading` pour éviter que la résolution initiale de PowerSync (runs=[]) ne
  // s'affiche comme un faux « aucune course » (0/0/0 + courbe vide + EmptyState).
  const { isLoading } = useRunHistory();

  // Analytics : ouverture de l'écran de stats course (une fois au montage). Fire-and-forget.
  useEffect(() => {
    void track(ANALYTICS_EVENTS.statsViewed, { pillar: 'running' });
  }, []);

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('running.history.title')} />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('running.history.statsTitle')}
          </Text>
          <StatsSection />

          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced, { color: colors.text }]}>
            {t('running.history.paceTitle')}
          </Text>
          <PaceSection />

          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced, { color: colors.text }]}>
            {t('running.history.runsSectionTitle')}
          </Text>
          <RunListSection />

          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced, { color: colors.text }]}>
            {t('running.records.sectionTitle')}
          </Text>
          <RecordsSection />
        </ScrollView>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Section statistiques
// ---------------------------------------------------------------------------

function StatsSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const [period, setPeriod] = useState<StatPeriod>('week');

  const todayKey = localDayKey(new Date());
  const prevKey = previousPeriodTodayKey(todayKey, period);
  const { stats, isLoading } = useRunStatsAt(period, todayKey);
  // `prevKey` est `null` pour la période 'all' (pas de période précédente) : le hook
  // est appelé quand même (règles des hooks), avec une clé neutre, mais le badge de
  // comparaison n'est jamais monté dans ce cas (voir `showDelta`).
  const { stats: prevStats, isLoading: prevLoading } = useRunStatsAt(period, prevKey ?? todayKey);
  const showDelta = prevKey != null && !isLoading && !prevLoading;

  const cards = [
    {
      key: 'totalDistance',
      value: units.formatDistance(stats.totalDistanceM / 1000),
      delta: percentChange(stats.totalDistanceM, prevStats.totalDistanceM),
    },
    {
      key: 'totalTime',
      value: formatDurationHms(stats.totalDurationS),
      delta: percentChange(stats.totalDurationS, prevStats.totalDurationS),
    },
    {
      key: 'runCount',
      value: String(stats.count),
      delta: percentChange(stats.count, prevStats.count),
    },
  ] as const;

  return (
    <Card style={styles.statsCard}>
      <Segment
        options={PERIOD_OPTIONS}
        value={period}
        onChange={setPeriod}
        label={(p) => t(`running.history.${p}`)}
        scrollable
      />
      <View style={styles.statsRow}>
        {cards.map((c) => (
          <View
            key={c.key}
            style={[styles.statChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          >
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              {t(`running.history.${c.key}`)}
            </Text>
            <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
              {c.value}
            </Text>
            {showDelta ? <DeltaBadge change={c.delta} style={styles.statDelta} /> : null}
          </View>
        ))}
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section courbe d'allure
// ---------------------------------------------------------------------------

function PaceSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const [window, setWindow] = useState<PaceWindow>('days90');
  const { points, trend } = usePaceTrend(PACE_WINDOWS[window]);

  // Allure convertie vers l'unité d'affichage (secondes par km ou par mile).
  const chartData = points.map((p) => ({
    label: dayKeyToShort(p.dayKey),
    // `label` = abrégé d'axe ; `detail` = date complète affichée dans l'infobulle (UX-01).
    detail: formatDayFull(p.dayKey),
    value: paceToSystem(p.paceSPerKm, units.system),
  }));
  const paceUnitLabel = t('running.history.paceUnit', { unit: units.distanceSymbol });

  return (
    <Card style={styles.paceCard}>
      <Segment
        options={PACE_WINDOW_OPTIONS}
        value={window}
        onChange={setWindow}
        label={(w) => t(`running.history.${w}`)}
      />
      <View style={styles.trendRow}>
        <Text style={[styles.trendLabel, { color: colors.textMuted }]}>
          {t('running.history.trend')}
        </Text>
        <Text style={[styles.trendValue, { color: colors.text }]}>
          {t(TREND_KEY[trend])}
        </Text>
      </View>
      {chartData.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t('running.history.paceEmpty')}
        </Text>
      ) : (
        <ProgressLineChart
          data={chartData}
          unit={paceUnitLabel}
          formatYLabel={(s) => formatPaceMMSS(s, '')}
          smooth
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section liste des courses
// ---------------------------------------------------------------------------

function RunListSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const router = useRouter();
  const { runs } = useRunHistory();

  if (runs.length === 0) {
    return (
      <EmptyState
        icon="walk-outline"
        title={t('running.history.title')}
        message={t('running.history.empty')}
      />
    );
  }

  return (
    <View style={styles.list}>
      {runs.map((run) => (
        <Pressable
          key={run.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/run/summary', params: { id: run.id } })}
          style={({ pressed }) => [
            styles.runRow,
            { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <View style={styles.runInfo}>
            <Text style={[styles.runDate, { color: colors.text }]}>
              {run.finishedAt ? isoToDate(run.finishedAt) : t('running.active.noData')}
            </Text>
            <Text style={[styles.runMeta, { color: colors.textMuted }]}>
              {units.formatDistance(run.distanceM == null ? null : run.distanceM / 1000)}
              {'  ·  '}
              {formatDurationHms(run.durationSeconds)}
              {'  ·  '}
              {units.formatPace(run.avgPaceSPerKm)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Section records d'allure
// ---------------------------------------------------------------------------

/**
 * Records d'allure par distance canonique (1 km → marathon).
 *
 * On itère `RUNNING_RECORD_DISTANCES` (ordre figé) et on cherche le record
 * correspondant : présent → allure (dérivée du meilleur temps : s/km =
 * bestTimeSeconds / (meters / 1000)) + date + tap vers le détail de la course ;
 * absent → libellé + « — », non tappable.
 *
 * Backfill : au montage, si la requête locale est résolue et qu'aucun record
 * n'existe, on rejoue une fois la détection sur l'historique GPS (offline-first,
 * erreurs avalées). Le verrou d'exécution du repo protège des appels concurrents ;
 * le ref local garantit un seul déclenchement par montage de l'écran.
 */
function RecordsSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const router = useRouter();
  const { records, isLoading } = useRunningRecords();

  const backfillTriggered = useRef(false);
  useEffect(() => {
    if (isLoading || records.length > 0 || backfillTriggered.current) return;
    backfillTriggered.current = true;
    backfillRunningRecords().catch((err) => {
      console.warn('[RunningHistory] backfillRunningRecords failed:', err);
    });
  }, [isLoading, records.length]);

  return (
    <View style={styles.list}>
      {RUNNING_RECORD_DISTANCES.map(({ key, meters }) => {
        const record = records.find((r) => r.distanceKey === key);
        const label = t(RECORD_DISTANCE_KEY[key]);

        if (!record) {
          return (
            <View
              key={key}
              style={[styles.runRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.runInfo}>
                <Text style={[styles.runDate, { color: colors.textMuted }]}>{label}</Text>
              </View>
              <Text style={[styles.recordPace, { color: colors.textMuted }]}>
                {t('running.records.none')}
              </Text>
            </View>
          );
        }

        const paceSPerKm = record.bestTimeSeconds / (meters / 1000);
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/run/summary', params: { id: record.runId } })}
            style={({ pressed }) => [
              styles.runRow,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={styles.runInfo}>
              <Text style={[styles.runDate, { color: colors.text }]}>{label}</Text>
              <Text style={[styles.runMeta, { color: colors.textMuted }]}>
                {isoToDate(record.achievedAt)}
              </Text>
            </View>
            <Text style={[styles.recordPace, { color: colors.text }]}>
              {units.formatPace(paceSPerKm)}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 18,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  sectionTitleSpaced: { marginTop: 28 },
  statsCard: { gap: 14 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    alignItems: 'center',
  },
  statLabel: { fontFamily: fontFamily.body, fontSize: 12, textAlign: 'center' },
  statValue: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.2 },
  statDelta: { marginTop: 2 },
  paceCard: { gap: 14 },
  trendRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  trendLabel: { fontFamily: fontFamily.body, fontSize: 13 },
  trendValue: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: 8,
  },
  list: { gap: 10 },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  runInfo: { flex: 1, gap: 4 },
  runDate: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  runMeta: { fontFamily: fontFamily.body, fontSize: 13 },
  recordPace: { fontFamily: fontFamily.displaySemi, fontSize: 15 },
});

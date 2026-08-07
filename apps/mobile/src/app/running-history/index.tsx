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
  computeAcwr,
  formatDurationHms,
  formatPaceMMSS,
  localDayKey,
  paceToSystem,
  formatDayFull,
  percentChange,
  previousPeriodTodayKey,
  resolveRacePredictions,
  RUNNING_RECORD_DISTANCES,
  type AcwrZone,
  type PaceTrendKind,
  type RecordDistanceKey,
  type StatPeriod,
  POLARISATION_REFERENCE_LOW_PCT,
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
  usePolarisation,
} from '@/data/repositories/run-repository';
import {
  backfillRunningRecords,
  useRunningRecords,
} from '@/data/repositories/running-record-repository';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { useUnits } from '@/hooks/useUnits';
import { useWindowStartKey } from '@/hooks/useTodayKey';
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

/** Clé i18n du libellé de zone ACWR (US RUN-18). */
const ACWR_ZONE_KEY: Record<AcwrZone, string> = {
  low: 'running.trainingLoad.zoneLow',
  safe: 'running.trainingLoad.zoneSafe',
  risk: 'running.trainingLoad.zoneRisk',
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

          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced, { color: colors.text }]}>
            {t('running.predictions.title')}
          </Text>
          <PredictionsSection />

          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced, { color: colors.text }]}>
            {t('running.trainingLoad.title')}
          </Text>
          <TrainingLoadSection />

          {/* US ALLURE-01 — polarisation du volume (RUN-08). Rend son propre titre et `null` quand
              elle se tait : moins de 2 courses avec trace sur 4 semaines, ou allure de référence
              absente. Une course ne se « polarise » pas — c'est pourquoi elle vit ici et non sur le
              résumé de course, où les trois autres lectures du lot s'affichent. */}
          <PolarisationSection />
        </ScrollView>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Section polarisation de l'entraînement (US ALLURE-01, catalogue RUN-08)
// ---------------------------------------------------------------------------

/**
 * Répartition du volume entre faible et haute intensité sur 4 semaines.
 *
 * ── On nomme le repère, on ne le prescrit pas (spec D5) ─────────────────────────────────────────
 * Le « 80/20 » de la littérature vaut pour un coureur qui s'entraîne pour **performer** — pas pour
 * quelqu'un qui court trois fois par semaine pour se sentir bien. Le présenter comme un objectif
 * serait faux pour une partie des utilisateurs. Il est donc **affiché comme repère**, jamais comparé,
 * et aucun écart n'est commenté.
 *
 * Rend son propre titre pour pouvoir disparaître **entièrement** quand elle n'a rien à dire — un titre
 * suivi du vide serait pire qu'une absence.
 */
function PolarisationSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { polarisation, isLoading } = usePolarisation();

  if (isLoading || polarisation === null) return null;

  const a11y = [
    t('running.polarisation.title'),
    t('running.polarisation.low', { pct: polarisation.lowIntensityPct }),
    t('running.polarisation.high', { pct: polarisation.highIntensityPct }),
    t('running.polarisation.basis', { km: polarisation.totalKm, count: polarisation.runCount }),
    t('running.polarisation.reference', { pct: POLARISATION_REFERENCE_LOW_PCT }),
  ].join('. ');

  return (
    <>
      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced, { color: colors.text }]}>
        {t('running.polarisation.title')}
      </Text>
      <Card>
        <View accessible accessibilityLabel={a11y}>
          <View style={styles.polarisationRow}>
            <View style={styles.polarisationStat}>
              <Text style={[styles.polarisationLabel, { color: colors.textMuted }]}>
                {t('running.polarisation.lowLabel')}
              </Text>
              <Text style={[styles.polarisationValue, { color: colors.success }]}>
                {polarisation.lowIntensityPct} %
              </Text>
            </View>
            <View style={styles.polarisationStat}>
              <Text style={[styles.polarisationLabel, { color: colors.textMuted }]}>
                {t('running.polarisation.highLabel')}
              </Text>
              <Text style={[styles.polarisationValue, { color: colors.accent }]}>
                {polarisation.highIntensityPct} %
              </Text>
            </View>
          </View>
          {/* Spec R2 — la part n'a de sens qu'avec son volume : « 73 % » sur 12 km ne vaut pas « 73 % »
              sur 142 km, et l'utilisateur doit pouvoir en juger. */}
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('running.polarisation.basis', {
              km: polarisation.totalKm,
              count: polarisation.runCount,
            })}
          </Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('running.polarisation.reference', { pct: POLARISATION_REFERENCE_LOW_PCT })}
          </Text>
        </View>
      </Card>
    </>
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
      {/* Dénivelé cumulé de la période (US RUN-F1b) — même bloc stats, deuxième rangée. */}
      <View style={styles.statsRow}>
        <View
          style={[styles.statChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
        >
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('running.elevation.gainLabel')}
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
            {`+${Math.round(stats.totalElevationGainM)} m`}
          </Text>
        </View>
        <View
          style={[styles.statChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
        >
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('running.elevation.lossLabel')}
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
            {`-${Math.round(stats.totalElevationLossM)} m`}
          </Text>
        </View>
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
// Objectifs estimés (US RUN-14) — formule de Riegel depuis le record des 5 km
// ---------------------------------------------------------------------------

/**
 * Prédictions de temps (10 km / semi / marathon) depuis le record des 5 km. Calcul pur
 * (`resolveRacePredictions`), recalculé à chaque affichage — pas de valeur stockée, un nouveau
 * record 5 km met donc à jour les 3 lignes sans code supplémentaire (spec critère 5).
 *
 * R3 (spec) : une distance qui a déjà un **vrai** record dans `records` n'est jamais prédite ici —
 * c'est `resolveRacePredictions` qui l'écarte, pas ce composant.
 */
function PredictionsSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { records } = useRunningRecords();

  const predictions = resolveRacePredictions(records);

  if (predictions.length === 0) {
    return (
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        {t('running.predictions.empty')}
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {predictions.map((p) => {
        const isMarathon = p.distanceKey === 'marathon';
        return (
          <View
            key={p.distanceKey}
            accessible
            style={[
              styles.predRow,
              isMarathon
                ? { backgroundColor: colors.warn, borderColor: colors.warnBorder }
                : { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.predTop}>
              <Text style={[styles.predDist, { color: colors.text }]}>
                {t(RECORD_DISTANCE_KEY[p.distanceKey])}
              </Text>
              <Text style={[styles.predTime, { color: colors.accent }]}>
                {formatDurationHms(p.predictedSeconds)}
              </Text>
            </View>
            <Text style={[styles.predSrc, { color: colors.textMuted }]}>
              {t('running.predictions.sourceLabel', {
                date: isoToDate(p.sourceAchievedAt),
                time: formatDurationHms(p.sourceTimeSeconds),
              })}
            </Text>
            {isMarathon ? (
              <Text style={[styles.predWarn, { color: colors.warnText }]}>
                {t('running.predictions.marathonWarning')}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Charge d'entraînement (US RUN-18) — ACWR running seul (7 j ÷ 28 j)
// ---------------------------------------------------------------------------

/**
 * Réutilise `computeAcwr` (posé par META-19, `@wellness/shared`) sur les seules courses. Calcul
 * inline, même patron que `PredictionsSection` : `useRunHistory()` est déjà chargée par l'écran,
 * aucun nouveau hook de repository. Contrairement au widget dashboard de META-19 (conditionnel,
 * replié `null` hors zone de risque), cette section affiche les **3 zones** — écran de stats
 * consulté à la demande, pas une alerte (spec §1/R3).
 */
function TrainingLoadSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { runs } = useRunHistory();

  const acuteStartKey = useWindowStartKey(7);
  const chronicStartKey = useWindowStartKey(28);

  const byWindow = (startKey: string) =>
    runs
      .filter((r) => r.finishedAt != null && localDayKey(new Date(r.finishedAt)) >= startKey)
      .map((r) => ({ rpe: r.rpe, durationSeconds: r.durationSeconds }));

  const result = computeAcwr({
    acuteSessions: byWindow(acuteStartKey),
    chronicSessions: byWindow(chronicStartKey),
  });

  if (!result) {
    return (
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        {t('running.trainingLoad.empty')}
      </Text>
    );
  }

  const zoneToneColor =
    result.zone === 'risk' ? colors.warnText : result.zone === 'low' ? colors.success : colors.textMuted;

  return (
    <View style={styles.list}>
      <View
        accessible
        accessibilityLabel={`${t('running.trainingLoad.ratioLabel')} ${result.ratio.toFixed(2)}. ${t(ACWR_ZONE_KEY[result.zone])}`}
        style={[
          styles.predRow,
          result.zone === 'risk'
            ? { backgroundColor: colors.warn, borderColor: colors.warnBorder }
            : { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.predTop}>
          <Text style={[styles.predDist, { color: colors.text }]}>
            {t('running.trainingLoad.ratioLabel')}
          </Text>
          <Text style={[styles.predTime, { color: result.zone === 'risk' ? colors.warnText : colors.accent }]}>
            {result.ratio.toFixed(2)}
          </Text>
        </View>
        <Text style={[styles.predSrc, { color: zoneToneColor }]}>{t(ACWR_ZONE_KEY[result.zone])}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // US ALLURE-01 — aucune hauteur fixe : tout grandit avec la police système (recette à 1,5×).
  polarisationRow: { flexDirection: 'row', gap: 18 },
  polarisationStat: { flex: 1, gap: 1 },
  polarisationLabel: { fontFamily: fontFamily.bodyBold, fontSize: 11 },
  polarisationValue: { fontFamily: fontFamily.bodyBold, fontSize: 24, lineHeight: 29 },
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
  predRow: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  predTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  predDist: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  predTime: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.2 },
  predSrc: { fontFamily: fontFamily.body, fontSize: 12.5 },
  predWarn: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
});

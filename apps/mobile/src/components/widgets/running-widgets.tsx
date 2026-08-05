/**
 * Widgets du hub course (galerie « FitTrio · Widgets »), déclinés aux 3 formes via `WidgetFrame`
 * + primitives : Historique, Programmes, Planning. La map `RUNNING_WIDGETS` est consommée par le hub.
 *
 * Le grand carré Historique remplace la carte + splits/carte GPS du design par une sparkline des
 * distances récentes (dégradation propre tant que les splits/tracé ne sont pas branchés).
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  computeKmSplits,
  decodeTrack,
  formatHoursMinutes,
  localDayKey,
  type RunningWidgetId,
  type WidgetSize,
} from '@wellness/shared';
import { PlanningPreview } from '@/components/PlanningPreview';
import { TrainingTimeCard } from '@/components/dashboard/TrainingTimeCard';
import { MiniBars, Sparkline } from '@/components/widgets/primitives';
import { Eyebrow, Metric, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { useActiveProgram } from '@/data/repositories/program-repository';
import { useRun, useRunHistory } from '@/data/repositories/run-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Date relative courte : « aujourd'hui » / « hier » / JJ/MM. */
function relDay(iso: string | null, t: (k: string) => string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = localDayKey(new Date());
  const key = localDayKey(d);
  if (key === today) return t('common.today');
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === localDayKey(y)) return t('common.yesterday');
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

// ---------------------------------------------------------------------------
// Historique — dernière course (distance · durée · allure)
// ---------------------------------------------------------------------------
function RunningHistoryWidget({ size }: { size: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();
  const { runs } = useRunHistory();
  const lastRun = runs[0] ?? null;
  // Détail de la dernière course (pour la trace GPS → splits/km du grand carré). Hook inconditionnel.
  const { run: lastRunDetail } = useRun(lastRun?.id);
  const open = () => router.push('/running-history');

  const distance = lastRun ? units.formatDistance((lastRun.distanceM ?? 0) / 1000) : '—';
  const duration = lastRun?.durationSeconds != null ? formatHoursMinutes(lastRun.durationSeconds) : '—';
  const pace = units.formatPace(lastRun?.avgPaceSPerKm ?? null);

  if (size === 'small') {
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={t('running.history.title')}>
        <Eyebrow>{t('widgets.running.lastRunEyebrow')}</Eyebrow>
        <View style={styles.smallBottom}>
          {lastRun ? (
            <Metric value={distance} sub={`${relDay(lastRun.finishedAt, t)} · ${duration}`} />
          ) : (
            <Metric value={t('running.history.empty')} muted />
          )}
        </View>
      </WidgetFrame>
    );
  }

  if (!lastRun) {
    const pad = size === 'large' ? 22 : 18;
    return (
      <WidgetFrame pad={pad} onPress={open} accessibilityLabel={t('running.history.title')} style={styles.center}>
        <Eyebrow>{t('widgets.running.lastRunEyebrow')}</Eyebrow>
        <Text style={[styles.metaLine, { color: colors.textMuted }]}>{t('running.history.empty')}</Text>
      </WidgetFrame>
    );
  }

  if (size === 'wide') {
    return (
      <WidgetFrame pad={18} onPress={open} accessibilityLabel={t('running.history.title')} style={styles.wideRow}>
        <StatCol value={distance} label={t('home.runningWeek.distance')} />
        <Divider />
        <StatCol value={duration} label={t('widgets.running.duration')} />
        <Divider />
        <StatCol value={pace} label={t('home.runningWeek.avgPace')} />
      </WidgetFrame>
    );
  }

  // large — splits/km de la dernière course si trace GPS, sinon sparkline des distances récentes.
  const splits = lastRunDetail?.gpsTrack ? computeKmSplits(decodeTrack(lastRunDetail.gpsTrack)) : [];
  const hasSplits = splits.length >= 2;
  const fastestIdx = hasSplits
    ? splits.reduce((mi, s, i) => (s.seconds < splits[mi]!.seconds ? i : mi), 0)
    : -1;
  const series = runs.slice(0, 10).map((r) => (r.distanceM ?? 0) / 1000).reverse();
  return (
    <WidgetFrame pad={22} onPress={open} accessibilityLabel={t('running.history.title')} style={styles.largeCol}>
      <View style={styles.largeHead}>
        <Text style={[styles.largeDistance, { color: colors.text }]}>{distance}</Text>
        <Text style={[styles.metaLine, { color: colors.textMuted }]}>
          {relDay(lastRun.finishedAt, t)} · {duration} · {pace}
        </Text>
      </View>
      {hasSplits ? (
        <>
          <Text style={[styles.splitsEyebrow, { color: colors.textMuted }]}>
            {t('widgets.running.splitsEyebrow')}
          </Text>
          <View style={styles.largeSpark}>
            <MiniBars values={splits.map((s) => s.seconds)} height={110} highlightIndex={fastestIdx} />
          </View>
          <Text style={[styles.footText, { color: colors.textMuted }]}>
            {t('widgets.running.bestKm', { pace: units.formatPace(splits[fastestIdx]!.seconds) })}
          </Text>
        </>
      ) : (
        <>
          {series.length >= 2 ? (
            <View style={styles.largeSpark}>
              <Sparkline values={series} height={130} area showDot strokeWidth={3.5} />
            </View>
          ) : (
            <View style={styles.largeSpark} />
          )}
          <Text style={[styles.footText, { color: colors.textMuted }]}>
            {t('widgets.running.recentDistances')}
          </Text>
        </>
      )}
    </WidgetFrame>
  );
}

// ---------------------------------------------------------------------------
// Programmes — plan running actif
// ---------------------------------------------------------------------------
function RunningProgramsWidget({ size }: { size: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { program } = useActiveProgram('running');
  const open = () => router.push('/running-programs');

  const sub = program?.durationWeeks ? t('programs.weeks', { count: program.durationWeeks }) : program?.goal ?? '';

  if (size === 'small') {
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={t('running.program.myTitle')}>
        <Eyebrow>{t('widgets.running.planEyebrow')}</Eyebrow>
        <View style={styles.smallBottom}>
          {program ? (
            <>
              <Text style={[styles.planName, { color: colors.text }]} numberOfLines={2}>
                {program.name}
              </Text>
              {sub ? <Text style={[styles.progSub, { color: colors.textMuted }]}>{sub}</Text> : null}
            </>
          ) : (
            <Metric value={t('programs.noneActive')} muted />
          )}
        </View>
      </WidgetFrame>
    );
  }

  const pad = size === 'large' ? 22 : 18;
  return (
    <WidgetFrame pad={pad} onPress={open} accessibilityLabel={t('running.program.myTitle')} style={styles.center}>
      <Eyebrow>{t('widgets.running.planActiveEyebrow')}</Eyebrow>
      {program ? (
        <>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {program.name}
          </Text>
          {sub ? <Text style={[styles.metaLine, { color: colors.textMuted }]}>{sub}</Text> : null}
        </>
      ) : (
        <Text style={[styles.metaLine, { color: colors.textMuted }]}>{t('programs.noneActive')}</Text>
      )}
    </WidgetFrame>
  );
}

// ---------------------------------------------------------------------------
// Planning — mini-calendrier (réutilise PlanningPreview)
// ---------------------------------------------------------------------------
function RunningPlanningWidget({ size }: { size: WidgetSize }) {
  const { t } = useTranslation();
  const router = useRouter();
  const open = () => router.push('/planning');
  const pad = size === 'small' ? 16 : size === 'large' ? 22 : 18;
  return (
    <WidgetFrame pad={pad} onPress={open} accessibilityLabel={t('planning.title')} style={styles.center}>
      <Eyebrow>{t('widgets.running.planningEyebrow')}</Eyebrow>
      <PlanningPreview size={size} />
    </WidgetFrame>
  );
}

function StatCol({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.statCol}>
      <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

// ---------------------------------------------------------------------------
// Registre de rendu du hub course
// ---------------------------------------------------------------------------
export const RUNNING_WIDGETS: Record<
  RunningWidgetId,
  (props: { size: WidgetSize }) => React.ReactElement | null
> = {
  'running-history': RunningHistoryWidget,
  'running-programs': RunningProgramsWidget,
  'running-planning': RunningPlanningWidget,
  // US INSIGHTS-02 : même carte que sur le hub muscu — elle ventile les deux piliers et se rend
  // partiellement, donc un coureur seul doit y avoir accès.
  'running-training-time': TrainingTimeCard,
};

const styles = StyleSheet.create({
  smallBottom: { marginTop: 'auto', gap: 2 },
  center: { justifyContent: 'center', gap: 6 },
  metaLine: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  planName: { fontFamily: fontFamily.displayXBold, fontSize: 26, letterSpacing: -0.8, lineHeight: 28 },
  progSub: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 20, letterSpacing: -0.4 },
  wideRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statCol: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: fontFamily.displayXBold, fontSize: 26, letterSpacing: -1 },
  statLabel: { fontFamily: fontFamily.body, fontSize: 11 },
  divider: { width: 1, alignSelf: 'stretch', marginVertical: 4 },
  largeCol: { gap: 0 },
  largeHead: { gap: 2 },
  largeDistance: { fontFamily: fontFamily.displayXBold, fontSize: 34, letterSpacing: -1.2 },
  splitsEyebrow: {
    fontFamily: fontFamily.monoBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 14,
  },
  largeSpark: { flex: 1, marginVertical: 14, justifyContent: 'center' },
  footText: { fontFamily: fontFamily.mono, fontSize: 11, marginTop: 'auto' },
});

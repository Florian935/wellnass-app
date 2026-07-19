/**
 * Widgets du hub course (US Widgets multi-formes) — issus des `ModulePreviewCard`
 * historiques de `(tabs)/running.tsx`, déclinés aux 3 formes (voir `strength-widgets`).
 * La map `RUNNING_WIDGETS` est consommée par `WidgetGrid` via le hub course.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RunningWidgetId, WidgetSize } from '@wellness/shared';
import { ModulePreviewCard } from '@/components/ModulePreviewCard';
import { PlanningPreview } from '@/components/PlanningPreview';
import { WidgetShell } from '@/components/widgets/WidgetShell';
import { useActiveProgram } from '@/data/repositories/program-repository';
import { useRunHistory } from '@/data/repositories/run-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

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
  const open = () => router.push('/running-history');

  const distance = lastRun ? units.formatDistance((lastRun.distanceM ?? 0) / 1000) : '—';

  if (size === 'small') {
    return (
      <WidgetShell
        icon="time-outline"
        title={t('running.history.title')}
        onPress={open}
        value={lastRun ? distance : t('running.history.empty')}
        valueMuted={!lastRun}
      />
    );
  }

  const body = lastRun ? (
    <View style={styles.runRow}>
      <Text style={[styles.runMetric, { color: colors.text }]}>{distance}</Text>
      <Text style={[styles.runDot, { color: colors.textMuted }]}>·</Text>
      <Text style={[styles.runMetric, { color: colors.text }]}>
        {lastRun.durationSeconds != null
          ? t('history.row.durationMin', { count: Math.round(lastRun.durationSeconds / 60) })
          : '—'}
      </Text>
      <Text style={[styles.runDot, { color: colors.textMuted }]}>·</Text>
      <Text style={[styles.runMetric, { color: colors.text }]}>
        {units.formatPace(lastRun.avgPaceSPerKm)}
      </Text>
    </View>
  ) : (
    <Text style={[styles.cardText, { color: colors.textMuted }]}>
      {t('running.history.empty')}
    </Text>
  );

  if (size === 'large') {
    return (
      <WidgetShell
        icon="time-outline"
        title={t('running.history.title')}
        onPress={open}
        showChevron
      >
        {body}
      </WidgetShell>
    );
  }

  return (
    <ModulePreviewCard icon="time-outline" title={t('running.history.title')} onPress={open}>
      {body}
    </ModulePreviewCard>
  );
}

// ---------------------------------------------------------------------------
// Programmes — programme running actif
// ---------------------------------------------------------------------------
function RunningProgramsWidget({ size }: { size: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { program } = useActiveProgram('running');
  const open = () => router.push('/running-programs');

  if (size === 'small') {
    return (
      <WidgetShell
        icon="list-outline"
        title={t('running.program.myTitle')}
        onPress={open}
        value={program ? program.name : t('programs.noneActive')}
        valueMuted={!program}
      />
    );
  }

  const activeRow = program ? (
    <View style={styles.activeProgramRow}>
      <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
      <Text style={[styles.activeProgramName, { color: colors.text }]} numberOfLines={1}>
        {program.name}
      </Text>
    </View>
  ) : (
    <Text style={[styles.cardText, { color: colors.textMuted }]}>
      {t('programs.noneActive')}
    </Text>
  );

  if (size === 'large') {
    return (
      <WidgetShell
        icon="list-outline"
        title={t('running.program.myTitle')}
        onPress={open}
        showChevron
      >
        {activeRow}
      </WidgetShell>
    );
  }

  return (
    <ModulePreviewCard icon="list-outline" title={t('running.program.myTitle')} onPress={open}>
      {activeRow}
    </ModulePreviewCard>
  );
}

// ---------------------------------------------------------------------------
// Planning — mini-calendrier 7 jours
// ---------------------------------------------------------------------------
function RunningPlanningWidget({ size }: { size: WidgetSize }) {
  const { t } = useTranslation();
  const router = useRouter();
  const open = () => router.push('/planning');

  if (size === 'wide') {
    return (
      <ModulePreviewCard icon="calendar-outline" title={t('planning.title')} onPress={open}>
        <PlanningPreview size="wide" />
      </ModulePreviewCard>
    );
  }

  return (
    <WidgetShell
      icon="calendar-outline"
      title={t('planning.title')}
      onPress={open}
      showChevron={size === 'large'}
    >
      <PlanningPreview size={size} />
    </WidgetShell>
  );
}

// ---------------------------------------------------------------------------
// Registre de rendu du hub course
// ---------------------------------------------------------------------------
export const RUNNING_WIDGETS: Record<
  RunningWidgetId,
  (props: { size: WidgetSize }) => React.ReactElement
> = {
  'running-history': RunningHistoryWidget,
  'running-programs': RunningProgramsWidget,
  'running-planning': RunningPlanningWidget,
};

const styles = StyleSheet.create({
  cardText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  activeProgramRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  activeProgramName: { fontFamily: fontFamily.bodySemi, fontSize: 14, flex: 1 },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  runMetric: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  runDot: { fontFamily: fontFamily.body, fontSize: 15 },
});

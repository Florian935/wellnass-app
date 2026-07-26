/**
 * Widgets du hub muscu (galerie « FitTrio · Widgets »), déclinés aux 3 formes via `WidgetFrame`
 * + primitives : Programmes, Historique, Planning, Progression. Chaque widget lit ses données
 * (repositories réactifs) et gère sa navigation. La map `STRENGTH_WIDGETS` est consommée par le hub.
 *
 * Données disponibles limitées côté historique (date + durée) et programme (nom, durée, niveau) :
 * les formes riches dégradent proprement (pas de nom de séance / tonnage / % de semaine tant que
 * ces données ne sont pas branchées).
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { percentChange, type StrengthWidgetId, type WidgetSize } from '@wellness/shared';
import { PlanningPreview } from '@/components/PlanningPreview';
import { Sparkline } from '@/components/widgets/primitives';
import { Chip, Eyebrow, Metric, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { useActiveProgram } from '@/data/repositories/program-repository';
import { useWorkoutHistory, type WorkoutHistoryItem } from '@/data/repositories/workout-repository';
import { useWeeklyVolumeComparison, useWeeklyVolumeSeries } from '@/data/repositories/records-repository';
import { useWorkoutTemplates } from '@/data/repositories/workout-template-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/color-utils';

/** Formate une date ISO (UTC) en JJ/MM local. */
function formatDayMonth(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

// ---------------------------------------------------------------------------
// Programmes — programme actif
// ---------------------------------------------------------------------------
function StrengthProgramsWidget({ size }: { size: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { program } = useActiveProgram('strength');
  const open = () => router.push('/programs');

  const sub = program?.durationWeeks
    ? t('programs.weeks', { count: program.durationWeeks })
    : program?.goal ?? program?.level ?? '';

  if (size === 'small') {
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={t('programs.title')}>
        <Eyebrow>{t('widgets.strength.programEyebrow')}</Eyebrow>
        <View style={styles.smallBottom}>
          {program ? (
            <>
              <Text style={[styles.progName, { color: colors.text }]} numberOfLines={2}>
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
    <WidgetFrame pad={pad} onPress={open} accessibilityLabel={t('programs.title')} style={styles.centerCol}>
      <Eyebrow>{t('widgets.strength.programActiveEyebrow')}</Eyebrow>
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
// Historique — dernières séances
// ---------------------------------------------------------------------------
function StrengthHistoryWidget({ size }: { size: WidgetSize }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { workouts } = useWorkoutHistory();
  const open = () => router.push('/history');

  const durationLabel = (s: number | null | undefined) =>
    s != null ? t('history.row.durationMin', { count: Math.round(s / 60) }) : '—';
  // Tonnage en tonnes (1 décimale, séparateur localisé) ; vide si aucun.
  const tonLabel = (kg: number) =>
    kg > 0
      ? t('widgets.strength.tonnage', {
          value: new Intl.NumberFormat(i18n.language, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(kg / 1000),
        })
      : null;

  if (size === 'small') {
    const last = workouts[0] ?? null;
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={t('history.title')}>
        <Eyebrow>{t('widgets.strength.lastEyebrow')}</Eyebrow>
        <View style={styles.smallBottom}>
          {last ? (
            <Metric value={formatDayMonth(last.startedAt)} sub={durationLabel(last.durationSeconds)} />
          ) : (
            <Metric value={t('history.subtitle')} muted />
          )}
        </View>
      </WidgetFrame>
    );
  }

  const count = size === 'large' ? 4 : 2;
  const recent = workouts.slice(0, count);
  const pad = size === 'large' ? 22 : 16;

  return (
    <WidgetFrame pad={pad} onPress={open} accessibilityLabel={t('history.title')} style={styles.listCol}>
      <Eyebrow>{t('widgets.strength.recentEyebrow', { count })}</Eyebrow>
      {recent.length > 0 ? (
        <View style={styles.list}>
          {recent.map((w: WorkoutHistoryItem) => (
            <View key={w.id} style={[styles.histRow, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <View style={[styles.dateTile, { backgroundColor: withAlpha(colors.accent, 0.12) }]}>
                <Text style={[styles.dateTileText, { color: colors.accent }]}>{formatDayMonth(w.startedAt)}</Text>
              </View>
              <Text style={[styles.histMeta, { color: colors.textMuted }]}>{durationLabel(w.durationSeconds)}</Text>
              {tonLabel(w.volumeKg) ? (
                <Text style={[styles.histTon, { color: colors.text }]}>{tonLabel(w.volumeKg)}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.metaLine, { color: colors.textMuted }]}>{t('history.subtitle')}</Text>
      )}
    </WidgetFrame>
  );
}

// ---------------------------------------------------------------------------
// Planning — mini-calendrier (réutilise PlanningPreview)
// ---------------------------------------------------------------------------
function StrengthPlanningWidget({ size }: { size: WidgetSize }) {
  const { t } = useTranslation();
  const router = useRouter();
  const open = () => router.push('/planning');
  const pad = size === 'small' ? 16 : size === 'large' ? 22 : 18;
  return (
    <WidgetFrame pad={pad} onPress={open} accessibilityLabel={t('planning.title')} style={styles.centerCol}>
      <Eyebrow>{t('widgets.strength.planningEyebrow')}</Eyebrow>
      <PlanningPreview size={size} />
    </WidgetFrame>
  );
}

// ---------------------------------------------------------------------------
// Progression — volume de la semaine + variation
// ---------------------------------------------------------------------------
function StrengthProgressWidget({ size }: { size: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();
  const { current, previous } = useWeeklyVolumeComparison();
  // Série de tonnage sur 8 semaines glissantes → sparkline multi-points (au lieu d'une diagonale 2 points).
  const { series } = useWeeklyVolumeSeries(8);
  const open = () => router.push('/progress');

  const hasVolume = current > 0;
  const volumeStr = hasVolume ? units.formatWeight(Math.round(current)) : '—';
  const change = previous > 0 ? percentChange(current, previous) : null;
  const deltaLabel =
    change?.pct != null ? `${change.pct >= 0 ? '▲ +' : '▼ '}${Math.abs(change.pct)} %` : null;
  const hasSeries = series.some((v) => v > 0);

  if (size === 'small') {
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={t('progress.title')}>
        <Eyebrow>{t('widgets.strength.progressEyebrow')}</Eyebrow>
        {hasSeries ? (
          <View style={styles.smallSpark}>
            <Sparkline values={series} height={38} />
          </View>
        ) : null}
        <View style={styles.smallBottom}>
          <Metric value={volumeStr} muted={!hasVolume} />
        </View>
      </WidgetFrame>
    );
  }

  if (size === 'wide') {
    return (
      <WidgetFrame pad={18} onPress={open} accessibilityLabel={t('progress.title')} style={styles.wideRow}>
        <View style={styles.wideLeft}>
          <Eyebrow>{t('widgets.strength.progressEyebrow')}</Eyebrow>
          <Text style={[styles.progValue, { color: colors.text }]}>{volumeStr}</Text>
          {deltaLabel ? (
            <Text style={[styles.progDelta, { color: change!.direction === 'down' ? colors.textMuted : colors.success }]}>
              {deltaLabel}
            </Text>
          ) : null}
        </View>
        {hasSeries ? (
          <View style={styles.wideSpark}>
            <Sparkline values={series} height={80} showDot />
          </View>
        ) : null}
      </WidgetFrame>
    );
  }

  // large
  return (
    <WidgetFrame pad={22} onPress={open} accessibilityLabel={t('progress.title')} style={styles.progressLargeCol}>
      <View style={styles.progressHead}>
        <Eyebrow>{t('widgets.strength.progressTotalEyebrow')}</Eyebrow>
        {deltaLabel ? <Chip label={deltaLabel} tone={change!.direction === 'down' ? 'neutral' : 'success'} /> : null}
      </View>
      <Text style={[styles.progLargeValue, { color: colors.text }]}>{volumeStr}</Text>
      <Text style={[styles.metaLine, { color: colors.textMuted }]}>{t('progress.weeklyVolume.title')}</Text>
      {hasSeries ? (
        <View style={styles.progLargeSpark}>
          <Sparkline values={series} height={130} area showDot strokeWidth={3.5} />
        </View>
      ) : (
        <View style={styles.progLargeSpark} />
      )}
    </WidgetFrame>
  );
}

// ---------------------------------------------------------------------------
// Templates — point d'entrée permanent vers « Mes templates » (US Refonte-D)
// ---------------------------------------------------------------------------
function StrengthTemplatesWidget({ size }: { size: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { templates } = useWorkoutTemplates();
  const open = () => router.push('/templates');

  if (size === 'small') {
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={t('templates.title')}>
        <Eyebrow>{t('widgets.strength.templatesEyebrow')}</Eyebrow>
        <View style={styles.smallBottom}>
          {templates.length > 0 ? (
            <Metric value={t('templates.countLabel', { count: templates.length })} />
          ) : (
            <Metric value={t('templates.emptyList')} muted />
          )}
        </View>
      </WidgetFrame>
    );
  }

  const count = size === 'large' ? 4 : 2;
  const preview = templates.slice(0, count);
  const pad = size === 'large' ? 22 : 16;

  return (
    <WidgetFrame pad={pad} onPress={open} accessibilityLabel={t('templates.title')} style={styles.listCol}>
      <Eyebrow>{t('widgets.strength.templatesEyebrow')}</Eyebrow>
      {preview.length > 0 ? (
        <View style={styles.list}>
          {preview.map((tpl) => (
            <View key={tpl.id} style={[styles.tplRow, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[styles.tplName, { color: colors.text }]} numberOfLines={1}>
                {tpl.name}
              </Text>
              <Text style={[styles.histMeta, { color: colors.textMuted }]}>
                {t('templates.exerciseCount', { count: tpl.exerciseCount })}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.metaLine, { color: colors.textMuted }]}>{t('templates.emptyList')}</Text>
      )}
    </WidgetFrame>
  );
}

// ---------------------------------------------------------------------------
// Registre de rendu du hub muscu
// ---------------------------------------------------------------------------
export const STRENGTH_WIDGETS: Record<
  StrengthWidgetId,
  (props: { size: WidgetSize }) => React.ReactElement
> = {
  'strength-programs': StrengthProgramsWidget,
  'strength-history': StrengthHistoryWidget,
  'strength-planning': StrengthPlanningWidget,
  'strength-progress': StrengthProgressWidget,
  'strength-templates': StrengthTemplatesWidget,
};

const styles = StyleSheet.create({
  smallBottom: { marginTop: 'auto', gap: 2 },
  centerCol: { justifyContent: 'center', gap: 6 },
  listCol: { gap: 12 },
  progName: { fontFamily: fontFamily.displayBold, fontSize: 22, letterSpacing: -0.6, lineHeight: 25 },
  progSub: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 20, letterSpacing: -0.4 },
  metaLine: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  list: { gap: 10 },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateTile: { borderRadius: 11, paddingHorizontal: 10, paddingVertical: 6 },
  dateTileText: { fontFamily: fontFamily.monoBold, fontSize: 12 },
  histMeta: { fontFamily: fontFamily.body, fontSize: 12.5, flex: 1 },
  histTon: { fontFamily: fontFamily.monoBold, fontSize: 13 },
  tplRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tplName: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 14 },
  smallSpark: { marginTop: 12 },
  wideRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  wideLeft: { flexShrink: 0 },
  progValue: { fontFamily: fontFamily.displayXBold, fontSize: 30, letterSpacing: -1.1, marginTop: 4 },
  progDelta: { fontFamily: fontFamily.bodyBold, fontSize: 12.5, marginTop: 2 },
  wideSpark: { flex: 1 },
  progressLargeCol: { gap: 4 },
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progLargeValue: { fontFamily: fontFamily.displayXBold, fontSize: 40, letterSpacing: -1.5, marginTop: 6 },
  progLargeSpark: { flex: 1, marginTop: 12, justifyContent: 'center' },
});

/**
 * Widgets du hub muscu (US Widgets multi-formes) — issus des `ModulePreviewCard`
 * historiques de `(tabs)/strength.tsx`, déclinés aux 3 formes :
 *  - `wide`  : rectangle pleine largeur = `ModulePreviewCard` (rendu d'origine) ;
 *  - `small` : petit carré = `WidgetShell` (titre + chiffre clé) ;
 *  - `large` : grand carré = `WidgetShell` (en-tête + contenu développé).
 *
 * Chaque widget lit ses propres données (repositories réactifs) et gère sa navigation.
 * La map `STRENGTH_WIDGETS` est consommée par `WidgetGrid` via le hub muscu.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { percentChange, type StrengthWidgetId, type WidgetSize } from '@wellness/shared';
import { DeltaBadge } from '@/components/DeltaBadge';
import { ModulePreviewCard } from '@/components/ModulePreviewCard';
import { PlanningPreview } from '@/components/PlanningPreview';
import { WidgetShell } from '@/components/widgets/WidgetShell';
import { useActiveProgram } from '@/data/repositories/program-repository';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';
import { useWeeklyVolumeComparison } from '@/data/repositories/records-repository';
import { useWorkoutTemplates } from '@/data/repositories/workout-template-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

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

  if (size === 'small') {
    return (
      <WidgetShell
        icon="list-outline"
        title={t('programs.title')}
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
      {program.durationWeeks ? (
        <Text style={[styles.metaRight, { color: colors.textMuted }]}>
          {t('programs.weeks', { count: program.durationWeeks })}
        </Text>
      ) : null}
    </View>
  ) : (
    <Text style={[styles.cardText, { color: colors.textMuted }]}>
      {t('programs.noneActive')}
    </Text>
  );

  if (size === 'large') {
    return (
      <WidgetShell icon="list-outline" title={t('programs.title')} onPress={open} showChevron>
        {activeRow}
      </WidgetShell>
    );
  }

  return (
    <ModulePreviewCard icon="list-outline" title={t('programs.title')} onPress={open}>
      {activeRow}
    </ModulePreviewCard>
  );
}

// ---------------------------------------------------------------------------
// Planning — mini-calendrier 7 jours
// ---------------------------------------------------------------------------
function StrengthPlanningWidget({ size }: { size: WidgetSize }) {
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
// Historique — dernières séances
// ---------------------------------------------------------------------------
function StrengthHistoryWidget({ size }: { size: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { workouts } = useWorkoutHistory();
  const open = () => router.push('/history');

  const durationLabel = (durationSeconds: number | null | undefined) =>
    durationSeconds != null
      ? t('history.row.durationMin', { count: Math.round(durationSeconds / 60) })
      : '—';

  if (size === 'small') {
    const last = workouts[0] ?? null;
    return (
      <WidgetShell
        icon="time-outline"
        title={t('history.title')}
        onPress={open}
        value={last ? formatDayMonth(last.startedAt) : t('history.subtitle')}
        valueMuted={!last}
      />
    );
  }

  const count = size === 'large' ? 4 : 2;
  const recent = workouts.slice(0, count);
  const list =
    recent.length > 0 ? (
      <View style={styles.previewList}>
        {recent.map((w) => (
          <View key={w.id} style={styles.previewRow}>
            <Text style={[styles.previewRowLabel, { color: colors.text }]}>
              {formatDayMonth(w.startedAt)}
            </Text>
            <Text style={[styles.previewRowMeta, { color: colors.textMuted }]}>
              {durationLabel(w.durationSeconds)}
            </Text>
          </View>
        ))}
      </View>
    ) : (
      <Text style={[styles.cardText, { color: colors.textMuted }]}>
        {t('history.subtitle')}
      </Text>
    );

  if (size === 'large') {
    return (
      <WidgetShell icon="time-outline" title={t('history.title')} onPress={open} showChevron>
        {list}
      </WidgetShell>
    );
  }

  return (
    <ModulePreviewCard icon="time-outline" title={t('history.title')} onPress={open}>
      {list}
    </ModulePreviewCard>
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
  const { current: weekVolume, previous: prevVolume } = useWeeklyVolumeComparison();
  const open = () => router.push('/progress');

  const hasVolume = weekVolume > 0;
  const volumeText = hasVolume ? units.formatWeight(Math.round(weekVolume)) : '—';

  if (size === 'small') {
    return (
      <WidgetShell
        icon="trending-up-outline"
        title={t('progress.title')}
        onPress={open}
        value={hasVolume ? volumeText : t('progress.weeklyVolume.emptyTitle')}
        valueMuted={!hasVolume}
      />
    );
  }

  const body = hasVolume ? (
    <View style={styles.volumeRow}>
      <View style={styles.volumeText}>
        <Text style={[styles.previewRowMeta, { color: colors.textMuted }]}>
          {t('progress.weeklyVolume.title')}
        </Text>
        <Text style={[styles.volumeValue, { color: colors.text }]}>{volumeText}</Text>
      </View>
      {prevVolume > 0 ? <DeltaBadge change={percentChange(weekVolume, prevVolume)} /> : null}
    </View>
  ) : (
    <Text style={[styles.cardText, { color: colors.textMuted }]}>
      {t('progress.weeklyVolume.emptyTitle')}
    </Text>
  );

  if (size === 'large') {
    return (
      <WidgetShell
        icon="trending-up-outline"
        title={t('progress.title')}
        onPress={open}
        showChevron
      >
        {body}
      </WidgetShell>
    );
  }

  return (
    <ModulePreviewCard icon="trending-up-outline" title={t('progress.title')} onPress={open}>
      {body}
    </ModulePreviewCard>
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
      <WidgetShell
        icon="albums-outline"
        title={t('templates.title')}
        onPress={open}
        value={
          templates.length > 0
            ? t('templates.countLabel', { count: templates.length })
            : t('templates.emptyList')
        }
        valueMuted={templates.length === 0}
      />
    );
  }

  const count = size === 'large' ? 4 : 2;
  const preview = templates.slice(0, count);
  const list =
    preview.length > 0 ? (
      <View style={styles.previewList}>
        {preview.map((tpl) => (
          <View key={tpl.id} style={styles.previewRow}>
            <Text style={[styles.previewRowLabel, { color: colors.text }]} numberOfLines={1}>
              {tpl.name}
            </Text>
            <Text style={[styles.previewRowMeta, { color: colors.textMuted }]}>
              {t('templates.exerciseCount', { count: tpl.exerciseCount })}
            </Text>
          </View>
        ))}
      </View>
    ) : (
      <Text style={[styles.cardText, { color: colors.textMuted }]}>{t('templates.emptyList')}</Text>
    );

  if (size === 'large') {
    return (
      <WidgetShell icon="albums-outline" title={t('templates.title')} onPress={open} showChevron>
        {list}
      </WidgetShell>
    );
  }

  return (
    <ModulePreviewCard icon="albums-outline" title={t('templates.title')} onPress={open}>
      {list}
    </ModulePreviewCard>
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
  cardText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  activeProgramRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  activeProgramName: { fontFamily: fontFamily.bodySemi, fontSize: 14, flex: 1 },
  metaRight: { fontFamily: fontFamily.body, fontSize: 12 },
  previewList: { gap: 6 },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewRowLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  previewRowMeta: { fontFamily: fontFamily.body, fontSize: 13 },
  volumeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  volumeText: { gap: 2 },
  volumeValue: { fontFamily: fontFamily.displaySemi, fontSize: 18 },
});

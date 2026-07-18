import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { percentChange } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DeltaBadge } from '@/components/DeltaBadge';
import { ModulePreviewCard } from '@/components/ModulePreviewCard';
import { PlanningPreview } from '@/components/PlanningPreview';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  startWorkout,
  useActiveWorkout,
  useWorkoutHistory,
} from '@/data/repositories/workout-repository';
import { useActiveProgram } from '@/data/repositories/program-repository';
import { useWeeklyVolumeComparison } from '@/data/repositories/records-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Formate une date ISO (UTC) en JJ/MM local. */
function formatDayMonth(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export default function StrengthScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();
  const { workout: active } = useActiveWorkout();
  const { workouts } = useWorkoutHistory();
  const { program: activeProgram } = useActiveProgram('strength');
  const { current: weekVolume, previous: prevVolume } = useWeeklyVolumeComparison();

  const onStart = async () => {
    await startWorkout();
    router.push('/workout');
  };

  const recentWorkouts = workouts.slice(0, 2);

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('pillars.strength')} subtitle={t('pillarScreens.strength.tagline')} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Carte d'action : reprendre / démarrer une séance (pas un module-lien). */}
        {active ? (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="barbell" size={18} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('workout.resumeTitle')}
              </Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {t('workout.exerciseCount', { count: active.entries.length })}
            </Text>
            <Button label={t('workout.resume')} onPress={() => router.push('/workout')} />
          </Card>
        ) : (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="flash-outline" size={18} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('workout.freeTitle')}
              </Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {t('workout.freeSubtitle')}
            </Text>
            <Button label={t('workout.startFree')} onPress={onStart} />
          </Card>
        )}

        {/* Module Programmes — aperçu : programme actif. */}
        <ModulePreviewCard
          icon="list-outline"
          title={t('programs.title')}
          onPress={() => router.push('/programs')}
        >
          {activeProgram ? (
            <View style={styles.activeProgramRow}>
              <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
              <Text style={[styles.activeProgramName, { color: colors.text }]} numberOfLines={1}>
                {activeProgram.name}
              </Text>
              {activeProgram.durationWeeks ? (
                <Text style={[styles.metaRight, { color: colors.textMuted }]}>
                  {t('programs.weeks', { count: activeProgram.durationWeeks })}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {t('programs.noneActive')}
            </Text>
          )}
        </ModulePreviewCard>

        {/* Module Mon planning — aperçu : mini-calendrier 4 prochains jours. */}
        <ModulePreviewCard
          icon="calendar-outline"
          title={t('planning.title')}
          onPress={() => router.push('/planning')}
        >
          <PlanningPreview />
        </ModulePreviewCard>

        {/* Module Historique — aperçu : 2 dernières séances. */}
        <ModulePreviewCard
          icon="time-outline"
          title={t('history.title')}
          onPress={() => router.push('/history')}
        >
          {recentWorkouts.length > 0 ? (
            <View style={styles.previewList}>
              {recentWorkouts.map((w) => (
                <View key={w.id} style={styles.previewRow}>
                  <Text style={[styles.previewRowLabel, { color: colors.text }]}>
                    {formatDayMonth(w.startedAt)}
                  </Text>
                  <Text style={[styles.previewRowMeta, { color: colors.textMuted }]}>
                    {w.durationSeconds != null
                      ? t('history.row.durationMin', { count: Math.round(w.durationSeconds / 60) })
                      : '—'}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {t('history.subtitle')}
            </Text>
          )}
        </ModulePreviewCard>

        {/* Module Progression — aperçu : volume de la semaine + variation. */}
        <ModulePreviewCard
          icon="trending-up-outline"
          title={t('progress.title')}
          onPress={() => router.push('/progress')}
        >
          {weekVolume > 0 ? (
            <View style={styles.volumeRow}>
              <View style={styles.volumeText}>
                <Text style={[styles.previewRowMeta, { color: colors.textMuted }]}>
                  {t('progress.weeklyVolume.title')}
                </Text>
                <Text style={[styles.volumeValue, { color: colors.text }]}>
                  {units.formatWeight(Math.round(weekVolume))}
                </Text>
              </View>
              {prevVolume > 0 ? (
                <DeltaBadge change={percentChange(weekVolume, prevVolume)} />
              ) : null}
            </View>
          ) : (
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {t('progress.weeklyVolume.emptyTitle')}
            </Text>
          )}
        </ModulePreviewCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 14, paddingBottom: 24 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.3 },
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

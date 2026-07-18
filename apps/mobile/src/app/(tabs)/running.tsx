import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ModulePreviewCard } from '@/components/ModulePreviewCard';
import { PlanningPreview } from '@/components/PlanningPreview';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useActiveProgram } from '@/data/repositories/program-repository';
import { useActiveRun, useRunHistory } from '@/data/repositories/run-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function RunningScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();
  const { run: active } = useActiveRun();
  const { settings } = useSettings();
  const runningActive = settings?.activePillars.includes('running') ?? false;
  const { program: activeProgram } = useActiveProgram('running');
  const { runs } = useRunHistory();
  const lastRun = runs[0] ?? null;

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('pillars.running')} subtitle={t('pillarScreens.running.tagline')} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Carte d'action : reprendre / démarrer une course (pas un module-lien). */}
        {active ? (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="walk" size={18} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('running.resume.title')}
              </Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {t('running.resume.subtitle')}
            </Text>
            <Button label={t('running.resume.cta')} onPress={() => router.push('/run/active')} />
          </Card>
        ) : (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="navigate-outline" size={18} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('running.start.title')}
              </Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {t('running.start.subtitle')}
            </Text>
            <Button label={t('running.start.startCta')} onPress={() => router.push('/run')} />
          </Card>
        )}

        {runningActive ? (
          <>
            {/* Module Mes programmes — aperçu : programme running actif. */}
            <ModulePreviewCard
              icon="list-outline"
              title={t('running.program.myTitle')}
              onPress={() => router.push('/running-programs')}
            >
              {activeProgram ? (
                <View style={styles.activeProgramRow}>
                  <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
                  <Text
                    style={[styles.activeProgramName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {activeProgram.name}
                  </Text>
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

            {/* Module Historique — aperçu : dernière course (distance · durée · allure). */}
            <ModulePreviewCard
              icon="time-outline"
              title={t('running.history.title')}
              onPress={() => router.push('/running-history')}
            >
              {lastRun ? (
                <View style={styles.runRow}>
                  <Text style={[styles.runMetric, { color: colors.text }]}>
                    {units.formatDistance((lastRun.distanceM ?? 0) / 1000)}
                  </Text>
                  <Text style={[styles.runDot, { color: colors.textMuted }]}>·</Text>
                  <Text style={[styles.runMetric, { color: colors.text }]}>
                    {lastRun.durationSeconds != null
                      ? t('history.row.durationMin', {
                          count: Math.round(lastRun.durationSeconds / 60),
                        })
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
              )}
            </ModulePreviewCard>
          </>
        ) : null}
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
  runRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  runMetric: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  runDot: { fontFamily: fontFamily.body, fontSize: 15 },
});

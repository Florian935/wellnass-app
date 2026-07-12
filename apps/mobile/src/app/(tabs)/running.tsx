import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useActiveRun } from '@/data/repositories/run-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function RunningScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { run: active } = useActiveRun();
  const { settings } = useSettings();
  const runningActive = settings?.activePillars.includes('running') ?? false;

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('pillars.running')} subtitle={t('pillarScreens.running.tagline')} />

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
        <Card style={styles.programsCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="list-outline" size={18} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {t('running.program.myTitle')}
            </Text>
          </View>
          <Button
            label={t('running.program.myTitle')}
            variant="ghost"
            onPress={() => router.push('/running-programs')}
          />
          <Button
            label={t('running.planning.title')}
            variant="ghost"
            onPress={() => router.push('/running-planning')}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.3 },
  cardText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  programsCard: { marginTop: 12 },
});

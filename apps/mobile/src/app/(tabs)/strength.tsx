import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  startWorkout,
  useActiveWorkout,
  useWorkoutHistory,
} from '@/data/repositories/workout-repository';
import { useActiveProgram } from '@/data/repositories/program-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function StrengthScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { workout: active } = useActiveWorkout();
  const { workouts } = useWorkoutHistory();
  const historyCount = workouts.length;
  const { program: activeProgram } = useActiveProgram('strength');

  const onStart = async () => {
    await startWorkout();
    router.push('/workout');
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('pillars.strength')} subtitle={t('pillarScreens.strength.tagline')} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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

      <Card>
        <View style={styles.cardHeader}>
          <Ionicons name="list-outline" size={18} color={colors.accent} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {t('programs.title')}
          </Text>
        </View>
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
            {t('programs.subtitle')}
          </Text>
        )}
        <Button label={t('programs.browseLibrary')} variant="ghost" onPress={() => router.push('/programs')} />
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <Ionicons name="calendar-outline" size={18} color={colors.accent} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {t('planning.title')}
          </Text>
        </View>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          {t('planning.subtitle')}
        </Text>
        <Button
          label={t('planning.title')}
          variant="ghost"
          onPress={() => router.push('/planning')}
        />
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <Ionicons name="time-outline" size={18} color={colors.accent} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {t('history.title')}
          </Text>
        </View>
        {historyCount > 0 ? (
          <Text style={[styles.cardText, { color: colors.textMuted }]}>
            {t('workout.historyCount', { count: historyCount })}
          </Text>
        ) : (
          <Text style={[styles.cardText, { color: colors.textMuted }]}>
            {t('history.subtitle')}
          </Text>
        )}
        <Button
          label={t('history.title')}
          variant="ghost"
          onPress={() => router.push('/history')}
        />
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <Ionicons name="trending-up-outline" size={18} color={colors.accent} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {t('progress.title')}
          </Text>
        </View>
        <Text style={[styles.cardText, { color: colors.textMuted }]}>
          {t('progress.strengthCardSubtitle')}
        </Text>
        <Button
          label={t('progress.title')}
          variant="ghost"
          onPress={() => router.push('/progress')}
        />
      </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 14, paddingBottom: 24 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.3 },
  cardText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  history: { fontFamily: fontFamily.body, fontSize: 13, textAlign: 'center', marginTop: 8 },
  activeProgramRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  activeProgramName: { fontFamily: fontFamily.bodySemi, fontSize: 14, flex: 1 },
});

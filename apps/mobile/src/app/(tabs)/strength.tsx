import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useWorkoutStore } from '@/stores/workout-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function StrengthScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const active = useWorkoutStore((s) => s.active);
  const start = useWorkoutStore((s) => s.start);
  const historyCount = useWorkoutStore((s) => s.history.length);

  const onStart = () => {
    start();
    router.push('/workout');
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('pillars.strength')} subtitle={t('pillarScreens.strength.tagline')} />

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

      {historyCount > 0 ? (
        <Text style={[styles.history, { color: colors.textMuted }]}>
          {t('workout.historyCount', { count: historyCount })}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.3 },
  cardText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  history: { fontFamily: fontFamily.body, fontSize: 13, textAlign: 'center', marginTop: 8 },
});

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormScreen } from '@/components/FormScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useWorkoutStore, type CompletedWorkout } from '@/stores/workout-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

function stats(workout: CompletedWorkout) {
  let doneSets = 0;
  let volume = 0;
  for (const entry of workout.entries) {
    for (const set of entry.sets) {
      if (set.done) {
        doneSets += 1;
        volume += (set.reps ?? 0) * (set.weightKg ?? 0);
      }
    }
  }
  const durationMin = Math.max(
    1,
    Math.round((new Date(workout.finishedAt).getTime() - new Date(workout.startedAt).getTime()) / 60000),
  );
  return { exercises: workout.entries.length, doneSets, volume: Math.round(volume), durationMin };
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export default function WorkoutSummaryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const last = useWorkoutStore((s) => s.history[0]);

  return (
    <FormScreen>
      <ScreenHeader title={t('workout.summary.title')} subtitle={t('workout.summary.subtitle')} />
      {last ? (
        <Card>
          {(() => {
            const s = stats(last);
            return (
              <>
                <Row label={t('workout.summary.duration')} value={t('workout.summary.minutes', { count: s.durationMin })} />
                <Row label={t('workout.summary.exercises')} value={String(s.exercises)} />
                <Row label={t('workout.summary.sets')} value={String(s.doneSets)} />
                <Row label={t('workout.summary.volume')} value={`${s.volume} kg`} />
              </>
            );
          })()}
        </Card>
      ) : (
        <Text style={[styles.empty, { color: colors.textMuted }]}>{t('workout.none')}</Text>
      )}
      <View style={styles.footer}>
        <Button label={t('workout.backHome')} onPress={() => router.replace('/(tabs)')} />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontFamily: fontFamily.body, fontSize: 15 },
  rowValue: { fontFamily: fontFamily.displaySemi, fontSize: 17 },
  empty: { fontFamily: fontFamily.body, fontSize: 15, textAlign: 'center' },
  footer: { marginTop: 'auto' },
});

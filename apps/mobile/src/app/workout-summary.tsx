import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { computeVolume } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormScreen } from '@/components/FormScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  getWorkoutSets,
  useWorkoutHistory,
} from '@/data/repositories/workout-repository';
import { powerSync } from '@/powersync/system';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Récapitulatif calculé à partir de la séance terminée et de ses séries. */
type Summary = {
  exercises: number;
  doneSets: number;
  volume: number;
  durationMin: number;
};

/**
 * Nombre d'exercices distincts d'une séance terminée.
 *
 * `getWorkoutSets` n'expose pas `exercise_id` sur ses items (il est réservé au
 * regroupement interne du repository) ; on lit donc le décompte des exercices
 * distincts directement en lecture seule sur la base locale.
 */
async function countExercises(workoutId: string): Promise<number> {
  const row = await powerSync.getOptional<{ n: number }>(
    `SELECT COUNT(DISTINCT exercise_id) AS n FROM workout_sets
     WHERE workout_id = ? AND deleted_at IS NULL`,
    [workoutId],
  );
  return row?.n ?? 0;
}

async function buildSummary(
  workoutId: string,
  durationSeconds: number | null,
): Promise<Summary> {
  const sets = await getWorkoutSets(workoutId);
  const doneSets = sets.filter((s) => s.done).length;
  const volume = Math.round(computeVolume(sets));
  const durationMin = Math.max(1, Math.round((durationSeconds ?? 0) / 60));
  const exercises = await countExercises(workoutId);
  return { exercises, doneSets, volume, durationMin };
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
  const { id } = useLocalSearchParams<{ id?: string }>();

  const { workouts } = useWorkoutHistory();
  const workout = workouts.find((w) => w.id === id) ?? null;
  const durationSeconds = workout?.durationSeconds ?? null;

  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!id || !workout) {
      return;
    }
    let cancelled = false;
    void buildSummary(id, durationSeconds).then((result) => {
      if (!cancelled) {
        setSummary(result);
      }
    });
    return () => {
      cancelled = true;
    };
    // On dépend de primitives stables (id, durée) plutôt que de l'objet `workout`,
    // dont l'identité change à chaque rendu de `useWorkoutHistory`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, durationSeconds]);

  return (
    <FormScreen>
      <ScreenHeader title={t('workout.summary.title')} subtitle={t('workout.summary.subtitle')} />
      {summary ? (
        <Card>
          <Row
            label={t('workout.summary.duration')}
            value={t('workout.summary.minutes', { count: summary.durationMin })}
          />
          <Row label={t('workout.summary.exercises')} value={String(summary.exercises)} />
          <Row label={t('workout.summary.sets')} value={String(summary.doneSets)} />
          <Row label={t('workout.summary.volume')} value={`${summary.volume} kg`} />
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

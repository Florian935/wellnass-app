import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import {
  addSet,
  cancelWorkout,
  removeSet,
  updateSet,
  useActiveWorkout,
  type WorkoutSetItem,
} from '@/data/repositories/workout-repository';
import { finishWorkoutAndEvaluate } from '@/data/repositories/records-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const REST_SECONDS = 90;

/** Fin du repos (module scope : évite un appel à `Date.now()` analysé « pendant le rendu »). */
function nextRestEnd(): number {
  return Date.now() + REST_SECONDS * 1000;
}

function useElapsed(startedAt: string | undefined): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!startedAt) return '00:00';
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function WorkoutScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { workout: active } = useActiveWorkout();

  const elapsed = useElapsed(active?.startedAt);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restLeft, setRestLeft] = useState(0);

  useEffect(() => {
    if (restEndsAt === null) return;
    const tick = () => {
      const left = Math.ceil((restEndsAt - Date.now()) / 1000);
      if (left <= 0) {
        setRestEndsAt(null);
        setRestLeft(0);
      } else {
        setRestLeft(left);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [restEndsAt]);

  if (!active) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('workout.none')}</Text>
          <Button label={t('workout.backHome')} onPress={() => router.replace('/(tabs)')} />
        </View>
      </SafeAreaView>
    );
  }

  const workoutId = active.id;
  const toNum = (v: string) => (v.trim() === '' ? null : Number(v));

  const onValidate = (set: WorkoutSetItem) => {
    const nextDone = !set.done;
    void updateSet(set.id, { done: nextDone });
    if (nextDone) {
      setRestEndsAt(nextRestEnd());
    }
  };

  const onFinish = async () => {
    // Termine la séance PUIS évalue les records (records lus par le résumé via
    // useWorkoutRecords, pas via l'état du routeur) avant de naviguer.
    await finishWorkoutAndEvaluate(workoutId);
    router.replace({ pathname: '/workout-summary', params: { id: workoutId } });
  };

  const onCancel = async () => {
    await cancelWorkout(workoutId);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={10} accessibilityLabel={t('common.cancel')}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={[styles.timer, { color: colors.text }]}>{elapsed}</Text>
        <Pressable onPress={onFinish} hitSlop={10}>
          <Text style={[styles.finish, { color: colors.accent }]}>{t('workout.finish')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {active.entries.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('workout.empty')}</Text>
        ) : null}

        {active.entries.map((entry) => (
          <View
            key={entry.exerciseId}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.exName, { color: colors.text }]}>{entry.exerciseName}</Text>

            <View style={styles.setsHeader}>
              <Text style={[styles.colSet, styles.muted, { color: colors.textMuted }]}>{t('workout.set')}</Text>
              <Text style={[styles.colInput, styles.muted, { color: colors.textMuted }]}>{t('workout.reps')}</Text>
              <Text style={[styles.colInput, styles.muted, { color: colors.textMuted }]}>{t('workout.weight')}</Text>
              <View style={styles.colActions} />
            </View>

            {entry.sets.map((set, si) => (
              <View key={set.id} style={styles.setRow}>
                <Text style={[styles.colSet, { color: colors.text }]}>{si + 1}</Text>
                <View style={styles.colInput}>
                  <TextField
                    label=""
                    value={set.reps?.toString() ?? ''}
                    onChangeText={(v) => void updateSet(set.id, { reps: toNum(v) })}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.colInput}>
                  <TextField
                    label=""
                    value={set.weightKg?.toString() ?? ''}
                    onChangeText={(v) => void updateSet(set.id, { weightKg: toNum(v) })}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.colActions}>
                  <Pressable onPress={() => onValidate(set)} hitSlop={6}>
                    <Ionicons
                      name={set.done ? 'checkmark-circle' : 'ellipse-outline'}
                      size={26}
                      color={set.done ? colors.success : colors.textMuted}
                    />
                  </Pressable>
                  <Pressable onPress={() => void removeSet(set.id)} hitSlop={6}>
                    <Ionicons name="remove-circle-outline" size={22} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            ))}

            <Button
              label={t('workout.addSet')}
              variant="ghost"
              onPress={() => void addSet(workoutId, entry.exerciseId)}
            />
          </View>
        ))}

        <Button label={t('workout.addExercise')} onPress={() => router.push('/exercises')} />
      </ScrollView>

      {restEndsAt !== null ? (
        <View style={[styles.rest, { backgroundColor: colors.accent }]}>
          <Text style={[styles.restText, { color: colors.accentText }]}>
            {t('workout.rest', { seconds: restLeft })}
          </Text>
          <Pressable onPress={() => setRestEndsAt(null)} hitSlop={8}>
            <Text style={[styles.restSkip, { color: colors.accentText }]}>{t('workout.skipRest')}</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  timer: { fontFamily: fontFamily.monoBold, fontSize: 20 },
  finish: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  content: { padding: 20, gap: 16 },
  hint: { fontFamily: fontFamily.body, fontSize: 14, textAlign: 'center' },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  exName: { fontFamily: fontFamily.displaySemi, fontSize: 17, letterSpacing: -0.3 },
  setsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muted: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  colSet: { width: 28, fontFamily: fontFamily.monoBold, fontSize: 15, textAlign: 'center' },
  colInput: { flex: 1 },
  colActions: { width: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  emptyText: { fontFamily: fontFamily.body, fontSize: 15, textAlign: 'center' },
  rest: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  restText: { fontFamily: fontFamily.monoBold, fontSize: 16 },
  restSkip: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
});

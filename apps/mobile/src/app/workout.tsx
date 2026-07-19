import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { CurrentSetCard } from '@/components/workout/CurrentSetCard';
import { ExerciseList } from '@/components/workout/ExerciseList';
import { RestOverlay } from '@/components/workout/RestOverlay';
import {
  cancelWorkout,
  finishWorkout,
  updateSet,
  useActiveWorkout,
  useLastPerformance,
  useSessionRest,
  type WorkoutEntry,
} from '@/data/repositories/workout-repository';
import { evaluateWorkoutRecords } from '@/data/repositories/records-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useUnits } from '@/hooks/useUnits';

/** Repos par défaut (s) quand l'exercice n'a ni override de session ni valeur planifiée. */
const DEFAULT_REST_SECONDS = 90;

/** Série courante résolue : l'exercice, la série et le rang (0-based) dans l'exercice. */
type CurrentSet = { entry: WorkoutEntry; set: WorkoutEntry['sets'][number]; rang: number };

/**
 * Résout la « série en cours » (machine à états de focus, C1) :
 *  - si `focusOverride` désigne un exercice ayant encore une série non validée,
 *    la 1ʳᵉ série non validée de CET exercice ;
 *  - sinon la 1ʳᵉ série `done===false` en parcourant exercices puis séries dans l'ordre ;
 *  - `null` si toutes les séries de tous les exercices sont validées (état de fin).
 */
function resolveCurrentSet(entries: WorkoutEntry[], focusOverride: string | null): CurrentSet | null {
  const firstUndone = (entry: WorkoutEntry): CurrentSet | null => {
    for (let rang = 0; rang < entry.sets.length; rang += 1) {
      const set = entry.sets[rang];
      if (set && !set.done) return { entry, set, rang };
    }
    return null;
  };

  if (focusOverride) {
    const entry = entries.find((e) => e.exerciseId === focusOverride);
    const found = entry ? firstUndone(entry) : null;
    if (found) return found;
  }
  for (const entry of entries) {
    const found = firstUndone(entry);
    if (found) return found;
  }
  return null;
}

/** État d'édition local des champs de la série courante (`null` = non modifié → repli). */
type EditState = { reps: string; weightKg: number | null };

type Units = ReturnType<typeof useUnits>;

/**
 * Formate la dernière performance d'un exercice : « 80 kg × 8/8/7 » si toutes les
 * séries ont le même poids, sinon « 80×8, 82.5×8 ». `null` si aucune donnée.
 */
function formatLastPerf(
  perf: { weightKg: number | null; reps: number | null }[],
  units: Units,
): string | null {
  const first = perf[0];
  if (!first) return null;
  const repsLabel = (r: number | null) => (r == null ? '—' : String(r));
  const allSameWeight = perf.every((p) => p.weightKg === first.weightKg);

  if (allSameWeight) {
    const w = first.weightKg;
    const prefix = w == null ? '' : `${units.weightInputValue(w)} ${units.weightSymbol} × `;
    return `${prefix}${perf.map((p) => repsLabel(p.reps)).join('/')}`;
  }
  return perf
    .map((p) => {
      const w = p.weightKg == null ? '' : units.weightInputValue(p.weightKg);
      return w === '' ? repsLabel(p.reps) : `${w}×${repsLabel(p.reps)}`;
    })
    .join(', ');
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
  useKeepAwake();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const router = useRouter();

  const { workout: active } = useActiveWorkout();

  // Tous les hooks sont appelés avant tout retour anticipé (règle des hooks) :
  // `active` peut être null, les dérivés retombent alors sur des valeurs neutres.
  const elapsed = useElapsed(active?.startedAt);
  const sessionRest = useSessionRest(active?.sessionId ?? null);

  const [focusOverride, setFocusOverride] = useState<string | null>(null);
  const [restOverride, setRestOverride] = useState<Record<string, number>>({});
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restLeft, setRestLeft] = useState(0);
  // État d'édition rattaché à l'id de la série : dès que la série courante change,
  // il cesse de correspondre et l'affichage repart des valeurs pré-remplies (pas
  // besoin d'effet de resynchronisation).
  const [edit, setEdit] = useState<{ setId: string; state: EditState } | null>(null);

  const entries = active?.entries ?? [];
  const current = resolveCurrentSet(entries, focusOverride);
  const currentExerciseId = current?.entry.exerciseId ?? '';

  // Dernière perf de l'exercice courant (requête stable : '' → aucune ligne).
  const lastPerf = useLastPerformance(currentExerciseId);

  // Décompte du repos : recalcule le restant chaque seconde ; à 0 → vibration + fin.
  useEffect(() => {
    if (restEndsAt === null) return;
    const tick = () => {
      const left = Math.ceil((restEndsAt - Date.now()) / 1000);
      if (left <= 0) {
        Vibration.vibrate();
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

  const currentSetId = current?.set.id;

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

  // Valeurs pré-remplies (série puis dernière perf au même rang), avant édition.
  const rang = current?.rang ?? 0;
  const prefillReps = current ? (current.set.reps ?? lastPerf[rang]?.reps ?? null) : null;
  const prefillWeightKg = current ? (current.set.weightKg ?? lastPerf[rang]?.weightKg ?? null) : null;

  // Édition ne valant que pour la série courante (sinon on repart du pré-remplissage).
  const activeEdit = edit && edit.setId === currentSetId ? edit.state : null;

  // Valeurs affichées : l'édition en cours prime, sinon repli sur le pré-remplissage.
  const displayReps = activeEdit ? activeEdit.reps : prefillReps == null ? '' : String(prefillReps);
  const displayWeightKg = activeEdit ? activeEdit.weightKg : prefillWeightKg;

  // Matérialise l'état d'édition à partir des valeurs affichées puis applique le patch.
  const applyEdit = (patch: Partial<EditState>) => {
    if (!currentSetId) return;
    setEdit({
      setId: currentSetId,
      state: {
        reps: activeEdit?.reps ?? displayReps,
        weightKg: activeEdit ? activeEdit.weightKg : displayWeightKg,
        ...patch,
      },
    });
  };

  const restSecondsFor = (exerciseId: string) =>
    restOverride[exerciseId] ?? sessionRest[exerciseId] ?? DEFAULT_REST_SECONDS;
  const currentRest = current ? restSecondsFor(current.entry.exerciseId) : DEFAULT_REST_SECONDS;

  const onStepRest = (delta: number) => {
    if (!current) return;
    const exerciseId = current.entry.exerciseId;
    setRestOverride((prev) => ({
      ...prev,
      [exerciseId]: Math.max(0, restSecondsFor(exerciseId) + delta),
    }));
  };

  const onValidate = () => {
    if (!current) return;
    const parsed = Number(displayReps);
    const reps = displayReps.trim() === '' || Number.isNaN(parsed) ? null : parsed;
    void updateSet(current.set.id, { reps, weightKg: displayWeightKg, done: true });
    setRestEndsAt(Date.now() + currentRest * 1000);
    setFocusOverride(null);
  };

  const confirmAbandon = () => {
    Alert.alert(t('workout.leave.abandonConfirmTitle'), t('workout.leave.abandonConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('workout.leave.abandonConfirm'),
        style: 'destructive',
        onPress: async () => {
          await cancelWorkout(workoutId);
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const onLeave = () => {
    Alert.alert(t('workout.leave.title'), undefined, [
      { text: t('workout.leave.continue'), style: 'cancel' },
      { text: t('workout.leave.pause'), onPress: () => router.replace('/(tabs)') },
      { text: t('workout.leave.abandon'), style: 'destructive', onPress: confirmAbandon },
    ]);
  };

  const doFinish = async () => {
    // 1. Clôture de la séance : doit réussir (statut 'completed').
    await finishWorkout(workoutId);
    // 2. Évaluation des records : enrichissement best-effort. Un échec ne doit
    //    jamais bloquer la navigation (le résumé lit les records de façon réactive).
    try {
      await evaluateWorkoutRecords(workoutId);
    } catch (error) {
      console.warn('Échec du calcul des records (ignoré, best-effort) :', error);
    }
    // 3. Navigation vers le résumé, quoi qu'il advienne à l'étape 2.
    router.replace({ pathname: '/workout-summary', params: { id: workoutId } });
  };

  const hasAnyDone = entries.some((entry) => entry.sets.some((set) => set.done));

  const onFinish = () => {
    if (!hasAnyDone) {
      Alert.alert(t('workout.finishNoSetsTitle'), t('workout.finishNoSetsMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('workout.finishAnyway'), onPress: () => void doFinish() },
      ]);
      return;
    }
    void doFinish();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onLeave} hitSlop={10} accessibilityLabel={t('workout.leave.title')}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={[styles.timer, { color: colors.text }]}>{elapsed}</Text>
        <Pressable onPress={onFinish} hitSlop={10}>
          <Text style={[styles.finish, { color: colors.accent }]}>{t('workout.finish')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {entries.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('workout.empty')}</Text>
        ) : current ? (
          <CurrentSetCard
            exerciseName={current.entry.exerciseName}
            currentIndex={current.rang + 1}
            totalSets={current.entry.sets.length}
            lastPerfLabel={formatLastPerf(lastPerf, units)}
            repsValue={displayReps}
            onChangeReps={(v) => applyEdit({ reps: v })}
            weightValue={units.weightInputValue(displayWeightKg)}
            weightSymbol={units.weightSymbol}
            weightPlaceholder={t(
              units.system === 'imperial' ? 'workout.weightPlaceholderImperial' : 'workout.weightPlaceholderMetric',
            )}
            onChangeWeight={(v) => applyEdit({ weightKg: units.parseWeightToKg(v) })}
            onStepWeight={(deltaKg) => applyEdit({ weightKg: Math.max(0, (displayWeightKg ?? 0) + deltaKg) })}
            restSeconds={currentRest}
            onStepRest={onStepRest}
            onValidate={onValidate}
            colors={colors}
          />
        ) : (
          <View style={[styles.doneCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.doneTitle, { color: colors.text }]}>{t('workout.sessionDone')}</Text>
            <Text style={[styles.doneHint, { color: colors.textMuted }]}>{t('workout.sessionDoneHint')}</Text>
          </View>
        )}

        {entries.length > 0 ? (
          <ExerciseList
            entries={entries}
            currentExerciseId={currentExerciseId}
            onSelect={setFocusOverride}
            colors={colors}
          />
        ) : null}

        <Button label={t('workout.addExercise')} onPress={() => router.push('/exercises')} />
      </ScrollView>

      {restEndsAt !== null ? (
        <RestOverlay
          secondsLeft={restLeft}
          onSkip={() => setRestEndsAt(null)}
          onExtend={() => setRestEndsAt((e) => (e ?? Date.now()) + 15000)}
        />
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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  emptyText: { fontFamily: fontFamily.body, fontSize: 15, textAlign: 'center' },
  doneCard: { borderRadius: 18, borderWidth: 1, padding: 24, gap: 8, alignItems: 'center' },
  doneTitle: { fontFamily: fontFamily.displaySemi, fontSize: 20, letterSpacing: -0.3 },
  doneHint: { fontFamily: fontFamily.body, fontSize: 14, textAlign: 'center' },
});

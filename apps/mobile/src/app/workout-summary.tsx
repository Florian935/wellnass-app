import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { computeVolume } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormScreen } from '@/components/FormScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import {
  getWorkoutSets,
  setWorkoutFeedback,
  useWorkoutHistory,
} from '@/data/repositories/workout-repository';
import {
  useWorkoutRecords,
  type BeatenRecord,
} from '@/data/repositories/records-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Récapitulatif calculé à partir de la séance terminée et de ses séries. */
type Summary = {
  exercises: number;
  doneSets: number;
  volume: number;
  durationMin: number;
};

async function buildSummary(
  workoutId: string,
  durationSeconds: number | null,
): Promise<Summary> {
  const sets = await getWorkoutSets(workoutId);
  const doneSets = sets.filter((s) => s.done).length;
  const volume = Math.round(computeVolume(sets));
  const durationMin = Math.max(1, Math.round((durationSeconds ?? 0) / 60));
  const exercises = new Set(sets.map((s) => s.exerciseId)).size;
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

/** Carte de célébration pour un record personnel battu. */
function RecordCard({ record }: { record: BeatenRecord }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const typeLabel = t(`workout.summary.records.type.${record.type}`, record.type);
  const valueLabel =
    record.type === 'best_volume'
      ? `${record.value}`
      : units.formatWeight(record.value);
  return (
    <View
      style={[
        styles.recordCard,
        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.recordIcon]}>🏆</Text>
      <View style={styles.recordBody}>
        <Text style={[styles.recordExercise, { color: colors.text }]} numberOfLines={1}>
          {record.exerciseName}
        </Text>
        <Text style={[styles.recordMeta, { color: colors.textMuted }]}>
          {typeLabel} · {valueLabel}
        </Text>
      </View>
    </View>
  );
}

/**
 * Section "Ressenti" — 5 étoiles tappables (RPE borné 1-5) + note de séance,
 * éditables a posteriori. Ne monte qu'une fois la séance chargée (`workout`
 * non nul) : l'état local est initialisé une seule fois depuis `workout.rpe` /
 * `workout.notes` (le composant est démonté/remonté via sa `key` si l'id de
 * séance change côté parent), puis reste la source de vérité pour l'affichage
 * pendant que l'utilisateur édite.
 */
function FeelingSection({
  workoutId,
  initialRpe,
  initialNotes,
}: {
  workoutId: string;
  initialRpe: number | null;
  initialNotes: string | null;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [rpe, setRpe] = useState(initialRpe);
  const [notes, setNotes] = useState(initialNotes ?? '');

  // Ressenti affiché borné 1-5 (0/absent = aucune étoile pleine) — voir spec.
  const displayRpe = Math.min(5, Math.max(0, rpe ?? 0));

  function handleRate(value: number) {
    setRpe(value);
    void setWorkoutFeedback(workoutId, { rpe: value });
  }

  function handleNotesBlur() {
    const trimmed = notes.trim();
    void setWorkoutFeedback(workoutId, { notes: trimmed.length > 0 ? notes : null });
  }

  return (
    <View style={styles.feelingSection}>
      <Text style={[styles.recordsSectionTitle, { color: colors.text }]}>
        {t('workout.summary.feeling')}
      </Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((value) => {
          const filled = displayRpe >= value;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={t('workout.summary.starLabel', { count: value })}
              onPress={() => handleRate(value)}
              hitSlop={8}
            >
              <Ionicons
                name={filled ? 'star' : 'star-outline'}
                size={30}
                color={filled ? colors.accent : colors.textMuted}
              />
            </Pressable>
          );
        })}
      </View>
      <TextField
        label={t('workout.summary.note')}
        placeholder={t('workout.summary.notePlaceholder')}
        value={notes}
        onChangeText={setNotes}
        onBlur={handleNotesBlur}
        multiline
        numberOfLines={4}
        style={styles.noteInput}
      />
    </View>
  );
}

/** Section "Records battus" — rendu uniquement si des records existent. */
function RecordsSection({ workoutId }: { workoutId: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { records, isLoading } = useWorkoutRecords(workoutId);

  // Ne rien afficher pendant le chargement (évite le flash "section vide").
  if (isLoading) return null;
  if (records.length === 0) return null;

  return (
    <View style={styles.recordsSection}>
      <Text style={[styles.recordsSectionTitle, { color: colors.text }]}>
        {t('workout.summary.records.sectionTitle')}
      </Text>
      {records.map((record) => (
        <RecordCard key={`${record.exerciseId}-${record.type}`} record={record} />
      ))}
    </View>
  );
}

export default function WorkoutSummaryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
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
          <Row label={t('workout.summary.volume')} value={units.formatWeight(summary.volume)} />
        </Card>
      ) : (
        <Text style={[styles.empty, { color: colors.textMuted }]}>{t('workout.none')}</Text>
      )}
      {workout ? (
        <FeelingSection
          key={workout.id}
          workoutId={workout.id}
          initialRpe={workout.rpe}
          initialNotes={workout.notes}
        />
      ) : null}
      {id ? <RecordsSection workoutId={id} /> : null}
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
  // Records section
  recordsSection: { gap: 10 },
  recordsSectionTitle: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 16,
    marginBottom: 2,
  },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  recordIcon: { fontSize: 22 },
  recordBody: { flex: 1, gap: 2 },
  recordExercise: { fontFamily: fontFamily.displaySemi, fontSize: 15 },
  recordMeta: { fontFamily: fontFamily.body, fontSize: 13 },
  // Feeling section (ressenti + note)
  feelingSection: { gap: 10 },
  starsRow: { flexDirection: 'row', gap: 8 },
  noteInput: { minHeight: 90, textAlignVertical: 'top', paddingTop: 14 },
});

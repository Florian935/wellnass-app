import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  useWorkoutDetail,
  useWorkoutRecords,
  type WorkoutDetail,
  type BeatenRecord,
} from '@/data/repositories/records-repository';
import type { WorkoutEntry, WorkoutSetItem } from '@/data/repositories/workout-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
// ---------------------------------------------------------------------------
// Formatage de date JJ/MM/AAAA
// ---------------------------------------------------------------------------

function formatDateFr(isoString: string): string {
  const d = new Date(isoString);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ---------------------------------------------------------------------------
// Écran principal
// ---------------------------------------------------------------------------

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = typeof id === 'string' ? id : '';
  return <WorkoutDetailView workoutId={workoutId} />;
}

// ---------------------------------------------------------------------------
// Vue principale
// ---------------------------------------------------------------------------

function WorkoutDetailView({ workoutId }: { workoutId: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { detail, isLoading: detailLoading } = useWorkoutDetail(workoutId);
  const { records, isLoading: recordsLoading } = useWorkoutRecords(workoutId);

  const isLoading = detailLoading || recordsLoading;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading && !detail) {
    return (
      <Screen edges={['top']} center>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  // ── Séance introuvable ────────────────────────────────────────────────────
  if (!detail) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader
          title={t('history.detail.notFoundTitle')}
          action={
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={24} color={colors.accent} />
            </Pressable>
          }
        />
        <Text style={[styles.notFound, { color: colors.textMuted }]}>
          {t('history.detail.notFoundMessage')}
        </Text>
      </Screen>
    );
  }

  const dateLabel = formatDateFr(detail.finishedAt ?? detail.startedAt);

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={dateLabel}
        action={
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <Ionicons name="arrow-back" size={24} color={colors.accent} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Métadonnées */}
        <MetaRow detail={detail} />

        {/* Exercices */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('history.detail.sectionExercises')}
        </Text>

        {detail.entries.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('history.detail.emptyExercises')}
          </Text>
        ) : (
          <View style={styles.exerciseList}>
            {detail.entries.map((entry) => (
              <ExerciseCard key={entry.exerciseId} entry={entry} />
            ))}
          </View>
        )}

        {/* Records battus */}
        {records.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced, { color: colors.text }]}>
              {t('history.detail.sectionRecords')}
            </Text>
            <View style={styles.recordList}>
              {records.map((rec) => (
                <RecordRow key={`${rec.exerciseId}-${rec.type}`} record={rec} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Métadonnées (durée, volume, RPE, notes)
// ---------------------------------------------------------------------------

function MetaRow({ detail }: { detail: WorkoutDetail }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const items: { label: string; value: string }[] = [];

  if (detail.durationSeconds != null) {
    items.push({
      label: t('history.detail.metaDuration'),
      value: t('history.detail.durationMin', {
        count: Math.round(detail.durationSeconds / 60),
      }),
    });
  }
  if (detail.volume > 0) {
    items.push({
      label: t('history.detail.metaVolume'),
      value: t('history.detail.volumeKg', { volume: Math.round(detail.volume) }),
    });
  }
  if (detail.rpe != null) {
    items.push({
      label: t('history.detail.metaRpe'),
      value: String(detail.rpe),
    });
  }

  return (
    <View style={styles.metaContainer}>
      {items.map((item) => (
        <View
          key={item.label}
          style={[styles.metaChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>{item.label}</Text>
          <Text style={[styles.metaValue, { color: colors.text }]}>{item.value}</Text>
        </View>
      ))}
      {detail.notes ? (
        <View style={[styles.notesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
            {t('history.detail.metaNotes')}
          </Text>
          <Text style={[styles.notesText, { color: colors.text }]}>{detail.notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Carte d'exercice (nom + séries)
// ---------------------------------------------------------------------------

function ExerciseCard({ entry }: { entry: WorkoutEntry }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.exerciseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.exerciseHeader}>
        <Ionicons name="barbell-outline" size={14} color={colors.accent} />
        <Text style={[styles.exerciseName, { color: colors.text }]} numberOfLines={1}>
          {entry.exerciseName}
        </Text>
      </View>
      <View style={styles.setList}>
        {entry.sets.map((set, idx) => (
          <SetRow key={set.id} set={set} index={idx} />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Ligne de série (numéro + type + reps × charge)
// ---------------------------------------------------------------------------

function SetRow({ set, index }: { set: WorkoutSetItem; index: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const setTypeLabelMap: Record<string, string> = {
    normal: t('history.detail.setNormal'),
    warmup: t('history.detail.setWarmup'),
    superset: t('history.detail.setSuperset'),
    duration: t('history.detail.setDuration'),
    bodyweight: t('history.detail.setBodyweight'),
  };
  const typeLabel = setTypeLabelMap[set.setType] ?? t('history.detail.setNormal');

  let valueLabel: string;
  if (set.reps != null && set.weightKg != null) {
    valueLabel = t('history.detail.repsWeight', { reps: set.reps, kg: set.weightKg });
  } else if (set.reps != null) {
    valueLabel = t('history.detail.repsOnly', { reps: set.reps });
  } else if (set.weightKg != null) {
    valueLabel = t('history.detail.weightOnly', { kg: set.weightKg });
  } else if (set.durationSeconds != null) {
    valueLabel = `${set.durationSeconds}s`;
  } else {
    valueLabel = '—';
  }

  return (
    <View style={styles.setRow}>
      <Text style={[styles.setIndex, { color: colors.textMuted }]}>{index + 1}</Text>
      <Text style={[styles.setType, { color: colors.textMuted }]}>{typeLabel}</Text>
      <Text style={[styles.setValue, { color: colors.text }]}>{valueLabel}</Text>
      {set.done ? (
        <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
      ) : (
        <Ionicons name="ellipse-outline" size={14} color={colors.border} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Ligne de record battu
// ---------------------------------------------------------------------------

function RecordRow({ record }: { record: BeatenRecord }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const typeLabel = t(`history.detail.record.${record.type}`);

  const valueParts: string[] = [];
  if (record.reps != null && record.weightKg != null) {
    valueParts.push(t('history.detail.repsWeight', { reps: record.reps, kg: record.weightKg }));
  } else if (record.weightKg != null) {
    valueParts.push(t('history.detail.volumeKg', { volume: Math.round(record.value) }));
  } else {
    valueParts.push(String(Math.round(record.value)));
  }

  return (
    <View style={[styles.recordRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.recordLeft}>
        <Ionicons name="trophy-outline" size={14} color={colors.accent} />
        <View style={styles.recordTexts}>
          <Text style={[styles.recordExercise, { color: colors.text }]} numberOfLines={1}>
            {record.exerciseName}
          </Text>
          <Text style={[styles.recordType, { color: colors.textMuted }]}>{typeLabel}</Text>
        </View>
      </View>
      <Text style={[styles.recordValue, { color: colors.accent }]}>{valueParts.join(' · ')}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  notFound: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  metaChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
    minWidth: 80,
  },
  notesCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
    width: '100%',
  },
  metaLabel: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 15,
  },
  notesText: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 18,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  sectionTitleSpaced: {
    marginTop: 28,
  },
  exerciseList: { gap: 12 },
  exerciseCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exerciseName: {
    flex: 1,
    fontFamily: fontFamily.bodySemi,
    fontSize: 15,
  },
  setList: { gap: 6 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setIndex: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    width: 16,
    textAlign: 'right',
  },
  setType: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    width: 48,
  },
  setValue: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: 14,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },
  recordList: { gap: 8 },
  recordRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  recordLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordTexts: {
    flex: 1,
    gap: 2,
  },
  recordExercise: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 14,
  },
  recordType: {
    fontFamily: fontFamily.body,
    fontSize: 12,
  },
  recordValue: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 14,
    flexShrink: 0,
  },
});

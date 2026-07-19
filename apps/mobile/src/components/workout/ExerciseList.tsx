import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamily } from '@/theme/fonts';
import type { Palette } from '@/theme/colors';
import type { WorkoutEntry, WorkoutSetItem } from '@/data/repositories/workout-repository';
import { useUnits } from '@/hooks/useUnits';

type ExerciseListProps = {
  entries: WorkoutEntry[];
  currentExerciseId: string;
  onSelect: (exerciseId: string) => void;
  /** Dé-valide une série déjà validée (sans relancer le repos, spec §2.2). */
  onToggleSetDone: (setId: string, currentDone: boolean) => void;
  /** Retire une série de l'exercice (soft delete). */
  onRemoveSet: (setId: string) => void;
  /** Ajoute une série pré-remplie à la fin de l'exercice. */
  onAddSet: (exerciseId: string) => void;
  colors: Palette;
};

/** « {reps} × {charge} », `—` pour les valeurs manquantes. */
function formatSetLine(set: WorkoutSetItem, units: ReturnType<typeof useUnits>): string {
  const repsLabel = set.reps == null ? '—' : String(set.reps);
  return `${repsLabel} × ${units.formatWeight(set.weightKg)}`;
}

/**
 * Liste des exercices de la séance (C1) : un rang par exercice avec sa
 * progression « {faites}/{total} », dépliable pour retrouver la gestion des
 * séries (dé-validation, suppression, ajout). L'exercice courant est mis en
 * avant et déplié par défaut ; tap sur l'en-tête = saut de focus + dépli.
 */
export function ExerciseList({
  entries,
  currentExerciseId,
  onSelect,
  onToggleSetDone,
  onRemoveSet,
  onAddSet,
  colors,
}: ExerciseListProps) {
  const { t } = useTranslation();
  const units = useUnits();
  // Dépli par défaut = exercice courant ; un tap sur l'en-tête pose une
  // dérogation explicite (déplié/replié), sans effet ni resynchronisation :
  // quand le focus change, le nouvel exercice courant retombe sur le défaut
  // (déplié) tant qu'aucune dérogation n'a été posée pour lui.
  const [manualOverride, setManualOverride] = useState<Record<string, boolean>>({});

  const isExpandedFor = (exerciseId: string): boolean =>
    manualOverride[exerciseId] ?? exerciseId === currentExerciseId;

  const toggleExpanded = (exerciseId: string) => {
    setManualOverride((prev) => ({ ...prev, [exerciseId]: !isExpandedFor(exerciseId) }));
  };

  return (
    <View style={styles.list}>
      {entries.map((entry) => {
        const total = entry.sets.length;
        const doneCount = entry.sets.filter((set) => set.done).length;
        const allDone = total > 0 && doneCount === total;
        const isCurrent = entry.exerciseId === currentExerciseId;
        const isExpanded = isExpandedFor(entry.exerciseId);

        return (
          <View
            key={entry.exerciseId}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: isCurrent ? colors.accent : colors.border,
              },
              isCurrent && styles.cardCurrent,
              allDone && !isCurrent && styles.cardDone,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isExpanded }}
              onPress={() => {
                onSelect(entry.exerciseId);
                toggleExpanded(entry.exerciseId);
              }}
              style={({ pressed }) => [styles.header, pressed && styles.pressed]}
            >
              <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
                {entry.exerciseName}
              </Text>
              <View style={styles.trailing}>
                <Text style={[styles.count, { color: colors.textMuted }]}>{`${doneCount}/${total}`}</Text>
                {allDone ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : null}
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                />
              </View>
            </Pressable>

            {isExpanded ? (
              <View style={styles.sets}>
                {entry.sets.map((set, index) => (
                  <View key={set.id} style={styles.setRow}>
                    <Text style={[styles.setLabel, { color: colors.textMuted }]}>
                      {`${t('workout.set')} ${index + 1}`}
                    </Text>
                    <Text style={[styles.setValue, { color: colors.text }]}>{formatSetLine(set, units)}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('workout.unvalidateSet')}
                      disabled={!set.done}
                      hitSlop={8}
                      onPress={() => onToggleSetDone(set.id, set.done)}
                      style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                    >
                      <Ionicons
                        name={set.done ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={set.done ? colors.success : colors.textMuted}
                      />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('workout.removeSet')}
                      hitSlop={8}
                      onPress={() => onRemoveSet(set.id)}
                      style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                    >
                      <Ionicons name="remove-circle-outline" size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}

                <Pressable
                  accessibilityRole="button"
                  onPress={() => onAddSet(entry.exerciseId)}
                  style={({ pressed }) => [styles.addSetRow, pressed && styles.pressed]}
                >
                  <Text style={[styles.addSetLabel, { color: colors.accent }]}>{t('workout.addSet')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
  },
  cardCurrent: { borderWidth: 2 },
  cardDone: { opacity: 0.5 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  name: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 15 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { fontFamily: fontFamily.monoBold, fontSize: 14 },
  sets: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setLabel: { fontFamily: fontFamily.body, fontSize: 13, width: 64 },
  setValue: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 14 },
  iconBtn: { padding: 2 },
  addSetRow: { paddingTop: 4, paddingBottom: 2 },
  addSetLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  pressed: { opacity: 0.7 },
});

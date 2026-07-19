import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily } from '@/theme/fonts';
import type { Palette } from '@/theme/colors';
import type { WorkoutEntry } from '@/data/repositories/workout-repository';

// Bordeaux muscu — rôle fixe hors thème (distinction de l'exercice courant).
const STRENGTH_COLOR = '#6b0028';

type ExerciseListProps = {
  entries: WorkoutEntry[];
  currentExerciseId: string;
  onSelect: (exerciseId: string) => void;
  colors: Palette;
};

/**
 * Liste repliée des exercices de la séance (C1) : un rang par exercice avec sa
 * progression « {faites}/{total} ». L'exercice courant est mis en avant, les
 * exercices terminés estompés. Tap → focus (saut) sur l'exercice.
 */
export function ExerciseList({ entries, currentExerciseId, onSelect, colors }: ExerciseListProps) {
  return (
    <View style={styles.list}>
      {entries.map((entry) => {
        const total = entry.sets.length;
        const doneCount = entry.sets.filter((set) => set.done).length;
        const allDone = total > 0 && doneCount === total;
        const isCurrent = entry.exerciseId === currentExerciseId;

        return (
          <Pressable
            key={entry.exerciseId}
            accessibilityRole="button"
            onPress={() => onSelect(entry.exerciseId)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: colors.surface,
                borderColor: isCurrent ? STRENGTH_COLOR : colors.border,
              },
              isCurrent && styles.rowCurrent,
              allDone && !isCurrent && styles.rowDone,
              pressed && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.name, { color: colors.text }]}
            >
              {entry.exerciseName}
            </Text>
            <View style={styles.trailing}>
              <Text style={[styles.count, { color: colors.textMuted }]}>{`${doneCount}/${total}`}</Text>
              {allDone ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowCurrent: { borderWidth: 2 },
  rowDone: { opacity: 0.5 },
  name: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 15 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { fontFamily: fontFamily.monoBold, fontSize: 14 },
  pressed: { opacity: 0.7 },
});

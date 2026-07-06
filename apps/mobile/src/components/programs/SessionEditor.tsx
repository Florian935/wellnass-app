import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  addExercisePlan,
  removeSession,
  type SessionDetail,
} from '@/data/repositories/program-repository';
import type { ExerciseListItem } from '@/data/repositories/exercise-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { ExercisePicker } from './ExercisePicker';
import { ExercisePlanEditor } from './ExercisePlanEditor';

type SessionEditorProps = {
  session: SessionDetail;
  /** Libellé de repli si la séance n'a pas de nom (ex. « Séance A »). */
  fallbackName: string;
};

/**
 * Carte d'édition d'une séance : entête (nom + suppression), liste des plans
 * d'exercice (chacun éditable via `ExercisePlanEditor`) et déclencheur d'ajout
 * ouvrant le sélecteur d'exercice (`ExercisePicker`).
 *
 * Toutes les écritures passent par le repository ; la vue est rafraîchie par la
 * lecture réactive `useProgramDetail` du parent.
 */
export function SessionEditor({ session, fallbackName }: SessionEditorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const displayName = session.name?.trim() ? session.name : fallbackName;

  const onPickExercise = (exercise: ExerciseListItem) => {
    setPickerOpen(false);
    void addExercisePlan(session.id, { exerciseId: exercise.id });
  };

  const onRemoveSession = () => {
    void removeSession(session.id);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {displayName}
        </Text>
        <Pressable
          onPress={onRemoveSession}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('programs.edit.removeSessionA11y', { name: displayName })}
        >
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {session.plans.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          {t('programs.edit.emptyPlans')}
        </Text>
      ) : (
        <View style={styles.plans}>
          {session.plans.map((plan) => (
            <ExercisePlanEditor key={plan.id} plan={plan} />
          ))}
        </View>
      )}

      <Pressable
        onPress={() => setPickerOpen(true)}
        accessibilityRole="button"
        style={[styles.addExercise, { borderColor: colors.border }]}
      >
        <Text style={[styles.addExerciseLabel, { color: colors.accent }]}>
          {t('programs.edit.addExercise')}
        </Text>
      </Pressable>

      <ExercisePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={onPickExercise}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { flex: 1, fontFamily: fontFamily.displaySemi, fontSize: 17, letterSpacing: -0.2 },
  empty: { fontFamily: fontFamily.body, fontSize: 13 },
  plans: { gap: 10 },
  addExercise: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addExerciseLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
});

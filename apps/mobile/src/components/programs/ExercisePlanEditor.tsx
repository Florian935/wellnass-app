import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  removeExercisePlan,
  updateExercisePlan,
  type PlanItem,
} from '@/data/repositories/program-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type ExercisePlanEditorProps = {
  plan: PlanItem;
};

/** Convertit une saisie en entier positif, ou null si vide/invalide. */
function toPositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 && Number.isInteger(n) ? n : null;
}

/** Convertit une saisie en entier >= 0, ou null si vide/invalide. */
function toNonNegativeInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 && Number.isInteger(n) ? n : null;
}

/** Convertit une saisie en nombre positif, ou null si vide/invalide. */
function toPositiveNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Affiche une valeur numérique nullable en chaîne pour un champ contrôlé. */
function numToStr(value: number | null): string {
  return value === null ? '' : String(value);
}

/**
 * Ligne d'édition d'un plan d'exercice au sein d'une séance : nom + 4 champs de
 * cibles (séries, répétitions, charge, repos) édités en local et persistés au blur
 * via `updateExercisePlan`, plus une action de suppression (`removeExercisePlan`).
 *
 * Les champs sont maintenus en état local pour une saisie fluide ; la lecture
 * réactive (`useProgramDetail`) rafraîchit la vue parente après écriture.
 */
export function ExercisePlanEditor({ plan }: ExercisePlanEditorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [sets, setSets] = useState(numToStr(plan.targetSets));
  const [reps, setReps] = useState(plan.targetReps ?? '');
  const [weight, setWeight] = useState(numToStr(plan.targetWeightKg));
  const [rest, setRest] = useState(numToStr(plan.restSeconds));

  const commitSets = () => {
    void updateExercisePlan(plan.id, { targetSets: toPositiveInt(sets) });
  };
  const commitReps = () => {
    const trimmed = reps.trim();
    void updateExercisePlan(plan.id, { targetReps: trimmed === '' ? null : trimmed });
  };
  const commitWeight = () => {
    void updateExercisePlan(plan.id, { targetWeightKg: toPositiveNumber(weight) });
  };
  const commitRest = () => {
    void updateExercisePlan(plan.id, { restSeconds: toNonNegativeInt(rest) });
  };

  const onRemove = () => {
    void removeExercisePlan(plan.id);
  };

  const fieldStyle = [
    styles.input,
    { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
  ];

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {plan.exerciseName}
        </Text>
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('programs.edit.removeExerciseA11y', {
            name: plan.exerciseName,
          })}
        >
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.targetsRow}>
        <View style={styles.targetField}>
          <Text style={[styles.targetLabel, { color: colors.textMuted }]}>
            {t('programs.edit.targets.sets')}
          </Text>
          <TextInput
            style={fieldStyle}
            value={sets}
            onChangeText={setSets}
            onBlur={commitSets}
            keyboardType="number-pad"
            placeholder={t('programs.edit.targets.setsPlaceholder')}
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={styles.targetField}>
          <Text style={[styles.targetLabel, { color: colors.textMuted }]}>
            {t('programs.edit.targets.reps')}
          </Text>
          <TextInput
            style={fieldStyle}
            value={reps}
            onChangeText={setReps}
            onBlur={commitReps}
            autoCapitalize="none"
            placeholder={t('programs.edit.targets.repsPlaceholder')}
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      <View style={styles.targetsRow}>
        <View style={styles.targetField}>
          <Text style={[styles.targetLabel, { color: colors.textMuted }]}>
            {t('programs.edit.targets.weight')}
          </Text>
          <TextInput
            style={fieldStyle}
            value={weight}
            onChangeText={setWeight}
            onBlur={commitWeight}
            keyboardType="decimal-pad"
            placeholder={t('programs.edit.targets.weightPlaceholder')}
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={styles.targetField}>
          <Text style={[styles.targetLabel, { color: colors.textMuted }]}>
            {t('programs.edit.targets.rest')}
          </Text>
          <TextInput
            style={fieldStyle}
            value={rest}
            onChangeText={setRest}
            onBlur={commitRest}
            keyboardType="number-pad"
            placeholder={t('programs.edit.targets.restPlaceholder')}
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  name: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 15 },
  targetsRow: { flexDirection: 'row', gap: 10 },
  targetField: { flex: 1, gap: 4 },
  targetLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  input: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
});

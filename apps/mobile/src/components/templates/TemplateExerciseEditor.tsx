import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SetType } from '@wellness/shared';
import {
  removeTemplateExercise,
  updateTemplateExercise,
  type WorkoutTemplateExerciseItem,
} from '@/data/repositories/workout-template-repository';
import {
  ExerciseTargetsFields,
  numToStr,
  toNonNegativeInt,
  toPositiveInt,
} from '@/components/exercise/ExerciseTargetsFields';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useUnits } from '@/hooks/useUnits';

/**
 * Types de série proposés pour un exercice de template (US Refonte-D). Contrairement
 * à `TYPE_CHIPS` de `CurrentSetCard.tsx` (5 valeurs, `warmup`/`superset` traités à
 * part avec un raccourci 1-tap / un dialogue de liaison live), un template n'a besoin
 * que d'un choix déclaratif simple, sans traitement spécial : les 7 valeurs du domaine
 * sont donc toutes proposées ici.
 */
const TEMPLATE_SET_TYPES: SetType[] = [
  'normal',
  'warmup',
  'superset',
  'duration',
  'bodyweight',
  'dropset',
  'failure',
];

type TemplateExerciseEditorProps = {
  plan: WorkoutTemplateExerciseItem;
};

/**
 * Ligne d'édition d'un exercice au sein d'un template de séance libre : mêmes 4
 * champs de cibles que `ExercisePlanEditor` (délégués à `ExerciseTargetsFields`)
 * plus un 5ᵉ champ propre aux templates, une rangée de chips pour choisir le
 * `set_type`. État local édité au fil de la saisie, persisté au blur via
 * `updateTemplateExercise` ; suppression via `removeTemplateExercise`.
 */
export function TemplateExerciseEditor({ plan }: TemplateExerciseEditorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();

  const [sets, setSets] = useState(numToStr(plan.targetSets));
  const [reps, setReps] = useState(plan.targetReps ?? '');
  const weight0 = units.weightInputValue(plan.targetWeightKg);
  const [weight, setWeight] = useState(weight0);
  const initialWeightRef = useRef(weight0);
  const [rest, setRest] = useState(numToStr(plan.restSeconds));

  const commitSets = () => {
    void updateTemplateExercise(plan.id, { targetSets: toPositiveInt(sets) });
  };
  const commitReps = () => {
    const trimmed = reps.trim();
    void updateTemplateExercise(plan.id, { targetReps: trimmed === '' ? null : trimmed });
  };
  const commitWeight = () => {
    const next =
      weight === initialWeightRef.current
        ? (plan.targetWeightKg ?? null)
        : units.parseWeightToKg(weight);
    void updateTemplateExercise(plan.id, { targetWeightKg: next });
  };
  const commitRest = () => {
    void updateTemplateExercise(plan.id, { restSeconds: toNonNegativeInt(rest) });
  };

  const onRemove = () => {
    void removeTemplateExercise(plan.id);
  };

  const onSetType = (type: SetType) => {
    void updateTemplateExercise(plan.id, { setType: type });
  };

  return (
    <View style={styles.container}>
      <ExerciseTargetsFields
        exerciseName={plan.exerciseName}
        sets={sets}
        onChangeSets={setSets}
        onBlurSets={commitSets}
        reps={reps}
        onChangeReps={setReps}
        onBlurReps={commitReps}
        weight={weight}
        onChangeWeight={setWeight}
        onBlurWeight={commitWeight}
        weightSymbol={units.weightSymbol}
        weightPlaceholder={t(
          units.system === 'imperial'
            ? 'programs.edit.targets.weightPlaceholderImperial'
            : 'programs.edit.targets.weightPlaceholderMetric',
        )}
        rest={rest}
        onChangeRest={setRest}
        onBlurRest={commitRest}
        onRemove={onRemove}
        removeA11yLabel={t('programs.edit.removeExerciseA11y', { name: plan.exerciseName })}
      />

      <View style={styles.typeRow}>
        {TEMPLATE_SET_TYPES.map((type) => {
          const active = plan.setType === type;
          return (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSetType(type)}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: active ? colors.accent : colors.surfaceAlt },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.chipText, { color: active ? colors.accentText : colors.textMuted }]}
              >
                {t(`workout.setType.${type}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
  },
  chipText: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  pressed: { opacity: 0.8 },
});

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Convertit une saisie en entier positif, ou null si vide/invalide. */
export function toPositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 && Number.isInteger(n) ? n : null;
}

/** Convertit une saisie en entier >= 0, ou null si vide/invalide. */
export function toNonNegativeInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 && Number.isInteger(n) ? n : null;
}

/** Affiche une valeur numérique nullable en chaîne pour un champ contrôlé. */
export function numToStr(value: number | null): string {
  return value === null ? '' : String(value);
}

export type ExerciseTargetsFieldsProps = {
  exerciseName: string;
  sets: string;
  onChangeSets: (v: string) => void;
  onBlurSets: () => void;
  reps: string;
  onChangeReps: (v: string) => void;
  onBlurReps: () => void;
  weight: string;
  onChangeWeight: (v: string) => void;
  onBlurWeight: () => void;
  weightSymbol: string;
  weightPlaceholder: string;
  rest: string;
  onChangeRest: (v: string) => void;
  onBlurRest: () => void;
  onRemove: () => void;
  removeA11yLabel: string;
};

/**
 * Composant présentation pur pour les 4 champs de cibles d'un exercice planifié
 * (séries, répétitions, charge, repos) + action de suppression. Aucune dépendance
 * à un repository : valeurs et callbacks reçus en props (le placeholder de charge
 * est déjà résolu par l'appelant, qui connaît le système d'unités). Réutilisé par
 * `ExercisePlanEditor` (programmes) et `TemplateExerciseEditor` (templates de
 * séance libre), qui gèrent chacun leur propre état local et persistance.
 */
export function ExerciseTargetsFields({
  exerciseName,
  sets,
  onChangeSets,
  onBlurSets,
  reps,
  onChangeReps,
  onBlurReps,
  weight,
  onChangeWeight,
  onBlurWeight,
  weightSymbol,
  weightPlaceholder,
  rest,
  onChangeRest,
  onBlurRest,
  onRemove,
  removeA11yLabel,
}: ExerciseTargetsFieldsProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const fieldStyle = [
    styles.input,
    // Champ de saisie → `borderStrong` (3:1), comme `TextField`. Le `border` du conteneur
    // ci-dessous reste décoratif, lui.
    { backgroundColor: colors.background, borderColor: colors.borderStrong, color: colors.text },
  ];

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {exerciseName}
        </Text>
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={removeA11yLabel}
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
            onChangeText={onChangeSets}
            onBlur={onBlurSets}
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
            onChangeText={onChangeReps}
            onBlur={onBlurReps}
            autoCapitalize="none"
            placeholder={t('programs.edit.targets.repsPlaceholder')}
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      <View style={styles.targetsRow}>
        <View style={styles.targetField}>
          <Text style={[styles.targetLabel, { color: colors.textMuted }]}>
            {`${t('programs.edit.targets.weight')} (${weightSymbol})`}
          </Text>
          <TextInput
            style={fieldStyle}
            value={weight}
            onChangeText={onChangeWeight}
            onBlur={onBlurWeight}
            keyboardType="decimal-pad"
            placeholder={weightPlaceholder}
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
            onChangeText={onChangeRest}
            onBlur={onBlurRest}
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

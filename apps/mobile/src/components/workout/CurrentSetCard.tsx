import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamily } from '@/theme/fonts';
import type { Palette } from '@/theme/colors';

// Bordeaux muscu — rôle fixe hors thème (accent fort du pilier, cf. RestOverlay).
const STRENGTH_COLOR = '#6b0028';

type CurrentSetCardProps = {
  exerciseName: string;
  /** Rang de la série dans l'exercice (1-based). */
  currentIndex: number;
  totalSets: number;
  /** Ligne « dernière fois » déjà formatée, ou `null` pour la masquer. */
  lastPerfLabel: string | null;
  repsValue: string;
  onChangeReps: (value: string) => void;
  weightValue: string;
  weightSymbol: string;
  weightPlaceholder: string;
  onChangeWeight: (value: string) => void;
  /** Incrément (kg) appliqué à la charge sous-jacente via les steppers. */
  onStepWeight: (deltaKg: number) => void;
  restSeconds: number;
  /** Incrément (s) appliqué au repos de l'exercice via le mini stepper. */
  onStepRest: (deltaSeconds: number) => void;
  onValidate: () => void;
  colors: Palette;
};

/** Petit bouton rond « − / + » réutilisé par les steppers. */
function StepButton({
  icon,
  onPress,
  colors,
  label,
}: {
  icon: 'add' | 'remove';
  onPress: () => void;
  colors: Palette;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepBtn,
        { borderColor: colors.border, backgroundColor: colors.surface },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

/**
 * Carte « série en cours » du flux guidé (C1). Composant présentational :
 * l'état d'édition et les mutations (updateSet, repos) sont gérés par le parent.
 */
export function CurrentSetCard({
  exerciseName,
  currentIndex,
  totalSets,
  lastPerfLabel,
  repsValue,
  onChangeReps,
  weightValue,
  weightSymbol,
  weightPlaceholder,
  onChangeWeight,
  onStepWeight,
  restSeconds,
  onStepRest,
  onValidate,
  colors,
}: CurrentSetCardProps) {
  const { t } = useTranslation();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: STRENGTH_COLOR }]}>
      <Text style={[styles.exName, { color: colors.text }]}>{exerciseName}</Text>
      <Text style={[styles.progress, { color: colors.textMuted }]}>
        {t('workout.setProgress', { current: currentIndex, total: totalSets })}
      </Text>

      {lastPerfLabel ? (
        <Text style={[styles.lastPerf, { color: colors.textMuted }]}>
          {t('workout.lastTime', { perf: lastPerfLabel })}
        </Text>
      ) : null}

      <View style={styles.fields}>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('workout.reps')}</Text>
          <TextInput
            value={repsValue}
            onChangeText={onChangeReps}
            keyboardType="number-pad"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
            {`${t('workout.weight')} (${weightSymbol})`}
          </Text>
          <View style={styles.weightRow}>
            <StepButton icon="remove" label="-2.5" colors={colors} onPress={() => onStepWeight(-2.5)} />
            <TextInput
              value={weightValue}
              onChangeText={onChangeWeight}
              placeholder={weightPlaceholder}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                styles.weightInput,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
              ]}
            />
            <StepButton icon="add" label="+2.5" colors={colors} onPress={() => onStepWeight(2.5)} />
          </View>
        </View>
      </View>

      <View style={styles.restControl}>
        <StepButton icon="remove" label="-15s" colors={colors} onPress={() => onStepRest(-15)} />
        <Text style={[styles.restLabel, { color: colors.textMuted }]}>
          {t('workout.restRemaining', { seconds: restSeconds })}
        </Text>
        <StepButton icon="add" label="+15s" colors={colors} onPress={() => onStepRest(15)} />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onValidate}
        style={({ pressed }) => [styles.validate, { backgroundColor: STRENGTH_COLOR }, pressed && styles.pressed]}
      >
        <Text style={styles.validateLabel}>{t('workout.validateSet')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 2, padding: 20, gap: 12 },
  exName: { fontFamily: fontFamily.displaySemi, fontSize: 22, letterSpacing: -0.4 },
  progress: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  lastPerf: { fontFamily: fontFamily.body, fontSize: 14 },
  fields: { flexDirection: 'row', gap: 12, marginTop: 4 },
  field: { flex: 1, gap: 6 },
  fieldLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  input: {
    fontFamily: fontFamily.body,
    fontSize: 18,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Padding horizontal réduit : les charges à virgule (ex. « 52.5 ») ne doivent pas
  // être tronquées dans un input étroit encadré par les deux steppers.
  weightInput: { flex: 1, paddingHorizontal: 4, minWidth: 0 },
  stepBtn: {
    width: 40,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  restLabel: { fontFamily: fontFamily.monoBold, fontSize: 16, minWidth: 64, textAlign: 'center' },
  validate: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  validateLabel: { fontFamily: fontFamily.bodyBold, fontSize: 17, color: '#ffffff' },
  pressed: { opacity: 0.8 },
});

/**
 * US OBJ-01 — formulaire de création d'un objectif.
 *
 * Même patron que `MeasurementSheet` / `WellbeingCheckinSheet` : le formulaire est **monté à
 * l'ouverture avec une `key`**, donc aucun `setState` dans un effet (le React Compiler le refuse).
 *
 * ── Deux choix d'ergonomie assumés ────────────────────────────────────────────────────────────
 * 1. **L'échéance se choisit en semaines** (4 / 8 / 12), pas dans un calendrier. Un objectif se pense
 *    en durée d'engagement, pas en date ; et cela évite une dépendance de sélecteur de date pour un
 *    gain nul.
 * 2. **Le 1RM de départ est calculé et affiché** avant validation (décision D6). L'utilisateur voit
 *    depuis quoi il part — sans ce repère, « 105 kg » ne dit pas s'il s'agit d'un pas ou d'un bond.
 */

import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  GOAL_KINDS,
  localDayKey,
  MAX_ACTIVE_GOALS,
  validateGoalTarget,
  type GoalKind,
} from '@wellness/shared';

import { Button } from '@/components/Button';
import { Segment } from '@/components/Segment';
import { createGoal, currentBest1RM } from '@/data/repositories/goal-repository';
import { useExercises } from '@/data/repositories/exercise-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Durées proposées, en semaines. */
const WEEK_OPTIONS = [4, 8, 12] as const;

type Props = { visible: boolean; onClose: () => void };

export function GoalFormSheet({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('goals.form.close')}
      />
      <View
        style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}
      >
        {visible && <GoalForm onDone={onClose} />}
      </View>
    </Modal>
  );
}

function GoalForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();

  const [kind, setKind] = useState<GoalKind>('run_distance');
  const [weeks, setWeeks] = useState<number>(8);
  const [targetText, setTargetText] = useState('');
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [startValue, setStartValue] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { exercises } = useExercises(search);
  // Liste volontairement courte : au-delà, on cherche. Afficher 200 exercices dans une feuille de
  // création noierait le champ qui compte (la cible).
  const shortlist = useMemo(() => exercises.slice(0, 12), [exercises]);

  const startDate = localDayKey(new Date());
  const deadline = localDayKey(addDays(new Date(), weeks * 7));

  /** Cible saisie → unité de stockage : mètres pour la course, kg pour la force. */
  const targetValue = useMemo(() => {
    if (kind === 'run_distance') {
      const km = units.parseDistanceToKm(targetText);
      return km == null ? null : Math.round(km * 1000);
    }
    return units.parseWeightToKg(targetText);
  }, [kind, targetText, units]);

  const pickExercise = async (id: string) => {
    setExerciseId(id);
    setError(null);
    // Le 1RM de départ est figé **maintenant** (D6) : c'est la référence de l'objectif.
    setStartValue(await currentBest1RM(id));
  };

  const validationError = useMemo(() => {
    if (targetValue === null) return null; // rien saisi encore : pas d'erreur à afficher
    return validateGoalTarget({ kind, targetValue, startValue, startDate, deadline });
  }, [kind, targetValue, startValue, startDate, deadline]);

  const canSubmit =
    targetValue !== null &&
    validationError === null &&
    (kind === 'run_distance' || exerciseId !== null);

  const submit = async () => {
    if (targetValue === null) return;
    setSaving(true);
    setError(null);
    try {
      await createGoal({
        kind,
        targetValue,
        exerciseId: kind === 'exercise_1rm' ? exerciseId : null,
        startValue: kind === 'exercise_1rm' ? startValue : null,
        startDate,
        deadline,
      });
      onDone();
    } catch {
      // Le plafond est relu côté repository : l'échec le plus probable ici est justement celui-là.
      setError(t('goals.errors.limitReached', { count: MAX_ACTIVE_GOALS }));
    } finally {
      setSaving(false);
    }
  };

  const targetLabel =
    kind === 'run_distance' ? t('goals.form.targetDistance') : t('goals.form.target1rm');
  const targetUnit = kind === 'run_distance' ? units.distanceSymbol : units.weightSymbol;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: colors.text }]}>{t('goals.form.title')}</Text>

      <Text style={[styles.label, { color: colors.text }]}>{t('goals.form.kind')}</Text>
      <Segment<GoalKind>
        options={[...GOAL_KINDS]}
        value={kind}
        onChange={(next) => {
          setKind(next);
          setTargetText('');
          setExerciseId(null);
          setStartValue(null);
          setError(null);
        }}
        label={(option) => t(`goals.kinds.${option}`)}
        scrollable
      />
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t(`goals.kindHints.${kind}`)}
      </Text>

      {kind === 'exercise_1rm' && (
        <>
          <Text style={[styles.label, { color: colors.text }]}>{t('goals.form.exercise')}</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('goals.form.pickExercise')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('goals.form.exercise')}
            maxFontSizeMultiplier={1.4}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <View style={[styles.picker, { borderColor: colors.border }]}>
            {shortlist.map((exercise, index) => {
              const selected = exercise.id === exerciseId;
              return (
                <Pressable
                  key={exercise.id}
                  onPress={() => void pickExercise(exercise.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.pickerRow,
                    index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                    selected && { backgroundColor: colors.track },
                  ]}
                >
                  <Text
                    style={[styles.pickerLabel, { color: colors.text }]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.3}
                  >
                    {exercise.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {exerciseId !== null && (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {startValue === null
                ? t('goals.form.noStartValue')
                : t('goals.form.startValue', { value: units.formatWeight(startValue) })}
            </Text>
          )}
        </>
      )}

      <Text style={[styles.label, { color: colors.text }]}>{targetLabel}</Text>
      <View style={styles.targetRow}>
        <TextInput
          value={targetText}
          onChangeText={setTargetText}
          keyboardType="decimal-pad"
          placeholder={targetUnit}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={`${targetLabel}, ${targetUnit}`}
          maxFontSizeMultiplier={1.4}
          style={[styles.input, styles.targetInput, { color: colors.text, borderColor: colors.border }]}
        />
        <Text style={[styles.unit, { color: colors.textMuted }]} maxFontSizeMultiplier={1.3}>
          {targetUnit}
        </Text>
      </View>

      <Text style={[styles.label, { color: colors.text }]}>{t('goals.form.deadline')}</Text>
      <Segment<string>
        options={WEEK_OPTIONS.map(String)}
        value={String(weeks)}
        onChange={(next) => setWeeks(Number(next))}
        label={(option) => t('goals.weeks', { count: Number(option) })}
      />

      {validationError !== null && (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {validationError === 'target_below_start'
            ? t('goals.errors.targetBelowStart', {
                start: units.formatWeight(startValue),
              })
            : validationError === 'deadline_before_start'
              ? t('goals.errors.deadlineBeforeStart')
              : t('goals.errors.invalidTarget')}
        </Text>
      )}
      {kind === 'exercise_1rm' && exerciseId === null && targetValue !== null && (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {t('goals.errors.missingExercise')}
        </Text>
      )}
      {error !== null && (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      )}

      <Button
        label={t('goals.form.submit')}
        onPress={submit}
        disabled={!canSubmit}
        loading={saving}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: '90%' },
  content: { padding: 20, gap: 10 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 20, marginBottom: 4 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 14, marginTop: 6 },
  hint: { fontFamily: fontFamily.body, fontSize: 12.5 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 48,
    fontFamily: fontFamily.bodySemi,
    fontSize: 15,
  },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  targetInput: { flex: 1, textAlign: 'right' },
  unit: { fontFamily: fontFamily.bodySemi, fontSize: 14, minWidth: 34 },
  picker: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  pickerRow: { paddingHorizontal: 12, minHeight: 48, justifyContent: 'center' },
  pickerLabel: { fontFamily: fontFamily.body, fontSize: 14 },
  error: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});

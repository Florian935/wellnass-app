/**
 * Section « Ressenti » — cinq niveaux nommés (Facile → Max) + note de séance, éditables a posteriori.
 *
 * ── Déplacée ici par MUSCU-UX02, et c'est un correctif de justesse ───────────────────────────────
 * Elle vivait dans `workout-summary.tsx` et n'existait **que** là : l'historique, lui, affichait la
 * même colonne en brut — « 8/10 » — alors que le récap affichait « Difficile ». Même donnée, deux
 * lectures contradictoires dans la même app. En vivant dans le bilan partagé, elle se lit désormais
 * pareil partout (spec R10).
 *
 * ── Pourquoi des niveaux nommés et pas des étoiles (US MUSCU-UX01) ───────────────────────────────
 * La séance vient d'être notée série par série en RPE ou en RIR, une échelle qui a un sens ; le
 * résumé demandait la même chose en cinq étoiles muettes, où rien ne dit ce que vaut trois.
 *
 * Le **stockage ne change pas** : `workouts.rpe` reçoit toujours un RPE 1-10 via `feelingToStoredRpe`.
 * C'est le patron d'`intensity.ts` — la base ne change jamais de nature, seule la lecture change.
 */

import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  WORKOUT_FEELINGS,
  feelingFromStoredRpe,
  feelingToStoredRpe,
  type WorkoutFeeling,
} from '@wellness/shared';
import { TextField } from '@/components/TextField';
import { setWorkoutFeedback } from '@/data/repositories/workout-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function FeelingSection({
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
  const [feeling, setFeeling] = useState<WorkoutFeeling | null>(() =>
    feelingFromStoredRpe(initialRpe),
  );
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [noteOpen, setNoteOpen] = useState((initialNotes ?? '').trim() !== '');

  function handlePick(value: WorkoutFeeling) {
    // Retaper le niveau déjà posé l'efface : même geste que le RPE en séance.
    const next = value === feeling ? null : value;
    setFeeling(next);
    void setWorkoutFeedback(workoutId, { rpe: next ? feelingToStoredRpe(next) : null });
  }

  function handleNotesBlur() {
    const trimmed = notes.trim();
    void setWorkoutFeedback(workoutId, { notes: trimmed.length > 0 ? notes : null });
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
        {t('workout.summary.feelingQuestion')}
      </Text>

      <View style={styles.row}>
        {WORKOUT_FEELINGS.map((value) => {
          const selected = feeling === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`workout.summary.feeling.${value}`)}
              onPress={() => handlePick(value)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: selected ? colors.accent : colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.label, { color: selected ? colors.accentText : colors.textMuted }]}
              >
                {t(`workout.summary.feeling.${value}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {noteOpen ? (
        <TextField
          label={t('workout.summary.note')}
          placeholder={t('workout.summary.notePlaceholder')}
          value={notes}
          onChangeText={setNotes}
          onBlur={handleNotesBlur}
          multiline
          numberOfLines={3}
          style={styles.noteInput}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setNoteOpen(true)}
          style={({ pressed }) => [
            styles.noteTrigger,
            { borderColor: colors.border, backgroundColor: colors.surface },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="create-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.noteTriggerLabel, { color: colors.textMuted }]}>
            {t('workout.summary.addNote')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  eyebrow: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', gap: 7 },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 2,
    borderWidth: 1,
    borderRadius: 12,
  },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  noteTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  noteTriggerLabel: { fontFamily: fontFamily.body, fontSize: 13.5 },
  noteInput: { minHeight: 90, textAlignVertical: 'top', paddingTop: 14 },
  pressed: { opacity: 0.8 },
});

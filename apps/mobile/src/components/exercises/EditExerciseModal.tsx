import { useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { EQUIPMENTS, MUSCLE_GROUPS, type Equipment, type MuscleGroup } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Segment } from '@/components/Segment';
import { TextField } from '@/components/TextField';
import { updateCustomExercise, type ExerciseDetail } from '@/data/repositories/exercise-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type CreateExerciseModalProps = { visible: boolean; onClose: () => void; exercise: ExerciseDetail };

/**
 * Options du sélecteur de matériel : sentinelle `'none'` (= `equipment` null) en tête.
 */
const EQUIPMENT_OPTIONS = ['none', ...EQUIPMENTS] as const;
type EquipmentOption = (typeof EQUIPMENT_OPTIONS)[number];

/**
 * Modale bottom-sheet d'édition d'un exercice **personnalisé** : nom, groupe, matériel,
 * muscles secondaires et instructions. Patron `CreateExerciseModal`. État de formulaire
 * interne initialisé depuis `exercise` — le parent pose `key={exercise.id}` pour réinitialiser
 * à l'ouverture d'un autre exo. Métier : `updateCustomExercise` (atomique).
 */
export function EditExerciseModal({ visible, onClose, exercise }: CreateExerciseModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [name, setName] = useState(exercise.name);
  const [muscle, setMuscle] = useState<MuscleGroup>(exercise.muscle);
  const [equipment, setEquipment] = useState<Equipment | null>(exercise.equipment as Equipment | null);
  const [musclesSecondary, setMusclesSecondary] = useState<MuscleGroup[]>(exercise.musclesSecondary);
  const [instructions, setInstructions] = useState(exercise.instructions ?? '');
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0;

  // La modale reste montée en permanence dans la fiche (seul `visible` bascule) : il faut
  // réinitialiser l'état à chaque fermeture, sinon les saisies abandonnées réapparaissent et
  // `saving` resterait figé après un enregistrement. Restaure depuis `exercise` (patron
  // `CreateExerciseModal`).
  const resetFromExercise = () => {
    setName(exercise.name);
    setMuscle(exercise.muscle);
    setEquipment(exercise.equipment as Equipment | null);
    setMusclesSecondary(exercise.musclesSecondary);
    setInstructions(exercise.instructions ?? '');
    setSaving(false);
  };

  const close = () => {
    resetFromExercise();
    onClose();
  };

  const toggleSecondary = (m: MuscleGroup) =>
    setMusclesSecondary((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const onChangeMuscle = (next: MuscleGroup) => {
    setMuscle(next);
    // Invariant primaire ∉ secondaires.
    setMusclesSecondary((prev) => prev.filter((m) => m !== next));
  };

  const onSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await updateCustomExercise(exercise.id, {
        name,
        muscle,
        equipment,
        musclesSecondary,
        instructions,
      });
      // Succès : le formulaire reflète déjà les valeurs enregistrées (= `exercise` après
      // synchro réactive) ; on lève seulement `saving` avant de fermer.
      setSaving(false);
      onClose();
    } catch (e) {
      // Offline-first : écriture locale ; on garde la modale ouverte en cas d'échec improbable.
      console.warn('updateCustomExercise a échoué', e);
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable
        style={styles.backdrop}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={[styles.title, { color: colors.text }]}>{t('exercises.detail.editTitle')}</Text>

            <TextField
              label={t('exercises.customName')}
              value={name}
              onChangeText={setName}
              autoCapitalize="sentences"
            />

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('exercises.detail.muscle')}</Text>
              <Segment
                options={MUSCLE_GROUPS}
                value={muscle}
                onChange={onChangeMuscle}
                label={(m) => t(`muscle.${m}`)}
                scrollable
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('exercises.detail.equipment')}</Text>
              <Segment
                options={EQUIPMENT_OPTIONS}
                value={equipment ?? 'none'}
                onChange={(opt: EquipmentOption) => setEquipment(opt === 'none' ? null : opt)}
                label={(opt) => (opt === 'none' ? t('exercises.detail.equipmentNone') : t(`equipment.${opt}`))}
                scrollable
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textMuted }]}>
                {t('exercises.detail.secondaryMuscles')}
              </Text>
              <View style={styles.chips}>
                {MUSCLE_GROUPS.filter((m) => m !== muscle).map((m) => {
                  const selected = musclesSecondary.includes(m);
                  return (
                    <Pressable
                      key={m}
                      onPress={() => toggleSecondary(m)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[
                        styles.chip,
                        { backgroundColor: selected ? colors.accent : colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <Text style={{ color: selected ? colors.accentText : colors.text, fontSize: 13 }}>
                        {t(`muscle.${m}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <TextField
              label={t('exercises.detail.instructions')}
              value={instructions}
              onChangeText={setInstructions}
              placeholder={t('exercises.detail.instructionsPlaceholder')}
              autoCapitalize="sentences"
              multiline
              textAlignVertical="top"
              style={styles.multiline}
            />

            <View style={styles.actions}>
              <View style={styles.flex}>
                <Button label={t('common.cancel')} variant="ghost" onPress={close} />
              </View>
              <View style={styles.flex}>
                <Button
                  label={t('exercises.detail.save')}
                  onPress={() => void onSave()}
                  disabled={!canSave || saving}
                  loading={saving}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '85%',
  },
  content: { padding: 20, gap: 16 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 18, letterSpacing: -0.3 },
  field: { gap: 6 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  multiline: { minHeight: 96, paddingTop: 12, paddingBottom: 12 },
  actions: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});

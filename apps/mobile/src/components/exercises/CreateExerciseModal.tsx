import { useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MUSCLE_GROUPS, type MuscleGroup } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Segment } from '@/components/Segment';
import { TextField } from '@/components/TextField';
import { addCustomExercise } from '@/data/repositories/exercise-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type CreateExerciseModalProps = { visible: boolean; onClose: () => void };

/**
 * Modale bottom-sheet de création d'un exercice personnalisé (nom + groupe
 * musculaire). Patron `ExerciseFilterDrawer`. État de formulaire interne, réinitialisé
 * à chaque fermeture (ajout, annulation, dismiss). Métier : `addCustomExercise`.
 */
export function CreateExerciseModal({ visible, onClose }: CreateExerciseModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup>('chest');
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0;

  const reset = () => {
    setName('');
    setMuscle('chest');
    setSaving(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const onAdd = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await addCustomExercise(name.trim(), muscle);
      close();
    } catch (e) {
      console.warn('addCustomExercise a échoué', e);
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
            <Text style={[styles.title, { color: colors.text }]}>{t('exercises.createTitle')}</Text>

            <TextField
              label={t('exercises.customName')}
              value={name}
              onChangeText={setName}
              autoCapitalize="sentences"
              placeholder={t('exercises.customNamePlaceholder')}
            />

            <Segment
              options={MUSCLE_GROUPS}
              value={muscle}
              onChange={setMuscle}
              label={(m) => t(`muscle.${m}`)}
              scrollable
            />

            <View style={styles.actions}>
              <View style={styles.flex}>
                <Button label={t('common.cancel')} variant="ghost" onPress={close} />
              </View>
              <View style={styles.flex}>
                <Button
                  label={t('exercises.add')}
                  onPress={() => void onAdd()}
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
    maxHeight: '80%',
  },
  content: { padding: 20, gap: 16 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 18, letterSpacing: -0.3 },
  actions: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});

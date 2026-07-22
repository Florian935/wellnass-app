import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MUSCLE_GROUPS, EQUIPMENTS, type MuscleGroup, type Equipment } from '@wellness/shared';
import { Button } from '@/components/Button';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type ExerciseFilterDrawerProps = {
  visible: boolean;
  onClose: () => void;
  muscles: MuscleGroup[];
  onMusclesChange: (m: MuscleGroup[]) => void;
  equipment: Equipment[];
  onEquipmentChange: (e: Equipment[]) => void;
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Tiroir de filtres (groupe musculaire + matériel) partagé par `ExercisePicker`
 * et l'écran bibliothèque `exercises.tsx`. OU au sein d'une facette, ET entre
 * facettes (cohérent avec `buildExerciseFilterClause`, shared). Pas de bouton
 * « Appliquer » : fermer le tiroir applique la sélection courante.
 */
export function ExerciseFilterDrawer({
  visible,
  onClose,
  muscles,
  onMusclesChange,
  equipment,
  onEquipmentChange,
}: ExerciseFilterDrawerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const hasFilters = muscles.length > 0 || equipment.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.section, { color: colors.textMuted }]}>
            {t('exercises.filterDrawer.muscleSection')}
          </Text>
          <View style={styles.chips}>
            {MUSCLE_GROUPS.map((m) => (
              <Pressable
                key={m}
                onPress={() => onMusclesChange(toggle(muscles, m))}
                style={[
                  styles.chip,
                  {
                    backgroundColor: muscles.includes(m) ? colors.accent : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={{ color: muscles.includes(m) ? colors.accentText : colors.text, fontSize: 13 }}>
                  {t(`muscle.${m}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.section, { color: colors.textMuted }]}>
            {t('exercises.filterDrawer.equipmentSection')}
          </Text>
          <View style={styles.chips}>
            {EQUIPMENTS.map((eq) => (
              <Pressable
                key={eq}
                onPress={() => onEquipmentChange(toggle(equipment, eq))}
                style={[
                  styles.chip,
                  {
                    backgroundColor: equipment.includes(eq) ? colors.accent : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={{ color: equipment.includes(eq) ? colors.accentText : colors.text, fontSize: 13 }}>
                  {t(`equipment.${eq}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          {hasFilters && (
            <Button
              label={t('exercises.filterDrawer.reset')}
              variant="ghost"
              onPress={() => {
                onMusclesChange([]);
                onEquipmentChange([]);
              }}
            />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '70%',
  },
  content: { padding: 20, gap: 10 },
  section: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
});

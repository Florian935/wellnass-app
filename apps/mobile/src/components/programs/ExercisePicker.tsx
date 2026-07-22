import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MuscleGroup, Equipment } from '@wellness/shared';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import {
  useExercises,
  type ExerciseListItem,
} from '@/data/repositories/exercise-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { ExerciseFilterDrawer } from './ExerciseFilterDrawer';

type ExercisePickerProps = {
  visible: boolean;
  onClose: () => void;
  /** Appelé avec l'exercice choisi ; la fermeture est gérée par l'appelant. */
  onPick: (exercise: ExerciseListItem) => void;
};

/**
 * Sélecteur d'exercice en modal : liste réactive `useExercises` avec champ de
 * recherche (même motif que l'écran `exercises.tsx`). Sélectionner un exercice
 * déclenche `onPick`.
 */
export function ExercisePicker({ visible, onClose, onPick }: ExercisePickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { exercises, isLoading } = useExercises(query, muscles, equipment);
  const filterCount = muscles.length + equipment.length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('programs.edit.picker.title')}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('programs.edit.picker.close')}
          >
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <TextField
              label={t('exercises.search')}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              placeholder={t('exercises.searchPlaceholder')}
            />
          </View>
          <Pressable
            onPress={() => setFiltersOpen(true)}
            accessibilityRole="button"
            style={[
              styles.filtersButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.filtersLabel, { color: colors.text }]}>
              {t('exercises.filters')}
              {filterCount > 0 ? ` · ${filterCount}` : ''}
            </Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <FlatList
            data={exercises}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={[styles.empty, { color: colors.textMuted }]}>
                  {filterCount > 0
                    ? t('exercises.emptyFiltered')
                    : t('programs.edit.picker.empty')}
                </Text>
                {filterCount > 0 ? (
                  <Button
                    variant="ghost"
                    label={t('exercises.filterDrawer.reset')}
                    onPress={() => {
                      setMuscles([]);
                      setEquipment([]);
                    }}
                  />
                ) : null}
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPick(item)}
                accessibilityRole="button"
                accessibilityLabel={item.name}
                style={[
                  styles.row,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.muscle, { color: colors.textMuted }]}>
                    {t(`muscle.${item.muscle}`)}
                    {item.equipment ? ` · ${t(`equipment.${item.equipment}`)}` : ''}
                    {item.source === 'custom' ? ` · ${t('exercises.customBadge')}` : ''}
                  </Text>
                </View>
                <Ionicons name="add" size={22} color={colors.accent} />
              </Pressable>
            )}
          />
        )}

        <ExerciseFilterDrawer
          visible={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          muscles={muscles}
          onMusclesChange={setMuscles}
          equipment={equipment}
          onEquipmentChange={setEquipment}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontFamily: fontFamily.displaySemi, fontSize: 20, letterSpacing: -0.3 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  searchField: { flex: 1 },
  filtersButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  filtersLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  list: { padding: 20, gap: 10 },
  emptyWrap: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  muscle: { fontFamily: fontFamily.body, fontSize: 13 },
});

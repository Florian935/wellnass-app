import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MUSCLE_GROUPS, type MuscleGroup, type Equipment } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Segment } from '@/components/Segment';
import { TextField } from '@/components/TextField';
import { ExerciseFilterDrawer } from '@/components/programs/ExerciseFilterDrawer';
import {
  useExercises,
  addCustomExercise,
  toggleFavorite,
  type ExerciseListItem,
} from '@/data/repositories/exercise-repository';
import {
  addExerciseToWorkout,
  replaceExercise,
  useActiveWorkout,
} from '@/data/repositories/workout-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function ExercisesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { replaceExerciseId, mode } = useLocalSearchParams<{ replaceExerciseId?: string; mode?: string }>();
  const browse = mode === 'browse';

  const { workout: active } = useActiveWorkout();

  const [query, setQuery] = useState('');
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>('chest');

  const { exercises, isLoading } = useExercises(query, muscles, equipment);
  const filterCount = muscles.length + equipment.length;

  // Trie côté JS : favoris en premier, puis ordre alphabétique déjà fourni par SQL
  const items = [...exercises].sort((a, b) => {
    const fa = a.isFavorite ? 0 : 1;
    const fb = b.isFavorite ? 0 : 1;
    return fa - fb;
  });

  // Mode remplacement (US Refonte-C3) : exclut les exercices déjà présents
  // dans la séance active, pour ne proposer que des remplacements pertinents.
  const filteredItems = replaceExerciseId
    ? items.filter((item) => !active?.entries.some((e) => e.exerciseId === item.id))
    : items;

  const onPick = async (item: ExerciseListItem) => {
    if (browse) {
      router.push(`/exercises/${item.id}`);
      return;
    }
    if (active) {
      if (replaceExerciseId) {
        await replaceExercise(active.id, replaceExerciseId, item.id);
      } else {
        await addExerciseToWorkout(active.id, item.id);
      }
      router.back();
    }
  };

  const onCreate = async () => {
    if (!newName.trim()) return;
    await addCustomExercise(newName, newMuscle);
    setNewName('');
    setCreating(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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

      {creating ? (
        <View style={[styles.createBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextField label={t('exercises.customName')} value={newName} onChangeText={setNewName} autoCapitalize="sentences" />
          <Segment
            options={MUSCLE_GROUPS}
            value={newMuscle}
            onChange={setNewMuscle}
            label={(m) => t(`muscle.${m}`)}
          />
          <View style={styles.createActions}>
            <View style={styles.flex}><Button label={t('common.cancel')} variant="ghost" onPress={() => setCreating(false)} /></View>
            <View style={styles.flex}><Button label={t('exercises.add')} onPress={onCreate} /></View>
          </View>
        </View>
      ) : (
        <View style={styles.createTrigger}>
          <Button label={t('exercises.createCustom')} variant="ghost" onPress={() => setCreating(true)} />
        </View>
      )}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
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
              onPress={() => void onPick(item)}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.rowText}>
                <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.muscle, { color: colors.textMuted }]}>
                  {t(`muscle.${item.muscle}`)}
                  {item.equipment ? ` · ${t(`equipment.${item.equipment}`)}` : ''}
                  {item.source === 'custom' ? ` · ${t('exercises.customBadge')}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => toggleFavorite(item.id)} hitSlop={10}>
                <Ionicons
                  name={item.isFavorite ? 'star' : 'star-outline'}
                  size={22}
                  color={item.isFavorite ? colors.accent : colors.textMuted}
                />
              </Pressable>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  searchField: { flex: 1 },
  filtersButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  filtersLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  createTrigger: { paddingHorizontal: 20, paddingTop: 8 },
  createBox: { margin: 20, marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  createActions: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  list: { padding: 20, gap: 10 },
  emptyWrap: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  empty: { fontFamily: fontFamily.body, fontSize: 14, textAlign: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  muscle: { fontFamily: fontFamily.body, fontSize: 13 },
});

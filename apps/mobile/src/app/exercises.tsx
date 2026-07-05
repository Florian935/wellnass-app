import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MUSCLE_GROUPS, SEED_EXERCISES, type MuscleGroup } from '@/data/exercises';
import { Button } from '@/components/Button';
import { Segment } from '@/components/Segment';
import { TextField } from '@/components/TextField';
import { useExerciseStore } from '@/stores/exercise-store';
import { useWorkoutStore } from '@/stores/workout-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type LibraryItem = { id: string; name: string; muscle: MuscleGroup; custom: boolean };

export default function ExercisesScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const lang = i18n.language.startsWith('en') ? 'en' : 'fr';

  const customExercises = useExerciseStore((s) => s.customExercises);
  const favoriteIds = useExerciseStore((s) => s.favoriteIds);
  const toggleFavorite = useExerciseStore((s) => s.toggleFavorite);
  const addCustom = useExerciseStore((s) => s.addCustom);
  const addExercise = useWorkoutStore((s) => s.addExercise);
  const hasActive = useWorkoutStore((s) => s.active !== null);

  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>('chest');

  const items = useMemo<LibraryItem[]>(() => {
    const seed: LibraryItem[] = SEED_EXERCISES.map((e) => ({
      id: e.id,
      name: e.name[lang],
      muscle: e.muscle,
      custom: false,
    }));
    const custom: LibraryItem[] = customExercises.map((e) => ({ ...e, custom: true }));
    const all = [...custom, ...seed];
    const filtered = query
      ? all.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()))
      : all;
    return filtered.sort((a, b) => {
      const fa = favoriteIds.includes(a.id) ? 0 : 1;
      const fb = favoriteIds.includes(b.id) ? 0 : 1;
      return fa - fb;
    });
  }, [customExercises, favoriteIds, lang, query]);

  const onPick = (item: LibraryItem) => {
    if (hasActive) {
      addExercise(item.id, item.name);
      router.back();
    }
  };

  const onCreate = () => {
    if (!newName.trim()) return;
    addCustom(newName, newMuscle);
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

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const favorite = favoriteIds.includes(item.id);
          return (
            <Pressable
              onPress={() => onPick(item)}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.rowText}>
                <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.muscle, { color: colors.textMuted }]}>
                  {t(`muscle.${item.muscle}`)}
                  {item.custom ? ` · ${t('exercises.customBadge')}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => toggleFavorite(item.id)} hitSlop={10}>
                <Ionicons
                  name={favorite ? 'star' : 'star-outline'}
                  size={22}
                  color={favorite ? colors.accent : colors.textMuted}
                />
              </Pressable>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: { paddingHorizontal: 20, paddingTop: 16 },
  searchField: { flex: 1 },
  createTrigger: { paddingHorizontal: 20, paddingTop: 8 },
  createBox: { margin: 20, marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  createActions: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  list: { padding: 20, gap: 10 },
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

import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { BodyExerciseMatch, FineMuscle } from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function BodyMuscleDetail({ muscle, exercises, isLoading, error, query, onQueryChange, onOpenExercise }: {
  muscle: FineMuscle; exercises: BodyExerciseMatch[]; isLoading: boolean; error: unknown;
  query: string; onQueryChange: (value: string) => void; onOpenExercise: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View accessibilityLiveRegion="polite">
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{t(`muscleFine.${muscle}`)}</Text>
        <Text style={[styles.anatomy, { color: colors.textMuted }]}>{t(`bodyExplorer.anatomy.${muscle}`)}</Text>
      </View>
      <Text style={[styles.subheading, { color: colors.text }]}>{t('bodyExplorer.exercises')}</Text>
      <View style={[styles.search, { borderColor: colors.borderStrong }]}>
        <Ionicons name="search-outline" size={19} color={colors.textMuted} />
        <TextInput accessibilityLabel={t('bodyExplorer.search')} placeholder={t('bodyExplorer.search')} placeholderTextColor={colors.textMuted}
          value={query} onChangeText={onQueryChange} autoCorrect={false} returnKeyType="search"
          style={[styles.input, { color: colors.text }]} />
        {query.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={t('bodyExplorer.clearSearch')} onPress={() => onQueryChange('')} style={styles.clear}>
          <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
        </Pressable> : null}
      </View>
      {isLoading ? <ActivityIndicator accessibilityLabel={t('bodyExplorer.loading')} color={colors.accent} />
        : error ? <Text accessibilityRole="alert" style={[styles.message, { color: colors.textMuted }]}>{t('bodyExplorer.error')}</Text>
          : exercises.length === 0 ? <Text style={[styles.message, { color: colors.textMuted }]}>{t(query.trim() ? 'bodyExplorer.noResults' : 'bodyExplorer.empty')}</Text>
            : <View>{exercises.map((exercise) => (
              <Pressable key={exercise.id} accessibilityRole="button" accessibilityLabel={[
                exercise.name, exercise.isFavorite ? t('bodyExplorer.favorite') : null,
                exercise.equipment ? t(`equipment.${exercise.equipment}`) : null,
                exercise.inferred ? t('bodyExplorer.inferred') : null,
              ].filter(Boolean).join(', ')}
                onPress={() => onOpenExercise(exercise.id)} style={[styles.exercise, { borderTopColor: colors.border }]}>
                <View style={styles.exerciseText}>
                  <View style={styles.nameRow}>
                    {exercise.isFavorite ? <Ionicons name="star" size={14} color={colors.accent} /> : null}
                    <Text style={[styles.name, { color: colors.text }]}>{exercise.name}</Text>
                  </View>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {[exercise.equipment ? t(`equipment.${exercise.equipment}`) : null, exercise.inferred ? t('bodyExplorer.inferred') : null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}</View>}
      {exercises.some((exercise) => exercise.inferred) && !error ? <Text style={[styles.note, { color: colors.textMuted }]}>{t('bodyExplorer.inferredHint')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 18, gap: 12 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 26 },
  anatomy: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21 },
  subheading: { fontFamily: fontFamily.bodyBold, fontSize: 16, marginTop: 6 },
  search: { borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingLeft: 12, gap: 8 },
  input: { flex: 1, minHeight: 48, fontFamily: fontFamily.body, fontSize: 14, paddingVertical: 10 },
  clear: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  exercise: { minHeight: 64, flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, paddingVertical: 12 },
  exerciseText: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: fontFamily.bodySemi, fontSize: 15, flex: 1 },
  meta: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },
  message: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21, paddingVertical: 8 },
  note: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 18 },
});

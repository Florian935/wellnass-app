import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { useExercise, toggleFavorite } from '@/data/repositories/exercise-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Fiche exercice en lecture seule (MUSC-F10a) : nom, groupe musculaire, matériel
 * (si renseigné), instructions (si renseignées), badge « perso » pour les exercices
 * personnalisés, et bascule favori ⭐ (réutilise `toggleFavorite`).
 *
 * L'en-tête natif (titre « Fiche exercice ») est fourni par la `Stack.Screen`
 * enregistrée dans `app/_layout.tsx` : pas de `ScreenHeader` ici. Les actions perso
 * (Modifier / Supprimer) seront ajoutées en Task 5.
 */
export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = typeof id === 'string' ? id : '';

  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { exercise, isLoading } = useExercise(exerciseId);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!exercise) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFound, { color: colors.textMuted }]}>
          {t('exercises.detail.notFound')}
        </Text>
        <Button label={t('common.back')} variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={[styles.name, { color: colors.text }]}>{exercise.name}</Text>
          {exercise.source === 'custom' ? (
            <Text style={[styles.badge, { color: colors.accent }]}>
              {t('exercises.customBadge')}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => toggleFavorite(exercise.id)}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Ionicons
            name={exercise.isFavorite ? 'star' : 'star-outline'}
            size={26}
            color={exercise.isFavorite ? colors.accent : colors.textMuted}
          />
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {t('exercises.detail.muscle')}
        </Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {t(`muscle.${exercise.muscle}`)}
        </Text>
      </View>

      {exercise.equipment ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('exercises.detail.equipment')}
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {t(`equipment.${exercise.equipment}`)}
          </Text>
        </View>
      ) : null}

      {exercise.instructions ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('exercises.detail.instructions')}
          </Text>
          <Text style={[styles.instructions, { color: colors.text }]}>
            {exercise.instructions}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center', gap: 16, padding: 20 },
  content: { padding: 20, gap: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  titleText: { flex: 1, gap: 4 },
  name: { fontFamily: fontFamily.displayBold, fontSize: 24, letterSpacing: -0.5 },
  badge: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  field: { gap: 4 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  value: { fontFamily: fontFamily.body, fontSize: 16 },
  instructions: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22 },
  notFound: { fontFamily: fontFamily.body, fontSize: 15, textAlign: 'center' },
});

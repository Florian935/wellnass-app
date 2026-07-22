import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  EQUIPMENTS,
  MUSCLE_GROUPS,
  type Equipment,
  type MuscleGroup,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Segment } from '@/components/Segment';
import { TextField } from '@/components/TextField';
import {
  useExercise,
  toggleFavorite,
  updateCustomExercise,
  deleteCustomExercise,
} from '@/data/repositories/exercise-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Options du sélecteur de matériel : sentinelle `'none'` en tête (le `Segment`
 * exige une valeur non-null) qui représente « aucun matériel » (equipment = null),
 * suivie des équipements canoniques.
 */
const EQUIPMENT_OPTIONS = ['none', ...EQUIPMENTS] as const;
type EquipmentOption = (typeof EQUIPMENT_OPTIONS)[number];

/**
 * Fiche exercice (MUSC-F10a) : nom, groupe musculaire, matériel (si renseigné),
 * instructions (si renseignées), badge « perso » pour les exercices personnalisés,
 * et bascule favori ⭐ (réutilise `toggleFavorite`).
 *
 * Pour les exercices **personnalisés** (`source === 'custom'`), la fiche expose
 * en plus les actions **Modifier** (formulaire d'édition inline) et **Supprimer**
 * (confirmation puis retour). Ces actions sont masquées pour la bibliothèque.
 *
 * L'en-tête natif (titre « Fiche exercice ») est fourni par la `Stack.Screen`
 * enregistrée dans `app/_layout.tsx` : pas de `ScreenHeader` ici.
 */
export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = typeof id === 'string' ? id : '';

  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { exercise, isLoading } = useExercise(exerciseId);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMuscle, setEditMuscle] = useState<MuscleGroup>('chest');
  const [editEquipment, setEditEquipment] = useState<Equipment | null>(null);

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

  const isCustom = exercise.source === 'custom';
  const canSave = editName.trim().length > 0;

  const onStartEdit = () => {
    setEditName(exercise.name);
    setEditMuscle(exercise.muscle);
    setEditEquipment(exercise.equipment as Equipment | null);
    setIsEditing(true);
  };

  const onSave = async () => {
    if (!canSave) return;
    await updateCustomExercise(exercise.id, {
      name: editName,
      muscle: editMuscle,
      equipment: editEquipment,
    });
    setIsEditing(false);
  };

  const onDelete = () => {
    Alert.alert(exercise.name, t('exercises.detail.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('exercises.detail.delete'),
        style: 'destructive',
        onPress: () => {
          // Offline-first : l'écriture locale doit réussir. On isole toute erreur
          // (log) pour ne pas crasher, puis on revient à l'écran précédent.
          void deleteCustomExercise(exercise.id)
            .catch((e) => console.warn('deleteCustomExercise a échoué', e))
            .finally(() => router.back());
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={[styles.name, { color: colors.text }]}>{exercise.name}</Text>
          {isCustom ? (
            <Text style={[styles.badge, { color: colors.accent }]}>
              {t('exercises.customBadge')}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => toggleFavorite(exercise.id)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('exercises.detail.favorite')}
          accessibilityState={{ selected: exercise.isFavorite }}
        >
          <Ionicons
            name={exercise.isFavorite ? 'star' : 'star-outline'}
            size={26}
            color={exercise.isFavorite ? colors.accent : colors.textMuted}
          />
        </Pressable>
      </View>

      {isEditing ? (
        <View style={styles.form}>
          <Text style={[styles.editTitle, { color: colors.text }]}>
            {t('exercises.detail.editTitle')}
          </Text>

          <TextField
            label={t('exercises.customName')}
            value={editName}
            onChangeText={setEditName}
            autoCapitalize="sentences"
          />

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textMuted }]}>
              {t('exercises.detail.muscle')}
            </Text>
            <Segment
              options={MUSCLE_GROUPS}
              value={editMuscle}
              onChange={setEditMuscle}
              label={(m) => t(`muscle.${m}`)}
              scrollable
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textMuted }]}>
              {t('exercises.detail.equipment')}
            </Text>
            <Segment
              options={EQUIPMENT_OPTIONS}
              value={editEquipment ?? 'none'}
              onChange={(opt: EquipmentOption) =>
                setEditEquipment(opt === 'none' ? null : opt)
              }
              label={(opt) =>
                opt === 'none' ? t('exercises.detail.equipmentNone') : t(`equipment.${opt}`)
              }
              scrollable
            />
          </View>

          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button
                label={t('common.cancel')}
                variant="ghost"
                onPress={() => setIsEditing(false)}
              />
            </View>
            <View style={styles.flex}>
              <Button
                label={t('exercises.detail.save')}
                onPress={() => void onSave()}
                disabled={!canSave}
              />
            </View>
          </View>
        </View>
      ) : (
        <>
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

          {isCustom ? (
            <View style={styles.actions}>
              <View style={styles.flex}>
                <Button
                  label={t('exercises.detail.edit')}
                  variant="ghost"
                  onPress={onStartEdit}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label={t('exercises.detail.delete')}
                  variant="destructive"
                  onPress={onDelete}
                />
              </View>
            </View>
          ) : null}
        </>
      )}
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
  form: { gap: 16 },
  editTitle: { fontFamily: fontFamily.displayBold, fontSize: 18, letterSpacing: -0.3 },
  field: { gap: 4 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  value: { fontFamily: fontFamily.body, fontSize: 16 },
  instructions: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  notFound: { fontFamily: fontFamily.body, fontSize: 15, textAlign: 'center' },
});

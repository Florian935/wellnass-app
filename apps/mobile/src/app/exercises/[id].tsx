import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { EditExerciseModal } from '@/components/exercises/EditExerciseModal';
import {
  useExercise,
  toggleFavorite,
  deleteCustomExercise,
} from '@/data/repositories/exercise-repository';
import { useExerciseVariants, removeExerciseVariant } from '@/data/repositories/exercise-variant-repository';
import { useExerciseFicheRecords } from '@/data/repositories/records-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Formate un timestamp ISO en date locale JJ/MM/AAAA (zéros de tête). */
function formatRecordDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

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

  // Records de la fiche (F10b) — hooks appelés inconditionnellement au niveau
  // racine (règle des hooks) avec l'`exerciseId` des params, avant tout retour
  // anticipé (`exercise` n'est pas encore disponible ici).
  const units = useUnits();
  const { records, isLoading: recordsLoading } = useExerciseFicheRecords(exerciseId);
  const { variants, isLoading: variantsLoading } = useExerciseVariants(exerciseId);

  const [editOpen, setEditOpen] = useState(false);

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

  // Tuiles records : on n'inclut que les records non-nuls (mode lecture).
  const recordTiles: { key: string; label: string; value: string; meta: string }[] = [];
  if (records.oneRepMax) {
    const badge = records.oneRepMax.real
      ? t('exercises.detail.records.real')
      : t('exercises.detail.records.estimated');
    recordTiles.push({
      key: 'oneRepMax',
      label: t('exercises.detail.records.oneRepMax'),
      value: units.formatWeight(records.oneRepMax.value),
      meta: `${badge} · ${formatRecordDate(records.oneRepMax.date)}`,
    });
  }
  if (records.maxWeight) {
    recordTiles.push({
      key: 'maxWeight',
      label: t('progress.records.type.max_weight'),
      value: units.formatWeight(records.maxWeight.value),
      meta: formatRecordDate(records.maxWeight.date),
    });
  }
  if (records.bestVolume) {
    recordTiles.push({
      key: 'bestVolume',
      label: t('progress.records.type.best_volume'),
      value: records.bestVolume.value.toFixed(0),
      meta: formatRecordDate(records.bestVolume.date),
    });
  }

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

      <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textMuted }]}>
              {t('exercises.detail.muscle')}
            </Text>
            <Text style={[styles.value, { color: colors.text }]}>
              {t(`muscle.${exercise.muscle}`)}
            </Text>
          </View>

          {exercise.musclesSecondary.length > 0 ? (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textMuted }]}>
                {t('exercises.detail.secondaryMuscles')}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {exercise.musclesSecondary.map((m) => t(`muscle.${m}`)).join(' · ')}
              </Text>
            </View>
          ) : null}

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

          <View style={styles.records}>
            <Text style={[styles.recordsTitle, { color: colors.text }]}>
              {t('exercises.detail.records.title')}
            </Text>
            {recordsLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : recordTiles.length === 0 ? (
              <Text style={[styles.recordsEmpty, { color: colors.textMuted }]}>
                {t('progress.records.empty')}
              </Text>
            ) : (
              <>
                <View style={styles.recordsGrid}>
                  {recordTiles.map((tile) => (
                    <View
                      key={tile.key}
                      style={[
                        styles.recordChip,
                        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.recordLabel, { color: colors.textMuted }]}>
                        {tile.label}
                      </Text>
                      <Text style={[styles.recordValue, { color: colors.text }]}>
                        {tile.value}
                      </Text>
                      <Text style={[styles.recordMeta, { color: colors.textMuted }]}>
                        {tile.meta}
                      </Text>
                    </View>
                  ))}
                </View>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/progress',
                      params: { exerciseId: exercise.id },
                    })
                  }
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text style={[styles.seeProgression, { color: colors.accent }]}>
                    {t('exercises.detail.records.seeProgression')}
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.field}>
            <Text style={[styles.recordsTitle, { color: colors.text }]}>
              {t('exercises.detail.variants')}
            </Text>
            {variantsLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : variants.length === 0 ? (
              <Text style={[styles.recordsEmpty, { color: colors.textMuted }]}>
                {t('exercises.detail.variantsEmpty')}
              </Text>
            ) : (
              variants.map((v) => (
                <View key={v.otherId} style={styles.variantRow}>
                  <Pressable
                    style={styles.variantName}
                    onPress={() => router.push(`/exercises/${v.otherId}`)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.value, { color: colors.text }]}>
                      {v.name}
                      {v.source === 'custom' ? ` · ${t('exercises.customBadge')}` : ''}
                    </Text>
                  </Pressable>
                  {v.canRemove ? (
                    <Pressable
                      onPress={() => void removeExerciseVariant(v.linkId)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={t('exercises.detail.removeVariant')}
                    >
                      <Ionicons name="close" size={20} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
            <Pressable
              onPress={() =>
                router.push({ pathname: '/exercises', params: { mode: 'pickVariant', forExerciseId: exercise.id } })
              }
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={[styles.seeProgression, { color: colors.accent }]}>
                {t('exercises.detail.addVariant')}
              </Text>
            </Pressable>
          </View>

          {isCustom ? (
            <View style={styles.actions}>
              <View style={styles.flex}>
                <Button
                  label={t('exercises.detail.edit')}
                  variant="ghost"
                  onPress={() => setEditOpen(true)}
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

      {isCustom ? (
        <EditExerciseModal
          key={exercise.id}
          visible={editOpen}
          exercise={exercise}
          onClose={() => setEditOpen(false)}
        />
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
  actions: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  notFound: { fontFamily: fontFamily.body, fontSize: 15, textAlign: 'center' },
  // Section records (F10b) — styles recopiés des record-chips de /progress
  // (duplication assumée, dette de partage notée dans la spec §7).
  records: { gap: 12 },
  recordsTitle: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.2 },
  recordsEmpty: { fontFamily: fontFamily.body, fontSize: 14 },
  recordsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  recordChip: {
    flex: 1,
    minWidth: '28%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    alignItems: 'center',
  },
  recordLabel: { fontFamily: fontFamily.body, fontSize: 12, textAlign: 'center' },
  recordValue: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.2 },
  recordMeta: { fontFamily: fontFamily.body, fontSize: 10, textAlign: 'center' },
  seeProgression: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  variantRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  variantName: { flex: 1 },
});

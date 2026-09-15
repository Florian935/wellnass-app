/**
 * Le plan de la séance, à la demande — US MUSCU-UX03, spec §4.2.
 *
 * ── Pourquoi une feuille, et pas une liste permanente ───────────────────────────────────────────
 * Le mode immersif ne montre **qu'une série à la fois** : c'est tout son propos. La liste complète
 * n'a pas disparu pour autant — elle est à un appui, sur la ligne « Ensuite » du pont ou du repos.
 *
 * ── Rien n'est redessiné ────────────────────────────────────────────────────────────────────────
 * Le contenu est **exactement** `ExerciseList`, le composant du mode classique : dé-valider une
 * série, en supprimer une, en ajouter une, réordonner, « Plus tard », « Remplacer », les notes
 * d'exercice et les liens superset s'y comportent à l'identique. Réécrire une liste immersive
 * aurait produit deux listes à maintenir, dont une moins complète.
 */

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ExerciseList } from '@/components/workout/ExerciseList';
import type { ImmersiveRuntime } from '@/components/workout/immersive/types';
import { fontFamily } from '@/theme/fonts';

type Props = {
  visible: boolean;
  onClose: () => void;
  runtime: ImmersiveRuntime;
};

export function SessionPlanSheet({ visible, onClose, runtime }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = runtime;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={styles.dismissZone}
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, paddingBottom: insets.bottom + 12 },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{t('immersive.plan.title')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={12}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <ExerciseList
              entries={runtime.entries}
              currentExerciseId={runtime.currentExerciseId}
              onSelect={(exerciseId) => {
                runtime.onSelectExercise(exerciseId);
                onClose();
              }}
              onToggleSetDone={runtime.onToggleSetDone}
              onRemoveSet={runtime.onRemoveSet}
              onAddSet={runtime.onAddSet}
              onReorder={runtime.onReorder}
              onSendLater={runtime.onSendLater}
              onReplace={runtime.onReplace}
              exerciseNotes={runtime.exerciseNotes}
              supersetPairs={runtime.supersetPairs}
              colors={colors}
            />

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onClose();
                runtime.onAddExercise();
              }}
              style={[styles.addExercise, { borderColor: colors.border }]}
            >
              <Ionicons name="add" size={18} color={colors.accent} />
              <Text style={[styles.addExerciseLabel, { color: colors.accent }]}>
                {t('workout.addExercise')}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0000008a' },
  dismissZone: { flex: 1 },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: { fontFamily: fontFamily.displayBold, fontSize: 20, letterSpacing: -0.5 },
  content: { paddingBottom: 12, gap: 12 },
  addExercise: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
  },
  addExerciseLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14.5 },
});

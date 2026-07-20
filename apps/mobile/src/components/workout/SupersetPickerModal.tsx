import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fontFamily } from '@/theme/fonts';
import type { Palette } from '@/theme/colors';

type SupersetCandidate = { exerciseId: string; exerciseName: string };

type SupersetPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Exercices de la séance pouvant être choisis comme partenaire (déjà filtrés par le parent). */
  candidates: SupersetCandidate[];
  onPick: (exerciseId: string) => void;
  colors: Palette;
};

/**
 * Choix du partenaire superset (US Refonte-C3, révision recette 20/07/2026) :
 * liste des AUTRES exercices de la séance en cours (pas la bibliothèque
 * complète — contrairement à `ExercisePicker`, pas de recherche nécessaire,
 * la liste est courte et déjà chargée en mémoire par le parent). Sélectionner
 * un exercice déclenche `onPick` ; la fermeture est gérée par l'appelant.
 */
export function SupersetPickerModal({
  visible,
  onClose,
  candidates,
  onPick,
  colors,
}: SupersetPickerModalProps) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('workout.superset.pickerTitle')}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>

        {candidates.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>{t('workout.superset.pickerEmpty')}</Text>
        ) : (
          <View style={styles.list}>
            {candidates.map((candidate) => (
              <Pressable
                key={candidate.exerciseId}
                onPress={() => onPick(candidate.exerciseId)}
                accessibilityRole="button"
                accessibilityLabel={candidate.exerciseName}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.name, { color: colors.text }]}>{candidate.exerciseName}</Text>
                <Ionicons name="link" size={20} color={colors.accent} />
              </Pressable>
            ))}
          </View>
        )}
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
  empty: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
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
  name: { fontFamily: fontFamily.bodySemi, fontSize: 16, flex: 1 },
  pressed: { opacity: 0.7 },
});

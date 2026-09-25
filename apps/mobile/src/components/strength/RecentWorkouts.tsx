/**
 * « Refaire une séance » — les trois dernières séances, visibles sans geste (US MUSCU-UX07, D1-2).
 *
 * Dans la proposition B telle que dessinée, il fallait déplier une rangée pour les voir : deux
 * gestes pour refaire la séance de mardi. Repris de A : elles sont là, chacune avec son bouton.
 * Une séance sans exercice travaillé (vide, ou d'échauffements seuls) n'a rien à rejouer.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WorkoutHistoryItem } from '@/data/repositories/workout-repository';
import { PressableScale } from '@/components/motion/PressableScale';
import { WorkoutRow } from '@/components/strength/WorkoutRow';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Nombre de séances proposées : au-delà, c'est l'historique. */
export const RECENT_LIMIT = 3;

type Props = {
  workouts: readonly WorkoutHistoryItem[];
  todayKey: string;
  onOpen: (workoutId: string) => void;
  onRedo: (workoutId: string) => void;
  onAllHistory: () => void;
};

export function RecentWorkouts({ workouts, todayKey, onOpen, onRedo, onAllHistory }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const recent = workouts.filter((w) => w.exerciseCount > 0).slice(0, RECENT_LIMIT);
  if (recent.length === 0) return null;

  return (
    <View style={styles.block} testID="strength-recent">
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t('strengthHub.redo.title')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {recent.map((item) => (
          <WorkoutRow
            key={item.id}
            item={item}
            todayKey={todayKey}
            onOpen={() => onOpen(item.id)}
            onRedo={() => onRedo(item.id)}
          />
        ))}
        <PressableScale
          testID="strength-all-history"
          onPress={onAllHistory}
          accessibilityRole="button"
          style={styles.all}
        >
          <Text style={[styles.allLabel, { color: colors.text }]}>{t('strengthHub.redo.allHistory')}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 20, letterSpacing: -0.4 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  all: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  allLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
});

/**
 * Détail d'une séance passée — le **second montage** du bilan (US MUSCU-UX02).
 *
 * ── Ce que cet écran a perdu, et pourquoi c'est le but ───────────────────────────────────────────
 * Il portait son propre `MetaRow`, ses `ExerciseCard`, `SetRow` et `RecordRow` : une seconde version
 * du récap, qui avait divergé de la première. Elle montrait le détail série par série et l'écart au
 * planifié que le récap n'avait pas, mais pas la comparaison à la séance précédente que le récap
 * avait — et elle affichait le ressenti **en brut** (« 8/10 ») là où le récap disait « Difficile »,
 * deux lectures contradictoires de `workouts.rpe`.
 *
 * Tout cela vit désormais dans `<WorkoutReport>`. Cet écran ne garde que son en-tête.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { WorkoutReport } from '@/components/workout/report/WorkoutReport';
import { useWorkoutReport } from '@/data/repositories/workout-report-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** JJ/MM/AAAA en date **locale** — un slice de l'ISO UTC décalerait le jour selon le fuseau. */
function formatDateFr(isoString: string): string {
  const d = new Date(isoString);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = typeof id === 'string' ? id : '';

  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { report, isLoading } = useWorkoutReport(workoutId);

  const back = (
    <Pressable
      onPress={() => router.back()}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
    >
      <Ionicons name="arrow-back" size={24} color={colors.accent} />
    </Pressable>
  );

  if (isLoading && report === null) {
    return (
      <Screen edges={['top']} center>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (report === null) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={t('history.detail.notFoundTitle')} action={back} />
        <Text style={[styles.notFound, { color: colors.textMuted }]}>
          {t('history.detail.notFoundMessage')}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={formatDateFr(report.startedAt)}
        subtitle={report.title ?? t('history.freeSession')}
        action={back}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <WorkoutReport report={report} context="history" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  notFound: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
});

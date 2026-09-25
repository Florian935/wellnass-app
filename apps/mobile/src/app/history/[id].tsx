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
 *
 * ── « Refaire cette séance » (US MUSCU-UX07, §4.6) ─────────────────────────────────────────────
 * Le détail d'une séance passée n'avait pas de bouton pour la refaire : il fallait revenir au hub,
 * un jour de repos, ouvrir « Séance libre ». Le bouton est collé en bas, et suit R4 (`useRedo`) :
 * pendant une séance en cours, une alerte, et rien n'est créé. Absent pour une séance sans exercice
 * travaillé, qui n'a rien à rejouer.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/motion/PressableScale';
import { WorkoutReport } from '@/components/workout/report/WorkoutReport';
import { useWorkoutReport } from '@/data/repositories/workout-report-repository';
import { useRedo } from '@/hooks/useRedo';
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
  const redo = useRedo();
  const insets = useSafeAreaInsets();

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
      {report.totals.exercises > 0 ? (
        <View style={[styles.redoBar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
          <PressableScale
            testID="history-detail-redo"
            haptic="confirm"
            onPress={() => redo(workoutId)}
            accessibilityRole="button"
            accessibilityLabel={t('history.detail.redo')}
            accessibilityHint={t('history.detail.redoHint')}
            style={[styles.redo, { backgroundColor: colors.accent }]}
          >
            <View style={styles.redoRow}>
              <Ionicons name="refresh" size={17} color={colors.accentText} />
              <Text style={[styles.redoLabel, { color: colors.accentText }]}>{t('history.detail.redo')}</Text>
            </View>
            <Text style={[styles.redoHint, { color: colors.accentText }]}>{t('history.detail.redoHint')}</Text>
          </PressableScale>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 110 },
  redoBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12 },
  redo: { minHeight: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 1 },
  redoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  redoLabel: { fontFamily: fontFamily.bodyBold, fontSize: 16.5 },
  redoHint: { fontFamily: fontFamily.body, fontSize: 12, opacity: 0.9 },
  notFound: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
});

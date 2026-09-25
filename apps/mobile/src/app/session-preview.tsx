/**
 * Aperçu de la séance du jour — US MUSCU-UX07, §4.5.
 *
 * Ouvert par « Voir les N exercices » depuis la carte du jour. Il remplace « Voir le détail », qui
 * promettait le contenu de la séance et ouvrait le planning (constat b).
 *
 * Il dit **exactement ce que Démarrer créera** (même source que `startWorkoutFromSession`) : chaque
 * exercice planifié, son objectif tel qu'écrit (« 4 × 8-12 », « 3 × AMRAP », « 1 série »), la charge
 * prévue par le programme s'il y en a une, la dernière fois en pastilles de série, et la suggestion
 * du jour **en toutes lettres, avec le libellé de la séance** (R11).
 *
 * Pas de bandeau « charges pré-remplies » : il serait faux dès que le programme fixe une charge,
 * puisque la séance démarre alors sur la charge prévue.
 *
 * Démarrer suit le chemin du hub : question du premier mode, brief immersif, verrou anti-double
 * appui (`useStartTodaySession`). En immersif, le brief annonce encore la séance : c'est assumé, il
 * fait partie du rituel et lance le chrono.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { estimateSessionMinutes, formatLastPerformance } from '@wellness/shared';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/motion/PressableScale';
import { SessionModeSheet } from '@/components/workout/immersive/SessionModeSheet';
import {
  useSessionName,
  useSessionPreview,
  type SessionPreviewExercise,
} from '@/data/repositories/session-preview-repository';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';
import { useLastPerfFormat } from '@/hooks/useLastPerfFormat';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import { useModeGate } from '@/hooks/useModeGate';
import { useProgressionSuggestion } from '@/hooks/useProgressionSuggestion';
import { useStartTodaySession } from '@/hooks/useStartTodaySession';
import { useUnits } from '@/hooks/useUnits';
import { formatProgressionSuggestion, makeLoadProposer } from '@/lib/progression-suggestion';
import { useImmersivePrefs } from '@/stores/immersive-prefs-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Params = {
  sessionId?: string;
  plannedSessionId?: string;
  programId?: string;
  weekIndex?: string;
};

export default function SessionPreviewScreen() {
  useMenuFocus('strength');
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Params>();
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : '';
  const plannedSessionId = typeof params.plannedSessionId === 'string' ? params.plannedSessionId : '';
  const program = {
    programId: typeof params.programId === 'string' && params.programId !== '' ? params.programId : null,
    weekIndex: typeof params.weekIndex === 'string' && params.weekIndex !== '' ? Number(params.weekIndex) : null,
  };

  const { exercises } = useSessionPreview(sessionId);
  const name = useSessionName(sessionId);
  const { workouts } = useWorkoutHistory();
  const modeGate = useModeGate(workouts.length > 0);
  const { start, starting } = useStartTodaySession(modeGate.gate);

  const minutes = estimateSessionMinutes(
    exercises.map((e) => ({ targetSets: e.targetSets, restSeconds: e.restSeconds })),
  );

  const back = (
    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')}>
      <Ionicons name="arrow-back" size={24} color={colors.accent} />
    </Pressable>
  );

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={name?.trim() || t('stage.strength.session')}
        subtitle={[
          t('sessionPreview.subtitle', { count: exercises.length }),
          minutes != null ? t('strengthHub.minutesShort', { count: minutes }) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        action={back}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {exercises.map((exercise, index) => (
          <PreviewRow key={`${exercise.exerciseId}-${index}`} exercise={exercise} index={index} program={program} />
        ))}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
        <PressableScale
          testID="session-preview-start"
          haptic="milestone"
          disabled={starting || sessionId === ''}
          onPress={() => start(sessionId, plannedSessionId)}
          accessibilityRole="button"
          accessibilityLabel={t('strengthHub.moment.primary.today')}
          style={[styles.start, { backgroundColor: colors.accent }]}
        >
          <Ionicons name="play" size={18} color={colors.accentText} />
          <Text style={[styles.startLabel, { color: colors.accentText }]}>{t('strengthHub.moment.primary.today')}</Text>
        </PressableScale>
      </View>

      <SessionModeSheet {...modeGate.sheet} colors={colors} />
    </Screen>
  );
}

function PreviewRow({
  exercise,
  index,
  program,
}: {
  exercise: SessionPreviewExercise;
  index: number;
  program: { programId: string | null; weekIndex: number | null };
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const format = useLastPerfFormat();
  const barKg = useImmersivePrefs((s) => s.barKg);
  const { lastPerf, suggestion } = useProgressionSuggestion(exercise.exerciseId, 0, program);

  const { target } = exercise;
  const objective = [
    target.reps !== null
      ? t('sessionPreview.target', { sets: target.sets, reps: target.reps })
      : t('sessionPreview.targetSets', { count: target.sets }),
    target.plannedWeightKg !== null
      ? t('sessionPreview.plannedLoad', { weight: units.formatWeight(target.plannedWeightKg) })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const done = lastPerf.length > 0;
  const tip = done
    ? formatProgressionSuggestion(suggestion, {
        t,
        formatWeight: units.formatWeight,
        propose: makeLoadProposer({
          isBarbell: exercise.equipment === 'barbell',
          barKg,
          imperial: units.system === 'imperial',
        }),
      })
    : t('strengthHub.lastTime.firstTime');
  // Pastilles de série : chaque série de la dernière fois, écrite seule.
  const pills = lastPerf.map((set) => formatLastPerformance([set], { ...format, maxSets: 1 }) ?? '—');

  return (
    <View
      testID={`session-preview-${exercise.exerciseId}`}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.head}>
        <View style={[styles.index, { backgroundColor: colors.text }]}>
          <Text style={[styles.indexText, { color: colors.background }]}>{index + 1}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
          {exercise.name?.trim() || '—'}
        </Text>
      </View>
      <Text style={[styles.objective, { color: colors.textMuted }]}>{objective}</Text>
      {done ? (
        <View style={styles.pills}>
          <Text style={[styles.pillsLabel, { color: colors.textMuted }]}>{t('strengthHub.lastTime.title')}</Text>
          {pills.map((pill, i) => (
            <View key={i} style={[styles.pill, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.pillText, { color: colors.text }]}>{pill}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {tip ? (
        <View style={[styles.tip, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.tipText, { color: done ? colors.accent : colors.textMuted }]}>{tip}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 10, paddingBottom: 120 },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 9 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  index: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  indexText: { fontFamily: fontFamily.monoBold, fontSize: 12 },
  name: { flex: 1, fontFamily: fontFamily.bodyBold, fontSize: 15.5 },
  objective: { fontFamily: fontFamily.mono, fontSize: 12.5 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  pillsLabel: { fontFamily: fontFamily.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginRight: 3 },
  pill: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  pillText: { fontFamily: fontFamily.mono, fontSize: 12 },
  tip: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  tipText: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12 },
  start: { minHeight: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startLabel: { fontFamily: fontFamily.bodyBold, fontSize: 17 },
});

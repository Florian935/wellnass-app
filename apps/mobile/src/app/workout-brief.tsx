/**
 * Le brief d'entrée en séance — US MUSCU-UX03, spec §5.1.
 *
 * ── Pourquoi un écran de plus avant la séance ───────────────────────────────────────────────────
 * Jusqu'ici, appuyer sur « Commencer » ouvrait directement la première série : on découvrait la
 * séance exercice par exercice, sans jamais savoir ce qui attendait ni combien de temps ça
 * prendrait. Le brief répond aux trois questions qu'on se pose sur le chemin de la salle — **quoi**,
 * **combien de temps**, **quel est l'enjeu** — puis s'efface.
 *
 * ── Rien n'est créé tant qu'on n'a pas dit oui ──────────────────────────────────────────────────
 * Le chrono part sur « C'est parti », pas à l'ouverture de cet écran : lire le plan pendant deux
 * minutes ne doit pas ajouter deux minutes à la durée de la séance. Revenir en arrière ne laisse
 * donc **aucune séance orpheline** derrière soi.
 *
 * ── Jamais imposé ──────────────────────────────────────────────────────────────────────────────
 * Il n'apparaît qu'en mode immersif, et seulement pour une séance qui a quelque chose à annoncer :
 * ni séance libre vide, ni reprise d'une séance déjà commencée.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { estimateSessionMinutes, pickCoachLine, type MuscleGroup } from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { StaggerIn } from '@/components/motion/StaggerIn';
import { RECORD_AMBER, immersivePalette } from '@/components/workout/immersive/theme';
import { useCoachVoice } from '@/components/workout/immersive/useCoachVoice';
import {
  useExerciseBests,
  useSessionBrief,
  type SessionBriefExercise,
} from '@/data/repositories/immersive-repository';
import {
  startWorkoutFromSession,
  useActiveWorkout,
} from '@/data/repositories/workout-repository';
import {
  startWorkoutFromTemplate,
  useWorkoutTemplateDetail,
} from '@/data/repositories/workout-template-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { useUnits } from '@/hooks/useUnits';
import { useImmersivePrefs } from '@/stores/immersive-prefs-store';
import { fontFamily } from '@/theme/fonts';

export default function WorkoutBriefScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const units = useUnits();
  const colors = immersivePalette;
  const lock = useActionLock();
  const coachCharacter = useImmersivePrefs((s) => s.coach);
  const speak = useCoachVoice(coachCharacter !== 'muet');

  const params = useLocalSearchParams<{
    sessionId?: string;
    plannedSessionId?: string;
    templateId?: string;
  }>();
  const sessionId = params.sessionId ?? '';
  const templateId = params.templateId ?? '';

  // Les deux lectures sont **toujours** appelées (règle des hooks) ; celle qui n'a pas d'id rend
  // une liste vide, et c'est l'autre qui alimente l'écran.
  const sessionBrief = useSessionBrief(sessionId, i18n.language);
  const { detail: template } = useWorkoutTemplateDetail(templateId);
  const { workout: active } = useActiveWorkout();

  const exercises: SessionBriefExercise[] = sessionId
    ? sessionBrief.exercises
    : (template?.exercises ?? []).map((item) => ({
        exerciseId: item.exerciseId,
        name: item.exerciseName,
        // Le détail d'un template ne porte pas le muscle principal : la ligne des muscles reste
        // donc muette pour cette provenance, plutôt que d'afficher un groupe inventé.
        musclePrimary: null,
        targetSets: item.targetSets,
        targetReps: item.targetReps,
        targetWeightKg: item.targetWeightKg,
        restSeconds: item.restSeconds,
      }));

  const name = sessionId ? sessionBrief.name : (template?.name ?? null);
  const bests = useExerciseBests(exercises.map((exercise) => exercise.exerciseId));

  const totalSets = exercises.reduce((total, exercise) => total + (exercise.targetSets ?? 0), 0);
  const minutes = estimateSessionMinutes(
    exercises.map((exercise) => ({
      targetSets: exercise.targetSets,
      restSeconds: exercise.restSeconds,
    })),
  );

  const muscles = [
    ...new Set(
      exercises
        .map((exercise) => exercise.musclePrimary)
        .filter((muscle): muscle is MuscleGroup => muscle !== null),
    ),
  ];

  // L'enjeu du jour : la première charge prévue qui dépasse un record enregistré.
  const stake = exercises
    .map((exercise) => {
      const record = bests[exercise.exerciseId]?.maxWeightKg ?? null;
      if (record === null || exercise.targetWeightKg === null) return null;
      return exercise.targetWeightKg > record
        ? { name: exercise.name, weightKg: exercise.targetWeightKg, record }
        : null;
    })
    .find((candidate) => candidate !== null);

  const coach = pickCoachLine({
    event: 'brief',
    character: coachCharacter,
    vars: { exercise: exercises[0]?.name ?? '' },
  });

  /** Démarre la séance — c'est **ici** que le chrono part, et nulle part avant. */
  const start = (openPlan: boolean) =>
    void lock(async () => {
      // Une séance déjà active ne se recrée pas : les fonctions de démarrage la renvoient telle
      // quelle, mais mieux vaut ne même pas les appeler (elles écriraient un `started_at`).
      if (!active) {
        if (sessionId) {
          await startWorkoutFromSession(sessionId, {
            plannedSessionId: params.plannedSessionId ?? undefined,
          });
        } else if (templateId) {
          await startWorkoutFromTemplate(templateId);
        }
      }
      router.replace(openPlan ? { pathname: '/workout', params: { plan: '1' } } : '/workout');
    });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={12}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-down" size={26} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <StaggerIn index={0}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>
            {t('immersive.brief.eyebrow')}
          </Text>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={3}>
            {name ?? t('immersive.brief.untitled')}
          </Text>
        </StaggerIn>

        <StaggerIn index={1}>
          <View style={styles.stats}>
            <Stat value={String(exercises.length)} label={t('workout.summary.exercises')} colors={colors} />
            <Stat value={String(totalSets)} label={t('immersive.brief.sets')} colors={colors} />
            {minutes !== null ? (
              <Stat
                value={t('workout.summary.minutes', { count: minutes })}
                label={t('workout.summary.duration')}
                colors={colors}
              />
            ) : null}
          </View>
        </StaggerIn>

        {muscles.length > 0 ? (
          <StaggerIn index={2}>
            <Text style={[styles.muscles, { color: colors.textMuted }]}>
              {muscles.map((muscle) => t(`muscle.${muscle}`)).join(' · ')}
            </Text>
          </StaggerIn>
        ) : null}

        {/* L'enjeu : on le sait **avant** de commencer, pas en découvrant la barre. */}
        {stake ? (
          <StaggerIn index={3}>
            <View style={[styles.stake, { borderColor: `${RECORD_AMBER}58`, backgroundColor: `${RECORD_AMBER}14` }]}>
              <Ionicons name="trophy-outline" size={20} color={RECORD_AMBER} />
              <Text style={[styles.stakeText, { color: colors.text }]}>
                {t('immersive.brief.stake', {
                  exercise: stake.name,
                  weight: units.formatWeight(stake.weightKg),
                  record: units.formatWeight(stake.record),
                })}
              </Text>
            </View>
          </StaggerIn>
        ) : null}

        <StaggerIn index={4}>
          <View style={[styles.list, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            {exercises.map((exercise, index) => (
              <View key={`${exercise.exerciseId}-${index}`} style={styles.listRow}>
                <Text style={[styles.listIndex, { color: colors.textMuted }]}>{index + 1}</Text>
                <Text style={[styles.listName, { color: colors.text }]} numberOfLines={1}>
                  {exercise.name}
                </Text>
                <Text style={[styles.listTarget, { color: colors.textMuted }]}>
                  {exercise.targetSets ?? '—'}
                  {exercise.targetReps ? ` × ${exercise.targetReps}` : ''}
                </Text>
              </View>
            ))}
          </View>
        </StaggerIn>

        {coach ? (
          <StaggerIn index={5}>
            <Text style={[styles.coach, { color: colors.textMuted }]}>{t(coach.key, coach.vars)}</Text>
          </StaggerIn>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PressableScale
          accessibilityRole="button"
          haptic="milestone"
          onPress={() => {
            speak(coach);
            start(false);
          }}
          style={[styles.primary, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.primaryLabel, { color: colors.accentText }]}>
            {t('immersive.brief.go')}
          </Text>
        </PressableScale>
        <Pressable accessibilityRole="button" onPress={() => start(true)} style={styles.secondary}>
          <Text style={[styles.secondaryLabel, { color: colors.textMuted }]}>
            {t('immersive.brief.edit')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Stat({
  value,
  label,
  colors,
}: {
  value: string;
  label: string;
  colors: typeof immersivePalette;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  top: { paddingHorizontal: 20, paddingTop: 8, alignItems: 'center' },
  content: { paddingHorizontal: 22, paddingBottom: 20, gap: 16 },
  eyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 34, letterSpacing: -1.3, marginTop: 6 },
  stats: { flexDirection: 'row', gap: 26 },
  stat: { gap: 2 },
  statValue: { fontFamily: fontFamily.displayXBold, fontSize: 24, letterSpacing: -0.8 },
  statLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  muscles: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  stake: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stakeText: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 14, lineHeight: 19 },
  list: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  listIndex: { width: 18, fontFamily: fontFamily.mono, fontSize: 12 },
  listName: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 14.5 },
  listTarget: { fontFamily: fontFamily.mono, fontSize: 12.5 },
  coach: { fontFamily: fontFamily.body, fontSize: 13.5, fontStyle: 'italic' },
  footer: { paddingHorizontal: 22, paddingBottom: 14, gap: 6 },
  primary: {
    minHeight: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { fontFamily: fontFamily.bodyBold, fontSize: 18 },
  secondary: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});

/**
 * Hub Musculation — **trois onglets : S'entraîner, Historique, Progrès** (US MUSCU-UX07, 25/09/2026).
 *
 * ── Pourquoi ─────────────────────────────────────────────────────────────────────────────────────
 * Test utilisateur du 23/09/2026 : « en ouvrant le pilier, ce que tu veux, c'est démarrer ta séance,
 * ou revoir tes séances pour savoir ce que tu as fait la dernière fois — l'info principale n'est pas
 * en haut ». Le hub de MUSCU-UX05 répondait très bien à « est-ce que je progresse ? » (six cartes)
 * et mal aux questions de la salle :
 *  - l'historique existait, mais **aucun bouton du hub n'y menait** ;
 *  - « Refaire une séance » n'était atteignable que les jours de repos ;
 *  - les charges de la dernière fois n'apparaissaient qu'une fois la séance lancée ;
 *  - « Voir le détail » ouvrait le planning.
 *
 * ── Ce qu'il est ─────────────────────────────────────────────────────────────────────────────────
 * Proposition B validée par Florian (« ultra clair »), avec quatre éléments repris de A (D1) :
 *   · **S'entraîner** — la carte du moment (la dernière fois, un jour de séance), Refaire en un geste,
 *     séance libre et modèles, le programme ;
 *   · **Historique** — le calendrier du mois, les séances, la dernière fois exercice par exercice ;
 *   · **Progrès** — les cartes d'analyse de MUSCU-UX05, déplacées telles quelles.
 *
 * L'onglet affiché (D3) : un paramètre `section` (lu une fois, puis effacé), sinon le dernier choisi
 * pendant la vie de l'app, sinon S'entraîner. Rien ne change d'onglet de force : pendant une séance,
 * Historique et Progrès portent une ligne « Reprendre ».
 *
 * Les onglets défilent avec la page (D2) — pas de bandeau collé en haut, retiré le 23/09 ; un nouvel
 * appui sur l'onglet Muscu de la barre du bas ramène en haut.
 */

import { useLocalSearchParams, useRouter, useScrollToTop } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { localDayKey, resolveHubSection, type HubSection } from '@wellness/shared';
import { DirectorySheet } from '@/components/strength/DirectorySheet';
import type { DoneTodayWorkout } from '@/components/strength/MomentCard';
import { ModeLine } from '@/components/strength/ModeLine';
import { ProgramProgressBar } from '@/components/strength/ProgramProgressBar';
import { StrengthHeader } from '@/components/strength/StrengthHeader';
import { StrengthWeekCard } from '@/components/strength/StrengthWeekCard';
import { SuggestedPrograms } from '@/components/strength/SuggestedPrograms';
import { TrainingContextSheet } from '@/components/strength/TrainingContextSheet';
import { HistorySection } from '@/components/strength/sections/HistorySection';
import { ProgressSection } from '@/components/strength/sections/ProgressSection';
import { TrainSection } from '@/components/strength/sections/TrainSection';
import { StageScrollView } from '@/components/stage/StageScrollView';
import { SessionModeSheet } from '@/components/workout/immersive/SessionModeSheet';
import { upsertProfile, useProfile } from '@/data/repositories/profile-repository';
import { useStrengthHub } from '@/data/repositories/strength-hub-repository';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import { useModeGate } from '@/hooks/useModeGate';
import { useRedo } from '@/hooks/useRedo';
import { useStartTodaySession } from '@/hooks/useStartTodaySession';
import { useTodayKey } from '@/hooks/useTodayKey';
import { useSessionMode } from '@/stores/session-mode-store';
import { useStrengthSection } from '@/stores/strength-section-store';
import { useTheme } from '@/theme/useTheme';

/** `AAAA-MM-JJ` → `JJ/MM` (découpage direct : `new Date('AAAA-MM-JJ')` décalerait le jour). */
function dayMonth(dayKey: string): string {
  const [, mm, dd] = dayKey.split('-');
  return `${dd}/${mm}`;
}

export default function StrengthScreen() {
  useMenuFocus('strength');
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();

  const { state, progress, programName, todayExercises, todayProgram } = useStrengthHub();
  const todayKey = useTodayKey();
  const { profile } = useProfile();
  const { workouts } = useWorkoutHistory();

  // ── L'onglet affiché (D3) ──────────────────────────────────────────────────────────────────────
  const remembered = useStrengthSection((s) => s.section);
  const setSection = useStrengthSection((s) => s.setSection);
  const section: HubSection = resolveHubSection({ param: params.section, remembered });
  useEffect(() => {
    // Un paramètre de route est lu **une fois** : laissé en place, il s'appliquerait de nouveau à
    // chaque retour sur l'onglet et écraserait le choix de l'utilisateur.
    if (params.section === undefined) return;
    setSection(section);
    router.setParams({ section: undefined });
  }, [params.section, section, setSection, router]);

  // D2 — un nouvel appui sur l'onglet Muscu ramène en haut.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  // ── Démarrer, refaire, changer de mode ─────────────────────────────────────────────────────────
  const modeGate = useModeGate(workouts.length > 0);
  const { start: startToday, starting } = useStartTodaySession(modeGate.gate);
  const redo = useRedo();
  const mode = useSessionMode((s) => s.mode);
  const setMode = useSessionMode((s) => s.setMode);
  const [changingMode, setChangingMode] = useState(false);

  // ── Feuilles ───────────────────────────────────────────────────────────────────────────────────
  const [directoryOpen, setDirectoryOpen] = useState(false);
  // US GUID-01 — la feuille « niveau + disponibilité », et le programme qu'on ouvrira juste après.
  const [contextSheetVisible, setContextSheetVisible] = useState(false);
  const [pendingProgramId, setPendingProgramId] = useState<string | null>(null);

  /**
   * La séance terminée **aujourd'hui** : le moment d'après. Seulement hors séance du jour (R2) —
   * une séance libre du matin laisse « Démarrer » à l'écran un jour de séance prévue.
   */
  const doneToday: DoneTodayWorkout | null = useMemo(() => {
    if (state.kind === 'today' || state.kind === 'resume') return null;
    const w = workouts.find((item) => item.finishedAt != null && localDayKey(new Date(item.finishedAt)) === todayKey);
    return w
      ? {
          id: w.id,
          name: w.sessionName,
          tonnageKg: w.volumeKg,
          exerciseCount: w.exerciseCount,
          recordsBeaten: w.recordCount,
        }
      : null;
  }, [state.kind, workouts, todayKey]);

  const weekLabel = progress
    ? t('strengthHub.moment.week', { week: progress.week, total: progress.totalWeeks })
    : null;

  const nextLabel =
    state.kind === 'rest'
      ? state.doneToday
        ? t('home.today.doneToday', { name: state.doneToday.name?.trim() || t('stage.strength.session') })
        : state.nextUpcoming
          ? t('home.today.next', {
              date: dayMonth(state.nextUpcoming.scheduledDate),
              name: state.nextUpcoming.name?.trim() || t('stage.strength.session'),
            })
          : null
      : null;

  const resumeName =
    state.kind === 'resume' ? state.workout.name?.trim() || t('stage.strength.freeSession') : null;

  const openWorkout = (id: string) => router.push(`/history/${id}`);
  const openExercise = (id: string) => router.push(`/exercises/${id}`);
  const onFree = () =>
    modeGate.gate(() => router.push({ pathname: '/exercises', params: { mode: 'compose' } }));

  const programBlock = (
    <>
      <StrengthWeekCard onOpenDay={() => router.push('/planning')} />
      {progress && programName ? (
        <ProgramProgressBar
          programName={programName}
          week={progress.week}
          totalWeeks={progress.totalWeeks}
          done={progress.done}
          total={progress.total}
          ratio={progress.ratio}
          onPress={() => router.push('/programs')}
        />
      ) : null}
      {state.kind === 'onboarding' ? (
        <SuggestedPrograms
          trainingLevel={profile?.trainingLevel}
          displayLevel={profile?.workoutDisplayLevel}
          weeklyAvailability={profile?.weeklyAvailability}
          onPick={(programId) => {
            // US GUID-01 — la question de contexte se pose ici, devant la bibliothèque (décision D6).
            // Elle ne bloque pas le parcours : on ouvre le programme dès qu'elle est refermée.
            if (profile != null && profile.trainingLevel == null) {
              setPendingProgramId(programId);
              setContextSheetVisible(true);
              return;
            }
            router.push(`/programs/${programId}`);
          }}
          onSeeAll={() => router.push('/programs')}
        />
      ) : null}
    </>
  );

  const closeContextSheet = () => {
    setContextSheetVisible(false);
    const target = pendingProgramId;
    setPendingProgramId(null);
    if (target) router.push(`/programs/${target}`);
  };

  return (
    <StageScrollView
      pillar="strength"
      testID="strength-screen"
      scrollRef={scrollRef}
      stage={
        <StrengthHeader
          section={section}
          onSection={setSection}
          onPlanning={() => router.push('/planning')}
          onDirectory={() => setDirectoryOpen(true)}
        />
      }
    >
      {section === 'train' ? (
        <TrainSection
          state={state}
          doneToday={doneToday}
          weekLabel={weekLabel}
          nextLabel={nextLabel}
          todayExercises={todayExercises}
          todayProgram={{
            programId: todayProgram?.programId ?? null,
            weekIndex: todayProgram?.weekIndex ?? null,
          }}
          workouts={workouts}
          todayKey={todayKey}
          starting={starting}
          modeLine={<ModeLine mode={mode} onChange={() => setChangingMode(true)} />}
          programBlock={programBlock}
          onStart={() => {
            if (state.kind === 'today') startToday(state.session.sessionId, state.session.plannedSessionId);
          }}
          onResume={() => router.push('/workout')}
          onSummary={() => doneToday && router.push(`/workout-summary?id=${doneToday.id}`)}
          onShare={() => doneToday && router.push(`/workout-summary?id=${doneToday.id}&share=1`)}
          onPlanning={() => router.push('/planning')}
          onPrograms={() => router.push('/programs')}
          onPreview={() => {
            if (state.kind !== 'today') return;
            router.push({
              pathname: '/session-preview',
              params: {
                sessionId: state.session.sessionId,
                plannedSessionId: state.session.plannedSessionId,
                // La suggestion de l'aperçu doit être celle de la séance (R11) : même programme, même
                // semaine que l'occurrence du jour.
                programId: todayProgram?.programId ?? '',
                weekIndex: todayProgram?.weekIndex != null ? String(todayProgram.weekIndex) : '',
              },
            });
          }}
          onOpenWorkout={openWorkout}
          onRedo={redo}
          onAllHistory={() => setSection('history')}
          onFree={onFree}
          onTemplates={() => router.push('/templates')}
        />
      ) : section === 'history' ? (
        <HistorySection
          workouts={workouts}
          todayKey={todayKey}
          resumeName={resumeName}
          onResume={() => router.push('/workout')}
          onOpenWorkout={openWorkout}
          onRedo={redo}
          onOpenExercise={openExercise}
        />
      ) : (
        <ProgressSection
          hasWorkouts={workouts.length > 0}
          resumeName={resumeName}
          onResume={() => router.push('/workout')}
          onInsights={() => router.push('/insights')}
          onProgress={() => router.push('/progress')}
          onBody={() => router.push('/body')}
          onOpenExercise={openExercise}
          onStart={() => setSection('train')}
        />
      )}

      <TrainingContextSheet
        visible={contextSheetVisible}
        onClose={closeContextSheet}
        onSubmit={(level, weeklyAvailability) => {
          void upsertProfile({ trainingLevel: level, weeklyAvailability });
          closeContextSheet();
        }}
        colors={colors}
      />

      <DirectorySheet
        visible={directoryOpen}
        onClose={() => setDirectoryOpen(false)}
        onPick={(target) => {
          setDirectoryOpen(false);
          if (target === 'exercises') {
            router.push({ pathname: '/exercises', params: { mode: 'browse' } });
            return;
          }
          router.push(target === 'programs' ? '/programs' : '/templates');
        }}
        colors={colors}
      />

      {/* R-MO-3 — la question du tout premier démarrage, qui rejoue ensuite l'action demandée. */}
      <SessionModeSheet {...modeGate.sheet} colors={colors} />

      {/* D4 — « Mode classique · Changer » : le mode courant présélectionné, rien ne démarre. */}
      <SessionModeSheet
        purpose="change"
        current={mode}
        visible={changingMode}
        onClose={() => setChangingMode(false)}
        onPick={(picked) => {
          setMode(picked, { remember: true });
          setChangingMode(false);
        }}
        colors={colors}
      />
    </StageScrollView>
  );
}

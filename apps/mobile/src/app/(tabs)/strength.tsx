/**
 * Hub Musculation — **un écran qui a quelque chose à dire** (US MUSCU-UX05, 19/09/2026).
 *
 * ── Ce que cet écran était ───────────────────────────────────────────────────────────────────────
 * Neuf surfaces, toutes de la même forme, qui répondaient à « où en suis-je administrativement ».
 * L'audit du 19/09 a relevé cinq défauts, et une cause sous les cinq :
 *
 *  1. **Le haut changeait cinq fois, le bas jamais.** La scène a cinq états ; le corps rendait les
 *     mêmes six blocs dans les cinq cas — un jour de repos et le lendemain d'un record affichaient
 *     le même écran.
 *  2. **La moitié des blocs parlaient de ce qui manque** : « encore 3 mesures et la projection
 *     devient possible », « rien de prévu ces prochains jours »… sur un compte qui soulevait
 *     17 tonnes par semaine.
 *  3. **Une seule forme, répétée neuf fois.** « Tu es à une série d'un record » avait le même poids
 *     visuel que « rien de prévu ».
 *  4. **Le plus gros chiffre était rangé en bas**, sous un « ▼ 49 % » sans référence écrite — et le
 *     volume hebdomadaire n'est pas une mesure de progrès : il monte quand on s'entraîne plus
 *     longtemps, pas quand on devient plus fort.
 *  5. **Le bas de l'écran était un cul-de-sac** : une date, un volume, un planning vide.
 *
 * **La cause** : sur 36 analyses muscu au catalogue, 20 sont livrées et testées — le hub en montrait
 * **une**. Et `selectInsights` (INSIGHTS-01), qui sait choisir les analyses pertinentes de l'instant
 * par pilier, n'était appelé ni ici ni nulle part côté muscu.
 *
 * ── La contrainte qui tient la refonte ──────────────────────────────────────────────────────────
 * MUSCU-UX01 avait **ramené** ce hub de 9 blocs à 6 le 10/09. « Plus sympa » ne pouvait donc pas
 * vouloir dire « plus de blocs », sinon on refaisait l'inflation qui a justifié la coupe. Le budget
 * ne bouge pas : **neuf surfaces d'administration deviennent six cartes et deux lignes.**
 *
 * Sortent : « Et si… », le widget Volume total, le widget Dernière, le widget Planning — et avec
 * eux la grille de widgets du hub. Entrent : le fil du jour, Tes charges, Ton corps, Le mur.
 *
 * ── L'ordre, et pourquoi ────────────────────────────────────────────────────────────────────────
 *   1 · `StrengthStage`      — la scène (US DASH-01), inchangée : cinq états, la silhouette
 *   2 · `DayThread`          — **la seule chose qui change tous les jours** (défaut 1)
 *   3 · `LoadProgressCard`   — la carte dominante : « est-ce que je progresse ? » (défaut 4)
 *   4 · `NearRecordsCard`    — promue : c'était déjà la meilleure carte de l'écran
 *   5 · `BodyBalanceCard`    — la silhouette cesse de décorer
 *   6 · `StrengthWeekCard`   — la semaine ET le planning, fusionnés
 *   7 · `RecordWall`         — les records tombés, en bande horizontale (défaut 3)
 *   8 · `LifetimeLine`       — une ligne, pas une carte
 *
 * Chaque carte **se tait quand elle n'a rien à dire** : c'est le défaut 2 traité à la racine.
 */

import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { localDayKey } from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { BodyBalanceCard } from '@/components/strength/BodyBalanceCard';
import { DayThread } from '@/components/strength/DayThread';
import { DirectorySheet } from '@/components/strength/DirectorySheet';
import { FreeSessionSheet, REPEATABLE_LIMIT } from '@/components/strength/FreeSessionSheet';
import { LifetimeLine } from '@/components/strength/LifetimeLine';
import { LoadProgressCard } from '@/components/strength/LoadProgressCard';
import { NearRecordsCard } from '@/components/strength/NearRecordsCard';
import { ProgramProgressBar } from '@/components/strength/ProgramProgressBar';
import { RecordWall } from '@/components/strength/RecordWall';
import { StrengthStage, type StrengthScene } from '@/components/strength/StrengthStage';
import { StrengthWeekCard } from '@/components/strength/StrengthWeekCard';
import { SuggestedPrograms } from '@/components/strength/SuggestedPrograms';
import { TrainingContextSheet } from '@/components/strength/TrainingContextSheet';
import { StageScrollView } from '@/components/stage/StageScrollView';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import {
  startWorkoutFromSession,
  startWorkoutFromWorkout,
  useWorkoutHistory,
} from '@/data/repositories/workout-repository';
import { upsertProfile, useProfile } from '@/data/repositories/profile-repository';
import { useNearRecords } from '@/data/repositories/records-repository';
import { useStrengthHub } from '@/data/repositories/strength-hub-repository';
import {
  startWorkoutFromTemplate,
  useWorkoutTemplates,
} from '@/data/repositories/workout-template-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { useTodayKey } from '@/hooks/useTodayKey';
import {
  briefRouteForSession,
  briefRouteForTemplate,
} from '@/components/workout/immersive/brief-entry';
import { SessionModeSheet } from '@/components/workout/immersive/SessionModeSheet';
import { useSessionMode } from '@/stores/session-mode-store';
import { fontFamily } from '@/theme/fonts';
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

  const { state, progress, programName, todayMuscles } = useStrengthHub();
  const todayKey = useTodayKey();
  const { profile } = useProfile();
  const [starting, setStarting] = useState(false);
  const lockStart = useActionLock();
  // US MUSCU-UX03, R-MO-3 : la question du mode, posée **une seule fois**, et seulement à
  // quelqu'un qui n'a encore rien fait. `pendingStart` retient l'action à rejouer après le choix.
  const modeChosen = useSessionMode((s) => s.chosen);
  const setSessionMode = useSessionMode((s) => s.setMode);
  const [pendingStart, setPendingStart] = useState<(() => void) | null>(null);
  // US GUID-01 — la feuille « niveau + disponibilité », et le programme qu'on ouvrira juste après.
  const [contextSheetVisible, setContextSheetVisible] = useState(false);
  const [pendingProgramId, setPendingProgramId] = useState<string | null>(null);
  // Une fois la question posée, elle ne se repose pas dans la même session d'écran — sinon
  // « ne pas retenir mon choix » bouclerait à l'infini sur la feuille.
  const modeAsked = useRef(false);
  // L'annuaire : l'icône 📚 dit « Exercices, programmes, templates » et n'ouvrait que les
  // exercices. Les templates n'avaient alors plus AUCUN point d'entrée à zéro template — voir
  // `DirectorySheet`.
  const [directoryOpen, setDirectoryOpen] = useState(false);

  const { workouts } = useWorkoutHistory();
  const { templates } = useWorkoutTemplates();

  /** Faut-il poser la question du mode avant de démarrer ? (R-MO-3) */
  const askMode = (run: () => void): boolean => {
    if (modeAsked.current || modeChosen || workouts.length > 0) return false;
    modeAsked.current = true;
    setPendingStart(() => run);
    return true;
  };

  // ── Séance libre : on choisit quoi faire, PUIS la séance existe (MUSCU-FIX02, passe 1) ───────
  // Sans modèle, l'appui créait une séance vide : chrono lancé, écran noir, « ajoute un premier
  // exercice ». La feuille propose composer / refaire / modèle, et rien n'est créé avant le choix.
  const [freeSheetOpen, setFreeSheetOpen] = useState(false);
  // Une séance sans exercice travaillé (vide, ou d'échauffements seuls) n'a rien à rejouer.
  const repeatable = workouts
    .filter((workout) => workout.exerciseCount > 0)
    .slice(0, REPEATABLE_LIMIT)
    .map((workout) => ({
      id: workout.id,
      name: workout.sessionName,
      finishedAt: workout.finishedAt,
      exerciseCount: workout.exerciseCount,
    }));

  const onStartFree = () => {
    if (askMode(onStartFree)) return;
    setFreeSheetOpen(true);
  };

  /** Démarre une séance déjà remplie puis l'ouvre — un échec laisse simplement le hub en place. */
  const startAndOpen = (start: () => Promise<string>) =>
    void lockStart(async () => {
      try {
        await start();
        router.push('/workout');
      } catch (error) {
        console.warn('Démarrage de la séance libre impossible :', error);
      }
    });

  const onComposeFree = () => {
    setFreeSheetOpen(false);
    router.push({ pathname: '/exercises', params: { mode: 'compose' } });
  };

  const onRepeatWorkout = (workoutId: string) => {
    setFreeSheetOpen(false);
    startAndOpen(() => startWorkoutFromWorkout(workoutId));
  };

  const onStartTemplate = (templateId: string) => {
    setFreeSheetOpen(false);
    // Mode immersif : le brief annonce la séance avant de la créer, comme depuis la fiche modèle.
    const brief = briefRouteForTemplate(templateId);
    if (brief) {
      router.push(brief);
      return;
    }
    startAndOpen(() => startWorkoutFromTemplate(templateId));
  };

  // `starting` ne pilote que l'affichage : la garde est portée par `useActionLock`. Un état React
  // ne voit pas un second appui du même cycle de rendu — sans le verrou, deux appuis créaient
  // DEUX séances, dont une orpheline que rien ne rouvrirait.
  const onStartToday = (sessionId: string, plannedSessionId: string) => {
    if (askMode(() => onStartToday(sessionId, plannedSessionId))) return;
    // Mode immersif : on annonce la séance **avant** de la créer (US MUSCU-UX03, §5.1). Le brief
    // porte lui-même le démarrage, pour que le chrono parte sur « C'est parti ».
    const brief = briefRouteForSession(sessionId, plannedSessionId);
    if (brief) {
      router.push(brief);
      return;
    }
    void lockStart(async () => {
      setStarting(true);
      try {
        await startWorkoutFromSession(sessionId, { plannedSessionId });
        router.push('/workout');
      } catch {
        // offline-first : échec improbable
      } finally {
        setStarting(false);
      }
    });
  };

  // ── La scène (US DASH-01, §4.4) ───────────────────────────────────────────────────────────
  /**
   * La séance terminée **aujourd'hui** : le moment d'après, le cinquième état de la scène. Le hub
   * le rangeait avec les jours de repos — on venait de soulever deux tonnes et l'écran répondait
   * « repos mérité », sans un chiffre.
   */
  const doneTodayWorkout = useMemo(
    () =>
      workouts.find(
        (w) => w.finishedAt != null && localDayKey(new Date(w.finishedAt)) === todayKey,
      ) ?? null,
    [workouts, todayKey],
  );

  const { items: nearRecordItems } = useNearRecords(1);
  const nearRecord = nearRecordItems[0] ?? null;

  const scene: StrengthScene = useMemo(() => {
    if (state.kind === 'resume') {
      return { kind: 'resume', doneSets: state.workout.doneSets, totalSets: state.workout.totalSets };
    }
    // L'après-séance prime sur le repos : il n'a de sens que le jour même.
    if (state.kind !== 'today' && doneTodayWorkout) {
      return {
        kind: 'after-session',
        name: doneTodayWorkout.sessionName,
        tonnageKg: doneTodayWorkout.volumeKg,
        exerciseCount: doneTodayWorkout.exerciseCount,
        recordsBeaten: doneTodayWorkout.recordCount,
      };
    }
    if (state.kind === 'today') {
      return {
        kind: 'today',
        name: state.session.name,
        orderIndex: state.session.orderIndex,
        programName: state.session.programName,
        exerciseCount: state.session.exerciseCount,
        estimatedMinutes: state.session.estimatedMinutes,
        previewExercises: state.session.previewExercises,
      };
    }
    if (state.kind === 'rest') {
      return {
        kind: 'rest',
        doneToday: state.doneToday !== null,
        // Mêmes libellés que la carte qu'elle remplace : « faite le … » / « prochaine le … ».
        nextLabel: state.doneToday
          ? t('home.today.doneToday', {
              name: state.doneToday.name?.trim() || t('stage.strength.session'),
            })
          : state.nextUpcoming
            ? t('home.today.next', {
                date: dayMonth(state.nextUpcoming.scheduledDate),
                name: state.nextUpcoming.name?.trim() || t('stage.strength.session'),
              })
            : null,
      };
    }
    return { kind: 'onboarding' };
  }, [state, doneTodayWorkout, t]);

  /** Le geste principal de la scène, un par état — c'est là que le hub agit. */
  const onPrimary = () => {
    switch (scene.kind) {
      case 'resume':
        return router.push('/workout');
      case 'after-session':
        return doneTodayWorkout
          ? router.push(`/workout-summary?id=${doneTodayWorkout.id}`)
          : undefined;
      case 'today':
        return state.kind === 'today'
          ? onStartToday(state.session.sessionId, state.session.plannedSessionId)
          : undefined;
      case 'rest':
        return onStartFree();
      default:
        return router.push('/programs');
    }
  };

  const onSecondary = () => {
    switch (scene.kind) {
      case 'onboarding':
        return onStartFree();
      default:
        return router.push('/planning');
    }
  };

  const openExercise = (exerciseId: string) => router.push(`/exercises/${exerciseId}`);

  return (
    <StageScrollView
      pillar="strength"
      testID="strength-screen"
      compactTitle={t('pillars.strength')}
      compactValue={progress ? t('stage.strength.weekCard.meta', { done: progress.done, planned: progress.total }) : undefined}
      stage={
        <StrengthStage
          scene={scene}
          muscles={todayMuscles}
          nearRecord={
            nearRecord
              ? { exerciseName: nearRecord.exerciseName, gapKind: nearRecord.gapKind, gap: nearRecord.gap }
              : null
          }
          weekLabel={
            progress
              ? t('stage.strength.week', {
                  week: progress.week,
                  total: progress.totalWeeks,
                  done: progress.done,
                })
              : null
          }
          busy={starting}
          onPrimary={onPrimary}
          onSecondary={onSecondary}
          onPlanning={() => router.push('/planning')}
          onDirectory={() => setDirectoryOpen(true)}
        />
      }
    >
      {/* La seule chose qui change tous les jours. Se tait s'il n'y a rien à dire. */}
      <DayThread onPress={() => router.push('/insights')} />

      {/* La carte dominante : « est-ce que je progresse ? ». */}
      <LoadProgressCard onPress={() => router.push('/progress')} />

      {/* Déjà la meilleure carte de l'écran avant la refonte — elle remonte. */}
      <NearRecordsCard onOpenExercise={openExercise} />

      {/* La silhouette au travail, plus en décor. */}
      <BodyBalanceCard onPress={() => router.push('/body')} />

      {/* La semaine ET la prochaine séance : le widget Planning a fondu ici. */}
      <StrengthWeekCard onOpenDay={() => router.push('/planning')} />

      {/* Le trophée, pas seulement la carotte — et le seul bloc qui ne se lit pas de haut en bas. */}
      <RecordWall onOpenExercise={openExercise} />

      {/* L'avancement du programme, quand il y en a un. */}
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

      {/* Les propositions, uniquement pour qui n'a pas encore de programme. */}
      {state.kind === 'onboarding' ? (
        <SuggestedPrograms
          trainingLevel={profile?.trainingLevel}
          displayLevel={profile?.workoutDisplayLevel}
          weeklyAvailability={profile?.weeklyAvailability}
          onPick={(programId) => {
            // US GUID-01 — la question de contexte se pose ici, devant la bibliothèque, et pas
            // avant : c'est le moment où elle a un objet visible (décision D6). Elle ne bloque
            // pas le parcours — on ouvre le programme dès qu'elle est refermée.
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

      {/* Une ligne, pas une carte — elle ferme la page sans ajouter une boîte de plus. */}
      <LifetimeLine onPress={() => router.push('/progress')} />

      {/* L'annuaire, en pied : la section « Suivre » et sa grille de widgets ont disparu avec les
          trois tuiles d'administration qu'elle portait. */}
      <PressableScale
        haptic="select"
        onPress={() => setDirectoryOpen(true)}
        accessibilityRole="button"
        // Pas d' : le libellé visible EST le nom accessible. En poser un
        // dupliquerait celui de l'icône de la scène, et TalkBack annoncerait deux fois la même
        // chose sans pouvoir les distinguer — trouvé par le test du hub.
        testID="strength-directory-link"
        style={[styles.directory, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Ionicons name="library-outline" size={20} color={colors.accent} />
        <Text style={[styles.directoryLabel, { color: colors.text }]} numberOfLines={1}>
          {t('strengthHub.directory')}
        </Text>
        <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
      </PressableScale>

      <TrainingContextSheet
        visible={contextSheetVisible}
        onClose={() => {
          // « Plus tard » n'écrit rien : `null` reste « pas de réponse », jamais « débutant ».
          setContextSheetVisible(false);
          const target = pendingProgramId;
          setPendingProgramId(null);
          if (target) router.push(`/programs/${target}`);
        }}
        onSubmit={(level, weeklyAvailability) => {
          void upsertProfile({ trainingLevel: level, weeklyAvailability });
          setContextSheetVisible(false);
          const target = pendingProgramId;
          setPendingProgramId(null);
          if (target) router.push(`/programs/${target}`);
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

      <FreeSessionSheet
        visible={freeSheetOpen}
        onClose={() => setFreeSheetOpen(false)}
        onCompose={onComposeFree}
        recent={repeatable}
        onRepeat={onRepeatWorkout}
        templates={templates}
        onTemplate={onStartTemplate}
        onManageTemplates={() => {
          setFreeSheetOpen(false);
          router.push('/templates');
        }}
        colors={colors}
      />

      {/* La question du mode, posée une seule fois (US MUSCU-UX03, R-MO-3). Elle rejoue ensuite
          l'action qui l'avait déclenchée : l'utilisateur voulait démarrer, pas régler quelque chose. */}
      <SessionModeSheet
        visible={pendingStart !== null}
        onClose={() => setPendingStart(null)}
        onPick={(mode, remember) => {
          setSessionMode(mode, { remember });
          const run = pendingStart;
          setPendingStart(null);
          run?.();
        }}
        colors={colors}
      />
    </StageScrollView>
  );
}

const styles = StyleSheet.create({
  directory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    minHeight: 48,
  },
  directoryLabel: { flex: 1, fontFamily: fontFamily.bodyBold, fontSize: 13 },
});

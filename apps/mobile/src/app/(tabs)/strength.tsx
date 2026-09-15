/**
 * Hub Musculation — **deux zones** (US MUSCU-UX01, 10/09/2026).
 *
 * ── Ce que cet écran était ───────────────────────────────────────────────────────────────────────
 * Une carte d'action, une ligne « bibliothèque », et une grille de **sept widgets** rendus quoi
 * qu'il arrive. Faute de prédicat `isActive` — que l'accueil passait déjà — les sept tuiles se
 * montraient **même vides** : environ 2,4 écrans de scroll sur un compte neuf, dont l'essentiel
 * n'avait rien à dire. Neuf blocs, aucune hiérarchie entre eux.
 *
 * Et sans programme actif, l'action mise en avant était « Séance libre », la moins structurée :
 * le problème 3 de l'audit de juillet, revenu par la porte du cas « pas encore de programme ».
 *
 * ── Ce qu'il est ─────────────────────────────────────────────────────────────────────────────────
 *   1 · `StrengthStage`      — la scène (US DASH-01) : les quatre états de la zone Agir, plus le
 *                              moment « après la séance », la silhouette qui encaisse l'impact et
 *                              le record à portée du jour
 *   2 · `StrengthWeekCard`   — la semaine séance par séance, touchable
 *   3 · `NearRecordsCard`    — « à ta portée », les trois records les plus proches
 *   4 · `ProgramProgressBar` — « semaine 3 sur 8 », le repère que MUSC-F15 calculait sans l'afficher
 *   5 · `SuggestedPrograms`  — trois propositions, seulement quand il n'y a pas de programme
 *   6 · `WidgetGrid`         — la zone **Suivre**, 3 widgets plafonnés et masqués s'ils sont vides
 *
 * ⚠️ La zone Agir et la ligne d'annuaire **ne sont pas des widgets** : elles ne consomment aucune
 * place au plafond `MAX_STRENGTH_WIDGETS`. Même distinction que sur l'accueil.
 */

import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { localDayKey, type StrengthWidgetId, type WidgetId, type WidgetSize } from '@wellness/shared';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BodyExplorerLink } from '@/components/body/BodyExplorerLink';
import { NearRecordsCard } from '@/components/strength/NearRecordsCard';
import { ProgramProgressBar } from '@/components/strength/ProgramProgressBar';
import { StrengthStage, type StrengthScene } from '@/components/strength/StrengthStage';
import { StrengthWeekCard } from '@/components/strength/StrengthWeekCard';
import { WhatIfCard } from '@/components/strength/WhatIfCard';
import { SuggestedPrograms } from '@/components/strength/SuggestedPrograms';
import { TrainingContextSheet } from '@/components/strength/TrainingContextSheet';
import { StageScrollView } from '@/components/stage/StageScrollView';
import { CustomizeButton } from '@/components/widgets/CustomizeButton';
import { WidgetGrid } from '@/components/widgets/WidgetGrid';
import { STRENGTH_WIDGETS } from '@/components/widgets/strength-widgets';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import {
  startWorkout,
  startWorkoutFromSession,
  useWorkoutHistory,
} from '@/data/repositories/workout-repository';
import { upsertProfile, useProfile } from '@/data/repositories/profile-repository';
import { useNearRecords } from '@/data/repositories/records-repository';
import { useStrengthHub } from '@/data/repositories/strength-hub-repository';
import { useWorkoutTemplates } from '@/data/repositories/workout-template-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { useTodayKey } from '@/hooks/useTodayKey';
import { briefRouteForSession } from '@/components/workout/immersive/brief-entry';
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
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  // US MUSCU-UX03, R-MO-3 : la question du mode, posée **une seule fois**, et seulement à
  // quelqu'un qui n'a encore rien fait. `pendingStart` retient l'action à rejouer après le choix.
  const modeChosen = useSessionMode((state) => state.chosen);
  const setSessionMode = useSessionMode((state) => state.setMode);
  const [pendingStart, setPendingStart] = useState<(() => void) | null>(null);
  // US GUID-01 — la feuille « niveau + disponibilité », et le programme qu'on ouvrira juste après.
  const [contextSheetVisible, setContextSheetVisible] = useState(false);
  const [pendingProgramId, setPendingProgramId] = useState<string | null>(null);
  // Une fois la question posée, elle ne se repose pas dans la même session d'écran — sinon
  // « ne pas retenir mon choix » bouclerait à l'infini sur la feuille.
  const modeAsked = useRef(false);

  // ── Widgets conditionnels ─────────────────────────────────────────────────────────────────
  // Le défaut corrigé : sans ce prédicat, une tuile sans donnée réserve quand même sa case et
  // laisse un carré vide. L'accueil le passait déjà ; ce hub ne le passait pas.
  const { workouts } = useWorkoutHistory();
  const { templates } = useWorkoutTemplates();
  const isWidgetActive = (id: WidgetId) => {
    // Le planning reste utile vide (il montre la semaine) ; l'historique et la progression, non.
    if (id === 'strength-history') return workouts.length > 0;
    if (id === 'strength-progress') return workouts.length > 0;
    return true;
  };

  /** Faut-il poser la question du mode avant de démarrer ? (R-MO-3) */
  const askMode = (run: () => void): boolean => {
    if (modeAsked.current || modeChosen || workouts.length > 0) return false;
    modeAsked.current = true;
    setPendingStart(() => run);
    return true;
  };

  const onStartFree = () => {
    if (askMode(onStartFree)) return;
    // Le choix « à blanc / depuis un template » n'a de sens que si des templates existent.
    if (templates.length === 0) {
      void lockStart(async () => {
        await startWorkout();
        router.push('/workout');
      });
      return;
    }
    Alert.alert(t('workout.freeStart.title'), undefined, [
      {
        text: t('workout.freeStart.blank'),
        onPress: () =>
          void lockStart(async () => {
            await startWorkout();
            router.push('/workout');
          }),
      },
      { text: t('workout.freeStart.fromTemplate'), onPress: () => router.push('/templates') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
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
      case 'today':
        return router.push('/planning');
      default:
        return router.push('/planning');
    }
  };

  const renderWidget = (id: WidgetId, size: WidgetSize) => {
    const Widget = STRENGTH_WIDGETS[id as StrengthWidgetId];
    return <Widget size={size} />;
  };

  /** La grille et son intertitre — le même contenu dans les deux modes. */
  const grid = (
    <WidgetGrid
      screen="strength"
      editing={editing}
      renderWidget={renderWidget}
      onDragActiveChange={setDragging}
      isActive={isWidgetActive}
    />
  );

  /**
   * Le mode édition **n'a pas de scène** : réorganiser des widgets sous une scène qui, elle, ne se
   * déplace pas ferait croire qu'elle est déplaçable aussi — la raison qui masquait déjà la carte
   * épinglée (US MUSCU-UX01).
   */
  if (editing) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader
          title={t('pillars.strength')}
          action={<CustomizeButton editing={editing} onToggle={() => setEditing((v) => !v)} />}
        />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!dragging}
        >
          {grid}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <StageScrollView
      pillar="strength"
      testID="strength-screen"
      scrollEnabled={!dragging}
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
          onDirectory={() => router.push({ pathname: '/exercises', params: { mode: 'browse' } })}
        />
      }
    >
      {/* §4.4 — la semaine, séance par séance : le hub disait « semaine 3 sur 8 » sans jamais dire
          ce qu'il restait à faire cette semaine. */}
      <StrengthWeekCard onOpenDay={() => router.push('/planning')} />

      {/* §4.4 — « à ta portée » : MUSC-09 détectait les records sans jamais dire de combien on
          était loin. */}
      <NearRecordsCard onOpenExercise={(exerciseId) => router.push(`/exercises/${exerciseId}`)} />

      {/* §6.3 — « Et si… » : trois leviers, un moteur déterministe, et l'éventail d'incertitude
          affiché avec le chiffre. La carte dit ce qui manque quand l'historique est trop court. */}
      <WhatIfCard baselineSessions={progress ? progress.total / Math.max(1, progress.totalWeeks) : 3} />

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

      <View style={styles.sectionHead}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
          {t('strengthHub.followSection')}
        </Text>
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
        <CustomizeButton editing={editing} onToggle={() => setEditing((v) => !v)} />
      </View>

      <BodyExplorerLink />

      {grid}

      {/* La question du mode, posée une seule fois (US MUSCU-UX03, R-MO-3). Elle rejoue ensuite
          l'action qui l'avait déclenchée : l'utilisateur voulait démarrer, pas régler quelque chose. */}
      {/* US GUID-01 — les deux questions manquantes, posées devant la bibliothèque. Elle rejoue
          ensuite l'action qui l'avait déclenchée : l'utilisateur voulait voir un programme, pas
          remplir un formulaire. Même patron que la feuille de mode ci-dessous. */}
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
  scroll: { gap: 12, paddingBottom: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  sectionLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  rule: { flex: 1, height: 1 },
});

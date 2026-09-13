import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  countdownToSession,
  estimateRunMinutes,
  formatDurationHms,
  formatHoursMinutes,
  localDayKey,
  resolveRacePredictions,
  resolveRunHubState,
  resolveRunWeek,
  startOfWeek,
  type RunHubTodaySession,
  type RunningWidgetId,
  type WidgetId,
  type WidgetSize,
} from '@wellness/shared';
import { CustomizeButton } from '@/components/widgets/CustomizeButton';
import { WidgetGrid } from '@/components/widgets/WidgetGrid';
import { RUNNING_WIDGETS } from '@/components/widgets/running-widgets';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import {
  useActiveRun,
  useIntervalBlocksForRun,
  useRunHistory,
  useTodayRunSession,
} from '@/data/repositories/run-repository';
import { useActiveProgram } from '@/data/repositories/program-repository';
import { useWeekPlan } from '@/data/repositories/planned-session-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useSessionAdaptation } from '@/data/repositories/session-adaptation-repository';
import { SessionAdaptationCard } from '@/components/running/SessionAdaptationCard';
import { RunWeekBand } from '@/components/running/RunWeekBand';
import { RunStage, type RunScene } from '@/components/running/RunStage';
import { RunSplitsCard } from '@/components/running/RunSplitsCard';
import { RunPredictionsCard } from '@/components/running/RunPredictionsCard';
import { RunLoadCard } from '@/components/running/RunLoadCard';
import { StageScrollView } from '@/components/stage/StageScrollView';
import { useRunningRecords } from '@/data/repositories/running-record-repository';
import { formatIntervalBlockSummary } from '@/running/interval-summary';
import { sessionPaceLabelText } from '@/running/session-pace-label';
import { useAuthStore } from '@/stores/auth-store';
import { useCurrentHour, useTodayKey } from '@/hooks/useTodayKey';
import { useUnits } from '@/hooks/useUnits';

/**
 * Hub du pilier Course (refondu par US CARDIO-UX01, R2a + R3).
 *
 * ── Ce que ça remplace ───────────────────────────────────────────────────────────────────────────
 * Une cascade de ternaires dans le JSX (`active ? … : todaySession ? … : …`) donnant **trois**
 * états, dont aucun ne distinguait « j'ai un programme mais rien aujourd'hui » de « je n'ai pas de
 * programme ». Le hub proposait donc la même carte à quelqu'un qui suit un plan de 8 semaines et à
 * quelqu'un qui vient d'installer l'app.
 *
 * Trois changements structurants :
 *  - **R3-1** — zone Agir à **quatre états exclusifs**, résolus par `resolveRunHubState`
 *    (`@wellness/shared`, testé). Le hub ne décide plus rien : il rend l'état qu'on lui donne.
 *  - **F37** — une bande **Ma semaine** : séances faites sur prévues, volume, et la fréquence
 *    visée du profil en repère (champ qui n'était lu nulle part, constat F40).
 *  - **F1** — le **profil coureur** entre dans le pilier. Il n'était atteignable que depuis les
 *    Réglages de l'application, alors qu'il porte l'allure de référence — laquelle pilote toutes
 *    les allures cibles — et les deux réglages audio, désactivés par défaut.
 */
export default function RunningScreen() {
  useMenuFocus('running');
  const { t } = useTranslation();
  const router = useRouter();
  const units = useUnits();
  const todayKey = useTodayKey();

  const { run: active } = useActiveRun();
  const { session: todaySession } = useTodayRunSession();
  const { runnerProfile } = useRunnerProfile();
  const userId = useAuthStore((st) => st.session?.user.id ?? null);
  const { program: activeProgram } = useActiveProgram('running');

  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);

  // ── Ma semaine (F37) ──────────────────────────────────────────────────────────────────────
  const weekStartKey = useMemo(() => localDayKey(startOfWeek(new Date())), []);
  const { items: weekItems } = useWeekPlan(weekStartKey);
  const { runs } = useRunHistory();

  const runningPlanned = useMemo(
    () => weekItems.filter((item) => item.pillar === 'running'),
    [weekItems],
  );

  const week = useMemo(() => {
    const weekEnd = addDaysToKey(weekStartKey, 6);
    return resolveRunWeek({
      weekStartKey,
      todayKey,
      // `useRunHistory` n'a aucune borne de date (elle alimente aussi les stats et l'accueil) :
      // on filtre ici plutôt que d'ajouter une requête pour sept jours.
      runs: runs
        .filter((r) => {
          const key = (r.finishedAt ?? r.startedAt).slice(0, 10);
          return key >= weekStartKey && key <= weekEnd;
        })
        .map((r) => ({
          dayKey: (r.finishedAt ?? r.startedAt).slice(0, 10),
          distanceM: r.distanceM,
          durationSeconds: r.durationSeconds,
          elevationGainM: r.elevationGainM,
        })),
      planned: runningPlanned.map((item) => ({
        dayKey: item.scheduledDate,
        done: item.status === 'done',
      })),
      targetFrequency: runnerProfile?.weeklyFrequency ?? null,
    });
  }, [weekStartKey, todayKey, runs, runningPlanned, runnerProfile?.weeklyFrequency]);

  // ── Contenu de la séance du jour ─────────────────────────────────────────────────────────
  const { blocks: todayBlocks } = useIntervalBlocksForRun(todaySession?.id ?? null);

  const segmentSummaries = useMemo(
    () => todayBlocks.map((block) => formatIntervalBlockSummary(t, block)),
    [todayBlocks, t],
  );

  /**
   * Volume total de la séance : la structure d'abord, la cible en repli.
   *
   * La structure est plus juste — une séance « 6 × 400 » couvre l'échauffement, les fractions,
   * les récupérations et le retour au calme, là où `target_distance_m` ne porte souvent que le
   * corps de séance. Quand il n'y a pas de structure, la cible est tout ce qu'on a.
   */
  const totalDistanceM = useMemo(() => {
    if (todayBlocks.length === 0) return todaySession?.targetDistanceM ?? null;
    let total = 0;
    for (const block of todayBlocks) {
      const reps = Math.max(1, block.reps);
      total += reps * (block.fastDistanceM ?? 0);
      total += reps * (block.recoveryDistanceM ?? 0);
    }
    return total > 0 ? total : (todaySession?.targetDistanceM ?? null);
  }, [todayBlocks, todaySession?.targetDistanceM]);

  const hubToday: RunHubTodaySession | null = useMemo(() => {
    if (!todaySession) return null;
    return {
      plannedSessionId: todaySession.id,
      sessionId: todaySession.sessionId,
      sessionType: todaySession.sessionType,
      targetDistanceM: todaySession.targetDistanceM,
      targetDurationSeconds: todaySession.targetDurationSeconds,
      instructions: todaySession.instructions,
      segmentSummaries,
      totalDistanceM,
      estimatedMinutes: estimateRunMinutes({
        targetDurationSeconds: todaySession.targetDurationSeconds,
        totalDistanceM,
        refPaceSPerKm: runnerProfile?.ref5kPaceSPerKm ?? null,
      }),
    };
  }, [todaySession, segmentSummaries, totalDistanceM, runnerProfile?.ref5kPaceSPerKm]);

  // Séance de course faite aujourd'hui, et prochaine à venir — les deux nuances de l'état C.
  const doneToday = useMemo(() => {
    const item = runningPlanned.find(
      (i) => i.scheduledDate === todayKey && i.status === 'done',
    );
    return item ? { sessionType: item.sessionType } : null;
  }, [runningPlanned, todayKey]);

  const nextUpcoming = useMemo(() => {
    const future = runningPlanned
      .filter((i) => i.scheduledDate > todayKey && i.status === 'planned')
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    const first = future[0];
    return first ? { scheduledDate: first.scheduledDate, sessionType: first.sessionType } : null;
  }, [runningPlanned, todayKey]);

  const hubState = resolveRunHubState({
    activeRun: active
      ? {
          source: active.source === 'manual' ? 'manual' : 'gps',
          distanceM: active.distanceM,
          durationSeconds: active.durationSeconds,
        }
      : null,
    todaySession: hubToday,
    hasActiveProgram: !!activeProgram,
    doneToday,
    nextUpcoming,
  });

  // Allure cible de la séance du jour, saisie ou dérivée (US RUN-F4, lot A).
  const todayPaceLabel = todaySession
    ? sessionPaceLabelText(
        t,
        {
          sessionType: todaySession.sessionType,
          targetDistanceM: todaySession.targetDistanceM,
          targetTimeSeconds: todaySession.targetTimeSeconds,
          targetPaceMinSPerKm: todaySession.targetPaceMinSPerKm,
          targetPaceMaxSPerKm: todaySession.targetPaceMaxSPerKm,
          ref5kPaceSPerKm: runnerProfile?.ref5kPaceSPerKm ?? null,
        },
        units.formatPace,
      )
    : null;

  const adaptation = useSessionAdaptation(todaySession?.sessionType ?? null, userId);

  // ── La scène (US DASH-01, §4.3) ───────────────────────────────────────────────────────────
  const hour = useCurrentHour();
  const { records } = useRunningRecords();

  /**
   * Une sortie terminée **aujourd'hui** : le moment « arrivée », le cinquième état de la scène.
   * L'ancien hub le rangeait avec les jours de repos — on venait de courir une heure et l'écran
   * répondait « rien de prévu ».
   */
  const arrivalRun = useMemo(
    () =>
      runs.find((r) => r.finishedAt != null && localDayKey(new Date(r.finishedAt)) === todayKey) ??
      null,
    [runs, todayKey],
  );

  const lastFinishedRun = useMemo(() => runs.find((r) => r.finishedAt != null) ?? null, [runs]);

  const prediction10k = useMemo(
    () => resolveRacePredictions(records).find((p) => p.distanceKey === '10k') ?? null,
    [records],
  );

  const scene: RunScene = useMemo(() => {
    if (hubState.kind === 'resume') {
      return {
        kind: 'resume',
        distanceLabel: units.formatDistance((hubState.run.distanceM ?? 0) / 1000),
        durationLabel: formatHoursMinutes(hubState.run.durationSeconds ?? 0),
      };
    }
    // L'arrivée prime sur le repos : elle n'a de sens que le jour même.
    if (hubState.kind !== 'today' && arrivalRun) {
      return {
        kind: 'arrival',
        distanceKm: (arrivalRun.distanceM ?? 0) / 1000,
        distanceUnit: units.distanceSymbol,
        paceLabel: units.formatPace(arrivalRun.avgPaceSPerKm),
        durationLabel: formatHoursMinutes(arrivalRun.durationSeconds ?? 0),
        prediction10kLabel: prediction10k ? formatDurationHms(prediction10k.predictedSeconds) : null,
        // Le record de 5 km qui porte l'estimation vient-il de cette sortie ?
        prediction10kIsNew:
          records.find((r) => r.distanceKey === '5k')?.runId === arrivalRun.id,
      };
    }
    if (hubState.kind === 'today') {
      const session = hubState.session;
      return {
        kind: 'today',
        typeLabel: session.sessionType
          ? t(`running.sessionType.${session.sessionType}`)
          : t('running.hub.freeRun'),
        segments: session.segmentSummaries,
        volumeLabel:
          session.totalDistanceM != null
            ? units.formatDistance(session.totalDistanceM / 1000)
            : null,
        estimatedMinutes: session.estimatedMinutes,
        paceLabel: todayPaceLabel,
        scheduledTime: todaySession?.scheduledTime ?? null,
        countdown: countdownToSession(hour, todaySession?.scheduledTime ?? null),
        instructions: session.instructions,
      };
    }
    if (hubState.kind === 'rest') {
      return {
        kind: 'rest',
        doneToday: !!hubState.doneToday,
        nextLabel: hubState.nextUpcoming
          ? t('running.hub.nextOn', {
              date: formatDayKeyShort(hubState.nextUpcoming.scheduledDate),
              type: hubState.nextUpcoming.sessionType
                ? t(`running.sessionType.${hubState.nextUpcoming.sessionType}`)
                : t('running.hub.freeRun'),
            })
          : null,
      };
    }
    return { kind: 'onboarding' };
  }, [hubState, arrivalRun, prediction10k, records, units, t, todayPaceLabel, todaySession?.scheduledTime, hour]);

  /** Le geste principal de la scène, un par état — c'est là que le hub agit. */
  const onPrimary = () => {
    switch (scene.kind) {
      case 'resume':
        return router.push('/run/active');
      case 'arrival':
        return arrivalRun ? router.push(`/run/analysis?id=${arrivalRun.id}`) : undefined;
      case 'today':
        return router.push({
          pathname: '/run',
          params: { plannedSessionId: hubToday?.plannedSessionId ?? '' },
        });
      case 'rest':
        return router.push('/run');
      default:
        return router.push('/running-programs');
    }
  };

  const onSecondary = () => {
    switch (scene.kind) {
      case 'resume':
        return router.push('/running-history');
      case 'arrival':
        return router.push('/running-history');
      case 'today':
        return router.push('/planning');
      case 'rest':
        return router.push('/planning');
      default:
        return router.push('/run');
    }
  };

  const renderWidget = (id: WidgetId, size: WidgetSize) => {
    const Widget = RUNNING_WIDGETS[id as RunningWidgetId];
    return <Widget size={size} />;
  };

  /**
   * Une tuile vide ne réserve plus sa case (US CARDIO-UX01, R3-2).
   *
   * Le prédicat existait sur `WidgetGrid` depuis MUSCU-UX01 et n'avait jamais été passé côté
   * course : les quatre tuiles se rendaient **même vides** sur un compte neuf.
   */
  const isWidgetActive = (id: WidgetId): boolean => {
    switch (id) {
      case 'running-history':
        return runs.length > 0;
      case 'running-programs':
        return !!activeProgram;
      case 'running-planning':
        return runningPlanned.length > 0;
      default:
        // `running-training-time` se tait de lui-même quand il n'a rien à dire.
        return true;
    }
  };

  return (
    <StageScrollView
      pillar="running"
      testID="running-screen"
      scrollEnabled={!dragging}
      compactTitle={t('pillars.running')}
      compactValue={units.formatDistance(week.distanceM / 1000)}
      stage={
        <RunStage
          scene={scene}
          weekDistanceLabel={units.formatDistance(week.distanceM / 1000)}
          weekSessionsLabel={t('running.week.count', {
            done: week.doneCount,
            total: week.plannedCount,
          })}
          onPrimary={onPrimary}
          onSecondary={onSecondary}
          onProfile={() => router.push('/running-profile')}
          onHistory={() => router.push('/running-history')}
        />
      }
    >
      {/* La carte d'adaptation garde sa place en tête du corps : elle propose de MODIFIER la
          séance que la scène vient d'annoncer (F36). */}
      <SessionAdaptationCard proposal={adaptation} plannedSessionId={todaySession?.id ?? null} />

      {/* §4.3 — le km par km de la dernière sortie, jusqu'ici enterré dans l'analyse d'une course. */}
      <RunSplitsCard
        runId={lastFinishedRun?.id ?? null}
        plannedSessionId={lastFinishedRun?.plannedSessionId ?? null}
        onOpen={() =>
          lastFinishedRun ? router.push(`/run/analysis?id=${lastFinishedRun.id}`) : undefined
        }
      />

      <RunPredictionsCard onOpen={() => router.push('/running-history')} />
      <RunLoadCard onOpen={() => router.push('/running-history')} />

      {/* Ma semaine (F37) — le détail jour par jour, dont la scène ne donne que la ligne. */}
      <RunWeekBand week={week} />

      <View style={styles.customizeRow}>
        <CustomizeButton editing={editing} onToggle={() => setEditing((v) => !v)} />
      </View>

      {/* Grille de widgets personnalisable (modules course, filtrés par pilier running). */}
      <WidgetGrid
        screen="running"
        editing={editing}
        renderWidget={renderWidget}
        isActive={isWidgetActive}
        onDragActiveChange={setDragging}
      />
    </StageScrollView>
  );
}

// ---------------------------------------------------------------------------
// Carte de la séance du jour
// ---------------------------------------------------------------------------

/** `AAAA-MM-JJ` + n jours → `AAAA-MM-JJ`, en calendrier local (jamais `new Date('AAAA-MM-JJ')`). */
function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y!, m! - 1, d! + days);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** `AAAA-MM-JJ` → `JJ/MM` (découpage direct, format FR). */
function formatDayKeyShort(key: string): string {
  const [, mm, dd] = key.split('-');
  return `${dd}/${mm}`;
}

const styles = StyleSheet.create({
  /** Le bouton « personnaliser » vit au-dessus de la grille, pas dans un en-tête disparu. */
  customizeRow: { flexDirection: 'row', justifyContent: 'flex-end' },

  // Carte de la séance du jour — panneau inversé, comme la séance du jour côté muscu.
});

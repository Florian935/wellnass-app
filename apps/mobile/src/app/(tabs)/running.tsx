/**
 * Hub Course — **trois onglets : Courir, Historique, Progrès** (US CARDIO-UX03, 25/09/2026).
 *
 * ── Pourquoi ─────────────────────────────────────────────────────────────────────────────────────
 * Le hub de CARDIO-UX02 (19/09) répondait très bien à la question du dimanche soir, « est-ce que je
 * cours plus vite ? » (sept cartes d'analyse), et mal à celles d'avant et d'après la sortie :
 *  - « Démarrer » ouvrait un écran titré « Course libre », et « Voir le détail » le planning ;
 *  - la dernière fois de la séance du jour (les fractions sont enregistrées) n'était montrée nulle
 *    part avant le départ ;
 *  - les sorties passées vivaient sous deux sections de statistiques, et ouvraient l'écran d'arrivée ;
 *  - le fantôme et le compte à rebours de la course étaient loin du hub.
 * C'est le diagnostic de MUSCU-UX07 sur le pilier voisin, livrée le même jour.
 *
 * ── Ce qu'il est ─────────────────────────────────────────────────────────────────────────────────
 * Proposition A validée par Florian (réponses Q1–Q10 : spec §2) :
 *   · **Courir** — la carte du moment (la dernière fois un jour de séance), tes trois dernières
 *     sorties avec Recourir, la course libre, ta semaine, ton programme et son échéance ;
 *   · **Historique** — le calendrier du mois, les sorties, « par type » ;
 *   · **Progrès** — les cartes de CARDIO-UX02, déplacées telles quelles, puis « Toutes tes stats ».
 *
 * L'onglet affiché (D1) : un paramètre `section` (lu une fois, puis effacé), sinon le dernier choisi
 * pendant la vie de l'app, sinon Courir. Rien ne change d'onglet de force : pendant une course,
 * Historique et Progrès portent une ligne « Reprendre ». Les onglets défilent avec la page ; un
 * nouvel appui sur l'onglet Course de la barre du bas ramène en haut.
 */

import { useLocalSearchParams, useRouter, useScrollToTop } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  countdownToSession,
  estimateRunMinutes,
  formatDurationHms,
  formatHoursMinutes,
  lastTimeReps,
  localDayKey,
  pickRunLastTime,
  recordCountsByRun,
  repsInRange,
  resolveRacePredictions,
  resolveRunHubSection,
  resolveRunHubState,
  resolveRunWeek,
  runDayKey,
  startOfWeek,
  type RunHubSection,
  type RunHubTodaySession,
} from '@wellness/shared';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import {
  useActiveRun,
  useIntervalBlocksForRun,
  useRunHistory,
  useRunIntervals,
  useTodayRunSession,
} from '@/data/repositories/run-repository';
import { useActiveProgram } from '@/data/repositories/program-repository';
import { useWeekPlan } from '@/data/repositories/planned-session-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useSessionAdaptation } from '@/data/repositories/session-adaptation-repository';
import { useRunProgram } from '@/data/repositories/run-hub-repository';
import { useRunningRecords } from '@/data/repositories/running-record-repository';
import { SessionAdaptationCard } from '@/components/running/SessionAdaptationCard';
import { RunHeader } from '@/components/running/RunHeader';
import { RunLastTime } from '@/components/running/RunLastTime';
import { RunMomentCard, type RunMoment } from '@/components/running/RunMomentCard';
import { RunProgramCard } from '@/components/running/RunProgramCard';
import { RunWeekCard } from '@/components/running/RunWeekCard';
import { RunHistorySection } from '@/components/running/sections/RunHistorySection';
import { RunProgressSection } from '@/components/running/sections/RunProgressSection';
import { RunSection } from '@/components/running/sections/RunSection';
import { StageScrollView } from '@/components/stage/StageScrollView';
import { formatIntervalBlockSummary } from '@/running/interval-summary';
import { sessionPaceLabelText } from '@/running/session-pace-label';
import { useAuthStore } from '@/stores/auth-store';
import { useRunSection } from '@/stores/run-section-store';
import { useCurrentHour, useTodayDate, useTodayKey } from '@/hooks/useTodayKey';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

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

export default function RunningScreen() {
  useMenuFocus('running');
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();
  const todayKey = useTodayKey();
  const params = useLocalSearchParams<{ section?: string }>();

  // ── L'onglet affiché (D1) ──────────────────────────────────────────────────────────────────────
  const remembered = useRunSection((s) => s.section);
  const setSection = useRunSection((s) => s.setSection);
  const section: RunHubSection = resolveRunHubSection({ param: params.section, remembered });
  useEffect(() => {
    // Un paramètre de route est lu **une fois** : laissé en place, il s'appliquerait de nouveau à
    // chaque retour sur l'onglet et écraserait le choix du coureur.
    if (params.section === undefined) return;
    setSection(section);
    router.setParams({ section: undefined });
  }, [params.section, section, setSection, router]);

  // D1 — un nouvel appui sur l'onglet Course ramène en haut.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const { run: active } = useActiveRun();
  const { session: todaySession } = useTodayRunSession();
  const { runnerProfile } = useRunnerProfile();
  const userId = useAuthStore((st) => st.session?.user.id ?? null);
  const { program: activeProgram } = useActiveProgram('running');
  const programData = useRunProgram(
    activeProgram ? { id: activeProgram.id, durationWeeks: activeProgram.durationWeeks } : null,
  );
  const { runs } = useRunHistory();
  const { records } = useRunningRecords();
  const recordCounts = useMemo(() => recordCountsByRun(records.map((r) => r.runId)), [records]);

  // ── Ta semaine (F37) ───────────────────────────────────────────────────────────────────────────
  // ⚠️ `useTodayDate()` et jamais `new Date()` : voir la note du 21/09/2026 (CARDIO-UX02), la
  // semaine doit suivre l'horloge du hook, et changer au passage de minuit.
  const today = useTodayDate();
  const weekStartKey = useMemo(() => localDayKey(startOfWeek(today)), [today]);
  const { items: weekItems } = useWeekPlan(weekStartKey);
  const runningPlanned = useMemo(() => weekItems.filter((item) => item.pillar === 'running'), [weekItems]);

  const week = useMemo(() => {
    const weekEnd = addDaysToKey(weekStartKey, 6);
    // US CARDIO-UX03 (R8) — le jour **local** d'une sortie (`runDayKey`), comme le calendrier. Le
    // hub découpait jusqu'ici la date ISO en UTC (`slice(0, 10)`) : une sortie finie entre minuit
    // et deux heures tombait la veille dans la semaine et le jour même dans le calendrier.
    const inWeek = runs
      .map((r) => ({ run: r, dayKey: runDayKey(r) }))
      .filter(({ dayKey }) => dayKey >= weekStartKey && dayKey <= weekEnd);
    return resolveRunWeek({
      weekStartKey,
      todayKey,
      runs: inWeek.map(({ run, dayKey }) => ({
        dayKey,
        distanceM: run.distanceM,
        durationSeconds: run.durationSeconds,
        elevationGainM: run.elevationGainM,
      })),
      planned: runningPlanned.map((item) => ({ dayKey: item.scheduledDate, done: item.status === 'done' })),
      targetFrequency: runnerProfile?.weeklyFrequency ?? null,
    });
  }, [weekStartKey, todayKey, runs, runningPlanned, runnerProfile?.weeklyFrequency]);

  // ── La séance du jour ──────────────────────────────────────────────────────────────────────────
  const { blocks: todayBlocks } = useIntervalBlocksForRun(todaySession?.id ?? null);
  const segmentSummaries = useMemo(
    () => todayBlocks.map((block) => formatIntervalBlockSummary(t, block)),
    [todayBlocks, t],
  );

  /** Volume de la séance : la structure d'abord, la cible en repli (voir CARDIO-UX02). */
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

  const doneToday = useMemo(() => {
    const item = runningPlanned.find((i) => i.scheduledDate === todayKey && i.status === 'done');
    return item ? { sessionType: item.sessionType } : null;
  }, [runningPlanned, todayKey]);

  const nextUpcoming = useMemo(() => {
    const future = runningPlanned
      .filter((i) => i.scheduledDate > todayKey && i.status === 'planned')
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    const first = future[0];
    return first ? { scheduledDate: first.scheduledDate, sessionType: first.sessionType } : null;
  }, [runningPlanned, todayKey]);

  const typeLabel = (sessionType: string | null | undefined) =>
    sessionType ? t(`running.sessionType.${sessionType}`) : t('running.hub.freeRun');

  /** « Prochaine séance le 27/09 — Sortie longue. » — pour la carte de repos et « Ta semaine ». */
  const nextLabel = nextUpcoming
    ? t('running.hub.nextOn', {
        date: formatDayKeyShort(nextUpcoming.scheduledDate),
        type: typeLabel(nextUpcoming.sessionType),
      })
    : null;

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
  const hour = useCurrentHour();

  // ── La course en cours : son type, par sa séance planifiée ────────────────────────────────────
  const { sessionType: activeType } = useIntervalBlocksForRun(active?.plannedSessionId ?? null);

  // ── L'arrivée : une sortie terminée aujourd'hui, en jour local (R8) ───────────────────────────
  const arrivalRun = useMemo(
    () => runs.find((r) => r.finishedAt != null && runDayKey(r) === todayKey) ?? null,
    [runs, todayKey],
  );
  const { intervals: arrivalIntervals } = useRunIntervals(arrivalRun?.id);
  const lastFinishedRun = runs.find((r) => r.finishedAt != null) ?? null;
  const prediction10k = useMemo(
    () => resolveRacePredictions(records).find((p) => p.distanceKey === '10k') ?? null,
    [records],
  );

  // ── La dernière fois de la séance du jour (D3, R3) ─────────────────────────────────────────────
  const lastTime =
    hubState.kind === 'today' && todaySession
      ? pickRunLastTime(runs, { sessionId: todaySession.sessionId, sessionType: todaySession.sessionType })
      : null;
  const lastTimeRun = lastTime ? (runs.find((r) => r.id === lastTime.runId) ?? null) : null;

  // ── Les gestes ─────────────────────────────────────────────────────────────────────────────────
  const openRun = (id: string) => router.push({ pathname: '/run/analysis', params: { id } });
  const runAgain = (id: string) => router.push({ pathname: '/run', params: { ghostRunId: id } });
  const openFreeRun = () => router.push('/run');
  const resume = () => router.push('/run/active');

  // ── La carte du moment (§4.2-1) ────────────────────────────────────────────────────────────────
  let moment: RunMoment;
  if (hubState.kind === 'resume') {
    moment = {
      kind: 'resume',
      typeLabel: typeLabel(activeType),
      distanceLabel:
        hubState.run.source === 'manual' ? null : units.formatDistance((hubState.run.distanceM ?? 0) / 1000),
      durationLabel: formatHoursMinutes(hubState.run.durationSeconds ?? 0),
    };
  } else if (hubState.kind !== 'today' && arrivalRun) {
    const rated = repsInRange(lastTimeReps(arrivalIntervals));
    moment = {
      kind: 'arrival',
      typeLabel: typeLabel(arrivalRun.sessionType),
      distanceKm: (arrivalRun.distanceM ?? 0) / 1000,
      distanceUnit: units.distanceSymbol,
      metaLabel: t('stage.running.arrivalMeta', {
        duration: formatDurationHms(arrivalRun.durationSeconds),
        pace: units.formatPace(arrivalRun.avgPaceSPerKm),
      }),
      validated: arrivalRun.plannedSessionId != null,
      inRange: rated,
      predictionLabel: prediction10k
        ? t(
            records.find((r) => r.distanceKey === '5k')?.runId === arrivalRun.id
              ? 'stage.running.predictionNew'
              : 'stage.running.prediction',
            { time: formatDurationHms(prediction10k.predictedSeconds) },
          )
        : null,
    };
  } else if (hubState.kind === 'today') {
    const countdown = countdownToSession(hour, todaySession?.scheduledTime ?? null);
    moment = {
      kind: 'today',
      typeLabel: hubState.session.sessionType
        ? typeLabel(hubState.session.sessionType)
        : (todaySession?.name ?? t('running.hub.freeRun')),
      scheduledTime: todaySession?.scheduledTime ?? null,
      countdownLabel: countdown
        ? countdown.kind === 'now'
          ? t('stage.running.countdownNow')
          : countdown.kind === 'in'
            ? t('stage.running.countdownIn', { count: countdown.hours })
            : t('stage.running.countdownPast', { count: countdown.hours })
        : null,
      segments: hubState.session.segmentSummaries,
      volumeLabel:
        hubState.session.totalDistanceM != null ? units.formatDistance(hubState.session.totalDistanceM / 1000) : null,
      estimatedLabel:
        hubState.session.estimatedMinutes != null
          ? t('running.hub.minutes', { count: hubState.session.estimatedMinutes })
          : null,
      paceLabel: todayPaceLabel,
      instructions: hubState.session.instructions,
    };
  } else if (hubState.kind === 'rest') {
    moment = { kind: 'rest', doneToday: !!hubState.doneToday, nextLabel };
  } else {
    moment = { kind: 'onboarding', needsRefPace: runnerProfile?.ref5kPaceSPerKm == null };
  }

  const progress = programData.progress;
  const weekLabel = progress ? t('runningHub.moment.week', { week: progress.week, total: progress.totalWeeks }) : null;

  /** Ce que dit la ligne « Reprendre » d'Historique et de Progrès pendant une course. */
  const resumeDetail =
    hubState.kind === 'resume'
      ? hubState.run.source === 'manual' || hubState.run.distanceM == null
        ? formatHoursMinutes(hubState.run.durationSeconds ?? 0)
        : units.formatDistance(hubState.run.distanceM / 1000)
      : null;

  const momentCard = (
    <RunMomentCard
      moment={moment}
      weekLabel={weekLabel}
      lastTime={
        moment.kind !== 'today' ? null : lastTime && lastTimeRun ? (
          <RunLastTime run={lastTimeRun} match={lastTime.match} onOpen={() => openRun(lastTimeRun.id)} />
        ) : (
          <Text testID="run-last-time-first" style={[styles.firstTime, { color: colors.textMuted }]}>
            {t('runningHub.lastTime.firstTime')}
          </Text>
        )
      }
      onResume={resume}
      onStart={() =>
        router.push({ pathname: '/run', params: { plannedSessionId: hubToday?.plannedSessionId ?? '' } })
      }
      onAnalysis={() => (arrivalRun ? openRun(arrivalRun.id) : undefined)}
      onShare={() =>
        arrivalRun ? router.push({ pathname: '/run/analysis', params: { id: arrivalRun.id, share: '1' } }) : undefined
      }
      onFreeRun={openFreeRun}
      onPlanning={() => router.push('/planning')}
      onPrograms={() => router.push('/running-programs')}
      onProfile={() => router.push('/running-profile')}
    />
  );

  return (
    <StageScrollView
      pillar="running"
      testID="running-screen"
      scrollRef={scrollRef}
      stage={
        <RunHeader
          section={section}
          onSection={setSection}
          onPlanning={() => router.push('/planning')}
          onProfile={() => router.push('/running-profile')}
          onPrograms={() => router.push('/running-programs')}
        />
      }
    >
      {section === 'run' ? (
        <RunSection
          inProgress={hubState.kind === 'resume'}
          moment={momentCard}
          adaptation={<SessionAdaptationCard proposal={adaptation} plannedSessionId={todaySession?.id ?? null} />}
          runs={runs}
          todayKey={todayKey}
          recordCounts={recordCounts}
          onOpenRun={openRun}
          onAgain={runAgain}
          onAllHistory={() => setSection('history')}
          showFreeRun={moment.kind === 'today' || moment.kind === 'arrival'}
          onFreeRun={openFreeRun}
          week={
            // Le nom du programme n'y est plus : « Ton programme » le porte juste en dessous.
            <RunWeekCard week={week} nextLabel={nextLabel} programLabel={null} onOpenPlanning={() => router.push('/planning')} />
          }
          program={
            activeProgram ? (
              <RunProgramCard
                programName={activeProgram.name}
                data={programData}
                records={records}
                todayKey={todayKey}
                onPress={() => router.push(`/running-programs/${activeProgram.id}`)}
              />
            ) : null
          }
        />
      ) : section === 'history' ? (
        <RunHistorySection
          runs={runs}
          todayKey={todayKey}
          recordCounts={recordCounts}
          resumeDetail={resumeDetail}
          onResume={resume}
          onOpenRun={openRun}
          onAgain={runAgain}
        />
      ) : (
        <RunProgressSection
          hasRuns={runs.length > 0}
          resumeDetail={resumeDetail}
          onResume={resume}
          onInsights={() => router.push('/insights')}
          onStats={() => router.push('/running-stats')}
          lastRun={lastFinishedRun ? { id: lastFinishedRun.id, plannedSessionId: lastFinishedRun.plannedSessionId } : null}
          onOpenRun={openRun}
          onStart={() => setSection('run')}
        />
      )}
    </StageScrollView>
  );
}

const styles = StyleSheet.create({
  firstTime: { fontFamily: fontFamily.body, fontSize: 13 },
});

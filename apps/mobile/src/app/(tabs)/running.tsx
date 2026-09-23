/**
 * Hub Course — **un écran qui sait où en est le coureur** (US CARDIO-UX02, 19/09/2026).
 *
 * ── Ce que cet écran était ───────────────────────────────────────────────────────────────────────
 * Une scène à cinq états, puis quatre cartes qui se taisaient presque toujours, puis un bouton
 * « Personnaliser » et une grille de quatre widgets. Sur le compte de recette, l'écran se réduisait
 * à : la scène, « Ta charge », « Ma semaine », et deux tuiles. L'audit du 19/09 a relevé six
 * défauts, et une cause sous les six :
 *
 *  1. **Le hub et sa propre carte se contredisaient.** La scène affichait « 2 / 0 faites » pendant
 *     que « Ma semaine », deux blocs plus bas, affichait « 2 / 3 faites » — le repli sur la
 *     fréquence visée vivait dans le composant, donc ne valait que pour lui.
 *  2. **La question du coureur n'avait aucune surface.** *Est-ce que je cours plus vite ?* RUN-05
 *     est livrée depuis le 29/07 et ne vivait que dans `/running-history`, à deux écrans d'ici.
 *  3. **Le plus gros chiffre de l'écran mesurait le passé, pas le progrès** : la distance de la
 *     dernière sortie, en 34 px, dans un widget.
 *  4. **Le bas de l'écran était de l'administration** : un nom de plan, un mini-calendrier, une
 *     distance — trois raccourcis déguisés en indicateurs.
 *  5. **L'identité du pilier s'arrêtait à la scène.** Le bleu ne réapparaissait nulle part en
 *     dessous (voir `theme/pillar.ts` et `components/stage/PillarPanel.tsx` : c'était mesurable).
 *  6. **Le haut changeait cinq fois, le bas jamais.**
 *
 * **La cause, sous les six** : sur **25 analyses course** au catalogue, **15 sont livrées** — le hub
 * en montrait **4**. ALLURE-01 en avait livré quatre d'un coup le 07/08 ; aucune n'était remontée.
 * Et `selectInsights` (INSIGHTS-01) n'était appelé nulle part côté course. Exactement le diagnostic
 * de MUSCU-UX05 sur le pilier voisin, onze jours plus tôt.
 *
 * ── La contrainte qui tient la refonte ──────────────────────────────────────────────────────────
 * CARDIO-UX01 avait déjà resserré ce hub le 10/09. « Plus utile » ne pouvait donc pas vouloir dire
 * « plus de blocs ». **Le budget ne bouge pas : dix surfaces deviennent sept cartes et trois
 * lignes** — et chaque carte **se tait quand elle n'a rien à dire**.
 *
 * Sortent : le bouton « Personnaliser », la grille et ses quatre widgets (Historique, Programmes,
 * Planning, Temps d'entraînement), la bande `RunWeekBand`.
 * Entrent : le fil du jour, « Ton allure », « Ton moteur », « Tes records », la ligne de toujours,
 * la ligne d'annuaire — et `RunWeekCard`, qui absorbe la bande, le planning et le programme.
 *
 * ── L'ordre, et pourquoi ────────────────────────────────────────────────────────────────────────
 *   1 · `RunStage`           — la scène (US DASH-01), cinq états, la trace
 *   2 · `SessionAdaptationCard` — elle propose de MODIFIER ce que la scène vient d'annoncer (F36)
 *   3 · `RunThread`          — **la seule chose qui change tous les jours** (défaut 6)
 *   4 · `PaceProgressCard`   — la carte dominante : « est-ce que je cours plus vite ? » (défauts 2, 3, 5)
 *   5 · `RunWeekCard`        — « où j'en suis, et ce qu'il me reste » (défauts 1, 4)
 *   6 · `RunPredictionsCard` — la projection : ce que ça vaudrait sur 10 km
 *   7 · `RunEngineCard`      — la polarisation, jamais remontée depuis ALLURE-01
 *   8 · `RunRecordWall`      — le trophée, pas seulement la carotte — en bande horizontale
 *   9 · `RunLoadCard`        — le garde-fou descend : c'est une limite, pas un progrès
 *  10 · `RunSplitsCard`      — le km par km de la dernière sortie
 *  11 · `RunLifetimeLine`    — une ligne, pas une carte
 *  12 · l'annuaire           — ce que la grille de widgets faisait, sans les faux indicateurs
 */

import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
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
} from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
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
import { PaceProgressCard } from '@/components/running/PaceProgressCard';
import { RunDirectorySheet } from '@/components/running/RunDirectorySheet';
import { RunEngineCard } from '@/components/running/RunEngineCard';
import { RunLifetimeLine } from '@/components/running/RunLifetimeLine';
import { RunRecordWall } from '@/components/running/RunRecordWall';
import { RunThread } from '@/components/running/RunThread';
import { RunWeekCard } from '@/components/running/RunWeekCard';
import { RunStage, type RunScene } from '@/components/running/RunStage';
import { RunSplitsCard } from '@/components/running/RunSplitsCard';
import { RunPredictionsCard } from '@/components/running/RunPredictionsCard';
import { RunLoadCard } from '@/components/running/RunLoadCard';
import { StageScrollView } from '@/components/stage/StageScrollView';
import { useRunningRecords } from '@/data/repositories/running-record-repository';
import { formatIntervalBlockSummary } from '@/running/interval-summary';
import { sessionPaceLabelText } from '@/running/session-pace-label';
import { useAuthStore } from '@/stores/auth-store';
import { useCurrentHour, useTodayDate, useTodayKey } from '@/hooks/useTodayKey';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function RunningScreen() {
  useMenuFocus('running');
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();
  const todayKey = useTodayKey();

  const { run: active } = useActiveRun();
  const { session: todaySession } = useTodayRunSession();
  const { runnerProfile } = useRunnerProfile();
  const userId = useAuthStore((st) => st.session?.user.id ?? null);
  const { program: activeProgram } = useActiveProgram('running');

  // L'annuaire remplace la grille de widgets : voir `RunDirectorySheet`.
  const [directoryOpen, setDirectoryOpen] = useState(false);

  // ── Ma semaine (F37) ──────────────────────────────────────────────────────────────────────
  // ⚠️ `useTodayDate()` et **jamais** `new Date()` : cet écran lit partout ailleurs l'horloge du
  // hook (`todayKey` juste en dessous). Mélanger les deux sources fait diverger le début de semaine
  // du reste de la page — et le `useMemo(…, [])` figeait en plus la valeur au montage, donc l'écran
  // ne changeait pas de semaine au passage de minuit. Défaut latent trouvé le 21/09/2026 : la suite
  // `running-screen` est passée au rouge **toute seule** au changement de jour, le dimanche 20
  // étant la fin d'une semaine et le lundi 21 le début de la suivante.
  const today = useTodayDate();
  const weekStartKey = useMemo(() => localDayKey(startOfWeek(today)), [today]);
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

  /** « Prochaine le 21/09 · Fractionné » — la même phrase pour la scène et pour la carte. */
  const nextLabel = useMemo(
    () =>
      nextUpcoming
        ? t('running.hub.nextOn', {
            date: formatDayKeyShort(nextUpcoming.scheduledDate),
            type: nextUpcoming.sessionType
              ? t(`running.sessionType.${nextUpcoming.sessionType}`)
              : t('running.hub.freeRun'),
          })
        : null,
    [nextUpcoming, t],
  );

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
      return { kind: 'rest', doneToday: !!hubState.doneToday, nextLabel };
    }
    return { kind: 'onboarding' };
  }, [hubState, arrivalRun, prediction10k, records, units, t, todayPaceLabel, todaySession?.scheduledTime, hour, nextLabel]);

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

  return (
    <StageScrollView
      pillar="running"
      testID="running-screen"
      stage={
        <RunStage
          scene={scene}
          weekDistanceLabel={units.formatDistance(week.distanceM / 1000)}
          // 🔴 `goalCount`, jamais `plannedCount` : c'est le défaut 1 de l'audit, corrigé à la
          // source (`resolveRunWeek`). La scène disait « 2 / 0 » là où la carte disait « 2 / 3 ».
          weekSessionsLabel={
            week.goalCount > 0
              ? t('running.week.count', { done: week.doneCount, total: week.goalCount })
              : t('runningHub.week.doneOnly', { count: week.doneCount })
          }
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

      {/* La seule chose qui change tous les jours. Se tait s'il n'y a rien à dire. */}
      <RunThread onPress={() => router.push('/insights')} />

      {/* La carte dominante : « est-ce que je cours plus vite ? » — et le bleu du pilier, dans le
          corps de la page. */}
      <PaceProgressCard onPress={() => router.push('/running-history')} />

      {/* Où j'en suis cette semaine, ET ce qu'il me reste. Absorbe la bande, le planning, le plan. */}
      <RunWeekCard
        week={week}
        nextLabel={nextLabel}
        programLabel={
          activeProgram
            ? t('runningHub.week.program', { name: activeProgram.name })
            : null
        }
        onOpenPlanning={() => router.push('/planning')}
      />

      {/* La projection — ce que la forme du moment vaudrait sur une distance jamais courue. */}
      <RunPredictionsCard onOpen={() => router.push('/running-history')} />

      {/* La polarisation : livrée par ALLURE-01 le 07/08, jamais remontée jusqu'ici. */}
      <RunEngineCard onOpen={() => router.push('/running-history')} />

      {/* Le trophée, pas seulement la carotte — et le seul bloc qui ne se lit pas de haut en bas. */}
      <RunRecordWall onOpen={() => router.push('/running-history')} />

      {/* Le garde-fou descend sous le progrès : c'est une limite, pas un accomplissement. */}
      <RunLoadCard onOpen={() => router.push('/running-history')} />

      {/* §4.3 — le km par km de la dernière sortie, jusqu'ici enterré dans l'analyse d'une course. */}
      <RunSplitsCard
        runId={lastFinishedRun?.id ?? null}
        plannedSessionId={lastFinishedRun?.plannedSessionId ?? null}
        onOpen={() =>
          lastFinishedRun ? router.push(`/run/analysis?id=${lastFinishedRun.id}`) : undefined
        }
      />

      {/* Une ligne, pas une carte — elle ferme la page sans ajouter une boîte de plus. */}
      <RunLifetimeLine onPress={() => router.push('/running-history')} />

      {/* L'annuaire, en pied : la grille de widgets et son bouton « Personnaliser » ont disparu
          avec les trois tuiles d'administration qu'elle portait. */}
      <PressableScale
        haptic="select"
        onPress={() => setDirectoryOpen(true)}
        accessibilityRole="button"
        testID="running-directory-link"
        style={[styles.directory, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Ionicons name="library-outline" size={20} color={colors.accent} />
        <Text style={[styles.directoryLabel, { color: colors.text }]} numberOfLines={1}>
          {t('runningHub.directory')}
        </Text>
        <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
      </PressableScale>

      <RunDirectorySheet
        visible={directoryOpen}
        onClose={() => setDirectoryOpen(false)}
        onPick={(target) => {
          setDirectoryOpen(false);
          switch (target) {
            case 'programs':
              return router.push('/running-programs');
            case 'planning':
              return router.push('/planning');
            case 'history':
              return router.push('/running-history');
            default:
              return router.push('/running-profile');
          }
        }}
        colors={colors}
      />
    </StageScrollView>
  );
}

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

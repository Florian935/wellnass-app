import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  estimateRunMinutes,
  localDayKey,
  resolveRunHubState,
  resolveRunWeek,
  startOfWeek,
  type RunHubTodaySession,
  type RunningWidgetId,
  type WidgetId,
  type WidgetSize,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
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
import { formatIntervalBlockSummary } from '@/running/interval-summary';
import { sessionPaceLabelText } from '@/running/session-pace-label';
import { useAuthStore } from '@/stores/auth-store';
import { useTodayKey } from '@/hooks/useTodayKey';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

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
  const { colors } = useTheme();
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
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('pillars.running')}
        subtitle={t('pillarScreens.running.tagline')}
        action={
          <View style={styles.headerActions}>
            {/* F1 — le profil entre dans le pilier. */}
            <Button
              label={t('running.profile.title')}
              variant="ghost"
              onPress={() => router.push('/running-profile')}
            />
            <CustomizeButton editing={editing} onToggle={() => setEditing((v) => !v)} />
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!dragging}
      >
        {/* ── Zone Agir : un seul état, jamais deux cartes (R3-1) ─────────────────────── */}
        {hubState.kind === 'resume' ? (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="walk" size={18} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('running.resume.title')}
              </Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {t('running.resume.subtitle')}
            </Text>
            <Button label={t('running.resume.cta')} onPress={() => router.push('/run/active')} />
          </Card>
        ) : hubState.kind === 'today' ? (
          <TodayCard
            session={hubState.session}
            paceLabel={todayPaceLabel}
            onStart={() =>
              router.push({
                pathname: '/run',
                params: { plannedSessionId: hubState.session.plannedSessionId },
              })
            }
            onDetail={() => router.push('/planning')}
          />
        ) : hubState.kind === 'rest' ? (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="navigate-outline" size={18} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {hubState.doneToday
                  ? t('running.hub.doneTodayTitle')
                  : t('running.hub.restTitle')}
              </Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {hubState.nextUpcoming
                ? t('running.hub.nextOn', {
                    date: formatDayKeyShort(hubState.nextUpcoming.scheduledDate),
                    type: hubState.nextUpcoming.sessionType
                      ? t(`running.sessionType.${hubState.nextUpcoming.sessionType}`)
                      : t('running.hub.freeRun'),
                  })
                : t('running.hub.nothingPlanned')}
            </Text>
            <Button label={t('running.hub.freeRunCta')} onPress={() => router.push('/run')} />
          </Card>
        ) : (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="flag-outline" size={18} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('running.hub.onboardingTitle')}
              </Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {t('running.hub.onboardingBody')}
            </Text>
            <Button
              label={t('running.hub.pickProgram')}
              onPress={() => router.push('/running-programs')}
            />
            <Button
              label={t('running.hub.freeRunCta')}
              variant="ghost"
              onPress={() => router.push('/run')}
            />
          </Card>
        )}

        {/* ── La carte d'adaptation, qui AGIT désormais (F36) ─────────────────────────── */}
        <SessionAdaptationCard
          proposal={adaptation}
          plannedSessionId={todaySession?.id ?? null}
        />

        {/* ── Ma semaine (F37) ───────────────────────────────────────────────────────── */}
        <RunWeekBand week={week} />

        {/* Grille de widgets personnalisable (modules course, filtrés par pilier running). */}
        <WidgetGrid
          screen="running"
          editing={editing}
          renderWidget={renderWidget}
          isActive={isWidgetActive}
          onDragActiveChange={setDragging}
        />
      </ScrollView>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Carte de la séance du jour
// ---------------------------------------------------------------------------

/**
 * La séance du jour, avec **son contenu** (R3, état B).
 *
 * La carte précédente annonçait la cible chiffrée et la consigne, mais jamais la **structure** ni
 * le **volume réel** ni la **durée estimée** — c'est-à-dire les trois choses qu'on regarde pour
 * décider si on part maintenant.
 */
function TodayCard({
  session,
  paceLabel,
  onStart,
  onDetail,
}: {
  session: RunHubTodaySession;
  paceLabel: string | null;
  onStart: () => void;
  onDetail: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();

  const typeLabel = session.sessionType
    ? t(`running.sessionType.${session.sessionType}`)
    : t('running.hub.freeRun');

  return (
    <View style={[styles.todayCard, { backgroundColor: colors.panel }]}>
      <View style={styles.cardHeader}>
        <Ionicons name="calendar-outline" size={18} color={colors.panelAccent} />
        <Text style={[styles.todayOverline, { color: colors.panelMuted }]}>
          {t('running.plannedToday.title')}
        </Text>
      </View>

      <Text style={[styles.todayTitle, { color: colors.panelText }]}>{typeLabel}</Text>

      {/* La structure, lisible d'un coup d'œil avant de partir. */}
      {session.segmentSummaries.length > 0 ? (
        <View style={styles.chips}>
          {session.segmentSummaries.map((summary, index) => (
            <View
              key={`${summary}-${index}`}
              style={[styles.chip, { backgroundColor: 'rgba(240,228,208,0.12)' }]}
            >
              <Text style={[styles.chipLabel, { color: colors.panelText }]}>{summary}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.todayStats}>
        {session.totalDistanceM != null ? (
          <View style={styles.todayStat}>
            <Text style={[styles.todayStatLabel, { color: colors.panelMuted }]}>
              {t('running.hub.volume')}
            </Text>
            <Text style={[styles.todayStatValue, { color: colors.panelText }]}>
              {units.formatDistance(session.totalDistanceM / 1000)}
            </Text>
          </View>
        ) : null}
        {session.estimatedMinutes != null ? (
          <View style={styles.todayStat}>
            <Text style={[styles.todayStatLabel, { color: colors.panelMuted }]}>
              {t('running.hub.estimated')}
            </Text>
            <Text style={[styles.todayStatValue, { color: colors.panelText }]}>
              {t('running.hub.minutes', { count: session.estimatedMinutes })}
            </Text>
          </View>
        ) : null}
        {paceLabel ? (
          <View style={styles.todayStat}>
            <Text style={[styles.todayStatLabel, { color: colors.panelMuted }]}>
              {t('running.paceGuidance.targetLabel')}
            </Text>
            <Text style={[styles.todayStatValue, { color: colors.panelText }]}>{paceLabel}</Text>
          </View>
        ) : null}
      </View>

      {/* La consigne rédigée — ce qui fait la différence entre une distance et une séance. */}
      {session.instructions ? (
        <View style={[styles.instructions, { borderLeftColor: colors.panelAccent }]}>
          <Text style={[styles.instructionsText, { color: colors.panelText }]}>
            {session.instructions}
          </Text>
        </View>
      ) : null}

      <View style={styles.todayActions}>
        <View style={styles.todayActionMain}>
          <Button label={t('running.plannedToday.startCta')} onPress={onStart} />
        </View>
        <Button label={t('running.hub.seeDetail')} variant="ghost" onPress={onDetail} />
      </View>
    </View>
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
  scroll: { gap: 14, paddingBottom: 24 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.3 },
  cardText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },

  // Carte de la séance du jour — panneau inversé, comme la séance du jour côté muscu.
  todayCard: { borderRadius: 22, padding: 18, gap: 12 },
  todayOverline: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  todayTitle: { fontFamily: fontFamily.displayBold, fontSize: 22, letterSpacing: -0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  chipLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 12 },
  todayStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  todayStat: { gap: 1 },
  todayStatLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  todayStatValue: { fontFamily: fontFamily.monoBold, fontSize: 17 },
  instructions: { borderLeftWidth: 2, paddingLeft: 10 },
  instructionsText: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  todayActions: { gap: 8 },
  todayActionMain: { width: '100%' },
});

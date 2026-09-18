import { Ionicons } from '@expo/vector-icons';
import {
  averagePace,
  compareToTarget,
  decodeTrack,
  derivedVmaPace,
  displayedNetSeconds,
  evaluatePace,
  instantPace,
  resolveHeroMetric,
  resolveSegmentBanner,
  ghostGap,
  resolveSessionPace,
  simplifyTrack,
  type HeroMetric,
  type RunSegmentBanner,
} from '@wellness/shared';
import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { GhostBand } from '@/components/running/GhostBand';
import { RouteMap } from '@/components/running/RouteMap';
import { SegmentBanner } from '@/components/running/SegmentBanner';
import { SyncStatus } from '@/components/SyncStatus';
import {
  deleteRun,
  finishRun,
  useActiveRun,
  useIntervalBlocksForRun,
  useRunGhost,
  useRunTarget,
} from '@/data/repositories/run-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { pauseTracking, resumeTracking, stopTracking } from '@/running/tracker';
import { getLiveNetSeconds, getPaused, subscribePaused } from '@/running/tracker-task';
import { useDistanceAnnouncements } from '@/running/announcements';
import { useGhostGuidance } from '@/running/ghost-guidance';
import { useIntervalGuidance, toPhaseBlockInput } from '@/running/interval-guidance';
import { usePaceGuidance } from '@/running/pace-guidance';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useActionLock } from '@/hooks/useActionLock';
import { useUnits } from '@/hooks/useUnits';

/**
 * Durée **nette** à afficher, rafraîchie chaque seconde (US CARDIO-UX01, R1a).
 *
 * ── Ce que ça remplace ───────────────────────────────────────────────────────────────────────────
 * `useElapsedSeconds(startedAt)` calculait `now − startedAt` : l'**horloge murale**, pauses
 * incluses. La base, elle, porte la durée **nette**. Le coureur voyait 32:10 et retrouvait 29:45
 * au résumé (constat F9), et pendant une pause le chrono continuait de défiler — ce qui donnait
 * l'impression que le bouton Pause ne servait à rien.
 *
 * L'incohérence était visible **dans le même écran** : l'allure moyenne utilisait déjà la durée
 * nette. Le chrono était le seul chiffre resté sur l'horloge murale.
 *
 * La décision de quoi afficher (tracker vivant ou valeur persistée figée) vit dans
 * `displayedNetSeconds`, testée dans `@wellness/shared`.
 */
function useNetSeconds(runId: string | undefined, storedDurationSeconds: number | null): number {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return displayedNetSeconds({
    liveNetSeconds: runId ? getLiveNetSeconds(runId) : null,
    storedDurationSeconds,
  });
}

/** Formate une durée en secondes → `HH:MM:SS` (ou `MM:SS` sous une heure). */
function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

/** Ordre de bascule du chiffre en héros au tap (US CARDIO-UX01, R5-2). */
const HERO_ORDER: readonly HeroMetric[] = ['pace', 'distance', 'duration'];

/**
 * Écran de suivi temps réel d'une course (Running R1, refondu par US CARDIO-UX01).
 *
 * Quatre changements structurants par rapport à la version précédente :
 *  - **R1a** — le chrono affiché est la durée **nette**, celle qui sera enregistrée, et la pause
 *    se voit (bandeau + chrono figé).
 *  - **R5 / F10** — un **bandeau de segment** dit en permanence où on en est dans la séance. Toute
 *    la machinerie de RUN-F4 était pilotée à la voix et n'avait aucune surface visuelle.
 *  - **R5-2 / F13** — le **chiffre en héros** dépend de la séance, et se change d'un tap.
 *  - **R1d / F11-F12** — l'arrêt se fait en **deux temps** (pause → Reprendre / Terminer /
 *    Supprimer) et l'écran se **verrouille**.
 *
 * Séquencement d'arrêt critique, inchangé : stopTracking() → finishRun() → résumé (voir `onFinish`).
 */
export default function RunActiveScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();

  // Empêche la mise en veille de l'écran pendant le suivi (5.x / 2.3).
  useKeepAwake();

  const { run: active, isLoading } = useActiveRun();

  // État de pause piloté par la source de vérité unique du tracker : reflète aussi
  // l'auto-pause (déclenchée hors interaction) pour que le bouton ne mente jamais.
  const [paused, setPaused] = useState(getPaused);
  const [finishing, setFinishing] = useState(false);
  /** Panneau d'issues ouvert (US CARDIO-UX01, R1d) : l'arrêt est un choix, pas un réflexe. */
  const [deciding, setDeciding] = useState(false);
  /** Écran verrouillé (constat F12) : les gestes sont inertes jusqu'au déverrouillage. */
  const [locked, setLocked] = useState(false);
  /** Bascule utilisateur du chiffre en héros ; `null` = on garde le défaut de la séance. */
  const [heroOverride, setHeroOverride] = useState<HeroMetric | null>(null);

  const lockFinish = useActionLock();
  const lockDelete = useActionLock();

  useEffect(() => subscribePaused(setPaused), []);

  const isGps = active?.source === 'gps';
  const gpsTrack = active?.gpsTrack ?? null;

  // Décodage de la trace uniquement quand elle change (coûteux) — pour l'allure
  // instantanée. En mode manuel / sans trace, on n'affiche pas d'allure.
  const points = useMemo(() => (isGps && gpsTrack ? decodeTrack(gpsTrack) : []), [isGps, gpsTrack]);

  // Simplification de la trace pour le rendu cartographique (epsilon 5 m).
  const simplified = useMemo(() => simplifyTrack(points, 5), [points]);

  const distanceM = active?.distanceM ?? 0;

  // US CARDIO-UX01 (R1a) — LA durée : affichée ici, enregistrée en base, identique.
  const netSeconds = useNetSeconds(active?.id, active?.durationSeconds ?? null);

  const avgPaceValue = isGps ? averagePace(distanceM, netSeconds) : null;

  // US FANT-01 — l'écart au fantôme. `useRunGhost` décode la trace une seule fois (R10) ; le calcul
  // lui-même est pur et ne coûte rien à chaque rendu.
  const { ghost } = useRunGhost(active?.ghostRunId ?? null);
  const gap =
    ghost === null
      ? null
      : ghostGap({
          profile: ghost.profile,
          runnerDistanceM: distanceM,
          netSeconds,
          avgPaceSPerKm: avgPaceValue,
        });
  useGhostGuidance({ gap, netSeconds, ghostDate: ghost?.finishedAt ?? null });
  const instantPaceValue = isGps ? instantPace(points) : null;

  // US RUN-F2a (5.19) : annonces vocales périodiques, GPS uniquement (spec R4). Hook appelé
  // inconditionnellement (règle des hooks) — le gating est géré en interne par `enabled`.
  const { runnerProfile } = useRunnerProfile();
  useDistanceAnnouncements({
    enabled: isGps && runnerProfile?.voiceAnnouncementsEnabled === true,
    intervalM: runnerProfile?.voiceAnnouncementIntervalM ?? 1000,
    distanceM,
    elapsedSeconds: netSeconds,
    avgPaceSPerKm: avgPaceValue,
  });

  const { sessionType: plannedSessionType, blocks: intervalBlocks } = useIntervalBlocksForRun(
    active?.plannedSessionId ?? null,
  );

  // US RUN-F2d (5.18) + US CARDIO-UX01 (R5) : le suivi de phase a lieu dès qu'il y a une
  // structure ; seule l'annonce vocale reste derrière son réglage. C'est ce découplage qui rend
  // le bandeau de segment ci-dessous possible — avant, le curseur n'avançait que si la voix
  // était activée, et elle est désactivée par défaut.
  useIntervalGuidance({
    voiceEnabled: isGps && runnerProfile?.intervalGuidanceEnabled === true,
    vmaPaceSPerKm:
      runnerProfile?.ref5kPaceSPerKm != null ? derivedVmaPace(runnerProfile.ref5kPaceSPerKm) : null,
    runId: active?.id ?? null,
    blocks: intervalBlocks,
    distanceM,
    durationSeconds: active?.durationSeconds ?? 0,
    persistedPhaseIndex: active?.intervalPhaseIndex ?? null,
    persistedPhaseStartDistanceM: active?.intervalPhaseStartDistanceM ?? null,
    persistedPhaseStartDurationS: active?.intervalPhaseStartDurationS ?? null,
  });

  const target = useRunTarget(active?.plannedSessionId ?? null);

  // ── US CARDIO-UX01 (R5 / F10) — le bandeau de segment ──────────────────────────────────────
  // Scalaires extraits AVANT le mémo : dépendre de l'objet `active` entier empêcherait la
  // mémoïsation (il change à chaque flush du tracker).
  const phaseIndex = active?.intervalPhaseIndex ?? null;
  const phaseStartD = active?.intervalPhaseStartDistanceM ?? 0;
  const phaseStartT = active?.intervalPhaseStartDurationS ?? 0;
  const netDurationS = active?.durationSeconds ?? 0;
  const ref5k = runnerProfile?.ref5kPaceSPerKm ?? null;

  const phaseBlocks = useMemo(() => intervalBlocks.map(toPhaseBlockInput), [intervalBlocks]);

  const banner: RunSegmentBanner | null = useMemo(
    () =>
      resolveSegmentBanner({
        blocks: phaseBlocks,
        phaseIndex,
        phaseStartDistanceM: phaseStartD,
        phaseStartDurationS: phaseStartT,
        distanceM,
        durationSeconds: netDurationS,
        vmaPaceSPerKm: ref5k != null ? derivedVmaPace(ref5k) : null,
      }),
    [phaseBlocks, phaseIndex, phaseStartD, phaseStartT, distanceM, netDurationS, ref5k],
  );

  // Allure cible de la séance, en repli quand la phase courante n'en porte pas.
  const sessionPace = useMemo(
    () =>
      resolveSessionPace({
        explicitMinSPerKm: target?.targetPaceMinSPerKm,
        explicitMaxSPerKm: target?.targetPaceMaxSPerKm,
        sessionType: plannedSessionType,
        targetDistanceM: target?.targetDistanceM,
        targetTimeSeconds: target?.targetTimeSeconds,
        ref5kPaceSPerKm: ref5k,
      }),
    [target, plannedSessionType, ref5k],
  );

  // La cible du SEGMENT courant prime sur celle de la séance (mur M8, RUN-F4).
  const effectivePaceRange =
    (banner?.state === 'running' ? banner.targetRange : null) ?? sessionPace?.range ?? null;

  // Verdict affiché : sur l'allure INSTANTANÉE, c'est elle qu'on corrige en courant.
  const paceEvaluation = useMemo(
    () => evaluatePace(instantPaceValue, effectivePaceRange),
    [instantPaceValue, effectivePaceRange],
  );

  usePaceGuidance({
    // Même réglage que le guidage fractionné : un coureur qui a coupé la voix l'a coupée pour
    // toute la séance, pas seulement pour les changements de bloc.
    enabled: isGps && runnerProfile?.intervalGuidanceEnabled === true && effectivePaceRange !== null,
    currentPaceSPerKm: instantPaceValue,
    targetRange: effectivePaceRange,
    durationSeconds: netDurationS,
  });

  const comparison = useMemo(
    () =>
      compareToTarget(
        { distanceM: isGps ? distanceM : null, durationS: active?.durationSeconds ?? null },
        {
          targetDistanceM: target?.targetDistanceM ?? null,
          targetDurationS: target?.targetDurationSeconds ?? null,
        },
      ),
    [isGps, distanceM, active?.durationSeconds, target],
  );

  // ── US CARDIO-UX01 (R5-2 / F13) — quel chiffre en héros ────────────────────────────────────
  const heroMetric = resolveHeroMetric({
    sessionType: plannedSessionType,
    boundedByDuration:
      target?.targetDurationSeconds != null && target?.targetDistanceM == null,
    override: heroOverride,
  });

  const cycleHero = () => {
    const index = HERO_ORDER.indexOf(heroMetric);
    setHeroOverride(HERO_ORDER[(index + 1) % HERO_ORDER.length]!);
  };

  // ── Actions ────────────────────────────────────────────────────────────────────────────────

  const onTogglePause = () => {
    // L'affichage suit l'émetteur du tracker (`subscribePaused`) : ces appels mutent la source de
    // vérité, qui notifie l'écran. Pas de `setPaused` local.
    if (paused) {
      resumeTracking();
    } else {
      void pauseTracking();
    }
  };

  /**
   * Premier temps de l'arrêt (US CARDIO-UX01, R1d / constat F11).
   *
   * Avant, un seul appui enchaînait `stopTracking` → `finishRun` → navigation : un frottement
   * dans la poche, une main mouillée, et une course de 90 minutes était clôturée et quittée sans
   * confirmation, sans retour arrière et sans suppression possible. Le geste met désormais en
   * **pause** et ouvre le choix.
   */
  const onStopPressed = () => {
    void pauseTracking();
    setDeciding(true);
  };

  const onResume = () => {
    setDeciding(false);
    resumeTracking();
  };

  const onFinish = () =>
    void lockFinish(async () => {
      setFinishing(true);
      const runId = active?.id;
      if (!runId) return;
      // Séquencement critique : stop + DRAIN avant finish (aucun flush tardif après clôture),
      // puis navigation quoi qu'il arrive (best-effort, comme la muscu).
      try {
        await stopTracking();
      } catch (error) {
        console.warn('Échec de stopTracking (ignoré, best-effort) :', error);
      }
      try {
        await finishRun(runId);
      } catch (error) {
        console.warn('Échec de finishRun (ignoré, best-effort) :', error);
      }
      router.replace({ pathname: '/run/summary', params: { id: runId } });
    });

  const onDelete = () => {
    const runId = active?.id;
    if (!runId) return;
    Alert.alert(t('running.stop.deleteConfirmTitle'), t('running.stop.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('running.stop.delete'),
        style: 'destructive',
        onPress: () =>
          void lockDelete(async () => {
            try {
              await stopTracking();
            } catch (error) {
              console.warn('Échec de stopTracking (ignoré) :', error);
            }
            try {
              await deleteRun(runId);
            } catch (error) {
              console.warn('Échec de deleteRun (ignoré) :', error);
            }
            router.replace('/(tabs)/running');
          }),
      },
    ]);
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}
      >
        <View style={styles.centered} />
      </SafeAreaView>
    );
  }

  // Plus de course active (terminée / annulée ailleurs) : on explique **avant** de proposer la
  // sortie. Un bouton « Retour » seul au milieu d'un écran vide laisse croire à un plantage.
  if (!active) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}
      >
        <View style={styles.centered}>
          <Text style={[styles.endedText, { color: colors.textMuted }]}>
            {t('running.active.ended')}
          </Text>
          <Button label={t('common.back')} onPress={() => router.replace('/run')} />
        </View>
      </SafeAreaView>
    );
  }

  const gpsStatus = !isGps
    ? t('running.active.gpsManual')
    : points.length > 0
      ? t('running.active.gpsActive')
      : t('running.active.gpsSearching');

  const distanceTargetLabel = comparison.distance
    ? t(
        `running.target.distance${comparison.distance.status === 'reached' ? 'Reached' : comparison.distance.status === 'over' ? 'Over' : 'Under'}`,
        {
          done: units.formatDistance(comparison.distance.doneValue / 1000),
          target: units.formatDistance(comparison.distance.targetValue / 1000),
          diff: units.formatDistance(Math.abs(comparison.distance.diff) / 1000),
        },
      )
    : null;
  const durationTargetLabel = comparison.duration
    ? t(
        `running.target.duration${comparison.duration.status === 'reached' ? 'Reached' : comparison.duration.status === 'over' ? 'Over' : 'Under'}`,
        {
          done: formatDuration(comparison.duration.doneValue),
          target: formatDuration(comparison.duration.targetValue),
          diff: formatDuration(Math.abs(comparison.duration.diff)),
        },
      )
    : null;
  const hasTarget = distanceTargetLabel !== null || durationTargetLabel !== null;

  // ── Écran verrouillé : tout est inerte sauf le déverrouillage ─────────────────────────────
  if (locked) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}
      >
        <View style={styles.lockedBody}>
          <Ionicons name="lock-closed" size={30} color={colors.textMuted} />
          <Text style={[styles.lockedTitle, { color: colors.text }]}>
            {t('running.active.lockedTitle')}
          </Text>

          <HeroValue
            metric={heroMetric}
            distanceM={distanceM}
            netSeconds={netSeconds}
            paceSPerKm={instantPaceValue}
            paused={paused}
            units={units}
            t={t}
            colors={colors}
          />

          <Pressable
            onLongPress={() => setLocked(false)}
            delayLongPress={700}
            accessibilityRole="button"
            accessibilityLabel={t('running.active.unlock')}
            accessibilityHint={t('running.active.unlockHint')}
            style={[
              styles.unlockBtn,
              { borderColor: colors.borderStrong, backgroundColor: colors.surface },
            ]}
          >
            <Ionicons name="lock-open-outline" size={20} color={colors.accent} />
            <Text style={[styles.unlockLabel, { color: colors.text }]}>
              {t('running.active.unlock')}
            </Text>
          </Pressable>
          <Text style={[styles.lockedHint, { color: colors.textMuted }]}>
            {t('running.active.unlockHint')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.topBar}>
        <View style={styles.gpsStatus}>
          <View
            style={[
              styles.gpsDot,
              { backgroundColor: isGps && points.length > 0 ? colors.success : colors.textMuted },
            ]}
          />
          <Text style={[styles.gpsLabel, { color: colors.textMuted }]}>{gpsStatus}</Text>
        </View>
        <SyncStatus />
      </View>

      {/* US CARDIO-UX01 (R1a) — la pause SE VOIT. Sans ce bandeau, un chrono figé se lit comme
          un écran gelé. */}
      {paused ? (
        <View
          style={[styles.pausedBanner, { backgroundColor: colors.warn, borderColor: colors.warnBorder }]}
          accessibilityRole="alert"
        >
          <Ionicons name="pause" size={18} color={colors.warnText} />
          <View style={styles.pausedTexts}>
            <Text style={[styles.pausedTitle, { color: colors.text }]}>
              {t('running.active.pausedTitle')}
            </Text>
            <Text style={[styles.pausedBody, { color: colors.warnText }]}>
              {t('running.active.pausedBody')}
            </Text>
          </View>
        </View>
      ) : null}

      {/* US CARDIO-UX01 (R5 / F10) — le bandeau qui manquait. */}
      <SegmentBanner banner={banner} paused={paused} />

      <View style={styles.body}>
        {/* Le chiffre du moment, en grand. Un tap le change (R5-2 / F13). */}
        <Pressable
          onPress={cycleHero}
          accessibilityRole="button"
          accessibilityLabel={t('running.hero.cycle')}
          accessibilityHint={t('running.hero.cycleHint')}
          style={styles.heroPress}
        >
          <HeroValue
            metric={heroMetric}
            distanceM={distanceM}
            netSeconds={netSeconds}
            paceSPerKm={instantPaceValue}
            paused={paused}
            units={units}
            t={t}
            colors={colors}
            evaluation={paceEvaluation}
          />
        </Pressable>

        {/* Les deux autres métriques, en petit. */}
        <View style={styles.secondaryRow}>
          {HERO_ORDER.filter((m) => m !== heroMetric).map((metric) => (
            <View key={metric} style={styles.secondaryItem}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t(`running.hero.${metric}`)}
              </Text>
              <Text style={[styles.secondaryValue, { color: colors.text }]}>
                {metric === 'distance'
                  ? units.formatDistance(distanceM / 1000)
                  : metric === 'duration'
                    ? formatDuration(netSeconds)
                    : units.formatPace(instantPaceValue)}
              </Text>
              {metric === 'duration' ? (
                <Text style={[styles.netHint, { color: colors.textMuted }]}>
                  {t('running.active.netHint')}
                </Text>
              ) : null}
            </View>
          ))}
          {isGps ? (
            <View style={styles.secondaryItem}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('running.active.avgPace')}
              </Text>
              <Text style={[styles.secondaryValue, { color: colors.text }]}>
                {units.formatPace(avgPaceValue)}
              </Text>
            </View>
          ) : null}
        </View>

        <GhostBand gap={gap} ghostDate={ghost?.finishedAt ?? null} />

        {/* Allure cible du moment + écart, jamais en couleur d'alerte (règle de ton RUN-F2b R4). */}
        {isGps && effectivePaceRange ? (
          <View style={styles.targetPaceRow}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              {t('running.paceGuidance.targetLabel')}
            </Text>
            <Text style={[styles.targetPaceValue, { color: colors.text }]}>
              {effectivePaceRange.minSPerKm === effectivePaceRange.maxSPerKm
                ? units.formatPace(effectivePaceRange.minSPerKm)
                : t('running.paceGuidance.range', {
                    min: units.formatPace(effectivePaceRange.minSPerKm),
                    max: units.formatPace(effectivePaceRange.maxSPerKm),
                  })}
            </Text>
            {paceEvaluation && paceEvaluation.verdict !== 'in_range' ? (
              <Text style={[styles.targetPaceHint, { color: colors.accent }]}>
                {t(
                  paceEvaluation.verdict === 'too_fast'
                    ? 'running.paceGuidance.hintTooFast'
                    : 'running.paceGuidance.hintTooSlow',
                  { delta: Math.abs(Math.round(paceEvaluation.deltaSPerKm)) },
                )}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Objectif de la séance planifiée (US RUN-F2b) — absent si aucune cible chiffrée */}
      {hasTarget ? (
        <View style={styles.targetWrap}>
          <Card>
            <Text style={[styles.targetTitle, { color: colors.text }]}>
              {t('running.target.title')}
            </Text>
            {distanceTargetLabel ? (
              <Text
                style={[
                  styles.targetText,
                  {
                    color:
                      comparison.distance!.status === 'under' ? colors.textMuted : colors.success,
                  },
                ]}
              >
                {distanceTargetLabel}
              </Text>
            ) : null}
            {durationTargetLabel ? (
              <Text
                style={[
                  styles.targetText,
                  {
                    color:
                      comparison.duration!.status === 'under' ? colors.textMuted : colors.success,
                  },
                ]}
              >
                {durationTargetLabel}
              </Text>
            ) : null}
          </Card>
        </View>
      ) : null}

      {/* Carte du parcours en temps réel */}
      {isGps ? (
        <View style={styles.mapCard}>
          <RouteMap points={simplified} follow emptyLabel={t('running.map.awaitingGps')} />
        </View>
      ) : null}

      {/* ── Deuxième temps de l'arrêt : les trois issues (R1d) ───────────────────────────── */}
      {deciding ? (
        <View style={styles.decideWrap}>
          <Card>
            <Text style={[styles.decideTitle, { color: colors.text }]}>
              {t('running.stop.title')}
            </Text>
            <Text style={[styles.decideBody, { color: colors.textMuted }]}>
              {t('running.stop.body', {
                distance: units.formatDistance(distanceM / 1000),
                duration: formatDuration(netSeconds),
              })}
            </Text>
            <Button label={t('running.stop.resume')} onPress={onResume} />
            <Button
              label={finishing ? t('running.active.finishing') : t('running.stop.finish')}
              variant="ghost"
              onPress={onFinish}
              loading={finishing}
            />
            <Button label={t('running.stop.delete')} variant="destructive" onPress={onDelete} />
            <Text style={[styles.decideHint, { color: colors.textMuted }]}>
              {t('running.stop.deleteHint')}
            </Text>
          </Card>
        </View>
      ) : (
        <View style={styles.controls}>
          <Pressable
            onPress={() => setLocked(true)}
            accessibilityRole="button"
            accessibilityLabel={t('running.active.lock')}
            style={[
              styles.iconBtn,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.iconBtnLabel, { color: colors.textMuted }]}>
              {t('running.active.lock')}
            </Text>
          </Pressable>

          <Pressable
            onPress={onTogglePause}
            accessibilityRole="button"
            accessibilityState={{ selected: paused }}
            style={[
              styles.pauseBtn,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Ionicons name={paused ? 'play' : 'pause'} size={22} color={colors.accent} />
            <Text style={[styles.pauseLabel, { color: colors.text }]}>
              {paused ? t('running.active.resume') : t('running.active.pause')}
            </Text>
          </Pressable>

          <View style={styles.stopWrap}>
            <Button label={t('running.active.stop')} onPress={onStopPressed} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Le chiffre en héros
// ---------------------------------------------------------------------------

/**
 * Le grand chiffre de l'écran (US CARDIO-UX01, R5-2 / constat F13).
 *
 * L'écran affichait la distance en 72 px **quelle que soit la séance**. Or le chiffre qu'on
 * regarde en courant dépend de ce qu'on fait : l'allure sur un fractionné (c'est elle qu'on
 * corrige), la distance sur une sortie longue, le chrono sur une séance bornée en minutes.
 */
function HeroValue({
  metric,
  distanceM,
  netSeconds,
  paceSPerKm,
  paused,
  units,
  t,
  colors,
  evaluation,
}: {
  metric: HeroMetric;
  distanceM: number;
  netSeconds: number;
  paceSPerKm: number | null;
  paused: boolean;
  units: ReturnType<typeof useUnits>;
  t: ReturnType<typeof useTranslation>['t'];
  colors: ReturnType<typeof useTheme>['colors'];
  evaluation?: ReturnType<typeof evaluatePace>;
}) {
  const value =
    metric === 'distance'
      ? units.formatDistanceValue(distanceM / 1000)
      : metric === 'duration'
        ? formatDuration(netSeconds)
        : units.formatPace(paceSPerKm);

  const unit =
    metric === 'distance'
      ? units.distanceSymbol
      : metric === 'pace'
        ? `/${units.distanceSymbol}`
        : null;

  // En pause, le chiffre est grisé : c'est ce qui distingue « figé » de « gelé ».
  const tone = paused
    ? colors.textMuted
    : metric === 'pace' && evaluation && evaluation.verdict === 'in_range'
      ? colors.success
      : colors.text;

  return (
    <View style={styles.hero}>
      <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
        {t(`running.hero.${metric}`)}
        {paused ? ` · ${t('running.active.frozen')}` : ''}
      </Text>
      <View style={styles.heroValueRow}>
        <Text style={[styles.heroValue, { color: tone }]}>{value}</Text>
        {unit ? <Text style={[styles.heroUnit, { color: colors.textMuted }]}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 },
  endedText: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 22, textAlign: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  gpsStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  gpsLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 12 },

  // Bandeau de pause
  pausedBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pausedTexts: { flex: 1, gap: 1 },
  pausedTitle: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.3 },
  pausedBody: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 16 },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, paddingHorizontal: 20 },
  heroPress: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: 2 },
  heroLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  heroValue: {
    fontFamily: fontFamily.displayXBold,
    fontSize: 72,
    letterSpacing: -2,
    lineHeight: 78,
  },
  heroUnit: { fontFamily: fontFamily.displaySemi, fontSize: 22, marginBottom: 12 },

  secondaryRow: { flexDirection: 'row', justifyContent: 'center', gap: 28 },
  secondaryItem: { alignItems: 'center', gap: 2, minWidth: 78 },
  statLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryValue: { fontFamily: fontFamily.monoBold, fontSize: 22 },
  netHint: { fontFamily: fontFamily.body, fontSize: 10 },

  targetPaceRow: { alignItems: 'center', gap: 2 },
  targetPaceValue: { fontFamily: fontFamily.monoBold, fontSize: 18 },
  targetPaceHint: { fontFamily: fontFamily.body, fontSize: 12 },

  targetWrap: { paddingHorizontal: 20, paddingBottom: 4 },
  targetTitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  targetText: { fontFamily: fontFamily.bodyBold, fontSize: 14, lineHeight: 19 },
  mapCard: { paddingHorizontal: 20, paddingBottom: 12 },

  // Panneau d'issues
  decideWrap: { paddingHorizontal: 20, paddingBottom: 12 },
  decideTitle: { fontFamily: fontFamily.displaySemi, fontSize: 17, letterSpacing: -0.3 },
  decideBody: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  decideHint: { fontFamily: fontFamily.body, fontSize: 11, lineHeight: 15, textAlign: 'center' },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  iconBtn: {
    minHeight: 56,
    minWidth: 62,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconBtnLabel: { fontFamily: fontFamily.bodySemi, fontSize: 10 },
  pauseBtn: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  pauseLabel: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  stopWrap: { flex: 1 },

  // Écran verrouillé
  lockedBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 },
  lockedTitle: { fontFamily: fontFamily.displaySemi, fontSize: 18, letterSpacing: -0.3 },
  unlockBtn: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 26,
  },
  unlockLabel: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  lockedHint: { fontFamily: fontFamily.body, fontSize: 12, textAlign: 'center' },
});

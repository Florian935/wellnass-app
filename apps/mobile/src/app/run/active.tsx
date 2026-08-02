import { Ionicons } from '@expo/vector-icons';
import { averagePace, compareToTarget, decodeTrack, instantPace, simplifyTrack } from '@wellness/shared';
import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { RouteMap } from '@/components/running/RouteMap';
import { SyncStatus } from '@/components/SyncStatus';
import { finishRun, useActiveRun, useRunTarget } from '@/data/repositories/run-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { pauseTracking, resumeTracking, stopTracking } from '@/running/tracker';
import { getPaused, subscribePaused } from '@/running/tracker-task';
import { useDistanceAnnouncements } from '@/running/announcements';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useUnits } from '@/hooks/useUnits';

/** Horloge locale : secondes écoulées depuis `startedAt`, rafraîchie chaque seconde. */
function useElapsedSeconds(startedAt: string | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
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

/**
 * Écran de suivi temps réel d'une course (Running R1, 5.13-5.16 / 5.20-5.22).
 *
 * Lit la course active de façon réactive (chaque flush du tracker met la ligne à
 * jour) et superpose une horloge locale pour un affichage fluide. Garde l'écran
 * allumé pendant le suivi (`useKeepAwake`). Séquencement d'arrêt critique :
 *   stopTracking() → finishRun() → navigation vers le résumé (voir `onStop`).
 */
export default function RunActiveScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();

  // Empêche la mise en veille de l'écran pendant le suivi (5.x / 2.3).
  useKeepAwake();

  const { run: active, isLoading } = useActiveRun();

  const elapsedSeconds = useElapsedSeconds(active?.startedAt);
  // État de pause piloté par la source de vérité unique du tracker : reflète aussi
  // l'auto-pause (déclenchée hors interaction) pour que le bouton ne mente jamais.
  const [paused, setPaused] = useState(getPaused);
  const [stopping, setStopping] = useState(false);

  useEffect(() => subscribePaused(setPaused), []);

  const isGps = active?.source === 'gps';
  const gpsTrack = active?.gpsTrack ?? null;

  // Décodage de la trace uniquement quand elle change (coûteux) — pour l'allure
  // instantanée. En mode manuel / sans trace, on n'affiche pas d'allure.
  const points = useMemo(
    () => (isGps && gpsTrack ? decodeTrack(gpsTrack) : []),
    [isGps, gpsTrack],
  );

  // Simplification de la trace pour le rendu cartographique (epsilon 5 m).
  const simplified = useMemo(() => simplifyTrack(points, 5), [points]);

  const distanceM = active?.distanceM ?? 0;

  // Allure moyenne : distance / durée nette (flushée) si dispo, sinon horloge
  // (durée nette exclut les pauses ; l'horloge est un repli tant qu'aucun flush).
  const durationForPace = active?.durationSeconds ?? elapsedSeconds;
  const avgPaceValue = isGps ? averagePace(distanceM, durationForPace) : null;
  const instantPaceValue = isGps ? instantPace(points) : null;

  // US RUN-F2a (5.19) : annonces vocales périodiques, GPS uniquement (spec R4). Hook appelé
  // inconditionnellement (règle des hooks) — le gating (pilier GPS + réglage utilisateur) est
  // géré en interne par `enabled`.
  const { runnerProfile } = useRunnerProfile();
  useDistanceAnnouncements({
    enabled: isGps && runnerProfile?.voiceAnnouncementsEnabled === true,
    intervalM: runnerProfile?.voiceAnnouncementIntervalM ?? 1000,
    distanceM,
    elapsedSeconds,
    avgPaceSPerKm: avgPaceValue,
  });

  // US RUN-F2b (5.23) : cible de la séance planifiée, comparée en direct — même fonction pure et
  // mêmes clés i18n que le résumé post-course (RUN-F3), aucune n'est modifiée (spec R1/R2).
  const target = useRunTarget(active?.plannedSessionId ?? null);
  const comparison = useMemo(
    () =>
      compareToTarget(
        {
          distanceM: isGps ? distanceM : null,
          // R1 bis : jamais `elapsedSeconds` ici (horloge murale, inclut les pauses) — absent
          // tant que le tracker n'a pas encore flushé de durée nette.
          durationS: active?.durationSeconds ?? null,
        },
        {
          targetDistanceM: target?.targetDistanceM ?? null,
          targetDurationS: target?.targetDurationSeconds ?? null,
        },
      ),
    [isGps, distanceM, active?.durationSeconds, target],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centered} />
      </SafeAreaView>
    );
  }

  // Plus de course active (terminée / annulée ailleurs) : on explique **avant** de proposer la
  // sortie. Un bouton « Retour » seul au milieu d'un écran vide laisse croire à un plantage —
  // constaté le 30/07/2026 en passe device, seul écran de l'app sans état vide rédigé.
  if (!active) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
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

  // US RUN-F2b : libellés de comparaison à la cible — copie volontaire de la logique de
  // `run/summary.tsx` (RUN-F3 encore en recette, pas de partage d'abstraction pour l'instant,
  // voir plan). Même règle de ton (R4) : jamais une couleur d'alerte.
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

  const onTogglePause = () => {
    // L'affichage suit l'émetteur du tracker (`subscribePaused`) : ces appels
    // mutent la source de vérité, qui notifie l'écran. Pas de `setPaused` local.
    if (paused) {
      resumeTracking();
    } else {
      void pauseTracking();
    }
  };

  const onStop = async () => {
    if (stopping) return;
    setStopping(true);
    const runId = active.id;
    // Séquencement critique : stop + DRAIN avant finish (aucun flush tardif après
    // clôture), puis navigation quoi qu'il arrive (best-effort, comme la muscu).
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
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
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

      <View style={styles.body}>
        {/* Distance en grand */}
        <View style={styles.hero}>
          <Text style={[styles.distanceValue, { color: colors.text }]}>
            {units.formatDistanceValue(distanceM / 1000)}
          </Text>
          <Text style={[styles.distanceUnit, { color: colors.textMuted }]}>
            {units.distanceSymbol}
          </Text>
        </View>

        {/* Chrono */}
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('running.active.duration')}
          </Text>
          <Text style={[styles.timer, { color: colors.text }]}>
            {formatDuration(elapsedSeconds)}
          </Text>
        </View>

        {/* Allures (GPS uniquement) */}
        {isGps ? (
          <View style={styles.paces}>
            <View style={styles.paceItem}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('running.active.avgPace')}
              </Text>
              <Text style={[styles.paceValue, { color: colors.text }]}>
                {units.formatPace(avgPaceValue)}
              </Text>
            </View>
            <View style={styles.paceItem}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('running.active.instantPace')}
              </Text>
              <Text style={[styles.paceValue, { color: colors.text }]}>
                {units.formatPace(instantPaceValue)}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Objectif de la séance planifiée (US RUN-F2b) — absente si aucune cible chiffrée */}
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
                  { color: comparison.distance!.status === 'under' ? colors.textMuted : colors.success },
                ]}
              >
                {distanceTargetLabel}
              </Text>
            ) : null}
            {durationTargetLabel ? (
              <Text
                style={[
                  styles.targetText,
                  { color: comparison.duration!.status === 'under' ? colors.textMuted : colors.success },
                ]}
              >
                {durationTargetLabel}
              </Text>
            ) : null}
          </Card>
        </View>
      ) : null}

      {/* Carte du parcours en temps réel */}
      <View style={styles.mapCard}>
        <RouteMap
          points={simplified}
          follow
          emptyLabel={t(
            active.source === 'manual'
              ? 'running.map.noTrack'
              : 'running.map.awaitingGps',
          )}
        />
      </View>

      <View style={styles.controls}>
        {isGps ? (
          <Pressable
            onPress={onTogglePause}
            accessibilityRole="button"
            style={[styles.pauseBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Ionicons
              name={paused ? 'play' : 'pause'}
              size={22}
              color={colors.accent}
            />
            <Text style={[styles.pauseLabel, { color: colors.text }]}>
              {paused ? t('running.active.resume') : t('running.active.pause')}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.stopWrap}>
          <Button
            label={stopping ? t('running.active.finishing') : t('running.active.stop')}
            onPress={onStop}
            loading={stopping}
          />
        </View>
      </View>
    </SafeAreaView>
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
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, paddingHorizontal: 20 },
  hero: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  distanceValue: { fontFamily: fontFamily.displayXBold, fontSize: 72, letterSpacing: -2, lineHeight: 78 },
  distanceUnit: { fontFamily: fontFamily.displaySemi, fontSize: 24, marginBottom: 12 },
  stat: { alignItems: 'center', gap: 4 },
  statLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  timer: { fontFamily: fontFamily.monoBold, fontSize: 40 },
  paces: { flexDirection: 'row', justifyContent: 'center', gap: 40 },
  paceItem: { alignItems: 'center', gap: 4 },
  paceValue: { fontFamily: fontFamily.monoBold, fontSize: 24 },
  targetWrap: { paddingHorizontal: 20, paddingBottom: 4 },
  targetTitle: { fontFamily: fontFamily.bodySemi, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  targetText: { fontFamily: fontFamily.bodyBold, fontSize: 14, lineHeight: 19 },
  mapCard: { paddingHorizontal: 20, paddingBottom: 12 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  pauseBtn: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
  },
  pauseLabel: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  stopWrap: { flex: 1 },
});

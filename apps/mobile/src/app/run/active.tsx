import { Ionicons } from '@expo/vector-icons';
import { averagePace, decodeTrack, instantPace } from '@wellness/shared';
import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { SyncStatus } from '@/components/SyncStatus';
import { finishRun, useActiveRun } from '@/data/repositories/run-repository';
import { pauseTracking, resumeTracking, stopTracking } from '@/running/tracker';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

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

/** Formate une allure en s/km → `M:SS` (ou `—` si nulle). */
function formatPace(sPerKm: number | null, noData: string): string {
  if (sPerKm == null || !Number.isFinite(sPerKm) || sPerKm <= 0) return noData;
  const total = Math.round(sPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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

  // Empêche la mise en veille de l'écran pendant le suivi (5.x / 2.3).
  useKeepAwake();

  const { run: active, isLoading } = useActiveRun();

  const elapsedSeconds = useElapsedSeconds(active?.startedAt);
  const [paused, setPaused] = useState(false);
  const [stopping, setStopping] = useState(false);

  const isGps = active?.source === 'gps';
  const gpsTrack = active?.gpsTrack ?? null;

  // Décodage de la trace uniquement quand elle change (coûteux) — pour l'allure
  // instantanée. En mode manuel / sans trace, on n'affiche pas d'allure.
  const points = useMemo(
    () => (isGps && gpsTrack ? decodeTrack(gpsTrack) : []),
    [isGps, gpsTrack],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centered} />
      </SafeAreaView>
    );
  }

  // Plus de course active (terminée / annulée ailleurs) : retour au démarrage.
  if (!active) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Button label={t('common.back')} onPress={() => router.replace('/run')} />
        </View>
      </SafeAreaView>
    );
  }

  const distanceM = active.distanceM ?? 0;
  const distanceKm = (distanceM / 1000).toFixed(2);

  // Allure moyenne : distance / durée nette (flushée) si dispo, sinon horloge
  // (durée nette exclut les pauses ; l'horloge est un repli tant qu'aucun flush).
  const durationForPace = active.durationSeconds ?? elapsedSeconds;
  const avgPaceValue = isGps ? averagePace(distanceM, durationForPace) : null;
  const instantPaceValue = isGps ? instantPace(points) : null;

  const gpsStatus = !isGps
    ? t('running.active.gpsManual')
    : points.length > 0
      ? t('running.active.gpsActive')
      : t('running.active.gpsSearching');

  const onTogglePause = () => {
    if (paused) {
      resumeTracking();
      setPaused(false);
    } else {
      void pauseTracking();
      setPaused(true);
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
          <Text style={[styles.distanceValue, { color: colors.text }]}>{distanceKm}</Text>
          <Text style={[styles.distanceUnit, { color: colors.textMuted }]}>
            {t('running.active.kmUnit')}
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
                {formatPace(avgPaceValue, t('running.active.noData'))}
                <Text style={[styles.paceUnit, { color: colors.textMuted }]}>
                  {' '}
                  {t('running.active.paceUnit')}
                </Text>
              </Text>
            </View>
            <View style={styles.paceItem}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('running.active.instantPace')}
              </Text>
              <Text style={[styles.paceValue, { color: colors.text }]}>
                {formatPace(instantPaceValue, t('running.active.noData'))}
                <Text style={[styles.paceUnit, { color: colors.textMuted }]}>
                  {' '}
                  {t('running.active.paceUnit')}
                </Text>
              </Text>
            </View>
          </View>
        ) : null}
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
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
  paceUnit: { fontFamily: fontFamily.body, fontSize: 13 },
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

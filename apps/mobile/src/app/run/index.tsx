import { Ionicons } from '@expo/vector-icons';
import { formatDurationHms, type RunSource } from '@wellness/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  cancelRun,
  setRunGhost,
  startRun,
  useActiveRun,
  useIntervalBlocksForRun,
  useRun,
  useRunGhost,
} from '@/data/repositories/run-repository';
import { GhostPicker } from '@/components/running/GhostPicker';
import { powerSync } from '@/powersync/system';
import { startManualClock, startTracking } from '@/running/tracker';
import { formatIntervalBlockSummary } from '@/running/interval-summary';
import { useRunStartMode } from '@/stores/run-start-mode-store';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useActionLock } from '@/hooks/useActionLock';
import { useTheme } from '@/theme/useTheme';
import { useMenuFocus } from '@/hooks/useMenuFocus';

/**
 * Écran de démarrage d'une course libre (Running R1, 5.12).
 *
 * - Bascule GPS / sans GPS (`source`).
 * - Démarre la course (ligne `runs`), puis — en mode GPS — lance le tracker et
 *   branche sur le résultat de permission (refus avant-plan bloquant : on ne
 *   navigue PAS vers le suivi sans permission de localisation).
 * - Si une course est déjà active, propose de la reprendre plutôt que d'en créer
 *   une seconde (le repository est idempotent, mais l'UX doit être explicite).
 * - `plannedSessionId` (US RUN-F3, roadmap 5.25) : param de route optionnel, posé par le hub
 *   course quand une séance planifiée du jour est démarrée depuis là — sinon absent (course libre).
 * - US CARDIO-UX03 : l'écran porte le nom de ce qu'on lance (la séance, « Recourir ta sortie du … »,
 *   ou « Course libre ») et rappelle la séance ; il **retient le dernier mode** (R6) ; `ghostRunId`
 *   (Recourir) présélectionne ce fantôme, posé en GPS seulement (R5).
 */
export default function RunStartScreen() {
  // US CARDIO-UX02 — **l'identité du pilier appartient à l'écran, pas à l'onglet d'où l'on vient.**
  // `useMenuFocus` n'était appelé que par les cinq onglets : un écran course ouvert depuis
  // l'Accueil (`NowCard`, `QuickActions`, `RecordRecentCard` y poussent tous vers `/run…`)
  // héritait du terracotta de l'accueil. Le déclarer ici rend la couleur du pilier vraie quel
  // que soit le chemin — un test de garde vérifie qu'aucun écran course ne l'oublie.
  useMenuFocus('running');

  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();
  const { plannedSessionId, ghostRunId: againId } = useLocalSearchParams<{
    plannedSessionId?: string;
    /** US CARDIO-UX03 (D4) — « Recourir » : la sortie passée à affronter, présélectionnée. */
    ghostRunId?: string;
  }>();

  const { run: active, isLoading } = useActiveRun();

  // ── US CARDIO-UX03 — la sortie à recourir (D4, R5) ─────────────────────────────────────────
  // Lue par son identifiant, et **vérifiée par son profil de fantôme** : une trace illisible ou
  // trop courte ne donne rien à suivre. L'écran retombe alors sur une course libre plutôt que de
  // promettre un fantôme qui ne courra pas.
  const { run: againRun } = useRun(againId);
  const { ghost: againGhost } = useRunGhost(againId);
  const again = againId && againRun && againGhost ? againRun : null;

  // ── US CARDIO-UX03 — le dernier mode retenu (D5, R6 ; Q5) ──────────────────────────────────
  // CARDIO-UX01 (F4) l'avait promis : l'écran repartait chaque fois sur « Suivi GPS ». Recourir
  // part en GPS quoi qu'il arrive : un fantôme ne court qu'à côté d'une trace.
  const storedSource = useRunStartMode((s) => s.source);
  const hydrateMode = useRunStartMode((s) => s.hydrate);
  const rememberSource = useRunStartMode((s) => s.setSource);
  useEffect(() => {
    void hydrateMode();
  }, [hydrateMode]);
  const [pickedSource, setSource] = useState<RunSource | null>(null);
  const source: RunSource = pickedSource ?? (again ? 'gps' : storedSource);

  // US FANT-01 — le fantôme choisi avant le départ, écrit une seule fois sur la course (R8).
  // `undefined` = rien touché encore : la sortie à recourir, si elle est valable, est présélectionnée.
  const [chosenGhost, setGhostRunId] = useState<string | null | undefined>(undefined);
  const ghostRunId = chosenGhost === undefined ? (again?.id ?? null) : chosenGhost;

  // ── US CARDIO-UX03 — la séance du jour, rappelée (D5) ──────────────────────────────────────
  // L'écran s'appelait « Course libre » même pour la séance planifiée qu'on venait de lancer.
  const { sessionType, blocks } = useIntervalBlocksForRun(plannedSessionId ?? null);
  const segments = blocks.map((block) => formatIntervalBlockSummary(t, block));

  const [starting, setStarting] = useState(false);
  const lockStart = useActionLock();

  const againDate = again ? new Date(again.finishedAt ?? again.startedAt) : null;
  const header = again
    ? {
        title: t('running.start.ghostTitle', {
          date: `${new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(againDate!)} ${String(
            againDate!.getDate(),
          ).padStart(2, '0')}/${String(againDate!.getMonth() + 1).padStart(2, '0')}`,
        }),
        subtitle: t('running.start.ghostSubtitle', {
          distance: units.formatDistance(again.distanceM != null ? again.distanceM / 1000 : null),
          duration: formatDurationHms(again.durationSeconds),
        }),
      }
    : plannedSessionId
      ? {
          title: sessionType ? t(`running.sessionType.${sessionType}`) : t('running.start.sessionSubtitle'),
          subtitle: sessionType ? t('running.start.sessionSubtitle') : undefined,
        }
      : { title: t('running.start.title'), subtitle: t('running.start.subtitle') };

  const startLabel = plannedSessionId
    ? t('running.start.startSessionCta')
    : source === 'gps' && ghostRunId !== null
      ? t('running.start.startGhostCta')
      : t('running.start.startCta');

  /** La sortie à recourir, telle que le sélecteur de fantôme l'affiche (listée même partie d'ailleurs, Q4). */
  const pinnedGhost =
    again && again.finishedAt && again.distanceM != null
      ? {
          id: again.id,
          finishedAt: again.finishedAt,
          distanceM: again.distanceM,
          durationSeconds: again.durationSeconds,
        }
      : null;

  /** Lit l'epoch (ms) de démarrage de la course active en base (source de vérité). */
  const readStartedAtMs = async (runId: string): Promise<number> => {
    const row = await powerSync.getOptional<{ started_at: string }>(
      `SELECT started_at FROM runs WHERE id = ?`,
      [runId],
    );
    return row ? new Date(row.started_at).getTime() : Date.now();
  };

  // `starting` ne pilote que l'affichage : la garde est portée par `useActionLock`. Sans le
  // verrou, deux appuis du même cycle de rendu créaient DEUX courses — dont une orpheline, et le
  // suivi GPS rattaché à une seule des deux. Dix-septième site du défaut du 08/08/2026.
  const onStart = () =>
    void lockStart(async () => {
      setStarting(true);
      try {
        const id = await startRun(source, plannedSessionId);
        // US CARDIO-UX03 (R5) — **en GPS seulement** : l'écran posait jusqu'ici le fantôme choisi
        // quel que soit le mode, et une course sans trace se retrouvait « contre » un fantôme
        // qu'elle ne pouvait pas suivre.
        if (source === 'gps' && ghostRunId !== null) await setRunGhost(id, ghostRunId);
        const startedAtMs = await readStartedAtMs(id);

        if (source === 'manual') {
          // US CARDIO-UX01 (R1b) — le mode sans GPS démarre son propre chrono. Sans cet appel,
          // aucun tracker ne tournait : `duration_seconds` restait `null` et les minutes que le
          // coureur regardait défiler n'étaient enregistrées **nulle part** (constat F15).
          startManualClock(id, startedAtMs);
        }

        if (source === 'gps') {
          const res = await startTracking(id, startedAtMs, { autoPause: true });

          // Permission avant-plan refusée : suivi impossible. On propose de
          // continuer en mode manuel ou d'annuler ; on ne navigue PAS vers le suivi.
          if (!res.ok && res.reason === 'foreground-denied') {
            promptPermissionDenied(id);
            return;
          }
          // `background-denied` : le suivi avant-plan fonctionne, on continue (R1).
        }

        // US CARDIO-UX03 (R6) — le mode retenu est celui qu'on vient **effectivement** de démarrer.
        rememberSource(source);
        router.push('/run/active');
      } finally {
        setStarting(false);
      }
    });

  /**
   * Boîte de dialogue affichée quand la localisation est refusée : continuer en
   * mode manuel (annule la course GPS créée et en démarre une nouvelle en mode
   * manuel) ou annuler la course complètement.
   */
  const promptPermissionDenied = (gpsRunId: string) => {
    Alert.alert(t('running.permission.title'), t('running.permission.message'), [
      {
        text: t('running.permission.cancelRun'),
        style: 'cancel',
        onPress: () => {
          void cancelRun(gpsRunId);
        },
      },
      {
        text: t('running.permission.continueManual'),
        onPress: async () => {
          // Annule la course GPS (permission refusée, inutilisable) et en
          // démarre une nouvelle en mode manuel pour que l'écran actif affiche
          // le chrono sans chercher un signal GPS indisponible.
          await cancelRun(gpsRunId);
          const manualId = await startRun('manual', plannedSessionId);
          // R6 : c'est ce repli que le coureur a finalement lancé, c'est lui qu'on retient.
          rememberSource('manual');
          startManualClock(manualId, await readStartedAtMs(manualId));
          router.push('/run/active');
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={t('running.start.title')} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={header.title} subtitle={header.subtitle} />

      {active ? (
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
      ) : (
        <>
          {/* US CARDIO-UX03 (D5) — la séance qu'on lance, rappelée avant de partir (F7). */}
          {plannedSessionId && segments.length > 0 ? (
            <Card>
              <View style={styles.segments} testID="run-start-segments">
                {segments.map((label, index) => (
                  <View key={`${label}-${index}`} style={[styles.segment, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.segmentText, { color: colors.text }]}>{label}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          <Card>
            <ModeOption
              selected={source === 'gps'}
              icon="navigate-outline"
              label={t('running.start.gpsMode')}
              hint={t('running.start.gpsModeHint')}
              onPress={() => setSource('gps')}
            />
            <ModeOption
              selected={source === 'manual'}
              icon="create-outline"
              label={t('running.start.manualMode')}
              hint={t('running.start.manualModeHint')}
              onPress={() => setSource('manual')}
            />
          </Card>

          {/* US FANT-01 — proposé, jamais imposé (D1) : sans choix, la course démarre comme avant. */}
          {source === 'gps' ? (
            <GhostPicker selectedId={ghostRunId} onSelect={setGhostRunId} pinned={pinnedGhost} />
          ) : null}

          <Button
            testID="run-start-cta"
            label={starting ? t('running.start.starting') : startLabel}
            onPress={onStart}
            loading={starting}
          />
        </>
      )}
    </Screen>
  );
}

/** Ligne de choix de mode (GPS / manuel) au sein de la carte. */
function ModeOption({
  selected,
  icon,
  label,
  hint,
  onPress,
}: {
  selected: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.mode,
        {
          borderColor: selected ? colors.accent : colors.border,
          backgroundColor: selected ? colors.surfaceAlt : 'transparent',
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={selected ? colors.accent : colors.textMuted} />
      <View style={styles.modeTexts}>
        <Text style={[styles.modeLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.modeHint, { color: colors.textMuted }]}>{hint}</Text>
      </View>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={selected ? colors.accent : colors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.3 },
  cardText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  mode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  modeTexts: { flex: 1, gap: 2 },
  modeLabel: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  modeHint: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  segments: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segment: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  segmentText: { fontFamily: fontFamily.bodyMedium, fontSize: 13 },
});

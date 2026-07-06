import { Ionicons } from '@expo/vector-icons';
import type { RunSource } from '@wellness/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { cancelRun, startRun, useActiveRun } from '@/data/repositories/run-repository';
import { powerSync } from '@/powersync/system';
import { startTracking } from '@/running/tracker';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Écran de démarrage d'une course libre (Running R1, 5.12).
 *
 * - Bascule GPS / sans GPS (`source`).
 * - Démarre la course (ligne `runs`), puis — en mode GPS — lance le tracker et
 *   branche sur le résultat de permission (refus avant-plan bloquant : on ne
 *   navigue PAS vers le suivi sans permission de localisation).
 * - Si une course est déjà active, propose de la reprendre plutôt que d'en créer
 *   une seconde (le repository est idempotent, mais l'UX doit être explicite).
 */
export default function RunStartScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { run: active, isLoading } = useActiveRun();

  const [source, setSource] = useState<RunSource>('gps');
  const [starting, setStarting] = useState(false);

  /** Lit l'epoch (ms) de démarrage de la course active en base (source de vérité). */
  const readStartedAtMs = async (runId: string): Promise<number> => {
    const row = await powerSync.getOptional<{ started_at: string }>(
      `SELECT started_at FROM runs WHERE id = ?`,
      [runId],
    );
    return row ? new Date(row.started_at).getTime() : Date.now();
  };

  const onStart = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const id = await startRun(source);

      if (source === 'gps') {
        const startedAtMs = await readStartedAtMs(id);
        const res = await startTracking(id, startedAtMs, { autoPause: true });

        // Permission avant-plan refusée : suivi impossible. On propose de
        // continuer en mode manuel ou d'annuler ; on ne navigue PAS vers le suivi.
        if (!res.ok && res.reason === 'foreground-denied') {
          promptPermissionDenied(id);
          return;
        }
        // `background-denied` : le suivi avant-plan fonctionne, on continue (R1).
      }

      router.push('/run/active');
    } finally {
      setStarting(false);
    }
  };

  /**
   * Boîte de dialogue affichée quand la localisation est refusée : continuer en
   * mode manuel (la course créée reste active, on bascule juste sa source côté
   * suivi) ou annuler la course.
   */
  const promptPermissionDenied = (runId: string) => {
    Alert.alert(t('running.permission.title'), t('running.permission.message'), [
      {
        text: t('running.permission.cancelRun'),
        style: 'cancel',
        onPress: () => {
          void cancelRun(runId);
        },
      },
      {
        text: t('running.permission.continueManual'),
        onPress: () => {
          // La course est déjà créée (source 'gps') ; en R1 on la poursuit
          // en suivi manuel : pas de trace GPS, le suivi affiche le chrono.
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
      <ScreenHeader title={t('running.start.title')} subtitle={t('running.start.subtitle')} />

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

          <Button
            label={starting ? t('running.start.starting') : t('running.start.startCta')}
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
});

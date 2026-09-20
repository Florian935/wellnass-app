/**
 * US DASH-01 (§4.3) — les **chronos prédits**, remontés dans le hub.
 *
 * `resolveRacePredictions` (US RUN-14, formule de Riegel depuis le record des 5 km) ne vivait que
 * dans l'écran de statistiques. C'est pourtant la projection la plus motivante du pilier : elle
 * répond à « et si je courais un 10 km demain ? » sans demander de le courir.
 *
 * Deux règles héritées, tenues telles quelles : une distance qui a déjà un **vrai** record n'est
 * jamais prédite (c'est la brique qui l'écarte), et sans record de 5 km il n'y a **rien** à
 * afficher — la carte se tait plutôt que d'inventer une estimation.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  explainRacePrediction,
  formatDurationHms,
  resolveRacePredictions,
  type RacePrediction,
  RECORD_DISTANCE_I18N_KEY,
} from '@wellness/shared';
import { ExplainButton } from '@/components/explain/ExplainButton';
import { ExplainSheet } from '@/components/explain/ExplainSheet';
import { PressableScale } from '@/components/motion/PressableScale';
import { DenseTile } from '@/components/stage/DenseTile';
import { useRunningRecords } from '@/data/repositories/running-record-repository';
import { useTodayDate } from '@/hooks/useTodayKey';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = { onOpen: () => void };

export function RunPredictionsCard({ onOpen }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { records } = useRunningRecords();
  const today = useTodayDate();
  // §6.1 — la prédiction ouverte dans « Pourquoi ? », ou `null` quand la feuille est fermée.
  const [explained, setExplained] = useState<RacePrediction | null>(null);

  const predictions = resolveRacePredictions(records);
  if (predictions.length === 0) return null;

  return (
    <DenseTile
      title={t('stage.running.predictions.title')}
      meta={t('stage.running.predictions.meta')}
      onPress={onOpen}
      testID="run-predictions-card"
    >
      <View style={styles.row}>
        {predictions.map((prediction) => (
          <PressableScale
            key={prediction.distanceKey}
            haptic="select"
            onPress={() => setExplained(prediction)}
            accessibilityRole="button"
            accessibilityLabel={t('stage.running.predictions.a11y', {
              distance: t(RECORD_DISTANCE_I18N_KEY[prediction.distanceKey]),
              time: formatDurationHms(prediction.predictedSeconds),
            })}
            style={[styles.cell, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
          >
            <Text style={[styles.distance, { color: colors.textMuted }]} numberOfLines={1}>
              {t(RECORD_DISTANCE_I18N_KEY[prediction.distanceKey])}
            </Text>
            <Text style={[styles.time, { color: colors.text }]} numberOfLines={1}>
              {formatDurationHms(prediction.predictedSeconds)}
            </Text>
          </PressableScale>
        ))}
      </View>

      {/* Une estimation sans son origine est un chiffre magique : Riegel, depuis le record 5 km. */}
      <ExplainButton
        onPress={() => setExplained(predictions[0] ?? null)}
        color={colors.textMuted}
        subject={t('stage.running.predictions.title')}
      />

      <ExplainSheet
        visible={explained !== null}
        title={
          explained
            ? `${t(RECORD_DISTANCE_I18N_KEY[explained.distanceKey])} · ${formatDurationHms(explained.predictedSeconds)}`
            : ''
        }
        explanation={explained ? explainRacePrediction(explained, today.toISOString()) : null}
        // Les secondes brutes ne se lisent pas : chaque étape est rendue dans sa propre unité.
        formatValue={(step) =>
          step.value == null
            ? null
            : step.key === 'explain.race.riegel'
              ? step.value.toFixed(2)
              : formatDurationHms(step.value)
        }
        onClose={() => setExplained(null)}
      />
    </DenseTile>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, gap: 2 },
  distance: { fontFamily: fontFamily.bodySemi, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  time: { fontFamily: fontFamily.monoBold, fontSize: 15 },
});

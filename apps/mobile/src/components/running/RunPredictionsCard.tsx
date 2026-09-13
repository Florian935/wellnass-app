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

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDurationHms, resolveRacePredictions, type RecordDistanceKey } from '@wellness/shared';
import { DenseTile } from '@/components/stage/DenseTile';
import { useRunningRecords } from '@/data/repositories/running-record-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Les mêmes libellés que l'écran de stats — une distance ne change pas de nom selon l'écran. */
const DISTANCE_LABEL: Record<RecordDistanceKey, string> = {
  '1k': 'running.records.distance1k',
  '5k': 'running.records.distance5k',
  '10k': 'running.records.distance10k',
  semi: 'running.records.distanceSemi',
  marathon: 'running.records.distanceMarathon',
};

type Props = { onOpen: () => void };

export function RunPredictionsCard({ onOpen }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { records } = useRunningRecords();

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
          <View
            key={prediction.distanceKey}
            accessible
            accessibilityLabel={t('stage.running.predictions.a11y', {
              distance: t(DISTANCE_LABEL[prediction.distanceKey]),
              time: formatDurationHms(prediction.predictedSeconds),
            })}
            style={[styles.cell, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
          >
            <Text style={[styles.distance, { color: colors.textMuted }]} numberOfLines={1}>
              {t(DISTANCE_LABEL[prediction.distanceKey])}
            </Text>
            <Text style={[styles.time, { color: colors.text }]} numberOfLines={1}>
              {formatDurationHms(prediction.predictedSeconds)}
            </Text>
          </View>
        ))}
      </View>
    </DenseTile>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, gap: 2 },
  distance: { fontFamily: fontFamily.bodySemi, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  time: { fontFamily: fontFamily.monoBold, fontSize: 15 },
});

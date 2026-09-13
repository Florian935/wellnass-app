/**
 * US DASH-01 (§4.3) — la **charge**, en une jauge, dans le hub.
 *
 * Même calcul que la section de l'écran de statistiques (`computeAcwr` sur les seules courses,
 * 7 j ÷ 28 j, US RUN-18) : la carte ne décide rien, elle rend. Ce qu'elle ajoute, c'est une
 * **position sur l'axe** — sous-charge, zone saine, risque — parce qu'un ratio nu (« 1,34 ») ne dit
 * pas de quel côté du seuil on est tombé.
 *
 * Elle se tait sans charge chronique : quatre semaines de données sont le minimum du calcul, et un
 * ratio bâti sur trois sorties serait une alerte inventée (R7 de la spec : jamais de chiffre qui
 * n'a pas de quoi être calculé).
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ACWR_LOW_THRESHOLD,
  ACWR_RISK_THRESHOLD,
  computeAcwr,
  localDayKey,
  type AcwrZone,
} from '@wellness/shared';
import { DenseTile } from '@/components/stage/DenseTile';
import { useRunHistory } from '@/data/repositories/run-repository';
import { useWindowStartKey } from '@/hooks/useTodayKey';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Borne haute de l'axe dessiné : au-delà, le curseur reste au bout (le texte, lui, dit le ratio). */
const AXIS_MAX = 1.8;

const ZONE_KEY: Record<AcwrZone, string> = {
  low: 'running.trainingLoad.zoneLow',
  safe: 'running.trainingLoad.zoneSafe',
  risk: 'running.trainingLoad.zoneRisk',
};

type Props = { onOpen: () => void };

export function RunLoadCard({ onOpen }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { runs } = useRunHistory();

  const acuteStartKey = useWindowStartKey(7);
  const chronicStartKey = useWindowStartKey(28);

  const byWindow = (startKey: string) =>
    runs
      .filter((r) => r.finishedAt != null && localDayKey(new Date(r.finishedAt)) >= startKey)
      .map((r) => ({ rpe: r.rpe, durationSeconds: r.durationSeconds }));

  const result = computeAcwr({
    acuteSessions: byWindow(acuteStartKey),
    chronicSessions: byWindow(chronicStartKey),
  });
  if (!result) return null;

  const position = Math.min(1, Math.max(0, result.ratio / AXIS_MAX));
  const zoneColor =
    result.zone === 'risk' ? colors.warnText : result.zone === 'low' ? colors.textMuted : colors.success;

  return (
    <DenseTile
      title={t('stage.running.load.title')}
      meta={result.ratio.toFixed(2)}
      onPress={onOpen}
      testID="run-load-card"
    >
      <View
        accessible
        accessibilityLabel={t('stage.running.load.a11y', {
          ratio: result.ratio.toFixed(2),
          zone: t(ZONE_KEY[result.zone]),
        })}
        style={styles.axisBlock}
      >
        <View style={[styles.axis, { backgroundColor: colors.track }]}>
          {/* Les deux seuils du calcul, dessinés : c'est ce qui rend le chiffre lisible. */}
          <View style={[styles.threshold, { left: `${(ACWR_LOW_THRESHOLD / AXIS_MAX) * 100}%`, backgroundColor: colors.border }]} />
          <View style={[styles.threshold, { left: `${(ACWR_RISK_THRESHOLD / AXIS_MAX) * 100}%`, backgroundColor: colors.border }]} />
          <View style={[styles.cursor, { left: `${position * 100}%`, backgroundColor: zoneColor }]} />
        </View>
        <Text style={[styles.zone, { color: zoneColor }]}>{t(ZONE_KEY[result.zone])}</Text>
      </View>
    </DenseTile>
  );
}

const styles = StyleSheet.create({
  axisBlock: { gap: 8 },
  axis: { height: 8, borderRadius: 4, overflow: 'hidden' },
  threshold: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  cursor: { position: 'absolute', top: -2, width: 5, height: 12, borderRadius: 3, marginLeft: -2 },
  zone: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
});

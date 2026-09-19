/**
 * US CARDIO-UX02 — **« Ton moteur »** : où part réellement l'intensité.
 *
 * ── Ce qu'elle comble ────────────────────────────────────────────────────────────────────────────
 * ALLURE-01 a livré quatre analyses le 07/08/2026 — polarisation (RUN-08), negative split (RUN-11),
 * distribution par zone d'allure (RUN-17) et dégradation sur sortie longue (RUN-20). **Aucune** n'a
 * jamais atteint le hub : elles vivent toutes en bas de `/running-history`, sous six autres
 * sections. C'est le constat central de l'audit du 19/09 — sur 25 analyses course au catalogue,
 * 15 sont livrées et le hub en montrait 4.
 *
 * Cette carte en remonte **une**, la plus structurante : la répartition du volume entre faible et
 * haute intensité sur les 4 dernières semaines.
 *
 * ── La réserve du catalogue, reportée telle quelle ───────────────────────────────────────────────
 * 🔴 Le repère ~80/20 est **nommé, jamais prescrit** (décision D5 d'ALLURE-01). Un coureur qui
 * prépare un 5 km a de bonnes raisons d'être à 70/30 ; quelqu'un qui court trois fois par semaine
 * pour se sentir bien n'a aucune raison de viser quoi que ce soit. La carte affiche donc deux
 * nombres côte à côte — le sien et le repère — et **ne colore pas l'écart**.
 *
 * Elle se tait sans allure de référence ou sous deux courses tracées : `computePolarisation` rend
 * alors `null`, et une barre vide n'est pas une information.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { POLARISATION_REFERENCE_LOW_PCT } from '@wellness/shared';
import { DenseTile } from '@/components/stage/DenseTile';
import { usePolarisation } from '@/data/repositories/run-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = { onOpen: () => void };

export function RunEngineCard({ onOpen }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { polarisation, isLoading } = usePolarisation();

  if (isLoading || polarisation === null) return null;

  const low = Math.round(polarisation.lowIntensityPct);
  const high = Math.max(0, 100 - low);

  return (
    <DenseTile
      title={t('runningHub.engine.title')}
      meta={t('runningHub.engine.meta', { count: polarisation.runCount })}
      onPress={onOpen}
      testID="run-engine-card"
    >
      <View
        accessible
        accessibilityLabel={t('runningHub.engine.a11y', {
          low,
          high,
          km: polarisation.totalKm,
          reference: POLARISATION_REFERENCE_LOW_PCT,
        })}
        style={styles.block}
      >
        {/* Une seule barre à deux parts : deux jauges séparées donneraient l'impression de deux
            objectifs indépendants, alors que les parts sont les deux faces d'un même total. */}
        <View style={[styles.bar, { backgroundColor: colors.track }]}>
          <View style={[styles.low, { width: `${low}%`, backgroundColor: colors.success }]} />
          <View style={[styles.high, { width: `${high}%`, backgroundColor: colors.accent }]} />
        </View>

        <View style={styles.legend}>
          <Legend color={colors.success} value={`${low} %`} label={t('runningHub.engine.low')} />
          <Legend color={colors.accent} value={`${high} %`} label={t('runningHub.engine.high')} />
        </View>

        <Text style={[styles.foot, { color: colors.textMuted }]}>
          {t('runningHub.engine.reference', {
            reference: POLARISATION_REFERENCE_LOW_PCT,
            km: polarisation.totalKm,
          })}
        </Text>
      </View>
    </DenseTile>
  );
}

function Legend({ color, value, label }: { color: string; value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.legendValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.legendLabel, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  bar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' },
  low: { height: '100%' },
  high: { height: '100%' },
  legend: { flexDirection: 'row', gap: 18 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendValue: { fontFamily: fontFamily.monoBold, fontSize: 14 },
  legendLabel: { fontFamily: fontFamily.body, fontSize: 12, flexShrink: 1 },
  foot: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },
});

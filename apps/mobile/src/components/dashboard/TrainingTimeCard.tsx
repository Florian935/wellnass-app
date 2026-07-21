/**
 * Widget MR-06 — Temps d'entraînement (muscu + course, 7 j glissants), décliné aux 3 formes.
 *
 *  - `small` : eyebrow + durée totale + « d'activité » ;
 *  - `wide`  : eyebrow + total + barre segmentée muscu / course ;
 *  - `large` : anneau (part muscu) + légende muscu/course + pied ventilation.
 *
 * Données : `useTrainingTime` (total, muscu, course, piliers actifs). Ventilation affichée
 * seulement quand les deux piliers sont actifs. Durées via `formatHoursMinutes`.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatHoursMinutes, type WidgetSize } from '@wellness/shared';
import { RingGauge } from '@/components/widgets/primitives';
import { Eyebrow, Metric, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { useTrainingTime } from '@/data/repositories/dashboard-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function TrainingTimeCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const tt = useTrainingTime();

  if (tt.isLoading) return null;

  const isEmpty = tt.totalSeconds === 0;
  const totalStr = formatHoursMinutes(tt.totalSeconds);
  const bothActive = tt.strengthActive && tt.runningActive;
  const strengthPct = tt.totalSeconds > 0 ? tt.strengthSeconds / tt.totalSeconds : 0;

  // ── Petit carré ────────────────────────────────────────────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame pad={16}>
        <Eyebrow>{t('home.trainingTime.eyebrow')}</Eyebrow>
        <View style={styles.smallBottom}>
          {isEmpty ? (
            <Metric value={t('home.trainingTime.empty')} muted />
          ) : (
            <Metric value={totalStr} sub={t('home.trainingTime.activity')} />
          )}
        </View>
      </WidgetFrame>
    );
  }

  // ── Rectangle ────────────────────────────────────────────────────────────────
  if (size === 'wide') {
    return (
      <WidgetFrame pad={18} style={styles.wideCol}>
        <View style={styles.wideHead}>
          <View>
            <Eyebrow>{t('home.trainingTime.eyebrow')}</Eyebrow>
            <Text style={[styles.wideTotal, { color: colors.text }]}>{isEmpty ? '—' : totalStr}</Text>
          </View>
        </View>
        {bothActive && !isEmpty ? (
          <View style={[styles.splitBar, { backgroundColor: colors.chartGreen }]}>
            <View style={{ width: `${Math.round(strengthPct * 100)}%`, backgroundColor: colors.accent }} />
          </View>
        ) : null}
      </WidgetFrame>
    );
  }

  // ── Grand carré ──────────────────────────────────────────────────────────────
  return (
    <WidgetFrame pad={22} style={styles.largeCol}>
      <Eyebrow>{t('home.trainingTime.eyebrow')}</Eyebrow>
      <View style={styles.largeMid}>
        <RingGauge size={120} stroke={14} pct={strengthPct} trackColor={colors.chartGreen}>
          <Text style={[styles.ringVal, { color: colors.text }]}>{isEmpty ? '—' : totalStr}</Text>
          <Text style={[styles.ringSub, { color: colors.textMuted }]}>{t('home.trainingTime.total')}</Text>
        </RingGauge>
        <View style={styles.legend}>
          {tt.strengthActive ? (
            <LegendRow color={colors.accent} label={t('home.trainingTime.breakdownStrength')} value={formatHoursMinutes(tt.strengthSeconds)} />
          ) : null}
          {tt.runningActive ? (
            <LegendRow color={colors.chartGreen} label={t('home.trainingTime.breakdownRunning')} value={formatHoursMinutes(tt.runningSeconds)} />
          ) : null}
        </View>
      </View>
    </WidgetFrame>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.legendRow}>
      <View style={styles.legendHead}>
        <View style={[styles.legendDot, { backgroundColor: color }]} />
        <Text style={[styles.legendLabel, { color: colors.textMuted }]}>{label}</Text>
      </View>
      <Text style={[styles.legendValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  smallBottom: { marginTop: 'auto' },
  wideCol: { justifyContent: 'center', gap: 14 },
  wideHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  wideTotal: { fontFamily: fontFamily.displayXBold, fontSize: 32, letterSpacing: -1.2, marginTop: 4 },
  splitBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' },
  largeCol: { gap: 0 },
  largeMid: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 14 },
  ringVal: { fontFamily: fontFamily.displayXBold, fontSize: 22, letterSpacing: -0.5 },
  ringSub: { fontFamily: fontFamily.body, fontSize: 10 },
  legend: { flex: 1, gap: 14 },
  legendRow: { gap: 2 },
  legendHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 11, height: 11, borderRadius: 3 },
  legendLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  legendValue: { fontFamily: fontFamily.displayBold, fontSize: 22, marginLeft: 19 },
});

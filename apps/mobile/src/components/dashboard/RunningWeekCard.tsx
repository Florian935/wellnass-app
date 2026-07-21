/**
 * Widget 7.10 — Semaine running, décliné aux 3 formes de la galerie « FitTrio · Widgets ».
 *
 *  - `small` : eyebrow + distance 7 j + « cette semaine » ;
 *  - `wide`  : 3 colonnes séparées (distance · sorties · allure moy.) ;
 *  - `large` : distance + résumé, mini-barres par jour (km), pied durée + sorties.
 *
 * Totaux : `useRunStats('week')`. Barres par jour : `useRunHistory` (courses de la semaine
 * lun→dim, cumul distance par jour). Distance/allure/durée formatées via `useUnits` / helpers partagés.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatHoursMinutes, localDayKey, type WidgetSize } from '@wellness/shared';
import { MiniBars } from '@/components/widgets/primitives';
import { Eyebrow, Metric, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { useRunHistory, useRunStats } from '@/data/repositories/run-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Cumul de distance (m) par jour de la semaine courante (lun→dim). */
function weekDistanceByDay(runs: { finishedAt: string | null; distanceM: number | null }[]): number[] {
  const now = new Date();
  const dow = now.getDay(); // 0=dim
  const offsetToMonday = (dow + 6) % 7;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - offsetToMonday);
  const keys = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return localDayKey(d);
  });
  const byDay = new Array(7).fill(0) as number[];
  for (const r of runs) {
    if (!r.finishedAt) continue;
    const k = localDayKey(new Date(r.finishedAt));
    const idx = keys.indexOf(k);
    if (idx >= 0) byDay[idx] = (byDay[idx] ?? 0) + (r.distanceM ?? 0) / 1000;
  }
  return byDay;
}

export function RunningWeekCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();

  const { stats, isLoading: statsLoading } = useRunStats('week');
  const { runs, isLoading: runsLoading } = useRunHistory();

  if (statsLoading || runsLoading) return null;
  const open = () => router.push('/running-history');

  const isEmpty = stats.count === 0;
  const distanceStr = units.formatDistance(stats.totalDistanceM / 1000);
  const avgPace =
    stats.totalDistanceM > 0 ? stats.totalDurationS / (stats.totalDistanceM / 1000) : null;
  const paceStr = avgPace != null ? units.formatPace(Math.round(avgPace)) : '—';
  const durationStr = formatHoursMinutes(stats.totalDurationS);

  // ── Petit carré ────────────────────────────────────────────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={t('home.runningWeek.title')}>
        <Eyebrow>{t('home.runningWeek.eyebrow')}</Eyebrow>
        <View style={styles.smallBottom}>
          {isEmpty ? (
            <Metric value={t('home.runningWeek.empty')} muted />
          ) : (
            <Metric value={distanceStr} sub={t('home.runningWeek.thisWeek')} />
          )}
        </View>
      </WidgetFrame>
    );
  }

  // ── Rectangle ────────────────────────────────────────────────────────────────
  if (size === 'wide') {
    if (isEmpty) {
      return (
        <WidgetFrame pad={18} onPress={open} accessibilityLabel={t('home.runningWeek.title')} style={styles.center}>
          <Eyebrow>{t('home.runningWeek.eyebrow')}</Eyebrow>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('home.runningWeek.empty')}</Text>
        </WidgetFrame>
      );
    }
    return (
      <WidgetFrame pad={18} onPress={open} accessibilityLabel={t('home.runningWeek.title')} style={styles.wideRow}>
        <StatCol value={distanceStr} label={t('home.runningWeek.distance')} />
        <Divider />
        <StatCol value={String(stats.count)} label={t('home.runningWeek.sessionsLabel')} />
        <Divider />
        <StatCol value={paceStr} label={t('home.runningWeek.avgPace')} />
      </WidgetFrame>
    );
  }

  // ── Grand carré ──────────────────────────────────────────────────────────────
  const byDay = weekDistanceByDay(runs);
  const labels = t('home.streak.days', { returnObjects: true }) as string[];
  const highlight = byDay.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);

  return (
    <WidgetFrame pad={22} onPress={open} accessibilityLabel={t('home.runningWeek.title')} style={styles.largeCol}>
      <Eyebrow>{t('home.runningWeek.thisWeekEyebrow')}</Eyebrow>
      <Text style={[styles.largeValue, { color: colors.text }]}>
        {distanceStr}
      </Text>
      <Text style={[styles.largeSub, { color: colors.textMuted }]}>
        {t('home.runningWeek.sessions', { count: stats.count })} · {paceStr} · {durationStr}
      </Text>
      <View style={styles.largeBars}>
        <MiniBars values={byDay} height={110} highlightIndex={highlight} labels={labels} />
      </View>
      <View style={[styles.foot, { borderTopColor: colors.border }]}>
        <Text style={[styles.footText, { color: colors.textMuted }]}>
          {t('home.runningWeek.sessions', { count: stats.count })}
        </Text>
        <Text style={[styles.footText, { color: colors.textMuted }]}>{durationStr}</Text>
      </View>
    </WidgetFrame>
  );
}

function StatCol({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.statCol}>
      <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', gap: 6 },
  emptyText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  smallBottom: { marginTop: 'auto' },
  wideRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statCol: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: fontFamily.displayXBold, fontSize: 26, letterSpacing: -1 },
  statLabel: { fontFamily: fontFamily.body, fontSize: 11 },
  divider: { width: 1, alignSelf: 'stretch', marginVertical: 4 },
  largeCol: { gap: 0 },
  largeValue: { fontFamily: fontFamily.displayXBold, fontSize: 40, letterSpacing: -1.5, marginTop: 6 },
  largeSub: { fontFamily: fontFamily.body, fontSize: 13, marginTop: 2 },
  largeBars: { flex: 1, marginVertical: 18 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 12, marginTop: 'auto' },
  footText: { fontFamily: fontFamily.mono, fontSize: 11 },
});

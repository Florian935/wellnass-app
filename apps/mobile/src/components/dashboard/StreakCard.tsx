/**
 * Widget 7.6 — Régularité (streak), décliné aux 3 formes de la galerie « FitTrio · Widgets ».
 *
 *  - `small` : eyebrow + grand nombre + 🔥 + « jours d'affilée » ;
 *  - `wide`  : eyebrow + nombre à droite + bande de 7 jours (semaine courante) ;
 *  - `large` : eyebrow + nombre + bande de 7 jours (grandes pastilles ✓) + bandeau semaine.
 *
 * Pastille : jour actif → accent ; aujourd'hui inactif → contour accent ; futur → piste ;
 * passé inactif → surface. Données : `useStreakData` (current + last7, semaine lun→dim).
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WidgetSize } from '@wellness/shared';
import { WeekDots, type DayState } from '@/components/widgets/primitives';
import { Eyebrow, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { useStreakData, type WeekDay } from '@/data/repositories/dashboard-repository';
import { localDayKey } from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/color-utils';

/** Traduit un jour `WeekDay` en état de pastille (WeekDots). */
function dayState(day: WeekDay, todayKey: string): DayState {
  if (day.active) return 'done';
  if (day.isToday) return 'today';
  return day.key > todayKey ? 'future' : 'empty';
}

export function StreakCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { current, activeToday, last7, isLoading } = useStreakData();

  if (isLoading) return null;

  const isEmpty = current === 0;
  const labels = t('home.streak.days', { returnObjects: true }) as string[];
  const todayKey = localDayKey(new Date());
  const activeCount = last7.filter((d) => d.active).length;

  const suffix = isEmpty ? t('home.streak.empty') : t('home.streak.suffix', { count: current });

  // ── Petit carré ────────────────────────────────────────────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame pad={16}>
        <Eyebrow>{t('home.streak.eyebrow')}</Eyebrow>
        <View style={styles.smallCenter}>
          <Text style={[styles.bigNum, { color: isEmpty ? colors.textMuted : colors.accent }]}>
            {current}
          </Text>
          <Text style={styles.flame}>🔥</Text>
        </View>
        <Text style={[styles.smallSub, { color: colors.textMuted }]}>{suffix}</Text>
      </WidgetFrame>
    );
  }

  const dots = (tile: number, withCheck: boolean) => (
    <WeekDots
      tile={tile}
      days={last7.map((d, i) => {
        const state = dayState(d, todayKey);
        return {
          label: labels[i] ?? '',
          state,
          glyph: withCheck && state === 'done' ? '✓' : undefined,
        };
      })}
    />
  );

  // ── Rectangle ────────────────────────────────────────────────────────────────
  if (size === 'wide') {
    return (
      <WidgetFrame pad={18} style={styles.wideCol}>
        <View style={styles.wideHead}>
          <Eyebrow>{t('home.streak.eyebrow')}</Eyebrow>
          <View style={styles.wideNumRow}>
            <Text style={[styles.inlineNum, { color: colors.accent }]}>{current}</Text>
            <Text style={[styles.inlineSuffix, { color: colors.textMuted }]}>{suffix}</Text>
            <Text style={styles.flameSm}>🔥</Text>
          </View>
        </View>
        {dots(30, false)}
      </WidgetFrame>
    );
  }

  // ── Grand carré ──────────────────────────────────────────────────────────────
  return (
    <WidgetFrame pad={22} style={styles.largeCol}>
      <Eyebrow>{t('home.streak.eyebrow')}</Eyebrow>
      <View style={styles.largeTop}>
        <Text style={[styles.largeNum, { color: colors.accent }]}>{current}</Text>
        <Text style={[styles.largeSuffix, { color: colors.textMuted }]}>{suffix} 🔥</Text>
      </View>
      {dots(38, true)}
      <View
        style={[
          styles.banner,
          { backgroundColor: withAlpha(colors.accent, 0.1), borderColor: withAlpha(colors.accent, 0.28) },
        ]}
      >
        <Text style={[styles.bannerTitle, { color: colors.accent }]}>
          {activeToday
            ? t('home.streak.bannerActive', { count: activeCount })
            : t('home.streak.bannerIdle', { count: activeCount })}
        </Text>
      </View>
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  smallCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  bigNum: { fontFamily: fontFamily.displayXBold, fontSize: 52, letterSpacing: -2 },
  flame: { fontSize: 22 },
  smallSub: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  wideCol: { justifyContent: 'center', gap: 16 },
  wideHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  wideNumRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  inlineNum: { fontFamily: fontFamily.displayBold, fontSize: 22 },
  inlineSuffix: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  flameSm: { fontSize: 13 },
  largeCol: { gap: 18 },
  largeTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  largeNum: { fontFamily: fontFamily.displayXBold, fontSize: 46, letterSpacing: -1.6 },
  largeSuffix: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  banner: { marginTop: 'auto', borderWidth: 1, borderRadius: 16, padding: 14 },
  bannerTitle: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
});

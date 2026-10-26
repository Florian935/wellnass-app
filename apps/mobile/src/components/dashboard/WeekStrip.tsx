/**
 * US ACCUEIL-08 — **« Ta semaine »** : une seule carte pour la semaine (constat 8 : elle était dite
 * trois fois — anneaux, Régularité, « La suite »).
 *
 * Sept colonnes du lundi au dimanche, une pastille par pilier actif (plein = fait, pointillé =
 * prévu, pâle = repas noté hors cible), aujourd'hui encadré, les jours d'une période « vie réelle »
 * hachurés ; la série en pastille ; « 3 séances sur 5 · 3 jours dans ta cible » et le lien du Bilan.
 * La décision vit dans `buildWeekStrip` (`@wellness/shared`, testée).
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Pillar, WeekMark, WeekStrip as WeekStripData } from '@wellness/shared';
import { StreakOffers, type StreakOffersProps } from '@/components/dashboard/StreakOffers';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/color-utils';

export type StreakPill =
  | { kind: 'running'; days: number }
  | { kind: 'weeks'; weeks: number }
  | { kind: 'at-risk'; days: number }
  | { kind: 'start' };

type Props = {
  strip: WeekStripData;
  pillars: readonly Pillar[];
  streak: StreakPill;
  /** Le joker d'un jour manqué, ou la bascule en semaines (`StreakOffers`). */
  offers: StreakOffersProps;
  onReview: () => void;
};

const PILLAR_ORDER: readonly Pillar[] = ['strength', 'running', 'nutrition'];

export function WeekStrip({ strip, pillars, streak, offers, onReview }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const shown = PILLAR_ORDER.filter((p) => pillars.includes(p));
  const color: Record<Pillar, string> = {
    strength: colors.pillarStrength,
    running: colors.pillarRunning,
    nutrition: colors.pillarNutrition,
  };
  const days = t('home.streak.days', { returnObjects: true }) as unknown as string[];

  const pill = (() => {
    switch (streak.kind) {
      case 'at-risk':
        return { label: t('home.week.streak.atRisk', { count: streak.days }), fg: colors.warnText, bg: colors.warn };
      case 'weeks':
        return { label: t('home.week.streak.weeks', { count: streak.weeks }), fg: colors.accent, bg: withAlpha(colors.accent, 0.14) };
      case 'start':
        return { label: t('home.week.streak.start'), fg: colors.textMuted, bg: colors.track };
      case 'running':
      default:
        return { label: t('home.week.streak.days', { count: streak.days }), fg: colors.accent, bg: withAlpha(colors.accent, 0.14) };
    }
  })();

  const markStyle = (mark: WeekMark | undefined, c: string) => {
    switch (mark) {
      case 'done':
        return { backgroundColor: c, borderColor: c, borderStyle: 'solid' as const };
      case 'planned':
        return { backgroundColor: 'transparent', borderColor: c, borderStyle: 'dashed' as const };
      case 'logged':
        return { backgroundColor: withAlpha(c, 0.22), borderColor: 'transparent', borderStyle: 'solid' as const };
      default:
        return { backgroundColor: colors.track, borderColor: 'transparent', borderStyle: 'solid' as const };
    }
  };

  const summary = [
    shown.some((p) => p !== 'nutrition') && strip.sessionsTotal > 0
      ? t('home.week.sessions', { done: strip.sessionsDone, total: strip.sessionsTotal })
      : null,
    pillars.includes('nutrition') && strip.loggedDays > 0
      ? t('home.week.inTarget', { count: strip.daysInTarget })
      : null,
  ].filter(Boolean);

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      testID="home-week"
    >
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.textMuted }]} accessibilityRole="header">
          {t('home.week.title')}
        </Text>
        <View style={[styles.pill, { backgroundColor: pill.bg }]}>
          <Ionicons name="flame" size={13} color={pill.fg} />
          <Text style={[styles.pillLabel, { color: pill.fg }]}>{pill.label}</Text>
        </View>
      </View>

      <View style={styles.days}>
        {strip.days.map((day) => {
          const a11y = [
            `${days[day.weekday - 1] ?? ''} ${day.dayOfMonth}`,
            ...shown.map((p) => t(`home.week.a11y.${p}.${day.marks[p] ?? 'idle'}`)),
          ].join(', ');
          return (
            <View
              key={day.key}
              accessible
              accessibilityLabel={a11y}
              style={[
                styles.day,
                day.isToday && { backgroundColor: colors.surfaceAlt, borderColor: colors.accent },
                day.paused && !day.isToday && { backgroundColor: colors.track },
              ]}
            >
              <Text style={[styles.dayLetter, { color: day.isToday ? colors.accent : colors.textMuted }]}>
                {days[day.weekday - 1] ?? ''}
              </Text>
              <Text style={[styles.dayNumber, { color: day.isToday ? colors.text : colors.textMuted }]}>
                {day.dayOfMonth}
              </Text>
              <View style={styles.marks}>
                {shown.map((p) => (
                  <View key={p} style={[styles.mark, markStyle(day.marks[p], color[p])]} />
                ))}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        {shown.map((p) => (
          <View key={p} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: color[p] }]} />
            <Text style={[styles.legendLabel, { color: colors.textMuted }]}>{t(`home.week.legend.${p}`)}</Text>
          </View>
        ))}
        <Text style={[styles.legendLabel, { color: colors.textMuted }]}>{t('home.week.legend.key')}</Text>
      </View>

      {/* Le joker d'un jour manqué, ou la bascule en semaines : déménagés de la Régularité. */}
      <StreakOffers {...offers} />

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={[styles.summary, { color: colors.text }]}>
          {summary.length > 0 ? summary.join(' · ') : t('home.week.empty')}
        </Text>
        <Pressable onPress={onReview} accessibilityRole="link" hitSlop={8} style={styles.link}>
          <Text style={[styles.linkLabel, { color: colors.accent }]}>{t('home.week.review')}</Text>
          <Ionicons name="chevron-forward" size={12} color={colors.accent} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, paddingTop: 16, paddingBottom: 12, paddingHorizontal: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heading: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingLeft: 8, paddingRight: 11, borderRadius: 999 },
  pillLabel: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
  days: { flexDirection: 'row', gap: 4, marginTop: 12 },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingTop: 7,
    paddingBottom: 9,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayLetter: { fontFamily: fontFamily.bodyBold, fontSize: 11 },
  dayNumber: { fontFamily: fontFamily.mono, fontSize: 10.5 },
  marks: { gap: 3, marginTop: 4 },
  mark: { width: 22, height: 8, borderRadius: 4, borderWidth: 1.5 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 10, paddingHorizontal: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 12, height: 6, borderRadius: 3 },
  legendLabel: { fontFamily: fontFamily.bodySemi, fontSize: 11.5 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 1,
  },
  summary: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 13, lineHeight: 18 },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkLabel: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
});

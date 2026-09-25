/**
 * Le calendrier du mois de l'historique — US MUSCU-UX07, R5 et R6.
 *
 * Retrouver « mardi » d'un coup d'œil : une grille lundi → dimanche (jours locaux), les jours de
 * séance pleins, un repère pour ceux où un record est tombé, les séances prévues en pointillé,
 * aujourd'hui cerclé. Un jour à une séance ouvre son détail ; à plusieurs, il restreint la liste en
 * dessous. Jours vides et prévus ne sont pas des boutons.
 *
 * Le calcul (grille, états, résumé, bornes) vit dans `packages/shared/history-calendar.ts`.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  buildMonthGrid,
  compareMonths,
  monthSummary,
  type CalendarCell,
  type YearMonth,
} from '@wellness/shared';
import { formatTonnes } from '@/hooks/useLastPerfFormat';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export type CalendarMonthWorkout = { dayKey: string; recordCount: number; tonnageKg: number };

type Props = {
  month: YearMonth;
  range: { min: YearMonth; max: YearMonth };
  workouts: readonly CalendarMonthWorkout[];
  plannedDayKeys: readonly string[];
  todayKey: string;
  selectedDayKey: string | null;
  onMonth: (month: YearMonth) => void;
  onDay: (dayKey: string) => void;
  /** Nomme les séances d'un jour, pour TalkBack (« Legs, 2 records »). */
  describeDay: (dayKey: string) => string;
};

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function HistoryCalendar({
  month,
  range,
  workouts,
  plannedDayKeys,
  todayKey,
  selectedDayKey,
  onMonth,
  onDay,
  describeDay,
}: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  const grid = buildMonthGrid({ ...month, workouts, plannedDayKeys, todayKey });
  const summary = monthSummary(workouts);
  const title = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(
    new Date(month.year, month.month - 1, 1),
  );
  const canPrev = compareMonths(month, range.min) > 0;
  const canNext = compareMonths(month, range.max) < 0;

  const shift = (delta: number) => {
    const index = month.year * 12 + (month.month - 1) + delta;
    onMonth({ year: Math.floor(index / 12), month: (index % 12) + 1 });
  };

  const arrow = (dir: 'prev' | 'next', enabled: boolean) => (
    <Pressable
      testID={`calendar-${dir}`}
      onPress={() => enabled && shift(dir === 'prev' ? -1 : 1)}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={t(dir === 'prev' ? 'history.calendar.previous' : 'history.calendar.next')}
      accessibilityState={{ disabled: !enabled }}
      style={[styles.arrow, !enabled && styles.disabled]}
    >
      <Ionicons name={dir === 'prev' ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.text} />
    </Pressable>
  );

  const renderCell = (cell: CalendarCell, index: number) => {
    if (cell.day === null || cell.dayKey === null) return <View key={`e${index}`} style={styles.cell} />;
    const dayKey = cell.dayKey;
    const trained = cell.state === 'done' || cell.state === 'record';
    const selected = selectedDayKey === dayKey;

    if (trained) {
      return (
        <View key={dayKey} style={styles.cell}>
          <Pressable
            testID={`calendar-day-${dayKey}`}
            onPress={() => onDay(dayKey)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={t('history.calendar.dayA11y', {
              date: new Date(`${dayKey}T12:00:00`).toLocaleDateString(i18n.language, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }),
              sessions: describeDay(dayKey),
            })}
            style={[
              styles.dot,
              { backgroundColor: colors.accent },
              selected && { borderWidth: 3, borderColor: colors.text },
            ]}
          >
            <Text style={[styles.dayText, { color: colors.accentText, fontFamily: fontFamily.monoBold }]}>
              {cell.day}
            </Text>
            {cell.state === 'record' ? (
              <View style={[styles.recordMark, { backgroundColor: colors.amber, borderColor: colors.surface }]} />
            ) : null}
          </Pressable>
        </View>
      );
    }

    return (
      <View key={dayKey} style={styles.cell} importantForAccessibility="no-hide-descendants">
        <View
          style={[
            styles.dot,
            cell.isToday
              ? { borderWidth: 2, borderColor: colors.text }
              : cell.state === 'planned'
                ? { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.accent }
                : null,
          ]}
        >
          <Text
            style={[
              styles.dayText,
              {
                color: dayKey > todayKey ? colors.textMuted : colors.text,
                fontFamily: cell.isToday ? fontFamily.monoBold : fontFamily.mono,
              },
            ]}
          >
            {cell.day}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View testID="history-calendar" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        {arrow('prev', canPrev)}
        <View style={styles.headText}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {title.charAt(0).toUpperCase() + title.slice(1)}
          </Text>
          <Text style={[styles.summary, { color: colors.textMuted }]}>
            {summary.count > 0
              ? `${t('history.calendar.workouts', { count: summary.count })} · ${t('history.calendar.tonnage', {
                  tonnes: formatTonnes(summary.tonnageKg, i18n.language),
                })}`
              : t('history.calendar.empty')}
          </Text>
          {summary.records > 0 ? (
            <Text style={[styles.records, { color: colors.warnText }]}>
              {t('history.calendar.records', { count: summary.records })}
            </Text>
          ) : null}
        </View>
        {arrow('next', canNext)}
      </View>

      <View style={styles.week}>
        {WEEKDAY_KEYS.map((key) => (
          <Text key={key} style={[styles.weekday, { color: colors.textMuted }]}>
            {t(`common.weekdayShort.${key}`)}
          </Text>
        ))}
      </View>
      {grid.map((week, w) => (
        <View key={`w${w}`} style={styles.week}>
          {week.map((cell, i) => renderCell(cell, w * 7 + i))}
        </View>
      ))}

      <View style={styles.legend} importantForAccessibility="no-hide-descendants">
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>{t('history.calendar.legend.done')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.amber }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>{t('history.calendar.legend.record')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.accent }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>{t('history.calendar.legend.planned')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 12, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headText: { flex: 1, alignItems: 'center', gap: 1 },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 19 },
  summary: { fontFamily: fontFamily.body, fontSize: 12.5 },
  records: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontFamily: fontFamily.mono, fontSize: 10.5 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  dot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 13 },
  recordMark: { position: 'absolute', top: 1, right: 1, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: fontFamily.body, fontSize: 12 },
});

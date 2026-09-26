/**
 * Le calendrier du mois de l'Historique Nutrition — US NUTRI-UX03, R7 (décision Q2).
 *
 * Chaque jour passé est un petit **verre**, rempli à hauteur de ce qui a été mangé par rapport à la
 * cible de ce jour : « voir si on était loin de la jauge ou pas, comme les anciens verres ». Le
 * statut se lit aussi sans la couleur : « + » au-dessus de la cible, « − » en dessous, rien dans la
 * marge. Un jour sans rien de noté est en pointillé ; aujourd'hui est cerclé ; les jours à venir ne
 * sont pas des boutons.
 *
 * Le calcul (grille, remplissage, statut, résumé) vit dans `packages/shared/nutrition-calendar.ts`.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  buildNutritionMonthGrid,
  compareMonths,
  nutritionMonthSummary,
  shiftMonth,
  type NutritionCalendarCell,
  type NutritionCalendarDay,
  type YearMonth,
} from '@wellness/shared';
import { useKcalFormat } from '@/hooks/useKcalFormat';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  month: YearMonth;
  range: { min: YearMonth; max: YearMonth };
  days: readonly NutritionCalendarDay[];
  todayKey: string;
  marginPct: number;
  onMonth: (month: YearMonth) => void;
  onDay: (dayKey: string) => void;
};

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function NutritionCalendar({ month, range, days, todayKey, marginPct, onMonth, onDay }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const kcal = useKcalFormat();
  const lang = i18n?.language ?? 'fr';

  const grid = buildNutritionMonthGrid({ ...month, days, todayKey, marginPct });
  const summary = nutritionMonthSummary(days, todayKey, marginPct);
  const title = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(
    new Date(month.year, month.month - 1, 1),
  );
  const canPrev = compareMonths(month, range.min) > 0;
  const canNext = compareMonths(month, range.max) < 0;

  const statusLabel = (c: NutritionCalendarCell): string => {
    if (c.kind === 'today') return t('nutritionHub.calendar.status.today');
    if (c.kind === 'future') return t('nutritionHub.calendar.status.future');
    if (!c.logged) return t('nutritionHub.calendar.status.none');
    if (c.status === null) return t('nutritionHub.calendar.status.logged', { kcal: kcal(c.kcal) });
    return t(`nutritionHub.calendar.status.${c.status}`, { kcal: kcal(c.kcal) });
  };

  const glass = (c: NutritionCalendarCell) => {
    const logged = c.logged || c.kind === 'today';
    const fillColor =
      c.status === 'under' || c.status === null ? colors.track : colors.accent;
    return (
      <View
        style={[
          styles.glass,
          {
            borderColor: c.kind === 'today' ? colors.text : logged ? colors.accent : colors.borderStrong,
            borderWidth: c.kind === 'today' ? 2 : 1.5,
            borderStyle: logged ? 'solid' : 'dashed',
            backgroundColor: colors.surface,
          },
        ]}
      >
        <View
          style={[
            styles.glassFill,
            {
              height: `${Math.round(c.fill * 100)}%`,
              backgroundColor: fillColor,
              opacity: c.status === 'under' || c.status === null ? 1 : 0.35,
            },
          ]}
        />
        <Text style={[styles.dayNum, { color: colors.text }]}>{c.day}</Text>
        {c.status === 'over' || c.status === 'under' ? (
          <Text style={[styles.mark, { color: colors.text }]}>{c.status === 'over' ? '+' : '−'}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View
      testID="nutrition-calendar"
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.head}>
        <Pressable
          onPress={() => canPrev && onMonth(shiftMonth(month, -1))}
          disabled={!canPrev}
          accessibilityRole="button"
          accessibilityLabel={t('nutritionHub.calendar.previous')}
          accessibilityState={{ disabled: !canPrev }}
          style={[styles.arrow, !canPrev && styles.disabled]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {title.charAt(0).toUpperCase() + title.slice(1)}
        </Text>
        <Pressable
          onPress={() => canNext && onMonth(shiftMonth(month, 1))}
          disabled={!canNext}
          accessibilityRole="button"
          accessibilityLabel={t('nutritionHub.calendar.next')}
          accessibilityState={{ disabled: !canNext }}
          style={[styles.arrow, !canNext && styles.disabled]}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      {summary.loggedDays > 0 ? (
        <View style={styles.summary}>
          <Text style={[styles.summaryMain, { color: colors.text }]}>
            {t('nutritionHub.calendar.loggedDays', { count: summary.loggedDays })} ·{' '}
            {t('nutritionHub.calendar.average', { kcal: kcal(summary.averageKcal) })}
          </Text>
          {summary.withTarget > 0 ? (
            <Text style={[styles.summarySub, { color: colors.textMuted }]}>
              {t('nutritionHub.calendar.split', {
                inTarget: summary.inTarget,
                over: summary.over,
                under: summary.under,
              })}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={[styles.summarySub, { color: colors.textMuted }]}>{t('nutritionHub.calendar.empty')}</Text>
      )}

      <View style={styles.week}>
        {WEEKDAY_KEYS.map((k) => (
          <Text key={k} style={[styles.weekday, { color: colors.textMuted }]}>
            {t(`common.weekdayShort.${k}`)}
          </Text>
        ))}
      </View>
      {grid.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((c, di) => {
            if (c.dayKey === null) return <View key={`b-${wi}-${di}`} style={styles.cell} />;
            if (c.kind === 'future') {
              return (
                <View key={c.dayKey} style={styles.cell}>
                  <Text style={[styles.futureNum, { color: colors.textMuted }]}>{c.day}</Text>
                </View>
              );
            }
            const dateLabel = new Date(month.year, month.month - 1, c.day!).toLocaleDateString(lang, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            });
            return (
              <Pressable
                key={c.dayKey}
                testID={`nutrition-day-${c.dayKey}`}
                onPress={() => onDay(c.dayKey!)}
                accessibilityRole="button"
                accessibilityLabel={t('nutritionHub.calendar.dayA11y', { date: dateLabel, status: statusLabel(c) })}
                style={styles.cell}
              >
                {glass(c)}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.legend}>
        {(
          [
            ['in', 0.95, colors.accent, 0.35, 'solid', ''],
            ['over', 1, colors.accent, 0.35, 'solid', '+'],
            ['under', 0.5, colors.track, 1, 'solid', '−'],
            ['noTarget', 0.5, colors.track, 1, 'solid', ''],
            ['none', 0, colors.track, 1, 'dashed', ''],
          ] as const
        ).map(([key, fill, color, opacity, borderStyle, mark]) => (
          <View key={key} style={styles.legendItem}>
            <View
              style={[
                styles.legendGlass,
                { borderColor: key === 'none' ? colors.borderStrong : colors.accent, borderStyle },
              ]}
            >
              <View style={[styles.glassFill, { height: `${fill * 100}%`, backgroundColor: color, opacity }]} />
              {mark ? <Text style={[styles.legendMark, { color: colors.text }]}>{mark}</Text> : null}
            </View>
            <Text style={[styles.legendText, { color: colors.textMuted }]}>{t(`nutritionHub.calendar.legend.${key}`)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 12, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  title: { flex: 1, textAlign: 'center', fontFamily: fontFamily.displayXBold, fontSize: 19 },
  summary: { alignItems: 'center', gap: 1, marginBottom: 4 },
  summaryMain: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  summarySub: { fontFamily: fontFamily.body, fontSize: 12.5, textAlign: 'center' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontFamily: fontFamily.mono, fontSize: 10.5 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2, minHeight: 48, justifyContent: 'center' },
  glass: { width: 38, height: 44, borderRadius: 10, overflow: 'hidden', alignItems: 'center' },
  glassFill: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  dayNum: { fontFamily: fontFamily.monoBold, fontSize: 11.5, marginTop: 3 },
  mark: { position: 'absolute', right: 3, bottom: 1, fontFamily: fontFamily.monoBold, fontSize: 12 },
  futureNum: { fontFamily: fontFamily.mono, fontSize: 11.5 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendGlass: { width: 12, height: 14, borderRadius: 4, borderWidth: 1.5, overflow: 'hidden' },
  legendMark: { position: 'absolute', right: 0, bottom: -2, fontFamily: fontFamily.monoBold, fontSize: 9 },
  legendText: { fontFamily: fontFamily.body, fontSize: 12 },
});

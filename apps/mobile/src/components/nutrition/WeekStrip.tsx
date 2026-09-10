/**
 * Trame de la semaine dans la barre de jour (US NUTRI-UX01, R3.2).
 *
 * Sept pastilles, une par jour de la semaine du jour affiché : rempli, partiel, vide. La donnée
 * existait déjà — `useJournalCompletion` calcule un taux depuis des semaines, et le widget
 * Android affiche même une trame — mais le journal, lui, ne montrait rien. C'était le seul écran
 * aveugle à sa propre régularité, c'est-à-dire à ce qui motive.
 *
 * Chaque pastille est **tapable** : c'est le raccourci d'un jour à l'autre à l'intérieur de la
 * semaine, là où le calendrier sert à changer de semaine ou de mois.
 */

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { addDays, dayFill, localDateFromDayKey, localDayKey, startOfWeek } from '@wellness/shared';
import { useMonthTotals } from '@/data/repositories/journal-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function WeekStrip({
  selectedDay,
  targetKcal,
  onSelectDay,
}: {
  selectedDay: string;
  targetKcal: number | null;
  onSelectDay: (dayKey: string) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const days = useMemo(() => {
    const start = startOfWeek(localDateFromDayKey(selectedDay));
    return Array.from({ length: 7 }, (_, i) => localDayKey(addDays(start, i)));
  }, [selectedDay]);

  const { totals } = useMonthTotals(days[0]!, days[6]!);
  const byDate = useMemo(() => new Map(totals.map((r) => [r.logDate, r.kcal])), [totals]);
  const today = localDayKey(new Date());

  return (
    <View style={styles.strip}>
      {days.map((dayKey, i) => {
        const isFuture = dayKey > today;
        const fill = dayFill(byDate.get(dayKey) ?? 0, targetKcal);
        const isSelected = dayKey === selectedDay;
        const color = isFuture
          ? colors.track
          : fill === 'complete'
            ? colors.success
            : fill === 'partial'
              ? colors.amber
              : colors.track;

        return (
          <Pressable
            key={dayKey}
            onPress={() => onSelectDay(dayKey)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={t(`journal.calendar.dayA11y.${isFuture ? 'empty' : fill}`, {
              day: localDateFromDayKey(dayKey).getDate(),
            })}
            style={styles.item}
            hitSlop={4}
          >
            <Text
              style={[
                styles.letter,
                { color: isSelected ? colors.accent : colors.textMuted },
                isSelected && styles.letterSelected,
              ]}
            >
              {t(`common.weekdayShort.${WEEKDAY_KEYS[i]}`)}
            </Text>
            <View
              style={[styles.bar, { backgroundColor: isSelected ? colors.accent : color }]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: 6, marginTop: 8, paddingHorizontal: 4 },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  letter: { fontFamily: fontFamily.mono, fontSize: 11 },
  letterSelected: { fontFamily: fontFamily.monoBold },
  bar: { width: '100%', height: 5, borderRadius: 3 },
});

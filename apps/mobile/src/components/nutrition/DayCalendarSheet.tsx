/**
 * Calendrier mensuel du journal (US NUTRI-UX01, R3.1).
 *
 * ── Le défaut corrigé ────────────────────────────────────────────────────────────────────────
 * Le journal se naviguait **un jour à la fois** (◀ ▶). Corriger un oubli de la semaine dernière
 * coûtait 7 taps, d'il y a quinze jours 15 taps. La spec §4.7 prévoyait pourtant, noir sur
 * blanc : « Calendrier accessible via icône (vue mensuelle, **jours complétés surlignés**) ».
 *
 * Les pastilles ne sont pas décoratives : elles montrent la régularité là où elle se construit.
 * La donnée existait déjà (totaux par jour) — le journal était le seul écran aveugle à sa propre
 * complétude.
 */

import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { dayFill, localDayKey, type DayFill } from '@wellness/shared';
import { useMonthTotals } from '@/data/repositories/journal-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  visible: boolean;
  /** Jour actuellement affiché par le journal (AAAA-MM-JJ). */
  selectedDay: string;
  /** Objectif calorique, pour qualifier une journée de complète ou partielle. */
  targetKcal: number | null;
  onSelect: (dayKey: string) => void;
  onClose: () => void;
};

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Index de colonne (0 = lundi) du 1ᵉʳ jour du mois. */
function firstColumn(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay(); // 0 = dimanche
  return (day + 6) % 7;
}

export function DayCalendarSheet({ visible, selectedDay, targetKcal, onSelect, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  // Mois affiché — initialisé sur le jour sélectionné, puis navigable indépendamment.
  const [cursor, setCursor] = useState(() => {
    const [y, m] = selectedDay.split('-').map(Number);
    return { year: y ?? new Date().getFullYear(), month: (m ?? 1) - 1 };
  });

  const monthStart = useMemo(
    () => localDayKey(new Date(cursor.year, cursor.month, 1)),
    [cursor],
  );
  const monthEnd = useMemo(
    () => localDayKey(new Date(cursor.year, cursor.month + 1, 0)),
    [cursor],
  );
  const { totals } = useMonthTotals(monthStart, monthEnd);

  const byDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of totals) map.set(row.logDate, row.kcal);
    return map;
  }, [totals]);

  const today = localDayKey(new Date());
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const offset = firstColumn(cursor.year, cursor.month);

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(i18n.language, {
    month: 'long',
    year: 'numeric',
  });

  const fillColor: Record<DayFill, string> = {
    complete: colors.success,
    partial: colors.amber,
    empty: colors.track,
  };

  const shift = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const pick = (dayKey: string) => {
    onSelect(dayKey);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityElementsHidden />
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <View style={[styles.grab, { backgroundColor: colors.borderStrong }]} />

        <View style={styles.head}>
          <Text style={[styles.title, { color: colors.text }]}>{t('journal.calendar.title')}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={[styles.closeBtn, { backgroundColor: colors.track }]}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.monthNav}>
          <Pressable
            onPress={() => shift(-1)}
            accessibilityRole="button"
            accessibilityLabel={t('journal.calendar.previousMonth')}
            style={[styles.navBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.accent} />
          </Pressable>
          <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
          <Pressable
            onPress={() => shift(1)}
            accessibilityRole="button"
            accessibilityLabel={t('journal.calendar.nextMonth')}
            style={[styles.navBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.accent} />
          </Pressable>
        </View>

        <View style={[styles.grid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.weekRow}>
            {WEEKDAY_KEYS.map((k) => (
              <Text key={k} style={[styles.weekday, { color: colors.textMuted }]}>
                {t(`common.weekdayShort.${k}`)}
              </Text>
            ))}
          </View>

          <View style={styles.days}>
            {Array.from({ length: offset }).map((_, i) => (
              <View key={`pad-${i}`} style={styles.cell} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNumber = i + 1;
              const key = localDayKey(new Date(cursor.year, cursor.month, dayNumber));
              const fill = dayFill(byDate.get(key) ?? 0, targetKcal);
              const isSelected = key === selectedDay;
              const isToday = key === today;
              const isFuture = key > today;
              return (
                <Pressable
                  key={key}
                  onPress={() => pick(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={t(`journal.calendar.dayA11y.${fill}`, { day: dayNumber })}
                  style={[
                    styles.cell,
                    isSelected && { backgroundColor: colors.accent },
                    !isSelected && isToday && { borderWidth: 1.5, borderColor: colors.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      {
                        color: isSelected
                          ? colors.accentText
                          : isFuture
                            ? colors.textMuted
                            : colors.text,
                      },
                    ]}
                  >
                    {dayNumber}
                  </Text>
                  {!isFuture ? (
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: isSelected ? colors.accentText : fillColor[fill] },
                      ]}
                    />
                  ) : (
                    <View style={styles.dot} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.legend}>
          {(['complete', 'partial', 'empty'] as const).map((f) => (
            <View key={f} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: fillColor[f] }]} />
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>
                {t(`journal.calendar.legend.${f}`)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.shortcuts}>
          {(
            [
              { key: 'yesterday', offset: -1 },
              { key: 'today', offset: 0 },
            ] as const
          ).map(({ key, offset: delta }) => {
            const d = new Date();
            d.setDate(d.getDate() + delta);
            const dayKey = localDayKey(d);
            const active = dayKey === selectedDay;
            return (
              <Pressable
                key={key}
                onPress={() => pick(dayKey)}
                accessibilityRole="button"
                style={[
                  styles.shortcut,
                  {
                    backgroundColor: active ? colors.surfaceAlt : colors.surface,
                    borderColor: active ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.shortcutLabel, { color: active ? colors.accent : colors.text }]}
                >
                  {t(`journal.calendar.shortcuts.${key}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 14,
  },
  grab: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  title: { fontFamily: fontFamily.displayBold, fontSize: 20, letterSpacing: -0.4 },
  closeBtn: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: { fontFamily: fontFamily.displayBold, fontSize: 17, textTransform: 'capitalize' },
  grid: { marginHorizontal: 20, borderRadius: 20, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 12 },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekday: { flex: 1, textAlign: 'center', fontFamily: fontFamily.mono, fontSize: 11 },
  days: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 12,
  },
  dayNumber: { fontFamily: fontFamily.mono, fontSize: 13 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingHorizontal: 22 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendLabel: { fontFamily: fontFamily.body, fontSize: 12 },
  shortcuts: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  shortcut: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
});

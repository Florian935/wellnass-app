/**
 * L'onglet Historique du hub Nutrition — US NUTRI-UX03, §4.3 (R7, R8, R9).
 *
 * Le passé quitte l'écran de saisie (D4, décision Q2) : on le relit ici, un mois à la fois, au lieu
 * de faire basculer tout le hub sur un autre jour.
 *  1. **Le calendrier du mois**, en verres remplis selon la cible de chaque jour (R7).
 *  2. **Jours** : les jours notés du mois, et les trous récents à compléter (R8). Un appui ouvre la
 *     page du jour.
 *  3. **Repas habituels** : les mêmes aliments notés au moins deux fois, à reprendre en un geste (R9).
 *
 * Mois, sous-onglet et repas choisi vivent dans le store de l'onglet : revenir d'une page de jour,
 * ou d'un autre onglet, retrouve la même vue.
 */

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  compareMonths,
  dayTargetStatus,
  groupMealOccurrences,
  habitualMeals,
  historyListDayKeys,
  localDateFromDayKey,
  localDayKey,
  monthOfDayKey,
  monthRange,
  summarizeDayFoods,
  type HabitualMeal,
  type MealHistoryRow,
  type NutritionCalendarDay,
} from '@wellness/shared';
import { NutritionCalendar } from '@/components/nutrition/NutritionCalendar';
import { useDailyCalorieTargets } from '@/data/repositories/dashboard-repository';
import { copyMeal, useEntriesBetween, useFirstLogDate } from '@/data/repositories/journal-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { useKcalFormat } from '@/hooks/useKcalFormat';
import type { MealOption } from '@/hooks/useMealList';
import { useNutritionSection, type NutritionHistoryTab } from '@/stores/nutrition-section-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const pad = (n: number) => String(n).padStart(2, '0');

type Props = {
  todayKey: string;
  /** Repas de l'heure : présélection des repas habituels quand rien n'est choisi. */
  mealOfHour: string;
  mealList: MealOption[];
  /**
   * Les entrées des 60 jours précédant aujourd'hui (R9) — la même fenêtre que « Reprendre » (R3),
   * lue une seule fois par le hub : deux requêtes surveillées identiques n'apportaient rien.
   */
  historyRows: readonly MealHistoryRow[];
  onOpenDay: (dayKey: string) => void;
  onToday: () => void;
};

export function HistorySection({ todayKey, mealOfHour, mealList, historyRows, onOpenDay, onToday }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const kcal = useKcalFormat();
  const lang = i18n?.language ?? 'fr';

  const storedMonth = useNutritionSection((s) => s.historyMonth);
  const setHistoryMonth = useNutritionSection((s) => s.setHistoryMonth);
  const historyTab = useNutritionSection((s) => s.historyTab);
  const setHistoryTab = useNutritionSection((s) => s.setHistoryTab);
  const habitsMeal = useNutritionSection((s) => s.habitsMeal);
  const setHabitsMeal = useNutritionSection((s) => s.setHabitsMeal);

  // ── Le mois affiché (R7) ────────────────────────────────────────────────────────────────────────
  const { first } = useFirstLogDate();
  const range = monthRange(first, todayKey);
  const month =
    storedMonth && compareMonths(storedMonth, range.min) >= 0 && compareMonths(storedMonth, range.max) <= 0
      ? storedMonth
      : monthOfDayKey(todayKey);
  const monthStart = `${month.year}-${pad(month.month)}-01`;
  const monthEnd = `${month.year}-${pad(month.month)}-${pad(new Date(month.year, month.month, 0).getDate())}`;

  // Une seule source de cible pour le calendrier, la liste et la page d'un jour (D9).
  const { days: targetDays, marginPct } = useDailyCalorieTargets(monthStart, monthEnd);
  const calendarDays: NutritionCalendarDay[] = useMemo(
    () => targetDays.map((d) => ({ dayKey: d.dayKey, kcal: d.kcal, target: d.effectiveTarget })),
    [targetDays],
  );
  const byDay = useMemo(() => new Map(calendarDays.map((d) => [d.dayKey, d])), [calendarDays]);
  const { rows: monthRows } = useEntriesBetween(monthStart, monthEnd);

  // ── Les repas habituels (R9) ────────────────────────────────────────────────────────────────────
  const until = localDayKey(addDays(localDateFromDayKey(todayKey), -1));
  const occurrences = useMemo(() => groupMealOccurrences(historyRows), [historyRows]);
  const defaultMeal = mealList.some((m) => m.key === mealOfHour) ? mealOfHour : (mealList[0]?.key ?? mealOfHour);
  const selectedMeal = habitsMeal && mealList.some((m) => m.key === habitsMeal) ? habitsMeal : defaultMeal;
  const habits = useMemo(() => habitualMeals(occurrences, selectedMeal), [occurrences, selectedMeal]);
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const lock = useActionLock();

  // Clé `jour:repas:aliments` : après minuit, « Ajouté » ne vaut plus pour la nouvelle journée.
  const addedKey = (h: HabitualMeal) => `${todayKey}:${selectedMeal}:${h.last.signature}`;
  const repeat = (h: HabitualMeal) => {
    const key = addedKey(h);
    if (added.has(key)) return;
    void lock(async () => {
      await copyMeal(h.last.dayKey, selectedMeal, todayKey);
      setAdded((prev) => new Set(prev).add(key));
    }).catch(() => undefined);
  };

  const openDay = (dayKey: string) => (dayKey === todayKey ? onToday() : onOpenDay(dayKey));
  const longDate = (dayKey: string) =>
    localDateFromDayKey(dayKey).toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
  const shortDate = (dayKey: string) =>
    dayKey === until
      ? t('nutritionHub.habits.yesterday')
      : localDateFromDayKey(dayKey).toLocaleDateString(lang, { weekday: 'short', day: 'numeric' });

  // ── La liste des jours (R8) ─────────────────────────────────────────────────────────────────────
  const mealOrder = mealList.map((m) => m.key);
  const listKeys = historyListDayKeys({
    year: month.year,
    month: month.month,
    loggedDayKeys: calendarDays.filter((d) => d.kcal > 0).map((d) => d.dayKey),
    todayKey,
    firstLogDayKey: first,
  });

  const tabs: { key: NutritionHistoryTab; label: string }[] = [
    { key: 'days', label: t('nutritionHub.historyTabs.days') },
    { key: 'habits', label: t('nutritionHub.historyTabs.habits') },
  ];

  return (
    <>
      <NutritionCalendar
        month={month}
        range={range}
        days={calendarDays}
        todayKey={todayKey}
        marginPct={marginPct}
        onMonth={setHistoryMonth}
        onDay={openDay}
      />

      <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: colors.track }]}>
        {tabs.map((tab) => {
          const selected = tab.key === historyTab;
          return (
            <Pressable
              key={tab.key}
              testID={`nutrition-history-tab-${tab.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setHistoryTab(tab.key)}
              style={[styles.tab, selected && { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.tabLabel, { color: selected ? colors.text : colors.textMuted }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Mois sans jour : le calendrier le dit déjà (« Aucun jour noté ce mois-ci. »), la liste se tait. */}
      {historyTab === 'days' && listKeys.length > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {listKeys.map((dayKey, i) => {
            const d = byDay.get(dayKey);
            const total = d?.kcal ?? 0;
            const isToday = dayKey === todayKey;
            const logged = total > 0;
            const status = isToday ? null : dayTargetStatus(total, d?.target ?? null, marginPct);
            const chip = isToday
              ? t('nutritionHub.days.today')
              : status === 'in'
                ? t('nutritionHub.days.in')
                : status === 'over'
                  ? t('nutritionHub.days.over', { kcal: kcal(total - (d?.target ?? 0)) })
                  : status === 'under'
                    ? t('nutritionHub.days.under', { kcal: kcal((d?.target ?? 0) - total) })
                    : null;
            const summary = logged
              ? summarizeDayFoods(
                  monthRows.filter((r) => r.logDate === dayKey),
                  mealOrder,
                ).join(' · ')
              : t('nutritionHub.days.complete');
            const date = localDateFromDayKey(dayKey);
            return (
              <Pressable
                key={dayKey}
                testID={`nutrition-history-day-${dayKey}`}
                onPress={() => openDay(dayKey)}
                accessibilityRole="button"
                accessibilityLabel={t('nutritionHub.days.a11y', {
                  date: longDate(dayKey),
                  summary: logged ? `${t('nutritionHub.days.kcal', { kcal: kcal(total) })}${chip ? `, ${chip}` : ''}` : t('nutritionHub.days.nothing'),
                })}
                style={[styles.dayRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
              >
                <View style={[styles.pill, { backgroundColor: isToday ? colors.accent : logged ? colors.track : 'transparent' }]}>
                  <Text style={[styles.pillDow, { color: isToday ? colors.accentText : colors.accent }]}>
                    {isToday
                      ? t('nutritionHub.days.todayPill')
                      : date.toLocaleDateString(lang, { weekday: 'short' }).toUpperCase()}
                  </Text>
                  <Text style={[styles.pillDay, { color: isToday ? colors.accentText : colors.text }]}>{date.getDate()}</Text>
                </View>
                <View style={styles.dayTexts}>
                  <View style={styles.dayLine}>
                    <Text style={[styles.dayKcal, { color: logged ? colors.text : colors.textMuted }]}>
                      {logged ? t('nutritionHub.days.kcal', { kcal: kcal(total) }) : t('nutritionHub.days.nothing')}
                    </Text>
                    {chip ? (
                      <View style={[styles.chip, { backgroundColor: colors.track }]}>
                        <Text style={[styles.chipLabel, { color: colors.text }]}>{chip}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[styles.daySummary, { color: logged ? colors.textMuted : colors.accent }]}
                    numberOfLines={1}
                  >
                    {summary}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </View>
      ) : historyTab === 'days' ? null : (
        <View style={styles.habits}>
          <View style={styles.chips} accessibilityRole="tablist">
            {mealList.map((m) => {
              const selected = m.key === selectedMeal;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setHabitsMeal(m.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  style={[
                    styles.mealChip,
                    {
                      backgroundColor: selected ? colors.accent : colors.surface,
                      borderColor: selected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.mealChipLabel, { color: selected ? colors.accentText : colors.text }]} numberOfLines={1}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {habits.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>{t('nutritionHub.habits.empty')}</Text>
            ) : null}
            {habits.map((h, i) => {
              const done = added.has(addedKey(h));
              const names = h.last.items.map((e) => e.name).join(', ');
              return (
                <View
                  key={h.last.signature}
                  style={[styles.habitRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                >
                  <View style={styles.dayTexts}>
                    <Text style={[styles.habitName, { color: colors.text }]}>{names}</Text>
                    <Text style={[styles.daySummary, { color: colors.textMuted }]}>
                      {t('nutritionHub.habits.meta', {
                        count: h.count,
                        kcal: kcal(h.last.kcal),
                        date: shortDate(h.last.dayKey),
                      })}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => repeat(h)}
                    disabled={done}
                    accessibilityRole="button"
                    accessibilityLabel={t('nutritionHub.habits.a11y', {
                      name: names,
                      meal: mealList.find((m) => m.key === selectedMeal)?.label ?? selectedMeal,
                    })}
                    accessibilityState={{ disabled: done }}
                    style={[styles.repeat, { backgroundColor: colors.track }]}
                  >
                    <Ionicons name={done ? 'checkmark' : 'refresh'} size={15} color={colors.accent} />
                    <Text style={[styles.repeatLabel, { color: colors.accent }]}>
                      {done ? t('nutritionHub.repeat.done') : t('nutritionHub.repeat.action')}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
          <Text style={[styles.note, { color: colors.textMuted }]}>{t('nutritionHub.habits.note')}</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14 },
  tab: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  empty: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 20, padding: 16 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, paddingLeft: 14, paddingRight: 12 },
  pill: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pillDow: { fontFamily: fontFamily.monoBold, fontSize: 9 },
  pillDay: { fontFamily: fontFamily.displayXBold, fontSize: 17, lineHeight: 19 },
  dayTexts: { flex: 1, gap: 3 },
  dayLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dayKcal: { fontFamily: fontFamily.bodyBold, fontSize: 14.5 },
  chip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  chipLabel: { fontFamily: fontFamily.bodyBold, fontSize: 11.5 },
  daySummary: { fontFamily: fontFamily.body, fontSize: 12.5 },
  habits: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mealChip: { minHeight: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 12, justifyContent: 'center' },
  mealChipLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingLeft: 16, paddingRight: 12 },
  habitName: { fontFamily: fontFamily.bodyBold, fontSize: 14, lineHeight: 19 },
  repeat: { minHeight: 44, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  repeatLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  note: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17, paddingHorizontal: 4 },
});

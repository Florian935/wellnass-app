/**
 * Vue grille de la semaine (US NUTRI-UX01, R7.2).
 *
 * ── Le défaut corrigé ────────────────────────────────────────────────────────────────────────
 * Le planning empilait **sept cartes**, chacune portant ses 3 à 6 repas : soit jusqu'à 35 zones
 * « + Ajouter » dans un seul scroll vertical. On ne pouvait ni voir sa semaine d'un coup d'œil,
 * ni comparer deux jours — ce qui est pourtant l'usage même d'un planning.
 *
 * Sept colonnes, une ligne par repas. La grille dit en un regard ce qui est posé et ce qui reste
 * vide ; la pile reste disponible pour le détail d'une journée (bascule dans l'en-tête).
 */

import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  localDateFromDayKey,
  sumPlannedDay,
  type MealConfigItem,
  type PlannedMealEntry,
} from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function MealPlanWeekGrid({
  dayKeys,
  entriesByDay,
  mealConfig,
  mealLabels,
  todayKey,
  onAdd,
  onOpenDay,
}: {
  dayKeys: readonly string[];
  entriesByDay: ReadonlyMap<string, PlannedMealEntry[]>;
  mealConfig: readonly MealConfigItem[];
  mealLabels: Readonly<Record<string, string>>;
  todayKey: string;
  onAdd: (dayKey: string, mealKey: string) => void;
  /** Ouvre le détail d'une journée — la pile reste la vue de travail fine. */
  onOpenDay: (dayKey: string) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View>
        {/* En-tête : les sept jours */}
        <View style={styles.row}>
          <View style={styles.mealHeadCell} />
          {dayKeys.map((dayKey, i) => {
            const isToday = dayKey === todayKey;
            const totals = sumPlannedDay(entriesByDay.get(dayKey) ?? []);
            return (
              <Pressable
                key={dayKey}
                onPress={() => onOpenDay(dayKey)}
                accessibilityRole="button"
                accessibilityLabel={t('mealPlan.grid.openDayA11y', {
                  day: localDateFromDayKey(dayKey).getDate(),
                })}
                style={[
                  styles.dayHead,
                  {
                    backgroundColor: isToday ? colors.surfaceAlt : colors.surface,
                    borderColor: isToday ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.dayLetter, { color: isToday ? colors.accent : colors.textMuted }]}
                >
                  {t(`common.weekdayShort.${WEEKDAY_KEYS[i]}`)}
                </Text>
                <Text style={[styles.dayNumber, { color: colors.text }]}>
                  {localDateFromDayKey(dayKey).getDate()}
                </Text>
                <Text style={[styles.dayKcal, { color: colors.textMuted }]}>
                  {totals.kcal > 0 ? totals.kcal : '—'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Une ligne par repas configuré */}
        {mealConfig.map((meal) => (
          <View key={meal.key} style={styles.row}>
            <View style={styles.mealHeadCell}>
              <Text style={[styles.mealLabel, { color: colors.textMuted }]} numberOfLines={2}>
                {mealLabels[meal.key] ?? t('mealPlan.day.otherMeal')}
              </Text>
            </View>
            {dayKeys.map((dayKey) => {
              const cell = (entriesByDay.get(dayKey) ?? []).filter((e) => e.mealKey === meal.key);
              const kcal = cell.reduce((sum, e) => sum + e.kcal, 0);
              return (
                <Pressable
                  key={`${dayKey}-${meal.key}`}
                  onPress={() => onAdd(dayKey, meal.key)}
                  accessibilityRole="button"
                  accessibilityLabel={t('mealPlan.day.addToMealA11y', {
                    meal: mealLabels[meal.key] ?? t('mealPlan.day.otherMeal'),
                    day: localDateFromDayKey(dayKey).getDate(),
                  })}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: cell.length > 0 ? colors.surface : colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {cell.length === 0 ? (
                    <Ionicons name="add" size={15} color={colors.borderStrong} />
                  ) : (
                    <>
                      <Text
                        style={[styles.cellName, { color: colors.text }]}
                        numberOfLines={2}
                      >
                        {cell[0]!.label}
                      </Text>
                      <Text style={[styles.cellKcal, { color: colors.textMuted }]}>
                        {cell.length > 1
                          ? t('mealPlan.grid.more', { count: cell.length - 1, kcal })
                          : `${kcal}`}
                      </Text>
                      {/* Une entrée déjà portée au journal se distingue : le planning est une
                          intention, et ce qui a été mangé n'en est plus une (règle R1). */}
                      {cell.every((e) => e.consumedAt != null) ? (
                        <View style={[styles.consumed, { backgroundColor: colors.success }]} />
                      ) : null}
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 4 },
  row: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  mealHeadCell: { width: 74, justifyContent: 'center', paddingRight: 4 },
  mealLabel: { fontFamily: fontFamily.bodyBold, fontSize: 10.5, letterSpacing: 0.3 },
  dayHead: {
    width: 62,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 6,
    alignItems: 'center',
    gap: 1,
  },
  dayLetter: { fontFamily: fontFamily.mono, fontSize: 11 },
  dayNumber: { fontFamily: fontFamily.displayBold, fontSize: 15 },
  dayKcal: { fontFamily: fontFamily.mono, fontSize: 10.5 },
  cell: {
    width: 62,
    height: 62,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    gap: 2,
  },
  cellName: { fontFamily: fontFamily.bodySemi, fontSize: 10.5, textAlign: 'center' },
  cellKcal: { fontFamily: fontFamily.mono, fontSize: 10.5 },
  consumed: { position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: 3 },
});

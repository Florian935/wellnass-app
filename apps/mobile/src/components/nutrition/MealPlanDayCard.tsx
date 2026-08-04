import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  groupEntriesByMeal,
  sumPlannedDay,
  type MealConfigItem,
  type PlannedMealEntry,
} from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type MealPlanDayCardProps = {
  dayKey: string;
  /** Libellé du jour, déjà traduit et formaté par l'appelant. */
  dayLabel: string;
  isToday: boolean;
  entries: readonly PlannedMealEntry[];
  mealConfig: readonly MealConfigItem[];
  /** Libellé d'affichage par clé de repas (repas personnalisés compris). */
  mealLabels: Readonly<Record<string, string>>;
  /** Objectif du jour, ou `null` si aucun profil nutritionnel : la ligne est alors masquée. */
  targetKcal: number | null;
  /** Bonus appliqué ce jour-là (0 si aucun) — affiché pour que la majoration soit explicite. */
  trainingBonusKcal: number;
  onAdd: (mealKey: string) => void;
  onConsume: (entry: PlannedMealEntry) => void;
  onUndoConsume: (entry: PlannedMealEntry) => void;
  onRemove: (entry: PlannedMealEntry) => void;
};

/**
 * Une journée du planning repas (US REPAS-01, roadmap 4.27).
 *
 * Les cases sont les repas **configurés par l'utilisateur** (règle R4), pas quatre en dur : les
 * repas sont personnalisables depuis l'US 4.15. Un repas supprimé des réglages après coup laisse
 * ses entrées dans un bucket « Autre » (règle R10) — jamais masquées.
 *
 * ⚠️ Ce que cette carte affiche est une **intention**, pas du consommé : rien ici n'entre dans les
 * totaux du journal tant que l'utilisateur n'a pas touché « J'ai mangé ça » (règles R1/R2).
 */
export function MealPlanDayCard({
  dayKey,
  dayLabel,
  isToday,
  entries,
  mealConfig,
  mealLabels,
  targetKcal,
  trainingBonusKcal,
  onAdd,
  onConsume,
  onUndoConsume,
  onRemove,
}: MealPlanDayCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const totals = sumPlannedDay(entries);
  const groups = groupEntriesByMeal(entries, mealConfig);
  const ratio = targetKcal && targetKcal > 0 ? Math.min(1, totals.kcal / targetKcal) : 0;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isToday ? colors.accent : colors.border,
          borderWidth: isToday ? 1.5 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.dayLabel, { color: colors.text }]}>{dayLabel}</Text>
        {targetKcal === null ? (
          <Text style={[styles.kcal, { color: colors.textMuted }]}>
            {t('mealPlan.day.plannedOnly', { kcal: totals.kcal })}
          </Text>
        ) : (
          <Text style={[styles.kcal, { color: colors.textMuted }]}>
            <Text style={[styles.kcalStrong, { color: colors.text }]}>{totals.kcal}</Text>
            {' / '}
            <Text style={trainingBonusKcal > 0 ? { color: colors.warnText } : undefined}>
              {targetKcal}
            </Text>
            {' kcal'}
          </Text>
        )}
      </View>

      {targetKcal !== null && (
        <View style={[styles.track, { backgroundColor: colors.track }]}>
          <View style={[styles.fill, { backgroundColor: colors.success, width: `${ratio * 100}%` }]} />
        </View>
      )}

      {trainingBonusKcal > 0 && (
        <View style={[styles.bonus, { backgroundColor: colors.warn, borderColor: colors.warnBorder }]}>
          <Ionicons name="barbell-outline" size={14} color={colors.warnText} />
          <Text style={[styles.bonusText, { color: colors.warnText }]}>
            {t('mealPlan.day.trainingBonus', { kcal: trainingBonusKcal })}
          </Text>
        </View>
      )}

      {groups.map((group) => (
        <View key={group.key} style={[styles.meal, { borderTopColor: colors.border }]}>
          <Text style={[styles.mealLabel, { color: colors.textMuted }]}>
            {mealLabels[group.key] ?? t('mealPlan.day.otherMeal')}
          </Text>

          {group.entries.map((entry) => (
            <View
              key={entry.id}
              style={[
                styles.entry,
                {
                  backgroundColor: entry.consumedAt ? colors.surfaceAlt : colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.entryTexts}>
                <Text style={[styles.entryName, { color: colors.text }]}>{entry.label}</Text>
                <Text style={[styles.entryMeta, { color: colors.textMuted }]}>
                  {entry.consumedAt
                    ? t('mealPlan.entry.consumed')
                    : entry.sourceType === 'recipe'
                      ? t('mealPlan.entry.servings', { count: entry.servings })
                      : t('mealPlan.entry.template')}
                </Text>
              </View>
              <Text style={[styles.entryKcal, { color: colors.textMuted }]}>
                {t('mealPlan.entry.kcal', { kcal: entry.kcal })}
              </Text>
              <Pressable
                onPress={() => (entry.consumedAt ? onUndoConsume(entry) : onConsume(entry))}
                accessibilityRole="button"
                accessibilityLabel={
                  entry.consumedAt
                    ? t('mealPlan.entry.undoA11y', { name: entry.label })
                    : t('mealPlan.entry.consumeA11y', { name: entry.label })
                }
                hitSlop={8}
              >
                <Ionicons
                  name={entry.consumedAt ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={24}
                  color={entry.consumedAt ? colors.success : colors.accent}
                />
              </Pressable>
              <Pressable
                onPress={() => onRemove(entry)}
                accessibilityRole="button"
                accessibilityLabel={t('mealPlan.entry.removeA11y', { name: entry.label })}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}

          <Pressable
            onPress={() => onAdd(group.key)}
            accessibilityRole="button"
            accessibilityLabel={t('mealPlan.day.addToMealA11y', {
              meal: mealLabels[group.key] ?? t('mealPlan.day.otherMeal'),
              day: dayLabel,
            })}
            style={[styles.add, { borderColor: colors.borderStrong }]}
          >
            <Ionicons name="add" size={16} color={colors.textMuted} />
            <Text style={[styles.addLabel, { color: colors.textMuted }]}>
              {t('mealPlan.day.add')}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 12, marginBottom: 10, gap: 2 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  dayLabel: { fontFamily: fontFamily.displayBold, fontSize: 15, flexShrink: 1 },
  kcal: { fontFamily: fontFamily.body, fontSize: 13 },
  kcalStrong: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  fill: { height: '100%', borderRadius: 3 },
  bonus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginTop: 9,
  },
  bonusText: { fontFamily: fontFamily.bodyBold, fontSize: 12.5, flex: 1 },
  meal: { borderTopWidth: 1, paddingTop: 9, marginTop: 9, gap: 5 },
  mealLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  entryTexts: { flex: 1, gap: 1 },
  entryName: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  entryMeta: { fontFamily: fontFamily.body, fontSize: 11.5 },
  entryKcal: { fontFamily: fontFamily.body, fontSize: 12 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 8,
  },
  addLabel: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
});

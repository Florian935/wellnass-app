/**
 * « Reprendre un déjeuner » — US NUTRI-UX03, R3.
 *
 * Quelqu'un qui note ce qu'il mange mange souvent la même chose. Le journal le savait (`copyMeal`
 * existait) mais ne le proposait que dans le ⋯ d'un repas déjà rempli, là où il ne pouvait que le
 * doubler. Ici, en tête d'Aujourd'hui, pour le repas de l'heure : les trois derniers repas
 * **différents** de ce type, un geste chacun. C'est « Refaire une séance » de la muscu.
 *
 * Le bloc se tait dès que le repas visé a une entrée aujourd'hui : c'est l'appelant qui le décide.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { localDateFromDayKey, type RecentMeal } from '@wellness/shared';
import { useKcalFormat } from '@/hooks/useKcalFormat';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  mealKey: string;
  mealLabel: string;
  meals: readonly RecentMeal[];
  /** Reprendre : l'appelant copie l'occurrence et tient le verrou anti-double-appui. */
  onRepeat: (meal: RecentMeal) => void;
  onOpenDay: (dayKey: string) => void;
  onAllHabits: () => void;
};

const TITLED = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

export function RepeatMealCard({ mealKey, mealLabel, meals, onRepeat, onOpenDay, onAllHabits }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const kcal = useKcalFormat();
  const lang = i18n?.language ?? 'fr';

  if (meals.length === 0 || !TITLED.has(mealKey)) return null;

  return (
    <View
      testID="repeat-meal-card"
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t(`nutritionHub.repeat.title.${mealKey}`)}
      </Text>
      {meals.map((m) => {
        const date = localDateFromDayKey(m.occurrence.dayKey);
        const longDate = date.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
        const names = m.occurrence.items.slice(0, 3).map((e) => e.name).join(', ') + (m.occurrence.items.length > 3 ? '…' : '');
        return (
          <View key={`${m.occurrence.dayKey}-${m.occurrence.signature}`} style={[styles.row, { borderTopColor: colors.border }]}>
            <Pressable
              onPress={() => onOpenDay(m.occurrence.dayKey)}
              accessibilityRole="button"
              accessibilityLabel={t('nutritionHub.repeat.openA11y', { date: longDate })}
              style={styles.rowMain}
            >
              <View style={[styles.datePill, { backgroundColor: colors.track }]}>
                <Text style={[styles.dateDow, { color: colors.accent }]}>
                  {date.toLocaleDateString(lang, { weekday: 'short' }).toUpperCase()}
                </Text>
                <Text style={[styles.dateDay, { color: colors.text }]}>{date.getDate()}</Text>
              </View>
              <View style={styles.texts}>
                <Text style={[styles.names, { color: colors.text }]} numberOfLines={1}>
                  {names}
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {t('nutritionHub.repeat.meta', { count: m.count, kcal: kcal(m.occurrence.kcal) })}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => onRepeat(m)}
              accessibilityRole="button"
              accessibilityLabel={t('nutritionHub.repeat.a11y', { meal: mealLabel, date: longDate })}
              style={[styles.action, { backgroundColor: colors.track }]}
            >
              <Ionicons name="refresh" size={15} color={colors.accent} />
              <Text style={[styles.actionLabel, { color: colors.accent }]}>{t('nutritionHub.repeat.action')}</Text>
            </Pressable>
          </View>
        );
      })}
      <Pressable
        onPress={onAllHabits}
        accessibilityRole="button"
        style={[styles.footer, { borderTopColor: colors.border }]}
      >
        <Text style={[styles.footerLabel, { color: colors.accent }]}>{t('nutritionHub.repeat.allHabits')}</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, paddingTop: 14, paddingHorizontal: 14 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 17, paddingHorizontal: 2, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  datePill: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dateDow: { fontFamily: fontFamily.monoBold, fontSize: 9 },
  dateDay: { fontFamily: fontFamily.displayXBold, fontSize: 17, lineHeight: 19 },
  texts: { flex: 1, gap: 2 },
  names: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  meta: { fontFamily: fontFamily.body, fontSize: 12.5 },
  action: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  footer: {
    minHeight: 44,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
});

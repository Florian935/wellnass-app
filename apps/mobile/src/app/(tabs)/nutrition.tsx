import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  MEAL_TYPES,
  computeAge,
  defaultMacroRatios,
  macroGramsFromCalories,
  objectiveFromGoal,
  sumNutrients,
  targetCalories,
  tdee,
  type MealType,
} from '@wellness/shared';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useProfile } from '@/data/repositories/profile-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { removeEntry, useDayEntries, type JournalEntry } from '@/data/repositories/journal-repository';
import { saveMealAsTemplate } from '@/data/repositories/meal-template-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, m! - 1, d! + n);
  return isoDay(date);
};

const MACRO_KEYS = ['protein', 'carbs', 'fat'] as const;
type MacroKey = (typeof MACRO_KEYS)[number];
const MACRO_COLORS: Record<MacroKey, 'accent' | 'success' | 'textMuted'> = {
  protein: 'accent',
  carbs: 'success',
  fat: 'textMuted',
};

export default function NutritionScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { profile } = useProfile();
  const { nutritionProfile } = useNutritionProfile();
  const [day, setDay] = useState(() => isoDay(new Date()));
  const { entries } = useDayEntries(day);

  // Objectif calorique + macros cibles (même logique que le profil nutritionnel).
  const objective = nutritionProfile?.objective ?? objectiveFromGoal(profile?.mainGoal ?? null);
  const age = profile?.birthDate ? computeAge(new Date(profile.birthDate)) : null;
  const tdeeValue = tdee({
    sex: profile?.sex ?? 'unspecified',
    weightKg: profile?.weightKg ?? undefined,
    heightCm: profile?.heightCm ?? undefined,
    age: age ?? undefined,
    activityLevel: nutritionProfile?.activityLevel ?? 'moderate',
  });
  const target = tdeeValue != null ? targetCalories(tdeeValue, objective, nutritionProfile?.manualCalories ?? null) : null;
  const manualSet =
    nutritionProfile?.manualProteinG != null ||
    nutritionProfile?.manualCarbsG != null ||
    nutritionProfile?.manualFatG != null;
  const targetMacros = manualSet
    ? {
        protein: nutritionProfile?.manualProteinG ?? 0,
        carbs: nutritionProfile?.manualCarbsG ?? 0,
        fat: nutritionProfile?.manualFatG ?? 0,
      }
    : target != null
      ? macroGramsFromCalories(target, defaultMacroRatios(objective))
      : null;

  const totals = sumNutrients(entries);
  const remaining = target != null ? target - totals.kcal : null;

  const isToday = day === isoDay(new Date());
  const dayLabel = isToday
    ? t('journal.today')
    : new Date(day + 'T00:00:00').toLocaleDateString(i18n.language, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });

  const consumedMacros: Record<MacroKey, number> = {
    protein: totals.proteinG,
    carbs: totals.carbsG,
    fat: totals.fatG,
  };

  const onDeleteEntry = (entry: JournalEntry) => {
    Alert.alert(entry.name, t('journal.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('journal.delete'), style: 'destructive', onPress: () => void removeEntry(entry.id) },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('pillars.nutrition')}
        subtitle={t('pillarScreens.nutrition.tagline')}
        action={
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('stats.title')}
              onPress={() => router.push('/nutrition-stats')}
              hitSlop={10}
            >
              <Ionicons name="stats-chart-outline" size={23} color={colors.accent} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('nutrition.title')}
              onPress={() => router.push('/nutrition-profile')}
              hitSlop={10}
            >
              <Ionicons name="options-outline" size={24} color={colors.accent} />
            </Pressable>
          </View>
        }
      />

      {/* Navigation entre les jours (4.22) */}
      <View style={styles.dayNav}>
        <Pressable accessibilityLabel={t('journal.prevDay')} onPress={() => setDay(addDays(day, -1))} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => setDay(isoDay(new Date()))}>
          <Text style={[styles.dayLabel, { color: colors.text }]}>{dayLabel}</Text>
        </Pressable>
        <Pressable accessibilityLabel={t('journal.nextDay')} onPress={() => setDay(addDays(day, 1))} hitSlop={10}>
          <Ionicons name="chevron-forward" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Totaux du jour (4.20 / 4.21) */}
        <View style={[styles.totals, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.totalsHead}>
            <View>
              <Text style={[styles.kcalValue, { color: colors.text }]}>{totals.kcal}</Text>
              <Text style={[styles.kcalUnit, { color: colors.textMuted }]}>
                {target != null ? `/ ${target} ${t('nutrition.kcal')}` : t('nutrition.kcal')}
              </Text>
            </View>
            {remaining != null ? (
              <View style={styles.remaining}>
                <Text style={[styles.remainingValue, { color: remaining < 0 ? colors.danger : colors.success }]}>
                  {remaining < 0 ? '+' : ''}{Math.abs(remaining)}
                </Text>
                <Text style={[styles.kcalUnit, { color: colors.textMuted }]}>
                  {remaining < 0 ? t('journal.over') : t('journal.remaining')}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.macroBars}>
            {MACRO_KEYS.map((key) => {
              const consumed = consumedMacros[key];
              const goal = targetMacros?.[key] ?? 0;
              const pct = goal > 0 ? Math.min(100, (consumed / goal) * 100) : 0;
              return (
                <View key={key} style={styles.macroBar}>
                  <View style={styles.macroBarHead}>
                    <Text style={[styles.macroName, { color: colors.textMuted }]}>{t(`nutrition.macros.${key}`)}</Text>
                    <Text style={[styles.macroVal, { color: colors.text }]}>
                      {consumed}{goal > 0 ? ` / ${goal}` : ''} g
                    </Text>
                  </View>
                  <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
                    <View style={[styles.fill, { backgroundColor: colors[MACRO_COLORS[key]], width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
          {target == null ? (
            <Pressable onPress={() => router.push('/nutrition-profile')}>
              <Text style={[styles.setupLink, { color: colors.accent }]}>{t('journal.setTarget')}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Repas (4.14) */}
        {MEAL_TYPES.map((meal) => (
          <MealSection
            key={meal}
            meal={meal}
            entries={entries.filter((e) => e.mealType === meal)}
            onAdd={() => router.push({ pathname: '/food-picker', params: { date: day, meal } })}
            onDeleteEntry={onDeleteEntry}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

function MealSection({
  meal,
  entries,
  onAdd,
  onDeleteEntry,
}: {
  meal: MealType;
  entries: JournalEntry[];
  onAdd: () => void;
  onDeleteEntry: (e: JournalEntry) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const mealKcal = entries.reduce((s, e) => s + e.kcal, 0);
  const mealLabel = t(`journal.meals.${meal}`);

  const saveAsTemplate = () => {
    const items = entries.map((e) => ({
      foodId: e.foodId,
      name: e.name,
      quantityG: e.quantityG,
      kcal: e.kcal,
      proteinG: e.proteinG,
      carbsG: e.carbsG,
      fatG: e.fatG,
    }));
    void saveMealAsTemplate(mealLabel, items).then(() =>
      Alert.alert(t('journal.templateSaved'), mealLabel),
    );
  };

  return (
    <View style={styles.meal}>
      <View style={styles.mealHead}>
        <Text style={[styles.mealName, { color: colors.text }]}>{mealLabel}</Text>
        <View style={styles.mealHeadRight}>
          {entries.length > 0 ? (
            <Pressable onPress={saveAsTemplate} hitSlop={8} accessibilityLabel={t('journal.saveMeal')}>
              <Ionicons name="bookmark-outline" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
          <Text style={[styles.mealKcal, { color: colors.textMuted }]}>{mealKcal} {t('nutrition.kcal')}</Text>
        </View>
      </View>
      <View style={[styles.mealCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {entries.map((e) => (
          <Pressable
            key={e.id}
            onLongPress={() => onDeleteEntry(e)}
            style={styles.entry}
            accessibilityHint={t('journal.longPressDelete')}
          >
            <View style={styles.entryMain}>
              <Text style={[styles.entryName, { color: colors.text }]} numberOfLines={1}>{e.name}</Text>
              {e.quantityG != null ? (
                <Text style={[styles.entryQty, { color: colors.textMuted }]}>{e.quantityG} g</Text>
              ) : null}
            </View>
            <Text style={[styles.entryKcal, { color: colors.textMuted }]}>{e.kcal} {t('nutrition.kcal')}</Text>
          </Pressable>
        ))}
        <Pressable onPress={onAdd} style={styles.addRow} accessibilityRole="button">
          <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
          <Text style={[styles.addLabel, { color: colors.accent }]}>{t('journal.addFood')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  dayLabel: { fontFamily: fontFamily.bodyBold, fontSize: 16, textTransform: 'capitalize' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  mealHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  content: { gap: 16, paddingBottom: 32 },
  totals: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 14 },
  totalsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  kcalValue: { fontFamily: fontFamily.displayBold, fontSize: 36 },
  kcalUnit: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  remaining: { alignItems: 'flex-end' },
  remainingValue: { fontFamily: fontFamily.monoBold, fontSize: 22 },
  macroBars: { gap: 10 },
  macroBar: { gap: 4 },
  macroBarHead: { flexDirection: 'row', justifyContent: 'space-between' },
  macroName: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  macroVal: { fontFamily: fontFamily.mono, fontSize: 13 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  setupLink: { fontFamily: fontFamily.bodySemi, fontSize: 14, textAlign: 'center' },
  meal: { gap: 8 },
  mealHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  mealName: { fontFamily: fontFamily.displaySemi, fontSize: 17 },
  mealKcal: { fontFamily: fontFamily.mono, fontSize: 13 },
  mealCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,133,111,0.25)',
    gap: 12,
  },
  entryMain: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  entryName: { fontFamily: fontFamily.bodySemi, fontSize: 15, flexShrink: 1 },
  entryQty: { fontFamily: fontFamily.mono, fontSize: 12 },
  entryKcal: { fontFamily: fontFamily.mono, fontSize: 13 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  addLabel: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
});

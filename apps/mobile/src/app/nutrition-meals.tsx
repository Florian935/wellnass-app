import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DEFAULT_MEAL_KEYS, resolveMealConfig, type MealConfigItem } from '@wellness/shared';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { upsertNutritionProfile, useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function NutritionMealsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { nutritionProfile } = useNutritionProfile();

  const [meals, setMeals] = useState<MealConfigItem[]>(() =>
    resolveMealConfig(nutritionProfile?.meals).map((m) => ({ ...m, label: m.label ?? '' })),
  );

  const defaultLabel = (key: string) =>
    (DEFAULT_MEAL_KEYS as readonly string[]).includes(key) ? t(`journal.meals.${key}`) : t('meals.newMeal');

  const setLabel = (i: number, label: string) =>
    setMeals((prev) => prev.map((m, j) => (j === i ? { ...m, label } : m)));
  const remove = (i: number) => setMeals((prev) => prev.filter((_, j) => j !== i));
  const add = () =>
    setMeals((prev) => [...prev, { key: `custom-${Date.now()}`, label: '' }]);

  const save = async () => {
    // Libellé vide → null (défaut). Si la config == défaut, on stocke null.
    const normalized: MealConfigItem[] = meals.map((m) => ({
      key: m.key,
      label: m.label && m.label.trim().length > 0 ? m.label.trim() : null,
    }));
    const isDefault =
      normalized.length === DEFAULT_MEAL_KEYS.length &&
      normalized.every((m, i) => m.key === DEFAULT_MEAL_KEYS[i] && m.label === null);
    await upsertNutritionProfile({ meals: isDefault ? null : normalized });
    router.back();
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('meals.hint')}</Text>

      {meals.map((m, i) => (
        <View key={m.key} style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextField
              label={`${t('meals.mealN', { n: i + 1 })}`}
              value={m.label ?? ''}
              onChangeText={(v) => setLabel(i, v)}
              placeholder={defaultLabel(m.key)}
              autoCapitalize="sentences"
            />
          </View>
          {meals.length > 1 ? (
            <Pressable onPress={() => remove(i)} hitSlop={8} style={styles.remove} accessibilityLabel={t('meals.remove')}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          ) : null}
        </View>
      ))}

      <Button label={t('meals.add')} variant="ghost" onPress={add} />

      <View style={styles.footer}>
        <Button label={t('meals.done')} onPress={() => void save()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 },
  hint: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  remove: { paddingBottom: 14 },
  footer: { marginTop: 12 },
});

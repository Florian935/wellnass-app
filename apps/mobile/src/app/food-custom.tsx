import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FOOD_CATEGORIES, type FoodCategory } from '@wellness/shared';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { addCustomFood } from '@/data/repositories/food-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function FoodCustomScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('other');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const parse = (s: string) => {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const kcalNum = parse(kcal);
  const canSave = name.trim().length > 0 && kcalNum != null && kcalNum > 0;

  const save = async () => {
    if (!canSave) return;
    await addCustomFood({
      name,
      category,
      kcalPer100g: kcalNum,
      proteinPer100g: parse(protein),
      carbsPer100g: parse(carbs),
      fatPer100g: parse(fat),
    });
    router.back();
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('food.custom.hint')}</Text>

      <TextField label={t('journal.name')} value={name} onChangeText={setName} autoCapitalize="sentences" />

      <Text style={[styles.label, { color: colors.textMuted }]}>{t('food.custom.category')}</Text>
      <View style={styles.chips}>
        {FOOD_CATEGORIES.map((c) => {
          const active = category === c;
          return (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              style={[
                styles.chip,
                { backgroundColor: active ? colors.accent : colors.surface, borderColor: active ? colors.accent : colors.border },
              ]}
            >
              <Text style={[styles.chipLabel, { color: active ? colors.accentText : colors.text }]}>
                {t(`food.categories.${c}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.textMuted }]}>{t('food.custom.per100')}</Text>
      <TextField label={`${t('nutrition.calories.title')} (${t('nutrition.kcal')})`} value={kcal} onChangeText={setKcal} keyboardType="number-pad" />
      <View style={styles.macroRow}>
        <View style={styles.macroField}><TextField label={`${t('nutrition.macros.protein')} (g)`} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" /></View>
        <View style={styles.macroField}><TextField label={`${t('nutrition.macros.carbs')} (g)`} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" /></View>
        <View style={styles.macroField}><TextField label={`${t('nutrition.macros.fat')} (g)`} value={fat} onChangeText={setFat} keyboardType="decimal-pad" /></View>
      </View>

      <View style={styles.footer}>
        <Button label={t('food.custom.save')} onPress={() => void save()} disabled={!canSave} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  hint: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 19 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  macroRow: { flexDirection: 'row', gap: 10 },
  macroField: { flex: 1 },
  footer: { marginTop: 12 },
});

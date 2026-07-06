import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_UNIT_GRAMS,
  bestMatchIndex,
  parseMealText,
  scaleNutrition,
  type MealType,
  type ParsedUnit,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useFoods, type FoodListItem } from '@/data/repositories/food-repository';
import { addFoodEntry } from '@/data/repositories/journal-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Mots-clés de portion par unité, pour retrouver la portion usuelle de l'aliment. */
const UNIT_PORTION_KEYWORDS: Record<Exclude<ParsedUnit, null>, string[]> = {
  gram: [],
  slice: ['tranche', 'slice'],
  tbsp: ['soupe', 'tbsp', 'c. à s'],
  tsp: ['café', 'tsp', 'c. à c'],
  glass: ['verre', 'glass'],
  handful: ['poignée', 'poignee', 'handful'],
  piece: [],
};

function resolveGrams(unit: ParsedUnit, quantity: number, food: FoodListItem): number {
  if (unit === 'gram') return Math.max(1, Math.round(quantity));
  if (unit) {
    const kw = UNIT_PORTION_KEYWORDS[unit];
    const portion = food.portions.find((p) =>
      kw.some((k) => (p.labelFr + ' ' + p.labelEn).toLowerCase().includes(k)),
    );
    if (portion) return Math.max(1, Math.round(portion.grams * quantity));
    return Math.max(1, Math.round(DEFAULT_UNIT_GRAMS[unit] * quantity));
  }
  // Sans unité : portion usuelle par défaut de l'aliment, sinon 100 g/pièce.
  const base = food.portions[0]?.grams ?? DEFAULT_UNIT_GRAMS.piece;
  return Math.max(1, Math.round(base * quantity));
}

type Row = {
  key: string;
  raw: string;
  food: FoodListItem | null;
  grams: string;
};

export default function MealQuickEntryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; meal?: MealType }>();
  const date = params.date ?? '';
  const meal = (params.meal ?? 'breakfast') as MealType;

  const { foods } = useFoods();
  const candidateNames = useMemo(() => foods.map((f) => f.name), [foods]);

  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);

  const analyze = () => {
    const items = parseMealText(text);
    const next: Row[] = items.map((item, idx) => {
      const mi = bestMatchIndex(item.foodName, candidateNames);
      const food = mi >= 0 ? foods[mi]! : null;
      const grams = food ? resolveGrams(item.unit, item.quantity, food) : 0;
      return { key: `${idx}-${item.foodName}`, raw: item.raw, food, grams: grams ? String(grams) : '' };
    });
    setRows(next);
  };

  const matchedCount = rows?.filter((r) => r.food).length ?? 0;

  const confirm = async () => {
    if (!rows) return;
    for (const r of rows) {
      if (!r.food) continue;
      const g = Math.max(0, Math.round(Number(r.grams.replace(',', '.')) || 0));
      if (g <= 0) continue;
      const n = scaleNutrition(
        {
          kcalPer100g: r.food.kcalPer100g,
          proteinPer100g: r.food.proteinPer100g,
          carbsPer100g: r.food.carbsPer100g,
          fatPer100g: r.food.fatPer100g,
        },
        g,
      );
      await addFoodEntry(date, meal, {
        foodId: r.food.id,
        name: r.food.name,
        quantityG: g,
        kcal: n.kcal,
        proteinG: n.proteinG,
        carbsG: n.carbsG,
        fatG: n.fatG,
      });
    }
    router.back();
  };

  const setGrams = (key: string, value: string) =>
    setRows((prev) => prev?.map((r) => (r.key === key ? { ...r, grams: value } : r)) ?? null);
  const removeRow = (key: string) => setRows((prev) => prev?.filter((r) => r.key !== key) ?? null);

  const kcalOf = (r: Row) => {
    if (!r.food) return 0;
    const g = Math.round(Number(r.grams.replace(',', '.')) || 0);
    return scaleNutrition({ kcalPer100g: r.food.kcalPer100g }, g).kcal;
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('quickList.hint')}</Text>

      <TextField
        label={t('quickList.label')}
        value={text}
        onChangeText={setText}
        placeholder={t('quickList.placeholder')}
        multiline
        style={styles.input}
        autoCapitalize="none"
      />
      <Button label={t('quickList.analyze')} variant="ghost" onPress={analyze} disabled={text.trim().length === 0} />

      {rows != null ? (
        rows.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>{t('quickList.nothing')}</Text>
        ) : (
          <View style={styles.rows}>
            <Text style={[styles.reviewTitle, { color: colors.textMuted }]}>{t('quickList.review')}</Text>
            {rows.map((r) => (
              <View
                key={r.key}
                style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                {r.food ? (
                  <>
                    <View style={styles.rowMain}>
                      <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{r.food.name}</Text>
                      <Text style={[styles.rowKcal, { color: colors.textMuted }]}>{kcalOf(r)} {t('nutrition.kcal')}</Text>
                    </View>
                    <View style={styles.gramField}>
                      <TextField label={t('journal.grams')} value={r.grams} onChangeText={(v) => setGrams(r.key, v)} keyboardType="number-pad" />
                    </View>
                  </>
                ) : (
                  <View style={styles.rowMain}>
                    <Text style={[styles.rowName, { color: colors.textMuted }]} numberOfLines={1}>
                      « {r.raw} »
                    </Text>
                    <Text style={[styles.unmatched, { color: colors.danger }]}>{t('quickList.unmatched')}</Text>
                  </View>
                )}
                <Pressable onPress={() => removeRow(r.key)} hitSlop={8} accessibilityLabel={t('journal.delete')}>
                  <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        )
      ) : null}

      {matchedCount > 0 ? (
        <View style={styles.footer}>
          <Button label={t('quickList.addCount', { count: matchedCount })} onPress={() => void confirm()} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  hint: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  input: { minHeight: 90, paddingTop: 14, textAlignVertical: 'top' },
  empty: { fontFamily: fontFamily.body, fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  rows: { gap: 10 },
  reviewTitle: { fontFamily: fontFamily.bodySemi, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  rowMain: { flex: 1, gap: 2 },
  rowName: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  rowKcal: { fontFamily: fontFamily.mono, fontSize: 12 },
  unmatched: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  gramField: { width: 92 },
  footer: { marginTop: 8 },
});

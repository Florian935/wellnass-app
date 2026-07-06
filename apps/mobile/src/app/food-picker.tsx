import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  perServing,
  scaleNutrition,
  scalePortions,
  type FoodPortion,
  type MealType,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Segment } from '@/components/Segment';
import { TextField } from '@/components/TextField';
import {
  importOpenFoodFactsFood,
  toggleFoodFavorite,
  useFavoriteFoods,
  useFoods,
  type FoodListItem,
} from '@/data/repositories/food-repository';
import { addFoodEntry } from '@/data/repositories/journal-repository';
import { addRecipeIngredient, useRecipes, type RecipeListItem } from '@/data/repositories/recipe-repository';
import { applyTemplate, useMealTemplates } from '@/data/repositories/meal-template-repository';
import { searchOpenFoodFacts, type OffFood } from '@/lib/openfoodfacts';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type PickTarget = {
  id: string;
  name: string;
  kcalPer100g: number;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  portions: FoodPortion[];
};

export default function FoodPickerScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; meal?: MealType; mode?: string; recipeId?: string }>();
  const mode = params.mode === 'recipe' ? 'recipe' : 'journal';
  const date = params.date ?? '';
  const meal = (params.meal ?? 'breakfast') as MealType;
  const recipeId = params.recipeId ?? '';
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const TABS = mode === 'recipe' ? (['all', 'favorites'] as const) : (['all', 'favorites', 'recipes', 'templates'] as const);
  const [tab, setTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const { foods } = useFoods(tab === 'all' ? search : undefined);
  const { foods: favoriteFoods } = useFavoriteFoods();
  const { recipes } = useRecipes();
  const { templates } = useMealTemplates();

  const [offResults, setOffResults] = useState<OffFood[] | null>(null);
  const [offLoading, setOffLoading] = useState(false);
  const [target, setTarget] = useState<PickTarget | null>(null);
  const [recipeTarget, setRecipeTarget] = useState<RecipeListItem | null>(null);
  const [quickAdd, setQuickAdd] = useState(false);

  const addSnapshot = async (snapshot: {
    foodId: string | null;
    name: string;
    quantityG: number | null;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }) => {
    if (mode === 'recipe') {
      await addRecipeIngredient(recipeId, snapshot);
    } else {
      await addFoodEntry(date, meal, snapshot);
    }
    router.back();
  };

  const runOff = async () => {
    setOffLoading(true);
    setOffResults(await searchOpenFoodFacts(search, lang));
    setOffLoading(false);
  };

  const pickOff = async (off: OffFood) => {
    const id = await importOpenFoodFactsFood({ ...off, category: 'other' });
    setTarget({ id, name: off.name, kcalPer100g: off.kcalPer100g, proteinPer100g: off.proteinPer100g, carbsPer100g: off.carbsPer100g, fatPer100g: off.fatPer100g, portions: [] });
  };

  if (quickAdd) {
    return <QuickAddPanel onCancel={() => setQuickAdd(false)} onConfirm={addSnapshot} />;
  }
  if (recipeTarget) {
    return (
      <RecipeServingsPanel
        recipe={recipeTarget}
        onCancel={() => setRecipeTarget(null)}
        onConfirm={async (count) => {
          const one = perServing({ kcal: recipeTarget.totalKcal, proteinG: recipeTarget.totalProteinG, carbsG: recipeTarget.totalCarbsG, fatG: recipeTarget.totalFatG }, recipeTarget.servings);
          const n = scalePortions(one, count);
          await addSnapshot({ foodId: null, name: recipeTarget.name, quantityG: null, kcal: n.kcal, proteinG: n.proteinG, carbsG: n.carbsG, fatG: n.fatG });
        }}
      />
    );
  }
  if (target) {
    return (
      <QuantityPanel
        target={target}
        onCancel={() => setTarget(null)}
        onConfirm={async (grams) => {
          const n = scaleNutrition(target, grams);
          await addSnapshot({ foodId: target.id, name: target.name, quantityG: grams, kcal: n.kcal, proteinG: n.proteinG, carbsG: n.carbsG, fatG: n.fatG });
        }}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {tab === 'all' ? (
        <TextField
          label={t('journal.searchFood')}
          value={search}
          onChangeText={(v) => { setSearch(v); setOffResults(null); }}
          autoCapitalize="none"
          placeholder={t('journal.searchPlaceholder')}
        />
      ) : null}

      <Segment options={TABS} value={tab} onChange={setTab} label={(o) => t(`journal.tabs.${o}`)} />

      {tab === 'recipes' ? (
        <FlatList
          data={recipes}
          keyExtractor={(r) => r.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const one = perServing({ kcal: item.totalKcal, proteinG: item.totalProteinG, carbsG: item.totalCarbsG, fatG: item.totalFatG }, item.servings);
            return (
              <Pressable style={[styles.row, { borderColor: colors.border }]} onPress={() => setRecipeTarget(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.rowKcal, { color: colors.textMuted }]}>{one.kcal} {t('nutrition.kcal')} / {t('recipes.serving')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>{t('recipes.none')}</Text>}
          ListFooterComponent={<Button label={t('recipes.create')} variant="ghost" onPress={() => router.push('/recipe-edit')} />}
        />
      ) : tab === 'templates' ? (
        <FlatList
          data={templates}
          keyExtractor={(tpl) => tpl.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, { borderColor: colors.border }]}
              onPress={async () => { await applyTemplate(item.id, date, meal); router.back(); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.rowKcal, { color: colors.textMuted }]}>{item.totalKcal} {t('nutrition.kcal')} · {t('journal.itemCount', { count: item.itemCount })}</Text>
              </View>
              <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
            </Pressable>
          )}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>{t('journal.noTemplate')}</Text>}
        />
      ) : (
        <FlatList
          data={tab === 'all' ? foods : favoriteFoods}
          keyExtractor={(f) => f.id}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <FoodRow item={item} onPick={() => setTarget({ id: item.id, name: item.name, kcalPer100g: item.kcalPer100g, proteinPer100g: item.proteinPer100g, carbsPer100g: item.carbsPer100g, fatPer100g: item.fatPer100g, portions: item.portions })} />}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>{t('journal.noFood')}</Text>}
          ListFooterComponent={
            tab === 'all' && search.trim().length >= 2 ? (
              <View style={styles.offSection}>
                {offResults == null ? (
                  <Button label={offLoading ? t('journal.searching') : t('journal.searchOff', { term: search.trim() })} variant="ghost" loading={offLoading} onPress={() => void runOff()} />
                ) : offResults.length === 0 ? (
                  <Text style={[styles.empty, { color: colors.textMuted }]}>{t('journal.offNone')}</Text>
                ) : (
                  <>
                    <Text style={[styles.offTitle, { color: colors.textMuted }]}>OpenFoodFacts</Text>
                    {offResults.map((off, idx) => (
                      <Pressable key={`${off.barcode ?? 'off'}-${idx}`} style={[styles.row, { borderColor: colors.border }]} onPress={() => void pickOff(off)}>
                        <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{off.name}</Text>
                        <Text style={[styles.rowKcal, { color: colors.textMuted }]}>{Math.round(off.kcalPer100g)} {t('journal.per100')}</Text>
                      </Pressable>
                    ))}
                  </>
                )}
              </View>
            ) : null
          }
        />
      )}

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {mode === 'journal' ? <Button label={t('journal.quickAdd')} variant="ghost" onPress={() => setQuickAdd(true)} /> : null}
        <Button label={t('journal.createFood')} variant="ghost" onPress={() => router.push('/food-custom')} />
      </View>
    </View>
  );
}

function FoodRow({ item, onPick }: { item: FoodListItem; onPick: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable style={[styles.row, { borderColor: colors.border }]} onPress={onPick}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.rowKcal, { color: colors.textMuted }]}>{Math.round(item.kcalPer100g)} {t('journal.per100')} · {t(`food.categories.${item.category}`)}</Text>
      </View>
      <Pressable onPress={() => void toggleFoodFavorite(item.id)} hitSlop={10} accessibilityLabel="favorite">
        <Ionicons name={item.isFavorite ? 'star' : 'star-outline'} size={22} color={item.isFavorite ? colors.accent : colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

function QuantityPanel({ target, onCancel, onConfirm }: { target: PickTarget; onCancel: () => void; onConfirm: (grams: number) => void | Promise<void> }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const [grams, setGrams] = useState(String(target.portions[0]?.grams ?? 100));
  const g = Number(grams.replace(',', '.')) || 0;
  const kcal = scaleNutrition(target, g).kcal;

  return (
    <View style={[styles.screen, styles.panel, { backgroundColor: colors.background }]}>
      <Text style={[styles.panelTitle, { color: colors.text }]}>{target.name}</Text>
      <Text style={[styles.panelKcal, { color: colors.accent }]}>{kcal} {t('nutrition.kcal')}</Text>
      {target.portions.length > 0 ? (
        <View style={styles.portions}>
          {target.portions.map((p, i) => (
            <Pressable key={i} onPress={() => setGrams(String(p.grams))} style={[styles.portion, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.portionLabel, { color: colors.text }]}>{lang === 'en' ? p.labelEn : p.labelFr} ({p.grams} g)</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextField label={t('journal.grams')} value={grams} onChangeText={setGrams} keyboardType="decimal-pad" />
      <View style={styles.panelActions}>
        <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
        <Button label={t('journal.add')} onPress={() => void onConfirm(Math.round(g))} disabled={g <= 0} />
      </View>
    </View>
  );
}

function RecipeServingsPanel({ recipe, onCancel, onConfirm }: { recipe: RecipeListItem; onCancel: () => void; onConfirm: (count: number) => void | Promise<void> }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [count, setCount] = useState('1');
  const c = Number(count.replace(',', '.')) || 0;
  const one = perServing({ kcal: recipe.totalKcal, proteinG: recipe.totalProteinG, carbsG: recipe.totalCarbsG, fatG: recipe.totalFatG }, recipe.servings);
  const kcal = Math.round(one.kcal * c);

  return (
    <View style={[styles.screen, styles.panel, { backgroundColor: colors.background }]}>
      <Text style={[styles.panelTitle, { color: colors.text }]}>{recipe.name}</Text>
      <Text style={[styles.panelKcal, { color: colors.accent }]}>{kcal} {t('nutrition.kcal')}</Text>
      <TextField label={t('recipes.servingsToAdd')} value={count} onChangeText={setCount} keyboardType="decimal-pad" />
      <View style={styles.panelActions}>
        <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
        <Button label={t('journal.add')} onPress={() => void onConfirm(c)} disabled={c <= 0} />
      </View>
    </View>
  );
}

function QuickAddPanel({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (s: { foodId: null; name: string; quantityG: null; kcal: number; proteinG: number; carbsG: number; fatG: number }) => void | Promise<void> }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const num = (s: string) => Math.max(0, Math.round(Number(s.replace(',', '.')) || 0));

  return (
    <View style={[styles.screen, styles.panel, { backgroundColor: colors.background }]}>
      <Text style={[styles.panelTitle, { color: colors.text }]}>{t('journal.quickAdd')}</Text>
      <TextField label={t('journal.name')} value={name} onChangeText={setName} />
      <TextField label={`${t('nutrition.calories.title')} (${t('nutrition.kcal')})`} value={kcal} onChangeText={setKcal} keyboardType="number-pad" />
      <View style={styles.macroRow}>
        <View style={styles.macroField}><TextField label={`${t('nutrition.macros.protein')} (g)`} value={protein} onChangeText={setProtein} keyboardType="number-pad" /></View>
        <View style={styles.macroField}><TextField label={`${t('nutrition.macros.carbs')} (g)`} value={carbs} onChangeText={setCarbs} keyboardType="number-pad" /></View>
        <View style={styles.macroField}><TextField label={`${t('nutrition.macros.fat')} (g)`} value={fat} onChangeText={setFat} keyboardType="number-pad" /></View>
      </View>
      <View style={styles.panelActions}>
        <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
        <Button label={t('journal.add')} disabled={num(kcal) <= 0} onPress={() => void onConfirm({ foodId: null, name: name.trim() || t('journal.quickAdd'), quantityG: null, kcal: num(kcal), proteinG: num(protein), carbsG: num(carbs), fatG: num(fat) })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 12 },
  list: { flex: 1 },
  listContent: { gap: 8, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  rowName: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  rowKcal: { fontFamily: fontFamily.body, fontSize: 12, marginTop: 2 },
  empty: { fontFamily: fontFamily.body, fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  offSection: { gap: 8, marginTop: 8 },
  offTitle: { fontFamily: fontFamily.bodySemi, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  footer: { flexDirection: 'row', gap: 12, borderTopWidth: 1, paddingTop: 12 },
  panel: { gap: 16 },
  panelTitle: { fontFamily: fontFamily.displayBold, fontSize: 22 },
  panelKcal: { fontFamily: fontFamily.monoBold, fontSize: 20 },
  portions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  portion: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  portionLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  panelActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  macroRow: { flexDirection: 'row', gap: 10 },
  macroField: { flex: 1 },
});

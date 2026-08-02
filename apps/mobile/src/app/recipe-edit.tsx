import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { perServing } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/TextField';
import {
  createRecipe,
  removeRecipeIngredient,
  setRecipeServings,
  useRecipeIngredients,
  useRecipes,
} from '@/data/repositories/recipe-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function RecipeEditScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();

  const [id, setId] = useState<string | null>(params.id ?? null);
  const [name, setName] = useState('');

  const { recipes } = useRecipes();
  const recipe = id ? recipes.find((r) => r.id === id) : undefined;
  const { ingredients } = useRecipeIngredients(id ?? '');

  // Étape 1 : création (nom requis) → passe en mode édition.
  if (!id) {
    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('recipes.createHint')}</Text>
        <TextField label={t('recipes.name')} value={name} onChangeText={setName} autoCapitalize="sentences" />
        <View style={styles.footer}>
          <Button
            label={t('recipes.create')}
            disabled={name.trim().length === 0}
            onPress={async () => setId(await createRecipe(name, 1))}
          />
        </View>
      </ScrollView>
    );
  }

  const servings = recipe?.servings ?? 1;
  const total = { kcal: recipe?.totalKcal ?? 0, proteinG: recipe?.totalProteinG ?? 0, carbsG: recipe?.totalCarbsG ?? 0, fatG: recipe?.totalFatG ?? 0 };
  const one = perServing(total, servings);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>{recipe?.name}</Text>

      {/* Portions */}
      <View style={styles.servingsRow}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{t('recipes.servings')}</Text>
        <View style={styles.stepper}>
          <Pressable onPress={() => void setRecipeServings(id, servings - 1)} hitSlop={8} accessibilityLabel="-">
            <Ionicons name="remove-circle-outline" size={28} color={colors.accent} />
          </Pressable>
          <Text style={[styles.servingsValue, { color: colors.text }]}>{servings}</Text>
          <Pressable onPress={() => void setRecipeServings(id, servings + 1)} hitSlop={8} accessibilityLabel="+">
            <Ionicons name="add-circle-outline" size={28} color={colors.accent} />
          </Pressable>
        </View>
      </View>

      {/* Valeurs (4.25) */}
      <Card>
        <View style={styles.valuesRow}>
          <Value label={t('recipes.total')} kcal={total.kcal} unit={t('nutrition.kcal')} colors={colors} />
          <Value label={t('recipes.perServing')} kcal={one.kcal} unit={t('nutrition.kcal')} colors={colors} accent />
        </View>
        <Text style={[styles.macroLine, { color: colors.textMuted }]}>
          {t('nutrition.macros.protein')} {one.proteinG} g · {t('nutrition.macros.carbs')} {one.carbsG} g · {t('nutrition.macros.fat')} {one.fatG} g
        </Text>
      </Card>

      {/* Ingrédients */}
      <Text style={[styles.label, { color: colors.textMuted }]}>{t('recipes.ingredients')}</Text>
      <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {ingredients.map((ing) => (
          <Pressable
            key={ing.id}
            style={styles.ingredient}
            onLongPress={() =>
              Alert.alert(ing.name, t('recipes.removeIngredient'), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('journal.delete'), style: 'destructive', onPress: () => void removeRecipeIngredient(ing.id) },
              ])
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.ingName, { color: colors.text }]} numberOfLines={1}>{ing.name}</Text>
              {ing.quantityG != null ? <Text style={[styles.ingQty, { color: colors.textMuted }]}>{ing.quantityG} g</Text> : null}
            </View>
            <Text style={[styles.ingKcal, { color: colors.textMuted }]}>{ing.kcal} {t('nutrition.kcal')}</Text>
          </Pressable>
        ))}
        <Pressable
          style={styles.addRow}
          onPress={() => router.push({ pathname: '/food-picker', params: { mode: 'recipe', recipeId: id } })}
          accessibilityRole="button"
          accessibilityLabel={t('recipes.addIngredient')}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
          <Text style={[styles.addLabel, { color: colors.accent }]}>{t('recipes.addIngredient')}</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Button label={t('recipes.done')} onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

function Value({ label, kcal, unit, colors, accent }: { label: string; kcal: number; unit: string; colors: ReturnType<typeof useTheme>['colors']; accent?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.valueLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.valueKcal, { color: accent ? colors.accent : colors.text }]}>{kcal} {unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  hint: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 19 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 24 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  servingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  servingsValue: { fontFamily: fontFamily.monoBold, fontSize: 20, minWidth: 28, textAlign: 'center' },
  valuesRow: { flexDirection: 'row', gap: 12 },
  valueLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  valueKcal: { fontFamily: fontFamily.displayBold, fontSize: 22 },
  macroLine: { fontFamily: fontFamily.mono, fontSize: 13 },
  list: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  ingredient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,133,111,0.25)', gap: 12 },
  ingName: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  ingQty: { fontFamily: fontFamily.mono, fontSize: 12, marginTop: 2 },
  ingKcal: { fontFamily: fontFamily.mono, fontSize: 13 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  addLabel: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  footer: { marginTop: 12 },
});

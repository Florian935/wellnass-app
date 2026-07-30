import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const { nutritionProfile, isLoading } = useNutritionProfile();

  /**
   * Formulaire local. `null` = **pas encore initialisé** (la config n'est pas arrivée).
   *
   * ⚠️ Ne surtout pas repasser à un `useState(() => …)` seul : l'initialiseur ne s'exécute
   * qu'au **premier** rendu, alors que `useNutritionProfile` lit SQLite de façon asynchrone et
   * renvoie `null` en attendant. Le formulaire se figeait donc sur les 4 repas par défaut, et
   * « Enregistrer » écrasait silencieusement la vraie configuration — les entrées de journal
   * rattachées aux repas ainsi perdus se retrouvant dans la section « Autres ».
   * Bug constaté en recette sur device le 30/07/2026.
   */
  const [meals, setMeals] = useState<MealConfigItem[] | null>(null);

  useEffect(() => {
    // Une seule initialisation : une fois le formulaire peuplé, l'utilisateur en est maître.
    // Une resynchro ultérieure écraserait ses saisies en cours.
    if (isLoading || meals != null) return;
    setMeals(resolveMealConfig(nutritionProfile?.meals).map((m) => ({ ...m, label: m.label ?? '' })));
  }, [isLoading, nutritionProfile, meals]);

  const defaultLabel = (key: string) =>
    (DEFAULT_MEAL_KEYS as readonly string[]).includes(key) ? t(`journal.meals.${key}`) : t('meals.newMeal');

  const setLabel = (i: number, label: string) =>
    setMeals((prev) => prev?.map((m, j) => (j === i ? { ...m, label } : m)) ?? prev);
  const remove = (i: number) => setMeals((prev) => prev?.filter((_, j) => j !== i) ?? prev);
  const add = () =>
    setMeals((prev) => (prev ? [...prev, { key: `custom-${Date.now()}`, label: '' }] : prev));

  // Réordonnancement : échange la position i ↔ i+dir. Les clés sont conservées → aucune
  // entrée du journal n'est orpheline (contrairement à supprimer/recréer un repas).
  const move = (i: number, dir: -1 | 1) =>
    setMeals((prev) => {
      if (prev == null) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i]!, next[j]!] = [next[j]!, next[i]!];
      return next;
    });

  const save = async () => {
    // Garde-fou : sans configuration chargée, il n'y a rien à enregistrer — et écrire ici
    // reviendrait précisément à écraser la config réelle par les défauts.
    if (meals == null) return;
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

  if (meals == null) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

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
          <View style={styles.reorder}>
            <Pressable
              onPress={() => move(i, -1)}
              disabled={i === 0}
              hitSlop={6}
              accessibilityLabel={t('meals.moveUp')}
            >
              <Ionicons
                name="chevron-up"
                size={20}
                color={i === 0 ? colors.border : colors.text}
              />
            </Pressable>
            <Pressable
              onPress={() => move(i, 1)}
              disabled={i === meals.length - 1}
              hitSlop={6}
              accessibilityLabel={t('meals.moveDown')}
            >
              <Ionicons
                name="chevron-down"
                size={20}
                color={i === meals.length - 1 ? colors.border : colors.text}
              />
            </Pressable>
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  reorder: { paddingBottom: 10, gap: 2, alignItems: 'center' },
  remove: { paddingBottom: 14 },
  footer: { marginTop: 12 },
});

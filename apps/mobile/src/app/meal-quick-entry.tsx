import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  mealForHour,
  DEFAULT_UNIT_GRAMS,
  bestMatchIndex,
  parseMealText,
  rankFoodMatches,
  scaleNutrition,
  type ParsedUnit,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useFoods, type FoodListItem } from '@/data/repositories/food-repository';
import { addFoodEntry } from '@/data/repositories/journal-repository';
import { useCurrentHour, useTodayKey } from '@/hooks/useTodayKey';
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
  /**
   * Meilleures correspondances proposees pour une ligne non reconnue (spec §4.5).
   *
   * 🔴 Sans elles, une ligne rouge etait un **cul-de-sac** : l'app disait « non reconnu » et
   * n'offrait aucune issue — ni choisir, ni chercher, ni creer. La spec l'exigeait pourtant
   * noir sur blanc, et c'est le seul endroit du parcours ou l'utilisateur a deja fait l'effort
   * d'ecrire son repas.
   */
  suggestions: FoodListItem[];
};

export default function MealQuickEntryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  /**
   * Repli sur **aujourd'hui**, et non sur la chaîne vide — exactement le correctif appliqué à
   * `food-picker` le 01/08/2026, dont cet écran avait gardé la version fautive. `date` alimente
   * directement la clé de jour de l'entrée : `''` produisait des lignes rattachées à **aucune
   * journée**, écrites sans erreur, comptées par le bouton « ajouter N », et invisibles dans tous
   * les journaux. Un écran qui accuse réception d'enregistrements fantômes est pire qu'un écran qui
   * échoue. Trouvé le 14/08/2026 en écrivant les tests de cet écran.
   */
  const todayKey = useTodayKey();
  const hour = useCurrentHour();
  const date = params.date ?? todayKey;
  /**
 * Repli sur **le repas de l'heure courante**, et non `'breakfast'` en dur (US NUTRI-UX01, R2.6).
 *
 * Ouvert sans paramètre — lien direct, raccourci, retour arrière —, cet écran journalisait
 * systématiquement au petit-déjeuner : à 20 h, l'ajout partait dans le mauvais repas et était à
 * reprendre. Même correctif que celui posé sur l'accueil par ACCUEIL-02.
 */
const meal = params.meal ?? mealForHour(hour);

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
      return {
        key: `${idx}-${item.foodName}`,
        raw: item.raw,
        food,
        grams: grams ? String(grams) : '',
        // Les propositions ne sont calculees que pour ce qui n'a pas ete reconnu : c'est la
        // seule ligne ou elles servent, et le classement coute sur toute la base.
        suggestions: food
          ? []
          : rankFoodMatches(
              foods.map((f) => ({ id: f.id, name: f.name, kind: 'food' as const })),
              item.foodName,
              { limit: 3 },
            )
              .map((m) => foods.find((f) => f.id === m.item.id))
              .filter((f): f is FoodListItem => f != null),
      };
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

  /** Adopte une proposition : la ligne cesse d'etre un echec et redevient modifiable. */
  const pickSuggestion = (key: string, food: FoodListItem) =>
    setRows(
      (prev) =>
        prev?.map((r) =>
          r.key === key
            ? {
                ...r,
                food,
                // La quantite repart de la portion usuelle de l'aliment retenu, pas de celle
                // qu'on avait devinee pour un mot qu'on ne comprenait pas.
                grams: String(resolveGrams(null, 1, food)),
                suggestions: [],
              }
            : r,
        ) ?? null,
    );

  /** Ajoute une ligne vide a la revue (spec §4.5 : « ajout d'une ligne a la main possible »). */
  const addRow = () =>
    setRows((prev) => [
      ...(prev ?? []),
      { key: `manuel-${Date.now()}`, raw: '', food: null, grams: '', suggestions: [] },
    ]);

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
                    {/* R6.5 — les meilleures correspondances, puis la recherche, puis la
                        creation : trois issues, la ou il n'y en avait aucune. */}
                    {r.suggestions.length > 0 ? (
                      <View style={styles.suggestions}>
                        {r.suggestions.map((sugg) => (
                          <Pressable
                            key={sugg.id}
                            onPress={() => pickSuggestion(r.key, sugg)}
                            accessibilityRole="button"
                            accessibilityLabel={t('quickList.pickSuggestion', { name: sugg.name })}
                            style={[styles.suggestion, { backgroundColor: colors.surfaceAlt, borderColor: colors.accent }]}
                          >
                            <Text style={[styles.suggestionLabel, { color: colors.accent }]} numberOfLines={1}>
                              {sugg.name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                    <View style={styles.suggestions}>
                      <Pressable
                        onPress={() => router.push({ pathname: '/food-picker', params: { date, meal } })}
                        accessibilityRole="button"
                        style={[styles.suggestion, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <Text style={[styles.suggestionLabel, { color: colors.text }]}>
                          {t('quickList.search')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => router.push('/food-custom')}
                        accessibilityRole="button"
                        style={[styles.suggestion, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <Text style={[styles.suggestionLabel, { color: colors.text }]}>
                          {t('journal.createFood')}
                        </Text>
                      </Pressable>
                    </View>
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

      {rows != null && rows.length > 0 ? (
        <Pressable
          onPress={addRow}
          accessibilityRole="button"
          style={[styles.addRow, { borderColor: colors.borderStrong }]}
        >
          <Ionicons name="add" size={16} color={colors.textMuted} />
          <Text style={[styles.addRowLabel, { color: colors.textMuted }]}>
            {t('quickList.addRow')}
          </Text>
        </Pressable>
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
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
  suggestion: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13 },
  suggestionLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 12,
  },
  addRowLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  gramField: { width: 92 },
  footer: { marginTop: 8 },
});

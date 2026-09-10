/**
 * Feuille d'ajout d'un aliment — 3 modes (US NUTRI-UX01, R2.1 → R2.4).
 *
 * ── Ce qu'elle remplace ──────────────────────────────────────────────────────────────────────
 * Un écran plein portant **9 entrées de même poids** : 5 onglets (Tous · Favoris · Récents ·
 * Recettes · Repas types) et 4 boutons `ghost` de pied de page (Scanner · Liste rapide · Ajout
 * rapide · Créer un aliment). Rien n'y hiérarchisait le geste fait cinq fois par jour et celui
 * fait trois fois dans une vie.
 *
 * C'est **exactement l'arbitrage écrit dans la maquette du 30/07/2026**, resté sans suite dans le
 * code :
 *   « Affordance retenue (une seule, argumentée) : […] un bottom sheet de sélection ; ce sheet
 *     expose les 3 modes en haut (Rechercher · Scanner · Texte libre). »
 *
 * ── Les quatre gains, dans l'ordre où on les voit ────────────────────────────────────────────
 * 1. Le **budget du jour reste à l'écran** pendant toute la saisie. Il disparaissait au moment
 *    précis où la décision se prend.
 * 2. La liste ouvre sur **les habitudes** (récents + favoris), pas sur la base alphabétique.
 * 3. La recherche est **unifiée et classée** : aliments, recettes et repas types ensemble.
 * 4. Chaque ligne porte un **« + » qui ajoute la quantité habituelle** — un aliment connu se
 *    journalise en un seul tap, sans passer par le panneau de quantité.
 */

import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { scaleMicronutrients, scaleNutrition } from '@wellness/shared';
import { TextField } from '@/components/TextField';
import {
  SEARCH_RESULT_LIMIT,
  useCatalogSearch,
  useHabitFoods,
  useRecentFoodIds,
  type CatalogEntry,
} from '@/data/repositories/food-catalog-repository';
import { getFood } from '@/data/repositories/food-repository';
import { addFoodEntry } from '@/data/repositories/journal-repository';
import { applyTemplate } from '@/data/repositories/meal-template-repository';
import { useRecipes } from '@/data/repositories/recipe-repository';
import { useDebounced } from '@/hooks/useDebounced';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { CategoryGlyph } from './CategoryGlyph';

export type AddFoodSheetProps = {
  visible: boolean;
  /** Jour visé (AAAA-MM-JJ). */
  date: string;
  /** Repas visé — déjà déduit de l'heure par l'appelant (R2.6). */
  mealKey: string;
  /** Libellé du repas, pour le titre. */
  mealLabel: string;
  /** Calories encore disponibles sur la journée, ou `null` sans objectif. */
  kcalRemaining: number | null;
  /** Grammes de protéines encore disponibles, ou `null`. */
  proteinRemaining: number | null;
  /** Avancement calorique du jour, dans [0, 1] — pour l'anneau du bandeau. */
  consumedRatio: number;
  onClose: () => void;
};

type Mode = 'search' | 'scan' | 'text';

export function AddFoodSheet({
  visible,
  date,
  mealKey,
  mealLabel,
  kcalRemaining,
  proteinRemaining,
  consumedRatio,
  onClose,
}: AddFoodSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const [term, setTerm] = useState('');
  const debounced = useDebounced(term);
  const [busyId, setBusyId] = useState<string | null>(null);

  const recentIds = useRecentFoodIds();
  const { entries: habits, isLoading: habitsLoading } = useHabitFoods();
  const { entries: results, isLoading: searchLoading } = useCatalogSearch(debounced, recentIds);
  const { recipes } = useRecipes();

  const searching = debounced.trim().length > 0;
  const list = searching ? results : habits;
  const loading = searching ? searchLoading : habitsLoading;

  /** Quitte le sheet vers un écran plein, en réinitialisant la recherche. */
  const goTo = (pathname: string, params?: Record<string, string>) => {
    setTerm('');
    onClose();
    router.push({ pathname, params: { date, meal: mealKey, ...params } });
  };

  /**
   * Ajout direct depuis la liste — le geste à un tap.
   *
   * Un aliment part avec sa quantité habituelle ; une recette avec une portion ; un repas type
   * avec sa composition. Le panneau de quantité reste accessible en touchant la **ligne**, pour
   * les cas où la quantité change.
   */
  const quickAdd = async (entry: CatalogEntry) => {
    setBusyId(entry.id);
    try {
      if (entry.kind === 'template') {
        await applyTemplate(entry.id, date, mealKey);
        return;
      }
      if (entry.kind === 'recipe') {
        const recipe = recipes.find((r) => r.id === entry.id);
        if (!recipe) return;
        const servings = Math.max(1, recipe.servings);
        await addFoodEntry(date, mealKey, {
          foodId: null,
          name: recipe.name,
          quantityG: null,
          kcal: Math.round(recipe.totalKcal / servings),
          proteinG: Math.round(recipe.totalProteinG / servings),
          carbsG: Math.round(recipe.totalCarbsG / servings),
          fatG: Math.round(recipe.totalFatG / servings),
        });
        return;
      }
      // Aliment : on relit la fiche complète pour emporter les micronutriments, que la liste
      // ne transporte pas (elle en afficherait 33 par ligne sans jamais les montrer).
      const food = await getFood(entry.id, 'fr');
      const grams = entry.defaultGrams ?? 100;
      if (!food) return;
      const n = scaleNutrition(food, grams);
      await addFoodEntry(date, mealKey, {
        foodId: food.id,
        name: food.name,
        quantityG: grams,
        kcal: n.kcal,
        proteinG: n.proteinG,
        carbsG: n.carbsG,
        fatG: n.fatG,
        micronutrients: scaleMicronutrients(food.micronutrients ?? {}, grams),
      });
    } finally {
      setBusyId(null);
    }
  };

  // Trois entrées fixes : pas de `useMemo` à entretenir pour un tableau de cette taille, et
  // surtout pas de dépendance à `goTo` (recréée à chaque rendu) qui rendrait la mémoïsation
  // inutile tout en la faisant mentir.
  const modes: { key: Mode; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }[] = [
    { key: 'search', icon: 'search-outline', onPress: () => undefined },
    { key: 'scan', icon: 'barcode-outline', onPress: () => goTo('/food-scan') },
    { key: 'text', icon: 'list-outline', onPress: () => goTo('/meal-quick-entry') },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityElementsHidden />
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <View style={[styles.grab, { backgroundColor: colors.borderStrong }]} />

        {/* En-tête : le repas visé est nommé, et il vient de l'heure (R2.6) */}
        <View style={styles.head}>
          <View style={styles.headTexts}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {t('journal.addSheet.title', { meal: mealLabel })}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t('journal.addSheet.subtitle')}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={[styles.closeBtn, { backgroundColor: colors.track }]}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        {/* R2.4 — le budget ne quitte plus l'écran */}
        {kcalRemaining != null ? (
          <View style={[styles.budget, { backgroundColor: colors.panel }]}>
            <View style={[styles.budgetRing, { borderColor: colors.panelAccent }]}>
              <Text style={[styles.budgetPct, { color: colors.panelAccent }]}>
                {Math.round(Math.min(1, Math.max(0, consumedRatio)) * 100)}
              </Text>
            </View>
            <View style={styles.budgetTexts}>
              <Text style={[styles.budgetLabel, { color: colors.panelMuted }]}>
                {t('journal.addSheet.remainingLabel')}
              </Text>
              <Text style={[styles.budgetValue, { color: colors.panelText }]}>
                {t('journal.addSheet.remainingValue', {
                  kcal: Math.max(0, kcalRemaining),
                  protein: Math.max(0, proteinRemaining ?? 0),
                })}
              </Text>
            </View>
          </View>
        ) : null}

        {/* R2.1 — les 3 modes */}
        <View style={styles.modes}>
          {modes.map((m) => {
            const active = m.key === 'search';
            return (
              <Pressable
                key={m.key}
                onPress={m.onPress}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.mode,
                  {
                    backgroundColor: active ? colors.accent : colors.surface,
                    borderColor: active ? colors.accent : colors.border,
                  },
                ]}
              >
                <Ionicons name={m.icon} size={20} color={active ? colors.accentText : colors.text} />
                <Text
                  style={[styles.modeLabel, { color: active ? colors.accentText : colors.text }]}
                >
                  {t(`journal.addSheet.modes.${m.key}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* R2.3 — une seule recherche, sur les trois familles */}
        <View style={styles.searchField}>
          <TextField
            label={t('journal.addSheet.searchLabel')}
            value={term}
            onChangeText={setTerm}
            placeholder={t('journal.addSheet.searchPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.listHead}>
          <Text style={[styles.listHeadLabel, { color: colors.textMuted }]}>
            {searching ? t('journal.addSheet.results') : t('journal.addSheet.habits')}
          </Text>
          <Pressable onPress={() => goTo('/food-picker')} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.listHeadAction, { color: colors.accent }]}>
              {t('journal.addSheet.wholeBase')}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading && list.length === 0 ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : list.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {searching ? t('journal.addSheet.noResult') : t('journal.addSheet.noHabit')}
            </Text>
          ) : (
            list.map((entry) => (
              <EntryRow
                key={`${entry.kind}-${entry.id}`}
                entry={entry}
                busy={busyId === entry.id}
                onQuickAdd={() => void quickAdd(entry)}
                onOpen={() =>
                  goTo('/food-picker', { focusId: entry.id, focusKind: entry.kind })
                }
              />
            ))
          )}
          {searching && list.length >= SEARCH_RESULT_LIMIT ? (
            <Text style={[styles.more, { color: colors.textMuted }]}>
              {t('journal.addSheet.refine')}
            </Text>
          ) : null}
        </ScrollView>

        {/* Les deux actions rares, et elles seules */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Pressable onPress={() => goTo('/food-picker', { quick: '1' })} accessibilityRole="button">
            <Text style={[styles.footerAction, { color: colors.accent }]}>
              {t('journal.quickAdd')}
            </Text>
          </Pressable>
          <Pressable onPress={() => goTo('/food-custom')} accessibilityRole="button">
            <Text style={[styles.footerAction, { color: colors.accent }]}>
              {t('journal.createFood')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Une ligne de résultat : vignette, nom, quantité habituelle, « + » d'ajout direct. */
function EntryRow({
  entry,
  busy,
  onQuickAdd,
  onOpen,
}: {
  entry: CatalogEntry;
  busy: boolean;
  onQuickAdd: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const meta =
    entry.kind === 'recipe'
      ? t('journal.addSheet.recipeMeta', { count: entry.count ?? 1 })
      : entry.kind === 'template'
        ? t('journal.addSheet.templateMeta', { count: entry.count ?? 0 })
        : entry.fromHistory
          ? t('journal.addSheet.usualQuantity', { grams: entry.defaultGrams ?? 0 })
          : t('journal.addSheet.grams', { grams: entry.defaultGrams ?? 0 });

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${entry.name} — ${meta}`}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <CategoryGlyph kind={entry.kind} category={entry.category} />
      <View style={styles.rowTexts}>
        <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
          {entry.name}
        </Text>
        <Text
          style={[
            styles.rowMeta,
            { color: entry.fromHistory ? colors.success : colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {meta}
        </Text>
      </View>
      <Text style={[styles.rowKcal, { color: colors.textMuted }]}>{entry.kcal}</Text>
      <Pressable
        onPress={onQuickAdd}
        disabled={busy}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t('journal.addSheet.addA11y', { name: entry.name })}
        style={[styles.addBtn, { backgroundColor: busy ? colors.track : colors.accent }]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Ionicons name="add" size={22} color={colors.accentText} />
        )}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
  },
  grab: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  headTexts: { flex: 1, gap: 2 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 20, letterSpacing: -0.4 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 12.5 },
  closeBtn: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  budget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  budgetRing: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  budgetPct: { fontFamily: fontFamily.monoBold, fontSize: 11 },
  budgetTexts: { flex: 1 },
  budgetLabel: { fontFamily: fontFamily.body, fontSize: 12 },
  budgetValue: { fontFamily: fontFamily.monoBold, fontSize: 14 },
  modes: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 12 },
  mode: {
    flex: 1,
    height: 62,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  modeLabel: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
  searchField: { paddingHorizontal: 20, marginTop: 12 },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginTop: 14,
    marginBottom: 6,
  },
  listHeadLabel: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 0.8 },
  listHeadAction: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  list: { flexGrow: 0 },
  listContent: { paddingHorizontal: 20, paddingBottom: 8, gap: 8 },
  loader: { marginVertical: 24 },
  empty: { fontFamily: fontFamily.body, fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  more: { fontFamily: fontFamily.body, fontSize: 12.5, textAlign: 'center', paddingVertical: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowTexts: { flex: 1, minWidth: 0, gap: 1 },
  rowName: { fontFamily: fontFamily.bodySemi, fontSize: 14.5 },
  rowMeta: { fontFamily: fontFamily.body, fontSize: 11.5 },
  rowKcal: { fontFamily: fontFamily.monoBold, fontSize: 12 },
  addBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  footerAction: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
});

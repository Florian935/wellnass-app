/**
 * US NUTR-F2 — carte de suggestion pour combler un macro (roadmap 4.37).
 *
 * Rend le journal **actionnable** : il disait « il te reste 24 g de protéines », il propose maintenant
 * « ajoute 80 g de blanc de poulet · 132 kcal ».
 *
 * La carte ne s'affiche que si les trois conditions de la décision D6 sont réunies : un objectif
 * existe, l'écart atteint 10 % de la cible, et **le budget calorique restant est positif**. Cette
 * dernière condition est la plus importante : suggérer d'ajouter des protéines à quelqu'un qui a déjà
 * dépassé ses calories ne serait pas un conseil imparfait, ce serait un mauvais conseil.
 *
 * Tout le tri vit dans `@wellness/shared` (`macro-suggestion.ts`, 18 tests) : ici, de l'affichage.
 */

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useUnits } from '@/hooks/useUnits';
import {
  SUGGESTIBLE_MACROS,
  macroGaps,
  pickMacroToFill,
  suggestFoodsForMacro,
  type SuggestibleMacro,
  type SuggestionCandidate,
} from '@wellness/shared';

import { Card } from '@/components/Card';
import { addFoodEntry } from '@/data/repositories/journal-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  /** Jour visé (AAAA-MM-JJ). */
  day: string;
  /** Repas dans lequel l'ajout sera journalisé. */
  mealType: string;
  /** Grammes consommés par macro. */
  consumed: Record<SuggestibleMacro, number>;
  /** Grammes visés par macro. `null` = aucun objectif défini → pas de carte. */
  targets: Record<SuggestibleMacro, number> | null;
  /** Calories encore disponibles sur la journée. */
  kcalRemaining: number | null;
  /** Vivier : récents d'abord, puis la base (décision D4). */
  candidates: readonly SuggestionCandidate[];
  /** Identifiants des aliments récemment consommés, pour le départage. */
  recentIds: readonly string[];
};

export function MacroSuggestionCard({
  day,
  mealType,
  consumed,
  targets,
  kcalRemaining,
  candidates,
  recentIds,
}: Props) {
  const { t } = useTranslation();
  // `macroG` a une décimale : interpolé tel quel par i18next (un `String()` brut), il ressort
  // « +41.2 g » en français. Les nombres affichés passent par le formateur localisé, toujours.
  const { formatAxisNumber } = useUnits();
  const { colors } = useTheme();

  const [override, setOverride] = useState<SuggestibleMacro | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const gaps = useMemo(
    () => (targets ? macroGaps(consumed, targets) : []),
    [consumed, targets],
  );
  const autoMacro = useMemo(() => pickMacroToFill(gaps), [gaps]);
  const macro = override ?? autoMacro;

  const gap = gaps.find((g) => g.macro === macro);

  const suggestions = useMemo(() => {
    if (macro === null || gap === undefined || kcalRemaining === null) return [];
    return suggestFoodsForMacro({
      macro,
      gapG: gap.gapG,
      kcalBudget: kcalRemaining,
      candidates,
      recentIds,
    });
  }, [macro, gap, kcalRemaining, candidates, recentIds]);

  // ── Conditions d'affichage (D6) ────────────────────────────────────────────
  // Aucun objectif, aucun macro en retard, ou budget calorique épuisé → pas de carte du tout.
  if (targets === null || autoMacro === null || kcalRemaining === null || kcalRemaining <= 0) {
    return null;
  }
  if (macro === null || gap === undefined) return null;

  const add = async (suggestion: (typeof suggestions)[number]) => {
    const food = candidates.find((c) => c.id === suggestion.foodId);
    if (!food) return;

    setBusyId(suggestion.foodId);
    setError(false);
    try {
      const factor = suggestion.quantityG / 100;
      await addFoodEntry(day, mealType, {
        foodId: food.id,
        name: food.name,
        quantityG: suggestion.quantityG,
        kcal: suggestion.kcal,
        proteinG: Math.round((food.proteinPer100g ?? 0) * factor * 10) / 10,
        carbsG: Math.round((food.carbsPer100g ?? 0) * factor * 10) / 10,
        fatG: Math.round((food.fatPer100g ?? 0) * factor * 10) / 10,
      });
    } catch {
      setError(true);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <Text style={[styles.title, { color: colors.textMuted }]}>{t('suggestion.title')}</Text>

      {/* Le manque est porté par le TEXTE, jamais par la seule couleur. */}
      <Text style={[styles.gap, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
        {t('suggestion.missing', {
          count: Math.round(gap.gapG),
          macro: t(`suggestion.macros.${macro}`),
        })}
      </Text>

      {/* Sélecteur de macro : l'utilisateur peut viser autre chose que le plus en retard (D1). */}
      <View style={styles.segs} accessibilityRole="tablist">
        {SUGGESTIBLE_MACROS.map((id) => {
          const active = id === macro;
          return (
            <Pressable
              key={id}
              onPress={() => setOverride(id)}
              hitSlop={8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t('suggestion.a11yMacroTab', {
                macro: t(`suggestion.macros.${id}`),
              })}
              style={[
                styles.seg,
                {
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.accent : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.segLabel,
                  { color: active ? colors.background : colors.textMuted },
                ]}
                maxFontSizeMultiplier={1.3}
              >
                {t(`suggestion.macrosShort.${id}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {suggestions.length === 0 ? (
        // On dit POURQUOI il n'y a rien plutôt que de laisser une carte vide : sans explication,
        // l'absence de suggestion se lit comme un bug.
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          {t('suggestion.noCandidate')}
        </Text>
      ) : (
        suggestions.map((suggestion, index) => (
          <Pressable
            key={suggestion.foodId}
            onPress={() => add(suggestion)}
            disabled={busyId !== null}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t('suggestion.a11yAdd', {
              grams: suggestion.quantityG,
              name: suggestion.name,
              kcal: suggestion.kcal,
            })}
            style={[
              styles.row,
              index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
            ]}
          >
            <View style={styles.grow}>
              <Text
                style={[styles.name, { color: colors.text }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
              >
                {suggestion.name}
              </Text>
              {/*
                Trois nombres, et les trois comptent : la quantité, son prix calorique (un conseil
                qui cache son prix est partiel) et **ce qu'elle apporte vraiment** du macro visé.
                Ce dernier n'est pas décoratif : depuis que la suggestion est une portion et non
                plus « de quoi combler tout l'écart », l'omettre laisserait croire qu'une portion
                suffit à atteindre la cible du jour.
              */}
              <Text style={[styles.detail, { color: colors.textMuted }]} maxFontSizeMultiplier={1.3}>
                {t('suggestion.quantity', {
                  grams: suggestion.quantityG,
                  kcal: suggestion.kcal,
                  macroG: formatAxisNumber(suggestion.macroG),
                  macro: t(`suggestion.macros.${macro}`),
                })}
              </Text>
            </View>
            <Text style={[styles.add, { color: colors.accent }]} maxFontSizeMultiplier={1.3}>
              {t('suggestion.add')}
            </Text>
          </Pressable>
        ))
      )}

      {error && (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {t('suggestion.addError')}
        </Text>
      )}

      {/* Limite affichée, pas masquée : aucun aliment n'est étiqueté régime/allergène en base. */}
      <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
        {t('suggestion.dietDisclaimer')}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gap: { fontFamily: fontFamily.bodySemi, fontSize: 15, marginTop: 6 },
  segs: { flexDirection: 'row', gap: 6, marginTop: 10, marginBottom: 4 },
  seg: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  segLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, minHeight: 56 },
  grow: { flex: 1, minWidth: 0 },
  name: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  detail: { fontFamily: fontFamily.body, fontSize: 12.5, marginTop: 2 },
  add: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  empty: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, marginTop: 8 },
  error: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginTop: 8 },
  disclaimer: { fontFamily: fontFamily.body, fontSize: 11.5, marginTop: 10, lineHeight: 16 },
});

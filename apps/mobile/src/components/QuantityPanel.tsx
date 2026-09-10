import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  nudgeGrams,
  portionMultiples,
  scaleNutrition,
  type FoodPortion,
  type Micronutrients,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { MicronutrientDetails } from '@/components/MicronutrientDetails';
import { TextField } from '@/components/TextField';
import { getLastQuantityFor } from '@/data/repositories/food-catalog-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Aliment prêt à être quantifié (valeurs pour 100 g + portions rapides). */
export type PickTarget = {
  id: string;
  name: string;
  kcalPer100g: number;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  /** Détail facultatif pour 100 g : sucres / AG saturés / fibres (affichés si présents). */
  sugarsPer100g?: number | null;
  saturatedFatPer100g?: number | null;
  fiberPer100g?: number | null;
  portions: FoodPortion[];
  /** Micronutriments pour 100 g (socle 4.33). Vide = section « Valeurs détaillées » masquée. */
  micronutrients?: Micronutrients;
};

/**
 * Panneau de choix de la quantité (US NUTRI-UX01, R2.4 / R2.5).
 *
 * ── Trois défauts corrigés ───────────────────────────────────────────────────────────────────
 * ① **Les portions écrasaient les grammes.** « 1 banane (120 g) » posait 120, et « j'en ai mangé
 *    deux » imposait un calcul mental puis une saisie au clavier. Elles sont désormais
 *    **multipliables** (½ · 1 · 2) — manger deux unités est le cas courant, pas l'exception.
 * ② **Aucune mémoire de quantité.** Chaque ajout repartait de la portion de référence ou de
 *    100 g, alors que `food_entries.quantity_g` contient l'historique complet. La dernière
 *    quantité utilisée est maintenant lue, proposée, et annoncée comme telle.
 * ③ **Le budget du jour avait disparu.** L'écran affichait les kcal de l'aliment, jamais leur
 *    effet sur la journée — on choisissait donc une quantité à l'aveugle. Le panneau montre
 *    désormais ce qu'il restera après l'ajout.
 */
export function QuantityPanel({
  target,
  onCancel,
  onConfirm,
  kcalRemaining,
  confirmLabel,
}: {
  target: PickTarget;
  onCancel: () => void;
  onConfirm: (grams: number) => void | Promise<void>;
  /** Calories restantes sur la journée, pour la projection. `null` = pas d'objectif défini. */
  kcalRemaining?: number | null;
  /** Libellé du bouton de validation (« Ajouter au déjeuner »). */
  confirmLabel?: string;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const referenceGrams = target.portions[0]?.grams ?? null;
  const [grams, setGrams] = useState(String(referenceGrams ?? 100));
  /** Dernière quantité journalisée pour cet aliment — `undefined` tant qu'on ne sait pas. */
  const [lastQty, setLastQty] = useState<number | null | undefined>(undefined);

  // La dernière quantité prime sur la portion de référence : c'est l'information la plus
  // spécifique dont on dispose sur *cette* personne et *cet* aliment.
  useEffect(() => {
    let active = true;
    void getLastQuantityFor(target.id)
      .then((qty) => {
        if (!active) return;
        setLastQty(qty);
        if (qty != null) setGrams(String(qty));
      })
      // Sans historique lisible, on garde la portion de référence : c'est un confort, pas une
      // condition de fonctionnement.
      .catch(() => setLastQty(null));
    return () => {
      active = false;
    };
  }, [target.id]);

  const g = Number(grams.replace(',', '.')) || 0;
  const scaled = scaleNutrition(target, g);
  const kcal = scaled.kcal;
  const micronutrients = target.micronutrients ?? {};
  const multiples = portionMultiples(referenceGrams);
  const portionLabel = target.portions[0]
    ? lang === 'en'
      ? target.portions[0].labelEn
      : target.portions[0].labelFr
    : null;

  const afterAdd = kcalRemaining != null ? kcalRemaining - kcal : null;

  // Détail facultatif (sucres / AG saturés / fibres) mis à l'échelle, affiché si renseigné.
  const scaleG = (per100: number | null | undefined): number | null =>
    per100 == null ? null : Math.round((per100 * g) / 100);
  const extras = [
    { key: 'sugars', label: t('food.custom.sugars'), value: scaleG(target.sugarsPer100g) },
    { key: 'saturatedFat', label: t('food.custom.saturatedFat'), value: scaleG(target.saturatedFatPer100g) },
    { key: 'fiber', label: t('food.custom.fiber'), value: scaleG(target.fiberPer100g) },
  ].filter((e) => e.value != null);

  return (
    <View style={[styles.panel, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.panelTitle, { color: colors.text }]}>{target.name}</Text>
        <Text style={[styles.per100, { color: colors.textMuted }]}>
          {t('journal.quantity.per100', { kcal: Math.round(target.kcalPer100g) })}
        </Text>

        {/* Stepper : le clavier n'est plus obligatoire pour ajuster de quelques grammes. */}
        <View style={[styles.stepperRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            onPress={() => setGrams(String(nudgeGrams(g, -1)))}
            accessibilityRole="button"
            accessibilityLabel={t('journal.quantity.decrease')}
            style={[styles.stepBtn, { backgroundColor: colors.surfaceAlt }]}
          >
            <Ionicons name="remove" size={24} color={colors.accent} />
          </Pressable>
          <View style={styles.stepValue}>
            <Text style={[styles.gramsValue, { color: colors.text }]}>{Math.round(g)}</Text>
            <Text style={[styles.gramsUnit, { color: colors.textMuted }]}>g</Text>
          </View>
          <Pressable
            onPress={() => setGrams(String(nudgeGrams(g, 1)))}
            accessibilityRole="button"
            accessibilityLabel={t('journal.quantity.increase')}
            style={[styles.stepBtn, { backgroundColor: colors.surfaceAlt }]}
          >
            <Ionicons name="add" size={24} color={colors.accent} />
          </Pressable>
        </View>

        {/* R2.5 — portions MULTIPLIABLES. Le facteur est affiché, pas seulement les grammes :
            « 2 bols » se comprend sans faire la division. */}
        {multiples.length > 0 && portionLabel ? (
          <View style={styles.portions}>
            {multiples.map((m) => {
              const selected = Math.round(g) === m.grams;
              return (
                <Pressable
                  key={m.factor}
                  onPress={() => setGrams(String(m.grams))}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.portion,
                    {
                      backgroundColor: selected ? colors.surfaceAlt : colors.surface,
                      borderColor: selected ? colors.accent : colors.border,
                      borderWidth: selected ? 1.5 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[styles.portionLabel, { color: selected ? colors.accent : colors.text }]}
                  >
                    {t(`journal.quantity.factor.${String(m.factor).replace('.', '_')}`, {
                      portion: portionLabel,
                    })}
                  </Text>
                  <Text
                    style={[styles.portionGrams, { color: selected ? colors.accent : colors.textMuted }]}
                  >
                    {m.grams} g
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* R2.5 — la donnée était en base et n'était jamais lue. */}
        {lastQty != null ? (
          <View style={[styles.lastQty, { backgroundColor: colors.warn, borderColor: colors.warnBorder }]}>
            <Ionicons name="time-outline" size={17} color={colors.warnText} />
            <Text style={[styles.lastQtyLabel, { color: colors.warnText }]}>
              {t('journal.quantity.lastTime', { grams: lastQty })}
            </Text>
          </View>
        ) : null}

        <TextField
          label={t('journal.grams')}
          value={grams}
          onChangeText={setGrams}
          keyboardType="decimal-pad"
        />

        {/* R2.4 — l'effet sur la journée, là où la décision se prend. */}
        <View style={[styles.effect, { backgroundColor: colors.panel }]}>
          <View style={styles.effectHead}>
            <Text style={[styles.effectEyebrow, { color: colors.panelAccent }]}>
              {t('journal.quantity.effect')}
            </Text>
            <Text style={[styles.effectKcal, { color: colors.panelText }]}>
              {kcal} {t('nutrition.kcal')}
            </Text>
          </View>
          {afterAdd != null ? (
            <Text
              style={[
                styles.effectAfter,
                { color: afterAdd >= 0 ? colors.panelMuted : colors.danger },
              ]}
            >
              {afterAdd >= 0
                ? t('journal.quantity.willRemain', { kcal: afterAdd })
                : t('journal.quantity.willExceed', { kcal: Math.abs(afterAdd) })}
            </Text>
          ) : null}
          <View style={styles.effectMacros}>
            {(
              [
                ['protein', scaled.proteinG],
                ['carbs', scaled.carbsG],
                ['fat', scaled.fatG],
              ] as const
            ).map(([key, value]) => (
              <View key={key} style={styles.effectMacro}>
                <Text style={[styles.effectMacroLabel, { color: colors.panelMuted }]}>
                  {t(`nutrition.macros.${key}`)}
                </Text>
                <Text style={[styles.effectMacroValue, { color: colors.panelText }]}>{value} g</Text>
              </View>
            ))}
          </View>
        </View>

        {extras.length > 0 ? (
          <Text style={[styles.extras, { color: colors.textMuted }]}>
            {extras.map((e) => `${e.label} ${e.value} g`).join('  ·  ')}
          </Text>
        ) : null}

        {/* Repliés par défaut : jusqu'à 33 lignes s'ouvraient avant les boutons d'action (E8). */}
        <MicronutrientDetails micronutrients={micronutrients} grams={Math.round(g)} />
      </ScrollView>

      <View style={styles.panelActions}>
        <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
        <Button
          label={confirmLabel ?? t('journal.add')}
          onPress={() => void onConfirm(Math.round(g))}
          disabled={g <= 0}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: 16, gap: 16 },
  content: { gap: 14, paddingBottom: 8 },
  panelTitle: { fontFamily: fontFamily.displayBold, fontSize: 22 },
  per100: { fontFamily: fontFamily.body, fontSize: 12.5, marginTop: -8 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
  },
  stepBtn: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  stepValue: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  gramsValue: { fontFamily: fontFamily.displayXBold, fontSize: 40, letterSpacing: -1.6 },
  gramsUnit: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  portions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  portion: {
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  portionLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  portionGrams: { fontFamily: fontFamily.mono, fontSize: 11.5 },
  lastQty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  lastQtyLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12.5, flex: 1 },
  effect: { borderRadius: 20, padding: 16, gap: 10 },
  effectHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  effectEyebrow: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 0.8 },
  effectKcal: { fontFamily: fontFamily.monoBold, fontSize: 20 },
  effectAfter: { fontFamily: fontFamily.body, fontSize: 12.5 },
  effectMacros: { flexDirection: 'row', gap: 10, marginTop: 2 },
  effectMacro: { flex: 1 },
  effectMacroLabel: { fontFamily: fontFamily.body, fontSize: 11.5 },
  effectMacroValue: { fontFamily: fontFamily.monoBold, fontSize: 14 },
  extras: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  panelActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
});

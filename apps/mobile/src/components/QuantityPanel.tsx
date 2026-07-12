import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { scaleNutrition, type FoodPortion, type Micronutrients } from '@wellness/shared';
import { Button } from '@/components/Button';
import { MicronutrientDetails } from '@/components/MicronutrientDetails';
import { TextField } from '@/components/TextField';
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
 * Panneau de choix de la quantité (en grammes) d'un aliment, avec aperçu des kcal en
 * direct et raccourcis de portions. Partagé par le food-picker et l'écran de scan.
 */
export function QuantityPanel({
  target,
  onCancel,
  onConfirm,
}: {
  target: PickTarget;
  onCancel: () => void;
  onConfirm: (grams: number) => void | Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const [grams, setGrams] = useState(String(target.portions[0]?.grams ?? 100));
  const g = Number(grams.replace(',', '.')) || 0;
  const kcal = scaleNutrition(target, g).kcal;
  const micronutrients = target.micronutrients ?? {};

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
        {extras.length > 0 ? (
          <Text style={[styles.extras, { color: colors.textMuted }]}>
            {extras.map((e) => `${e.label} ${e.value} g`).join('  ·  ')}
          </Text>
        ) : null}
        <MicronutrientDetails micronutrients={micronutrients} grams={Math.round(g)} />
      </ScrollView>
      <View style={styles.panelActions}>
        <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
        <Button label={t('journal.add')} onPress={() => void onConfirm(Math.round(g))} disabled={g <= 0} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: 16, gap: 16 },
  content: { gap: 16, paddingBottom: 8 },
  panelTitle: { fontFamily: fontFamily.displayBold, fontSize: 22 },
  panelKcal: { fontFamily: fontFamily.monoBold, fontSize: 20 },
  extras: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  portions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  portion: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  portionLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  panelActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
});

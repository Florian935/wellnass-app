/**
 * Hydratation du jour (US NUTRI-UX01, R5.2 — catalogue NUTR-12).
 *
 * Le seul geste du pilier qui coûte **un tap** : pas de recherche, pas de pesée, pas de calcul.
 * C'est pour cette raison qu'il a été rouvert en V1 contre la spec §8 — le rapport valeur/coût
 * est le meilleur du pilier, et c'est un motif de retour quotidien.
 *
 * Le dépassement n'est **pas** traité comme une faute : la grille se remplit, l'anneau se
 * complète, rien ne vire au rouge — cohérent avec le traitement du dépassement calorique.
 */

import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  DEFAULT_GLASS_ML,
  DEFAULT_WATER_TARGET_ML,
  hydrationProgress,
  millilitresToLitres,
} from '@wellness/shared';
import { addWater, removeLastWater, useDayWater } from '@/data/repositories/water-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Formate un volume en litres selon la langue (virgule décimale en français). */
function formatLitres(ml: number, language: string): string {
  return new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'fr-FR', {
    maximumFractionDigits: 1,
  }).format(millilitresToLitres(ml));
}

export function HydrationCard({ day }: { day: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { totalMl } = useDayWater(day);
  const { nutritionProfile } = useNutritionProfile();

  const glassMl = nutritionProfile?.glassSizeMl ?? DEFAULT_GLASS_ML;
  const targetMl = nutritionProfile?.waterTargetMl ?? DEFAULT_WATER_TARGET_ML;
  const progress = hydrationProgress(totalMl, targetMl, glassMl);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <Ionicons name="water-outline" size={17} color={colors.accent} />
          <Text style={[styles.title, { color: colors.text }]}>{t('hydration.title')}</Text>
        </View>
        <Text style={[styles.total, { color: progress.reached ? colors.success : colors.textMuted }]}>
          {t('hydration.amount', {
            current: formatLitres(progress.totalMl, i18n.language),
            target: formatLitres(progress.targetMl, i18n.language),
          })}
        </Text>
      </View>

      <View style={styles.row}>
        {/* La grille de verres EST la barre de progression : un verre = un geste, et l'on voit
            du premier coup d'œil combien il en reste. */}
        <View
          style={styles.glasses}
          accessible
          accessibilityLabel={t('hydration.a11y', {
            glasses: progress.glasses,
            target: progress.targetGlasses,
          })}
        >
          {Array.from({ length: Math.max(progress.targetGlasses, progress.glasses) }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.glass,
                i < progress.glasses
                  ? { backgroundColor: colors.accent }
                  : { backgroundColor: colors.track, borderColor: colors.border, borderWidth: 1 },
              ]}
            />
          ))}
        </View>

        {progress.glasses > 0 ? (
          <Pressable
            onPress={() => void removeLastWater(day)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('hydration.undo')}
            style={[styles.undoBtn, { borderColor: colors.border }]}
          >
            <Ionicons name="arrow-undo-outline" size={17} color={colors.textMuted} />
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => void addWater(day, glassMl)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('hydration.add', { ml: glassMl })}
          style={[styles.addBtn, { backgroundColor: colors.surfaceAlt }]}
        >
          <Ionicons name="add" size={22} color={colors.accent} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16, gap: 11 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  total: { fontFamily: fontFamily.monoBold, fontSize: 12.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  glasses: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  glass: { flexGrow: 1, flexBasis: 18, height: 26, borderRadius: 7 },
  undoBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});

/**
 * L'onglet Progrès du hub Nutrition — US NUTRI-UX03, D12.
 *
 * C'est « La semaine » de NUTRI-UX02, renommée pour que les piliers parlent la même langue (D1) et
 * **inchangée** : le verdict en tête (R3.4), puis les cartes remontées de Stats sans être réécrites
 * (R3.3), la fenêtre de 7 jours imposée aux protéines (R21), et le lien vers toutes les statistiques.
 * Le tableau 8 semaines (`TrainingNutritionCrossCard`) reste hors de l'onglet (R24).
 *
 * Un compte sans aucun repas noté **ni aucune pesée** voit un seul message : six cartes muettes ne
 * disent rien. Une pesée suffit à montrer les cartes — l'objectif de poids a alors de quoi parler.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ProteinPerKgCard } from '@/components/ProteinPerKgCard';
import { WeightGoalCard } from '@/components/WeightGoalCard';
import { RegularityCard } from '@/components/nutrition/RegularityCard';
import { WeekVerdictCard } from '@/components/nutrition/WeekVerdictCard';
import { useLatestWeight } from '@/data/repositories/bodyweight-repository';
import { useFirstLogDate } from '@/data/repositories/journal-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  targetKcal: number | null;
  onStats: () => void;
  onStart: () => void;
};

export function ProgressSection({ targetKcal, onStats, onStart }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { first, isLoading } = useFirstLogDate();
  const { latest, isLoading: weightLoading } = useLatestWeight();

  if (isLoading || weightLoading) return null;

  if (first == null && latest == null) {
    return (
      <View
        testID="nutrition-progress-empty"
        style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('nutritionHub.progressEmpty.title')}</Text>
        <Text style={[styles.emptyBody, { color: colors.textMuted }]}>{t('nutritionHub.progressEmpty.body')}</Text>
        <Pressable
          onPress={onStart}
          accessibilityRole="button"
          style={[styles.emptyCta, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.emptyCtaLabel, { color: colors.accentText }]}>{t('nutritionHub.progressEmpty.cta')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <WeekVerdictCard />
      <ProteinPerKgCard window="7d" />
      <WeightGoalCard />
      <RegularityCard targetKcal={targetKcal} windowDays={7} />
      <Pressable onPress={onStats} style={styles.link} accessibilityRole="button">
        <Ionicons name="stats-chart-outline" size={16} color={colors.textMuted} />
        <Text style={[styles.linkLabel, { color: colors.textMuted }]}>{t('nutrition.week.allStats')}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  empty: { borderRadius: 20, borderWidth: 1, paddingVertical: 30, paddingHorizontal: 22, alignItems: 'center', gap: 8 },
  emptyTitle: { fontFamily: fontFamily.displayBold, fontSize: 18, textAlign: 'center' },
  emptyBody: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 20, textAlign: 'center', maxWidth: 280, marginBottom: 8 },
  emptyCta: { alignSelf: 'stretch', minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  emptyCtaLabel: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 },
  linkLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  computeAge,
  defaultMacroRatios,
  macroGramsFromCalories,
  objectiveFromGoal,
  targetCalories,
  tdee,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useProfile } from '@/data/repositories/profile-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function NutritionScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { profile } = useProfile();
  const { nutritionProfile } = useNutritionProfile();

  const objective = nutritionProfile?.objective ?? objectiveFromGoal(profile?.mainGoal ?? null);
  const activityLevel = nutritionProfile?.activityLevel ?? 'moderate';
  const age = profile?.birthDate ? computeAge(new Date(profile.birthDate)) : null;
  const tdeeValue = tdee({
    sex: profile?.sex ?? 'unspecified',
    weightKg: profile?.weightKg ?? undefined,
    heightCm: profile?.heightCm ?? undefined,
    age: age ?? undefined,
    activityLevel,
  });
  const target =
    tdeeValue != null
      ? targetCalories(tdeeValue, objective, nutritionProfile?.manualCalories ?? null)
      : null;

  const manualSet =
    nutritionProfile?.manualProteinG != null ||
    nutritionProfile?.manualCarbsG != null ||
    nutritionProfile?.manualFatG != null;
  const grams = manualSet
    ? {
        protein: nutritionProfile?.manualProteinG ?? 0,
        carbs: nutritionProfile?.manualCarbsG ?? 0,
        fat: nutritionProfile?.manualFatG ?? 0,
      }
    : target != null
      ? macroGramsFromCalories(target, defaultMacroRatios(objective))
      : null;

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('pillars.nutrition')} subtitle={t('pillarScreens.nutrition.tagline')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {target != null && grams != null ? (
          <Card>
            <View style={styles.targetRow}>
              <Text style={[styles.targetValue, { color: colors.text }]}>{target}</Text>
              <Text style={[styles.targetUnit, { color: colors.textMuted }]}>
                {t('nutrition.kcal')} · {t('nutrition.calories.targetShort')}
              </Text>
            </View>
            <View style={styles.macros}>
              {(['protein', 'carbs', 'fat'] as const).map((key) => (
                <View key={key} style={styles.macro}>
                  <Text style={[styles.macroValue, { color: colors.text }]}>{grams[key]} g</Text>
                  <Text style={[styles.macroLabel, { color: colors.textMuted }]}>
                    {t(`nutrition.macros.${key}`)}
                  </Text>
                </View>
              ))}
            </View>
            <Button
              label={t('nutrition.editProfile')}
              variant="ghost"
              onPress={() => router.push('/nutrition-profile')}
            />
          </Card>
        ) : (
          <Card>
            <Text style={[styles.setupText, { color: colors.text }]}>{t('nutrition.setupPrompt')}</Text>
            <Button label={t('nutrition.setupCta')} onPress={() => router.push('/nutrition-profile')} />
          </Card>
        )}

        <EmptyState
          icon="nutrition-outline"
          title={t('pillarScreens.nutrition.emptyTitle')}
          message={t('pillarScreens.nutrition.emptyMessage')}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 24 },
  targetRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  targetValue: { fontFamily: fontFamily.displayBold, fontSize: 40 },
  targetUnit: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  macros: { flexDirection: 'row', justifyContent: 'space-between' },
  macro: { alignItems: 'center', flex: 1 },
  macroValue: { fontFamily: fontFamily.monoBold, fontSize: 18 },
  macroLabel: { fontFamily: fontFamily.body, fontSize: 13, marginTop: 2 },
  setupText: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 21 },
});

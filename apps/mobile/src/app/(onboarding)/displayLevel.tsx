import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  WORKOUT_DISPLAY_LEVELS,
  resolveActivePillars,
  type WorkoutDisplayLevel,
} from '@wellness/shared';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { useSettings } from '@/data/repositories/settings-repository';
import { WorkoutLevelPreview } from '@/components/workout/WorkoutLevelPreview';
import { upsertProfile } from '@/data/repositories/profile-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Étape suivante — variable depuis l'US NUTRI-UX01 (R1.2).
 *
 * Le niveau d'activité ne concerne que le calcul du TDEE : le demander à quelqu'un qui n'a pas
 * activé la nutrition serait imposer une question sans objet (décision H). L'étape s'intercale
 * donc ici, en dernière position, pour que le numéro des étapes précédentes ne bouge pas.
 */
const NEXT_WITH_NUTRITION = '/(onboarding)/activity';
const NEXT_WITHOUT_NUTRITION = '/(onboarding)/summary';

export default function OnboardingDisplayLevel() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [level, setLevel] = useState<WorkoutDisplayLevel | null>(null);
  const { settings } = useSettings();
  // Tant que les réglages ne sont pas chargés, `resolveActivePillars` suppose tout actif — on
  // pose donc la question par défaut plutôt que de la sauter par accident.
  const nutritionActive = resolveActivePillars(settings?.activePillars).includes('nutrition');
  const next = nutritionActive ? NEXT_WITH_NUTRITION : NEXT_WITHOUT_NUTRITION;

  const onContinue = async () => {
    if (level) await upsertProfile({ workoutDisplayLevel: level });
    router.push(next);
  };

  return (
    <OnboardingScaffold
      step={4}
      title={t('onboarding.displayLevel.title')}
      subtitle={t('onboarding.displayLevel.subtitle')}
      onSkip={() => router.push(next)}
      onContinue={onContinue}
    >
      <View style={styles.list}>
        {WORKOUT_DISPLAY_LEVELS.map((option) => {
          const selected = level === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setLevel(option)}
              style={[
                styles.option,
                {
                  backgroundColor: colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}
            >
              <View style={styles.optionHeader}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.optionLabel, { color: colors.text }]}>
                    {t(`workout.displayLevel.levels.${option}.label`)}
                  </Text>
                  <Text style={[styles.optionHint, { color: colors.textMuted }]}>
                    {t(`workout.displayLevel.levels.${option}.description`)}
                  </Text>
                </View>
                {selected ? (
                  <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                ) : (
                  <View style={[styles.dot, { borderColor: colors.border, borderWidth: 1.5 }]} />
                )}
              </View>
              <WorkoutLevelPreview level={option} colors={colors} />
            </Pressable>
          );
        })}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  option: {
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  optionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  optionLabel: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  optionHint: { fontFamily: fontFamily.body, fontSize: 13 },
  dot: { width: 20, height: 20, borderRadius: 10 },
});

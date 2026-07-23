import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WORKOUT_DISPLAY_LEVELS, type WorkoutDisplayLevel } from '@wellness/shared';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { WorkoutLevelPreview } from '@/components/workout/WorkoutLevelPreview';
import { upsertProfile } from '@/data/repositories/profile-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const NEXT = '/(onboarding)/summary';

export default function OnboardingDisplayLevel() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [level, setLevel] = useState<WorkoutDisplayLevel | null>(null);

  const onContinue = async () => {
    if (level) await upsertProfile({ workoutDisplayLevel: level });
    router.push(NEXT);
  };

  return (
    <OnboardingScaffold
      step={4}
      title={t('onboarding.displayLevel.title')}
      subtitle={t('onboarding.displayLevel.subtitle')}
      onSkip={() => router.push(NEXT)}
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

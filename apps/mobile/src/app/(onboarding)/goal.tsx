import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GOALS, type Goal } from '@wellness/shared';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { upsertProfile } from '@/data/repositories/profile-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const NEXT = '/(onboarding)/summary';

export default function OnboardingGoal() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [goal, setGoal] = useState<Goal | null>(null);

  const onContinue = async () => {
    await upsertProfile({ mainGoal: goal });
    router.push(NEXT);
  };

  return (
    <OnboardingScaffold
      step={3}
      title={t('onboarding.goal.title')}
      subtitle={t('onboarding.goal.subtitle')}
      onSkip={() => router.push(NEXT)}
      onContinue={onContinue}
    >
      <View style={styles.list}>
        {GOALS.map((option) => {
          const selected = goal === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setGoal(option)}
              style={[
                styles.option,
                {
                  backgroundColor: colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={[styles.optionLabel, { color: colors.text }]}>
                {t(`onboarding.goal.options.${option}`)}
              </Text>
              {selected ? (
                <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              ) : (
                <View style={[styles.dot, { borderColor: colors.border, borderWidth: 1.5 }]} />
              )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  optionLabel: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  dot: { width: 20, height: 20, borderRadius: 10 },
});

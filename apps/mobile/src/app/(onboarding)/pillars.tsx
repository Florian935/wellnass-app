import { useRouter } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PILLARS, type Pillar } from '@wellness/shared';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { useSettingsStore } from '@/stores/settings-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const NEXT = '/(onboarding)/goal';

export default function OnboardingPillars() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const activePillars = useSettingsStore((s) => s.activePillars);
  const togglePillar = useSettingsStore((s) => s.togglePillar);

  return (
    <OnboardingScaffold
      step={2}
      title={t('onboarding.pillars.title')}
      subtitle={t('onboarding.pillars.subtitle')}
      onSkip={() => router.push(NEXT)}
      onContinue={() => router.push(NEXT)}
    >
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {PILLARS.map((pillar: Pillar, i) => (
          <View
            key={pillar}
            style={[
              styles.row,
              i < PILLARS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <Text style={[styles.label, { color: colors.text }]}>{t(`pillars.${pillar}`)}</Text>
            <Switch
              value={activePillars.includes(pillar)}
              onValueChange={() => togglePillar(pillar)}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor="#ffffff"
              accessibilityLabel={t(`pillars.${pillar}`)}
            />
          </View>
        ))}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
});

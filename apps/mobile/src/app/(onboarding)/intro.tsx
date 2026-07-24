import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { completeOnboarding } from '@/data/repositories/profile-repository';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function OnboardingIntro() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  // Entrée dans l'onboarding : émis une seule fois au montage de l'écran d'intro.
  useEffect(() => {
    void track(ANALYTICS_EVENTS.onboardingStarted);
  }, []);

  const skipAll = async () => {
    void track(ANALYTICS_EVENTS.onboardingSkipped);
    await completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <FormScreen>
      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.text }]}>{t('onboarding.intro.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t('onboarding.intro.subtitle')}
        </Text>
      </View>
      <Button label={t('onboarding.intro.start')} onPress={() => router.push('/(onboarding)/infos')} />
      <Button label={t('onboarding.skipAll')} variant="ghost" onPress={skipAll} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  title: {
    fontFamily: fontFamily.displayXBold,
    fontSize: 30,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  subtitle: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 23, textAlign: 'center' },
});

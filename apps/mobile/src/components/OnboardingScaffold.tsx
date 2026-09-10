import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { completeOnboarding } from '@/data/repositories/profile-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Nombre d'étapes du parcours **de base**.
 *
 * Il est variable depuis l'US NUTRI-UX01 : l'étape « niveau d'activité » ne s'affiche que si le
 * pilier nutrition est actif (décision H — ne rien imposer à qui ne suit pas son alimentation).
 * Le total est donc passé par l'appelant quand il diffère.
 */
const DEFAULT_TOTAL_STEPS = 4;

type OnboardingScaffoldProps = {
  step: number;
  /** Total affiché dans le badge « étape N sur M ». Défaut : le parcours de base. */
  total?: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onSkip: () => void;
  onContinue: () => void;
};

/** Étape d'onboarding : badge de progression, lien « Passer tout », contenu, Passer / Continuer. */
export function OnboardingScaffold({
  step,
  total = DEFAULT_TOTAL_STEPS,
  title,
  subtitle,
  children,
  onSkip,
  onContinue,
}: OnboardingScaffoldProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const skipAll = async () => {
    await completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <FormScreen>
      <View style={styles.topRow}>
        <Text style={[styles.stepBadge, { color: colors.textMuted }]}>
          {t('onboarding.step', { current: step, total })}
        </Text>
        <Pressable accessibilityRole="button" onPress={skipAll} hitSlop={8}>
          <Text style={[styles.skipAll, { color: colors.accent }]}>{t('onboarding.skipAll')}</Text>
        </Pressable>
      </View>

      <ScreenHeader title={title} subtitle={subtitle} />

      <View style={styles.content}>{children}</View>

      <View style={styles.footer}>
        <View style={styles.footerButton}>
          <Button label={t('onboarding.skip')} variant="ghost" onPress={onSkip} />
        </View>
        <View style={styles.footerButton}>
          <Button label={t('onboarding.continue')} onPress={onContinue} />
        </View>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBadge: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  skipAll: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  content: { gap: 16 },
  footer: { flexDirection: 'row', gap: 12, marginTop: 'auto' },
  footerButton: { flex: 1 },
});

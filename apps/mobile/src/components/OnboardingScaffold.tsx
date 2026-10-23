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
  /**
   * US CARDIO-02 — l'accueil du pilier Course réutilise ce cadre. Défauts : le parcours d'onboarding
   * de l'app (« Passer tout » le termine et ouvre les onglets, « Étape N/M », « Passer », « Continuer »).
   */
  onSkipAll?: () => void;
  stepLabel?: string;
  skipAllLabel?: string;
  skipLabel?: string;
  continueLabel?: string;
  /** US CARDIO-02 (§3.3) — une barre de progression d'un trait par étape, au-dessus du badge. */
  showProgressBar?: boolean;
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
  onSkipAll,
  stepLabel,
  skipAllLabel,
  skipLabel,
  continueLabel,
  showProgressBar = false,
}: OnboardingScaffoldProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const skipAll = async () => {
    if (onSkipAll) {
      onSkipAll();
      return;
    }
    await completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <FormScreen>
      {showProgressBar ? (
        // Décorative : le badge dit déjà « question N sur M » au lecteur d'écran.
        <View
          testID="onboarding-progress"
          style={styles.progress}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: total }, (_, i) => (
            <View
              key={i}
              style={[styles.progressStep, { backgroundColor: i < step ? colors.accent : colors.border }]}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.topRow}>
        <Text style={[styles.stepBadge, { color: colors.textMuted }]}>
          {stepLabel ?? t('onboarding.step', { current: step, total })}
        </Text>
        <Pressable accessibilityRole="button" onPress={skipAll} hitSlop={8} style={styles.skipAllButton}>
          <Text style={[styles.skipAll, { color: colors.accent }]}>{skipAllLabel ?? t('onboarding.skipAll')}</Text>
        </Pressable>
      </View>

      <ScreenHeader title={title} subtitle={subtitle} />

      <View style={styles.content}>{children}</View>

      <View style={styles.footer}>
        <View style={styles.footerButton}>
          <Button label={skipLabel ?? t('onboarding.skip')} variant="ghost" onPress={onSkip} />
        </View>
        <View style={styles.footerButton}>
          <Button label={continueLabel ?? t('onboarding.continue')} onPress={onContinue} />
        </View>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBadge: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  skipAll: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  // Une cible de 44 px au moins (CONF-07) : le texte seul et son `hitSlop` n'en faisaient que ~36.
  skipAllButton: { minHeight: 44, justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: 6 },
  progressStep: { flex: 1, height: 4, borderRadius: 2 },
  content: { gap: 16 },
  footer: { flexDirection: 'row', gap: 12, marginTop: 'auto' },
  footerButton: { flex: 1 },
});

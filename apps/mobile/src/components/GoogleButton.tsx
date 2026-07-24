import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Link } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type GoogleButtonProps = {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

/**
 * Logo « G » officiel Google — 4 chemins colorés (viewBox 48×48), rendu inline
 * pour respecter les guidelines (le logo doit rester intact, non recoloré).
 */
function GoogleLogo() {
  return (
    <Svg
      width={20}
      height={20}
      viewBox="0 0 48 48"
      importantForAccessibility="no"
      accessibilityElementsHidden
    >
      <Path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <Path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <Path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <Path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Svg>
  );
}

/**
 * Bouton « Continuer avec Google » réutilisable (sign-in / sign-up).
 *
 * Conforme aux guidelines Google : fond blanc, logo « G » intact, libellé lisible
 * (issu de l'i18n, `auth.google.button`). Gère l'état `loading` (spinner + désactivé).
 *
 * La **mention de consentement** (CGU + politique de confidentialité, âge 16+) est
 * rendue **sous** le bouton, avec des liens cliquables vers `/(auth)/terms` et
 * `/(auth)/privacy` (mêmes cibles que le bloc de `sign-up.tsx`).
 */
export function GoogleButton({ onPress, loading = false, disabled = false }: GoogleButtonProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('auth.google.button')}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: '#ffffff', borderColor: '#dadce0' },
          (pressed || isDisabled) && { opacity: isDisabled ? 0.5 : 0.85 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#3c4043" />
        ) : (
          <View style={styles.content}>
            <GoogleLogo />
            <Text numberOfLines={1} style={styles.label}>
              {t('auth.google.button')}
            </Text>
          </View>
        )}
      </Pressable>

      <Text style={[styles.consentText, { color: colors.textMuted }]}>
        {t('auth.google.consent.prefix')}
        <Link href="/(auth)/terms" style={[styles.link, { color: colors.accent }]}>
          {t('auth.google.consent.terms')}
        </Link>
        {t('auth.google.consent.middle')}
        <Link href="/(auth)/privacy" style={[styles.link, { color: colors.accent }]}>
          {t('auth.google.consent.privacy')}
        </Link>
        {t('auth.google.consent.suffix')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Libellé sur fond blanc imposé (guidelines Google) → couleur figée, indépendante du thème.
  label: { fontFamily: fontFamily.bodyBold, fontSize: 16, color: '#3c4043' },
  consentText: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, marginTop: 12 },
  link: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});

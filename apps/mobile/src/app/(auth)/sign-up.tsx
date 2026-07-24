import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  MIN_PASSWORD_LENGTH,
  MIN_SIGNUP_AGE,
  isAtLeast,
  toDate,
  validatePasswordPair,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { FormScreen } from '@/components/FormScreen';
import { GoogleButton } from '@/components/GoogleButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { useAuthStore } from '@/stores/auth-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const signUp = useAuthStore((s) => s.signUp);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const onGooglePress = async () => {
    setError(null);
    setGoogleLoading(true);
    const res = await signInWithGoogle();
    setGoogleLoading(false);
    // Contrat Task 3 : res.error est une clé i18n (ou null si annulation/succès).
    if (res.error) setError(t(res.error));
    // Succès → onAuthStateChange redirige (comme l'e-mail).
  };

  const onSubmit = async () => {
    setError(null);
    // Règle mutualisée avec la réinitialisation (CONF-08) — mêmes messages, même ordre qu'avant.
    const pwdError = validatePasswordPair(password, confirm);
    if (pwdError === 'too-short') {
      setError(t('auth.signUp.passwordTooShort', { count: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (pwdError === 'mismatch') {
      setError(t('auth.signUp.passwordMismatch'));
      return;
    }
    const birthDate = toDate(Number(day), Number(month), Number(year));
    if (!birthDate) {
      setError(t('auth.signUp.invalidBirthDate'));
      return;
    }
    if (!isAtLeast(birthDate, MIN_SIGNUP_AGE)) {
      setError(t('auth.signUp.tooYoung', { count: MIN_SIGNUP_AGE }));
      return;
    }
    if (!consent) {
      setError(t('auth.signUp.consentRequired'));
      return;
    }
    setLoading(true);
    const result = await signUp(email.trim(), password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsVerification) {
      router.replace({ pathname: '/(auth)/verify-email', params: { email: email.trim() } });
    }
  };

  return (
    <FormScreen>
      <ScreenHeader title={t('auth.signUp.title')} subtitle={t('auth.signUp.subtitle')} />

      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label={t('auth.signUp.confirmPassword')}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />

      {/* Date de naissance — contrôle d'âge RGPD (16+) */}
      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>
        {t('auth.signUp.birthDate')}
      </Text>
      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <TextField
            label={t('auth.signUp.day')}
            value={day}
            onChangeText={setDay}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="JJ"
          />
        </View>
        <View style={styles.dateField}>
          <TextField
            label={t('auth.signUp.month')}
            value={month}
            onChangeText={setMonth}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="MM"
          />
        </View>
        <View style={[styles.dateField, styles.yearField]}>
          <TextField
            label={t('auth.signUp.year')}
            value={year}
            onChangeText={setYear}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="AAAA"
          />
        </View>
      </View>

      {/* Consentement CGU + confidentialité */}
      <Checkbox
        checked={consent}
        onToggle={() => setConsent((v) => !v)}
        accessibilityLabel={t('auth.signUp.consent.accessibility')}
      >
        <Text style={[styles.consentText, { color: colors.textMuted }]}>
          {t('auth.signUp.consent.prefix')}
          <Link href="/(auth)/terms" style={[styles.link, { color: colors.accent }]}>
            {t('auth.signUp.consent.terms')}
          </Link>
          {t('auth.signUp.consent.middle')}
          <Link href="/(auth)/privacy" style={[styles.link, { color: colors.accent }]}>
            {t('auth.signUp.consent.privacy')}
          </Link>
          {t('auth.signUp.consent.suffix')}
        </Text>
      </Checkbox>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <Button label={t('auth.signUp.cta')} onPress={onSubmit} loading={loading} />

      <View style={styles.separator}>
        <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.separatorText, { color: colors.textMuted }]}>
          {t('auth.google.orSeparator')}
        </Text>
        <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
      </View>

      <GoogleButton loading={googleLoading} onPress={onGooglePress} />

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          {t('auth.signUp.hasAccount')}{' '}
        </Text>
        <Link href="/(auth)/sign-in" style={[styles.link, { color: colors.accent }]}>
          {t('auth.signUp.signInLink')}
        </Link>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  error: { fontFamily: fontFamily.bodyMedium, fontSize: 14 },
  groupLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginBottom: -8 },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateField: { flex: 1 },
  yearField: { flex: 1.4 },
  consentText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  separatorLine: { flex: 1, height: StyleSheet.hairlineWidth },
  separatorText: { fontFamily: fontFamily.bodyMedium, fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 'auto' },
  footerText: { fontFamily: fontFamily.body, fontSize: 14 },
});

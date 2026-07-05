import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { useAuthStore } from '@/stores/auth-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const MIN_PASSWORD_LENGTH = 8;

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const signUp = useAuthStore((s) => s.signUp);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('auth.signUp.passwordTooShort', { count: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.signUp.passwordMismatch'));
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
    // Sinon (confirmation désactivée) : session ouverte → redirection par le layout racine.
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

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <Button label={t('auth.signUp.cta')} onPress={onSubmit} loading={loading} />

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
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 'auto' },
  footerText: { fontFamily: fontFamily.body, fontSize: 14 },
});

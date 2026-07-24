import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { GoogleButton } from '@/components/GoogleButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { useAuthStore } from '@/stores/auth-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function SignInScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const signIn = useAuthStore((s) => s.signIn);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    const result = await signIn(email.trim(), password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    }
    // Succès → onAuthStateChange met à jour la session, le layout racine redirige.
  };

  const onGooglePress = async () => {
    setError(null);
    setGoogleLoading(true);
    const res = await signInWithGoogle();
    setGoogleLoading(false);
    // Contrat Task 3 : res.error est une clé i18n (ou null si annulation/succès).
    if (res.error) setError(t(res.error));
    // Succès → onAuthStateChange redirige (comme l'e-mail).
  };

  return (
    <FormScreen>
      <ScreenHeader title={t('auth.signIn.title')} subtitle={t('auth.signIn.subtitle')} />

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
        autoComplete="current-password"
        textContentType="password"
      />

      <Link href="/(auth)/forgot-password" style={[styles.link, { color: colors.accent }]}>
        {t('auth.signIn.forgot')}
      </Link>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <Button label={t('auth.signIn.cta')} onPress={onSubmit} loading={loading} />

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
          {t('auth.signIn.noAccount')}{' '}
        </Text>
        <Link href="/(auth)/sign-up" style={[styles.link, { color: colors.accent }]}>
          {t('auth.signIn.signUpLink')}
        </Link>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  error: { fontFamily: fontFamily.bodyMedium, fontSize: 14 },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  separatorLine: { flex: 1, height: StyleSheet.hairlineWidth },
  separatorText: { fontFamily: fontFamily.bodyMedium, fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 'auto' },
  footerText: { fontFamily: fontFamily.body, fontSize: 14 },
});

import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { useAuthStore } from '@/stores/auth-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const resetPassword = useAuthStore((s) => s.resetPassword);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    const result = await resetPassword(email.trim());
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  };

  return (
    <FormScreen>
      <ScreenHeader title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')} />

      {sent ? (
        <Text style={[styles.success, { color: colors.success }]}>
          {t('auth.forgot.sent', { email: email.trim() })}
        </Text>
      ) : (
        <>
          <TextField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          <Button label={t('auth.forgot.cta')} onPress={onSubmit} loading={loading} />
        </>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: fontFamily.bodyMedium, fontSize: 14 },
  success: { fontFamily: fontFamily.bodyMedium, fontSize: 15, lineHeight: 21 },
});

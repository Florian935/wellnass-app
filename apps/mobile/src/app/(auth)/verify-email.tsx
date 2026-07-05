import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();

  return (
    <FormScreen>
      <View style={styles.center}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="mail-outline" size={34} color={colors.accent} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{t('auth.verify.title')}</Text>
        <Text style={[styles.message, { color: colors.textMuted }]}>
          {t('auth.verify.message', { email: email ?? '' })}
        </Text>
      </View>
      <Button label={t('auth.verify.cta')} onPress={() => router.replace('/(auth)/sign-in')} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fontFamily.displayBold, fontSize: 22, letterSpacing: -0.4, textAlign: 'center' },
  message: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 320,
  },
});

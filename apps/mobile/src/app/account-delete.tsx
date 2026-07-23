import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuthStore } from '@/stores/auth-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Formate une date ISO en JJ/MM/AAAA (convention du projet, cf. history/index.tsx). */
function formatDateFr(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const GRACE_PERIOD_DAYS = 30;

/** Écran modal de suppression de compte (US CONF-02) : avertissement, ré-auth, confirmation. */
export default function AccountDeleteScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Échéance prévisionnelle affichée avant confirmation (le délai de grâce est fixe,
  // la date réelle est renvoyée par le serveur une fois la suppression programmée).
  const previewDate = new Date();
  previewDate.setDate(previewDate.getDate() + GRACE_PERIOD_DAYS);

  const onConfirm = async () => {
    if (!password) return;
    setError(null);
    setLoading(true);

    const { error: reauthError } = await useAuthStore.getState().reauthenticate(password);
    if (reauthError) {
      setLoading(false);
      setError(t('account.delete.errorWrongPassword'));
      return;
    }

    const { error: deletionError, scheduledAt } = await useAuthStore.getState().requestAccountDeletion();
    if (deletionError) {
      setLoading(false);
      setError(deletionError);
      return;
    }

    // La session vient d'être fermée (requestAccountDeletion → signOut) : le routage racine
    // va rediriger vers l'écran de connexion. On affiche l'échéance via une alerte native,
    // qui reste visible pendant la transition de navigation.
    const formattedDate = scheduledAt ? formatDateFr(scheduledAt) : formatDateFr(previewDate);
    Alert.alert(t('account.delete.scheduledTitle'), t('account.delete.scheduledBody', { date: formattedDate }));
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={[
          styles.warn,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.danger },
        ]}
      >
        <Text style={[styles.warnText, { color: colors.text }]}>
          <Text style={[styles.warnBold, { color: colors.danger }]}>{t('account.delete.warning')}</Text>
        </Text>
        <Text style={[styles.whatDeletedTitle, { color: colors.textMuted }]}>
          {t('account.delete.whatDeletedTitle')}
        </Text>
        <View style={styles.list}>
          <Text style={[styles.listItem, { color: colors.text }]}>• {t('account.delete.item1')}</Text>
          <Text style={[styles.listItem, { color: colors.text }]}>• {t('account.delete.item2')}</Text>
          <Text style={[styles.listItem, { color: colors.text }]}>• {t('account.delete.item3')}</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Text style={[styles.cardText, { color: colors.text }]}>
          {t('account.delete.graceInfo', { date: formatDateFr(previewDate) })}
        </Text>
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('account.delete.exportHint')}</Text>

      <TextField
        label={t('account.delete.passwordLabel')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        editable={!loading}
      />

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button
          label={t('account.delete.confirm')}
          variant="destructive"
          onPress={() => void onConfirm()}
          loading={loading}
          disabled={!password}
        />
        <Button
          label={t('account.delete.cancel')}
          variant="ghost"
          onPress={() => router.back()}
          disabled={loading}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, flexGrow: 1 },
  warn: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  warnText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  warnBold: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  whatDeletedTitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  list: { gap: 3 },
  listItem: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  cardText: { fontFamily: fontFamily.bodyMedium, fontSize: 14, lineHeight: 20 },
  hint: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },
  error: { fontFamily: fontFamily.bodyMedium, fontSize: 14 },
  actions: { gap: 10, marginTop: 'auto', paddingTop: 12 },
});

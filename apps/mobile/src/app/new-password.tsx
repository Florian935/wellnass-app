import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MIN_PASSWORD_LENGTH, validatePasswordPair } from '@wellness/shared';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { useAuthStore } from '@/stores/auth-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Reconnaît un échec réseau pour afficher un message actionnable plutôt que le brut de Supabase. */
function isNetworkError(message: string): boolean {
  return /network|fetch|timeout|offline/i.test(message);
}

/**
 * Gate plein écran (US CONF-08) : affichée quand la session a été ouverte par un **lien de
 * réinitialisation**. L'utilisateur doit choisir son nouveau mot de passe avant d'accéder à l'app —
 * sinon il entrerait avec son ancien mot de passe toujours actif.
 *
 * Aucune sortie implicite (pas de geste de retour, voir `gestureEnabled: false` dans `_layout.tsx`) :
 * la seule échappatoire est « Annuler », qui déconnecte.
 *
 * Le bouton n'est **pas** désactivé hors-ligne : `useStatus().connected` (PowerSync) n'est pas fiable
 * ici — l'app vient d'être ouverte par un deep link, la synchro n'est pas encore connectée, et on
 * bloquerait un utilisateur pourtant en ligne. On laisse partir l'appel et on mappe l'échec réseau.
 */
export default function NewPasswordScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const completePasswordRecovery = useAuthStore((s) => s.completePasswordRecovery);
  const clearRecovery = useAuthStore((s) => s.clearRecovery);
  const signOut = useAuthStore((s) => s.signOut);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const busy = saving || cancelling;

  const onSubmit = async () => {
    setError(null);

    // Validations locales — aucun appel réseau (règle mutualisée avec l'inscription).
    const pwdError = validatePasswordPair(password, confirm);
    if (pwdError === 'too-short') {
      setError(t('auth.newPassword.tooShort', { count: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (pwdError === 'mismatch') {
      setError(t('auth.newPassword.mismatch'));
      return;
    }

    setSaving(true);
    const result = await completePasswordRecovery(password);
    setSaving(false);
    if (result.error) {
      setError(
        isNetworkError(result.error)
          ? t('auth.newPassword.offline')
          : t('auth.newPassword.updateFailed'),
      );
      return;
    }
    // Succès : le store a déconnecté (tous appareils) → `onAuthStateChange` bascule le routing sur
    // l'authentification. Le message de succès est porté par le store (`passwordJustReset`).
  };

  const onCancel = async () => {
    setCancelling(true);
    clearRecovery();
    await signOut();
  };

  return (
    <FormScreen>
      <ScreenHeader
        title={t('auth.newPassword.title')}
        subtitle={t('auth.newPassword.subtitle')}
      />

      <TextField
        label={t('auth.newPassword.field')}
        accessibilityLabel={t('auth.newPassword.field')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label={t('auth.newPassword.confirmField')}
        accessibilityLabel={t('auth.newPassword.confirmField')}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <Button
        label={t('auth.newPassword.cta')}
        onPress={() => void onSubmit()}
        loading={saving}
        disabled={busy}
      />
      <Button
        label={t('auth.newPassword.cancel')}
        variant="ghost"
        onPress={() => void onCancel()}
        loading={cancelling}
        disabled={busy}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: fontFamily.bodyMedium, fontSize: 14 },
});

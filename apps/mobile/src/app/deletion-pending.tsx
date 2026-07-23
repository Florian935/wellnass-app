import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { fetchPendingDeletion } from '@/data/repositories/account-deletion-repository';
import { useAuthStore } from '@/stores/auth-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Formate une date ISO en JJ/MM/AAAA (convention du projet, cf. history/index.tsx). */
function formatDateFr(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Gate plein écran (US CONF-02) : affichée tant qu'une suppression de compte est
 * pending. Bloque l'accès à l'app ; permet d'annuler la suppression ou de se
 * déconnecter. Pas de retour geste (voir options `gestureEnabled: false` dans _layout.tsx).
 */
export default function DeletionPendingScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPendingDeletion()
      .then((pending) => {
        if (!cancelled) setScheduledAt(pending?.scheduledAt ?? null);
      })
      .catch(() => {
        // Fail-open silencieux : si la requête échoue, on affiche simplement l'écran
        // sans date précise plutôt que de bloquer l'utilisateur sur une erreur.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const busy = cancelling || signingOut;

  const onCancel = async () => {
    setError(null);
    setCancelling(true);
    const { error: cancelError } = await useAuthStore.getState().cancelAccountDeletion();
    setCancelling(false);
    if (cancelError) {
      setError(t('account.deletePending.cancelError'));
      return;
    }
    // Suppression annulée côté serveur : on sort de la gate en revenant à l'app ; le
    // routage racine re-évaluera l'état (plus de suppression pending) au prochain rendu.
    router.replace('/(tabs)');
  };

  const onSignOut = async () => {
    setSigningOut(true);
    await useAuthStore.getState().signOut();
  };

  return (
    <FormScreen>
      <View style={styles.center}>
        <Text style={styles.emoji}>⏳</Text>
        <Text style={[styles.title, { color: colors.text }]}>{t('account.deletePending.title')}</Text>
        {scheduledAt ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('account.deletePending.scheduledFor', { date: formatDateFr(scheduledAt) })}
          </Text>
        ) : null}
        <Text style={[styles.blocked, { color: colors.textMuted }]}>
          {t('account.deletePending.blocked')}
        </Text>
      </View>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button
          label={t('account.deletePending.cancel')}
          onPress={() => void onCancel()}
          loading={cancelling}
          disabled={busy}
        />
        <Button
          label={t('account.deletePending.signOut')}
          variant="ghost"
          onPress={() => void onSignOut()}
          loading={signingOut}
          disabled={busy}
        />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  emoji: { fontSize: 44 },
  title: {
    fontFamily: fontFamily.displayXBold,
    fontSize: 24,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  subtitle: { fontFamily: fontFamily.bodySemi, fontSize: 16, textAlign: 'center' },
  blocked: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  error: { fontFamily: fontFamily.bodyMedium, fontSize: 14, textAlign: 'center' },
  actions: { gap: 10 },
});

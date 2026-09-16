import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { updateSettings } from '@/data/repositories/settings-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * US IA-LAB-01 — section « Labo IA » des Réglages : le **consentement**, et la porte du labo.
 *
 * ── Pourquoi un opt-in, pour une surface de test ─────────────────────────────────────────────────
 * Parce que le consentement n'est pas une formalité qu'on ajoutera « quand ce sera en production » :
 * c'est le garde que la fonction Edge vérifie avant tout appel (`user_settings.ai_consent_at`), et
 * le poser maintenant est ce qui permet de tester le chemin réel plutôt qu'un chemin de complaisance.
 * Même patron que `CycleTrackingSection` et `pain_journal_enabled` : **désactivé par défaut**, et
 * l'absence de valeur ne vaut jamais consentement.
 *
 * ── Un horodatage, pas un booléen ────────────────────────────────────────────────────────────────
 * `ai_consent_at` porte l'**instant** du consentement (RGPD : prouver *quand*). Révoquer repose
 * `null`. C'est la migration DASH-01 qui l'a posé ; rien à ajouter côté base.
 *
 * 🔴 Le texte de l'interrupteur dit **ce qui part et où** — y compris que le fournisseur gratuit
 * peut s'en servir pour s'entraîner. Un consentement qui tairait ça n'en serait pas un.
 */
export function AiLabSection({ consentedAt }: { consentedAt: string | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const consented = Boolean(consentedAt);

  const onToggle = (next: boolean) => {
    if (!next) {
      void updateSettings({ aiConsentAt: null });
      return;
    }
    // Une confirmation explicite avant d'activer : c'est le seul endroit de l'app où des données
    // quittent l'appareil vers un tiers qui peut les réutiliser. L'interrupteur seul irait trop vite.
    Alert.alert(t('aiLab.settings.confirmTitle'), t('aiLab.settings.confirmBody'), [
      { text: t('aiLab.settings.cancel'), style: 'cancel' },
      {
        text: t('aiLab.settings.accept'),
        onPress: () => {
          setBusy(true);
          void updateSettings({ aiConsentAt: new Date().toISOString() }).finally(() =>
            setBusy(false),
          );
        },
      },
    ]);
  };

  return (
    <>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
        {t('aiLab.settings.title')}
      </Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          <View style={styles.grow}>
            <Text style={[styles.label, { color: colors.text }]}>
              {t('aiLab.settings.toggle')}
            </Text>
            <Text style={[styles.desc, { color: colors.textMuted }]}>
              {t('aiLab.settings.subtitle')}
            </Text>
          </View>
          <Switch
            value={consented}
            onValueChange={onToggle}
            disabled={busy}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#ffffff"
            accessibilityLabel={t('aiLab.settings.toggle')}
          />
        </View>
      </View>

      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('aiLab.settings.disclaimer')}</Text>

      {consented && (
        <View style={styles.stack}>
          <Button
            label={t('aiLab.settings.open')}
            variant="ghost"
            onPress={() => router.push('/ai-lab')}
          />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: 28,
    marginBottom: 8,
  },
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  grow: { flex: 1, gap: 2 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  desc: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  hint: { fontFamily: fontFamily.body, fontSize: 12, marginTop: 8, lineHeight: 17 },
  stack: { marginTop: 12, gap: 8 },
});

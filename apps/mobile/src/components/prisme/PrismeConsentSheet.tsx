/**
 * US PRISME-01 — la feuille d'accord à Prisme, au premier geste (spec §4).
 *
 * ── Ce qu'elle tient ───────────────────────────────────────────────────────────────────────────
 * 1. **Elle dit d'abord que c'est une IA** (R14, transparence de l'AI Act).
 * 2. **Elle nomme le vrai destinataire** : fournisseur, pays, entraînement, conservation — lus dans le
 *    statut du serveur, jamais écrits en dur (R6). Sans statut connu (hors ligne), elle ne promet rien.
 * 3. **« 18 ans ou plus » est exigé** quand la date de naissance est inconnue (DD15). C'est
 *    déclaratif, et assumé.
 * 4. **L'accord est accordé par le serveur** (DD3) : `grantPrismeConsent`. Un refus reste affiché ; la
 *    feuille ne se ferme qu'une fois l'accord enregistré.
 */

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { PrismeStatus } from '@wellness/shared';

import { Button } from '@/components/Button';
import { useProfile } from '@/data/repositories/profile-repository';
import { grantPrismeConsent } from '@/lib/ai/prisme';
import type { AiErrorCode } from '@/lib/ai/ai-client';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

import { PrismeMark } from './PrismeMark';

/** Le pays du fournisseur, en mots (« aux États-Unis »). Un code inconnu est dit tel quel. */
export function prismeCountryLabel(t: TFunction, code: string): string {
  return code === 'US' || code === 'FR' ? t(`prisme.country.${code}`) : t('prisme.country.other', { code });
}

type Props = {
  visible: boolean;
  status: PrismeStatus | null;
  onClose: () => void;
  onGranted: () => void;
};

export function PrismeConsentSheet({ visible, status, onClose, onGranted }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { profile } = useProfile();

  const birthKnown = Boolean(profile?.birthDate);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AiErrorCode | null>(null);

  const provider = status?.provider ?? null;
  const canActivate = provider !== null && (birthKnown || adult) && !busy;

  const activate = async () => {
    if (!canActivate) return;
    setBusy(true);
    setError(null);
    try {
      // Date de naissance connue : c'est elle que le serveur lit. Sinon, la case cochée.
      const result = await grantPrismeConsent(birthKnown ? false : adult);
      if (result.ok) onGranted();
      else setError(result.code);
    } catch {
      setError('failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
      <View testID="prisme-consent-sheet" style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={[styles.grip, { backgroundColor: colors.border }]} />
        <View style={styles.head}>
          <PrismeMark size={32} />
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {t('prisme.consent.title')}
          </Text>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Text style={[styles.lead, { color: colors.text }]}>{t('prisme.consent.isAi')}</Text>

          <Text style={[styles.label, { color: colors.textMuted }]}>{t('prisme.consent.sendsTitle')}</Text>
          <Text style={[styles.text, { color: colors.text }]}>{t('prisme.consent.sends')}</Text>

          <Text style={[styles.label, { color: colors.textMuted }]}>{t('prisme.consent.neverTitle')}</Text>
          <Text style={[styles.text, { color: colors.text }]}>{t('prisme.consent.never')}</Text>

          <Text style={[styles.label, { color: colors.textMuted }]}>{t('prisme.consent.whereTitle')}</Text>
          {provider ? (
            <>
              <Text style={[styles.text, { color: colors.text }]}>
                {t('prisme.consent.where', { provider: provider.label, country: prismeCountryLabel(t, provider.country) })}
              </Text>
              <Text style={[styles.text, { color: colors.text }]}>{t('prisme.consent.trainingNo')}</Text>
              <Text style={[styles.text, { color: colors.text }]}>
                {provider.retentionDays > 0
                  ? t('prisme.consent.retention', { days: provider.retentionDays })
                  : t('prisme.consent.retentionNone')}
              </Text>
              <Text style={[styles.text, { color: colors.text }]}>{t('prisme.consent.local')}</Text>
            </>
          ) : (
            <Text style={[styles.text, { color: colors.text }]}>
              {status === null ? t('prisme.settings.unknown') : t('prisme.settings.unavailable')}
            </Text>
          )}

          <Text style={[styles.note, { color: colors.textMuted }]}>{t('prisme.consent.revoke')}</Text>
        </ScrollView>

        {provider && !birthKnown ? (
          <Pressable
            testID="prisme-consent-adult"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: adult }}
            onPress={() => setAdult((value) => !value)}
            style={styles.check}
          >
            <View style={[styles.box, { borderColor: colors.text, backgroundColor: adult ? colors.text : 'transparent' }]} />
            <Text style={[styles.text, { color: colors.text }]}>{t('prisme.consent.adult')}</Text>
          </Pressable>
        ) : null}

        {error !== null ? (
          <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
            {t(`prisme.errors.${error}`)}
          </Text>
        ) : null}

        {provider ? (
          <Button
            testID="prisme-consent-activate"
            label={t('prisme.consent.activate')}
            onPress={() => void activate()}
            loading={busy}
            disabled={!canActivate}
          />
        ) : null}
        <Button label={t('prisme.consent.later')} onPress={onClose} variant="ghost" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24, gap: 10 },
  grip: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, opacity: 0.6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: fontFamily.displayXBold, fontSize: 20, letterSpacing: -0.3 },
  body: { maxHeight: 380 },
  bodyContent: { gap: 6, paddingBottom: 4 },
  lead: { fontFamily: fontFamily.bodySemi, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fontFamily.bodyBold, fontSize: 11.5, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 6 },
  text: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19 },
  note: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 16, marginTop: 6 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2 },
  error: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});

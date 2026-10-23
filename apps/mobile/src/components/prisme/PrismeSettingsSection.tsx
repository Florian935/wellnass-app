/**
 * US PRISME-01 — Réglages › Prisme (spec §4).
 *
 * ── Ce que la section tient ───────────────────────────────────────────────────────────────────
 * 1. **Visible tant qu'il y a quelque chose à y faire** — accorder, ou retirer un accord, même hors
 *    ligne, même si Prisme est devenu indisponible entre-temps (DD3). Le retrait s'écrit en local et
 *    remonte à la synchronisation. US ACCES-IA (spec §4.1) : la section n'est plus « toujours » là —
 *    - **bêta fermée** (`closed`) : absente, ou réduite à « Retirer mon accord » s'il en reste un ;
 *    - **accès inconnu** (`unknown`, pas encore de statut) : absente sans accord ; avec un accord,
 *      celle d'aujourd'hui (« il faut le réseau », « Vérifier à nouveau ») ;
 *    - **accès confirmé** (`allowed`) : celle d'aujourd'hui, plus « Bêta fermée — tu fais partie des
 *      testeurs » quand le serveur est en mode `testers`.
 * 2. **Allumer ouvre la feuille d'accord** : l'accord s'accorde par le serveur, au nom du vrai
 *    fournisseur (R6). Un accord donné à un autre fournisseur se lit éteint : il sera redemandé.
 * 3. **Dire à qui et quand** l'accord a été donné, et ce qui part.
 * 4. **Moins de 18 ans** : « réservé aux 18 ans et plus », sans interrupteur (R13).
 * 5. **Développement seulement** : « simuler un chiffre inventé », pour recetter le refus du garde-fou
 *    sur un vrai téléphone (critère 8). Absent d'un build de production.
 *
 * Distincte de la section « Labo IA » (IA-LAB-01) : deux accords, deux usages, deux fournisseurs.
 */

import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDayFull, localDayKey } from '@wellness/shared';

import { Button } from '@/components/Button';
import { useSettings } from '@/data/repositories/settings-repository';
import { usePrismeVisibility } from '@/hooks/usePrismeVisibility';
import { refreshPrismeStatus, revokePrismeConsent } from '@/lib/ai/prisme';
import { usePrismeStore } from '@/stores/prisme-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

import { PrismeConsentSheet, prismeCountryLabel } from './PrismeConsentSheet';
import { PrismeMark } from './PrismeMark';

export function PrismeSettingsSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { minor, status, access, mode } = usePrismeVisibility();
  const { settings } = useSettings();
  const devSimulate = usePrismeStore((s) => s.devSimulateInvented);
  const setDevSimulate = usePrismeStore((s) => s.setDevSimulateInvented);
  const [sheet, setSheet] = useState(false);

  const consentAt = settings?.prismeConsentAt ?? null;
  const consentProvider = settings?.prismeConsentProvider ?? null;
  const provider = status?.provider ?? null;

  // Sans statut connu, l'accord local fait foi ; avec, il doit avoir été donné à CE fournisseur (R6).
  const granted = consentAt !== null && (provider === null || consentProvider === provider.id);
  // L'interrupteur existe s'il y a quelque chose à accorder… ou un accord à retirer — y compris pour un
  // compte de moins de 18 ans : ses appels sont refusés, mais un accord stocké doit pouvoir être retiré.
  const showSwitch = consentAt !== null || (!minor && provider !== null);

  const onToggle = (next: boolean) => {
    if (next) setSheet(true);
    else void revokePrismeConsent();
  };

  // US ACCES-IA — rien de Prisme pour qui n'y a pas accès, sauf de quoi retirer un accord (§4.3).
  if (access !== 'allowed' && consentAt === null) return null;
  if (access === 'closed' && consentAt !== null) {
    return (
      <>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('prisme.settings.title')}</Text>
        <View testID="prisme-settings-closed" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.head}>
            <PrismeMark size={28} />
            <Text style={[styles.label, styles.grow, styles.closedText, { color: colors.text }]}>
              {t('prisme.settings.closed', { date: formatDayFull(localDayKey(new Date(consentAt))) })}
            </Text>
          </View>
          <Button
            testID="prisme-settings-withdraw"
            label={t('prisme.settings.withdraw')}
            variant="ghost"
            onPress={() => void revokePrismeConsent()}
          />
        </View>
      </>
    );
  }

  return (
    <>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('prisme.settings.title')}</Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.head}>
          <PrismeMark size={28} />
          <Text style={[styles.desc, styles.grow, { color: colors.textMuted }]}>{t('prisme.settings.intro')}</Text>
        </View>

        {access === 'allowed' && mode === 'testers' ? (
          <View testID="prisme-settings-beta" style={[styles.beta, { backgroundColor: colors.background }]}>
            <Text style={[styles.betaBadge, { color: colors.textMuted, borderColor: colors.textMuted }]}>{t('prisme.settings.betaBadge')}</Text>
            <Text style={[styles.desc, styles.grow, { color: colors.text }]}>{t('prisme.settings.betaTester')}</Text>
          </View>
        ) : null}

        {minor ? (
          <Text style={[styles.label, { color: colors.text }]}>{t('prisme.settings.adultOnly')}</Text>
        ) : null}

        {showSwitch ? (
          <View style={styles.row}>
            <View style={styles.grow}>
              <Text style={[styles.label, { color: colors.text }]}>{t('prisme.settings.toggle')}</Text>
              {granted && consentAt !== null ? (
                <Text style={[styles.desc, { color: colors.textMuted }]}>
                  {t('prisme.settings.grantedOn', {
                    date: formatDayFull(localDayKey(new Date(consentAt))),
                    provider: provider?.label ?? consentProvider ?? '',
                    country: provider ? prismeCountryLabel(t, provider.country) : '',
                  })}
                </Text>
              ) : null}
            </View>
            <Switch
              testID="prisme-settings-switch"
              value={granted}
              onValueChange={onToggle}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor="#ffffff"
              accessibilityLabel={t('prisme.settings.toggle')}
            />
          </View>
        ) : null}

        {!minor && provider ? (
          <>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('prisme.settings.providerTitle')}</Text>
            <Text style={[styles.desc, { color: colors.text }]}>
              {t('prisme.settings.provider', { provider: provider.label, country: prismeCountryLabel(t, provider.country) })}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('prisme.settings.sendsTitle')}</Text>
            <Text style={[styles.desc, { color: colors.text }]}>{t('prisme.settings.sends')}</Text>
          </>
        ) : null}

        {!minor && status !== null && provider === null ? (
          <Text style={[styles.desc, { color: colors.textMuted }]}>{t('prisme.settings.unavailable')}</Text>
        ) : null}

        {!minor && status === null ? (
          <View style={styles.stack}>
            <Text style={[styles.desc, { color: colors.textMuted }]}>{t('prisme.settings.unknown')}</Text>
            <Button
              testID="prisme-settings-refresh"
              label={t('prisme.settings.refresh')}
              variant="ghost"
              onPress={() => void refreshPrismeStatus()}
            />
          </View>
        ) : null}

        {__DEV__ && !minor ? (
          <View style={styles.row}>
            <Text style={[styles.desc, styles.grow, { color: colors.textMuted }]}>{t('prisme.devSimulate')}</Text>
            <Switch
              testID="prisme-settings-dev-simulate"
              value={devSimulate}
              onValueChange={setDevSimulate}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor="#ffffff"
              accessibilityLabel={t('prisme.devSimulate')}
            />
          </View>
        ) : null}
      </View>

      <PrismeConsentSheet visible={sheet} status={status} onClose={() => setSheet(false)} onGranted={() => setSheet(false)} />
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
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  grow: { flex: 1, gap: 2 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  subtitle: { fontFamily: fontFamily.bodySemi, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  desc: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  stack: { gap: 8 },
  closedText: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  beta: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  betaBadge: { fontFamily: fontFamily.monoBold, fontSize: 10, borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, overflow: 'hidden' },
});

/**
 * US PRISME-01 — Réglages › Prisme (spec §4).
 *
 * ── Ce que la section tient ───────────────────────────────────────────────────────────────────
 * 1. **Toujours visible**, pour pouvoir retirer l'accord — même hors ligne, même si Prisme est devenu
 *    indisponible entre-temps (DD3). Le retrait s'écrit en local et remonte à la synchronisation.
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
  const { minor, status } = usePrismeVisibility();
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

  return (
    <>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('prisme.settings.title')}</Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.head}>
          <PrismeMark size={28} />
          <Text style={[styles.desc, styles.grow, { color: colors.textMuted }]}>{t('prisme.settings.intro')}</Text>
        </View>

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
});

/**
 * US PRISME-01 — « Prisme raconte » : un bilan (soir ou semaine) raconté à la demande, puis vérifié.
 *
 * ── Ce que ce composant tient ─────────────────────────────────────────────────────────────────
 * 1. **Rien ne part sans un geste** (DD10) : aucun appel à l'ouverture de l'écran.
 * 2. **Sans accord — ou avec un accord donné à un autre fournisseur —, la feuille s'ouvre au lieu
 *    d'appeler** (R6). L'accord enregistré, le récit part.
 * 3. **Le refus se dit** : un texte jeté par le garde-fou n'est pas un bouton qui « ne fait rien »
 *    (R2). Les faits, eux, restent affichés au-dessus par l'écran parent.
 * 4. **Un texte périmé le dit** (DD12) : il reste en mémoire pour la journée ; si le dossier a changé
 *    depuis (un dîner saisi après la lecture), il est marqué et propose « Relire ».
 * 5. **Toujours dire que c'est une IA** (R14) : prisme, nom, badge « IA », « vérifié contre tes
 *    chiffres », et d'où ça vient — les blocs envoyés, rien d'autre.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { needsPrismeConsent, type BilanDossier } from '@wellness/shared';

import { useSettings } from '@/data/repositories/settings-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { tellBilan, type PrismeOutcome } from '@/lib/ai/prisme';
import { usePrismeStore } from '@/stores/prisme-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

import { PrismeConsentSheet } from './PrismeConsentSheet';
import { PrismeMark } from './PrismeMark';

type Failure = Exclude<PrismeOutcome, { ok: true }>['code'];

type Props = {
  dossier: BilanDossier;
  usage: 'evening' | 'week';
  /** Clé du texte en mémoire : « evening:2026-10-02 », « week:2026-09-21 ». */
  storeKey: string;
  /** Empreinte de ce que raconte le dossier ; un texte lu sur une autre empreinte est périmé. */
  fingerprint: string;
  testID?: string;
};

export function PrismeTell({ dossier, usage, storeKey, fingerprint, testID = 'prisme-tell' }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const lang = i18n.language.startsWith('fr') ? 'fr' : 'en';

  const status = usePrismeStore((s) => s.status);
  const stored = usePrismeStore((s) => s.texts[storeKey]);
  const rememberText = usePrismeStore((s) => s.rememberText);
  const { settings } = useSettings();
  const consent = { at: settings?.prismeConsentAt ?? null, provider: settings?.prismeConsentProvider ?? null };

  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [sheet, setSheet] = useState(false);
  // `busy` ne pilote que l'affichage : deux appuis du même cycle le lisent tous deux à `false`. La
  // garde est le verrou (critère 15 — un seul appel, un seul décompte).
  const runExclusive = useActionLock();

  const run = () =>
    runExclusive(async () => {
      setBusy(true);
      setFailure(null);
      try {
        const outcome = await tellBilan(dossier, usage, lang);
        if (outcome.ok) rememberText(storeKey, { text: outcome.text, fingerprint });
        // Le serveur ne voit pas l'accord (retiré ailleurs, pas encore synchronisé) : on le redemande
        // plutôt que de laisser chaque appui se faire refuser (spec §7).
        else if (outcome.code === 'consent-required') setSheet(true);
        else setFailure(outcome.code);
      } catch {
        // Une exception non prévue reste un échec de récit, pas un écran cassé : les faits sont là.
        setFailure('failed');
      } finally {
        setBusy(false);
      }
    });

  const onTell = () => {
    if (needsPrismeConsent(consent, status)) {
      setSheet(true);
      return;
    }
    void run();
  };

  const failureText = (code: Failure): string => {
    if (code === 'rejected') return t('prisme.rejected');
    if (code === 'invalid') return t('prisme.invalid');
    return t(`prisme.errors.${code}`);
  };

  const stale = stored !== undefined && stored.fingerprint !== fingerprint;

  return (
    <View testID={testID} style={[styles.block, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.head}>
        <PrismeMark size={22} />
        <Text style={[styles.name, { color: colors.text }]}>{t('prisme.name')}</Text>
        <Text style={[styles.badge, { color: colors.textMuted, borderColor: colors.textMuted }]}>{t('prisme.badge')}</Text>
      </View>

      {stored !== undefined ? (
        <View style={styles.result} accessibilityLiveRegion="polite">
          {stale ? (
            <View style={styles.staleRow}>
              <Text style={[styles.meta, styles.staleText, { color: colors.textMuted }]}>{t('prisme.stale')}</Text>
              <Pressable
                testID={`${testID}-retell`}
                accessibilityRole="button"
                accessibilityState={{ busy }}
                disabled={busy}
                onPress={onTell}
                style={[styles.smallAction, { borderColor: colors.text }]}
              >
                <Text style={[styles.actionLabel, { color: colors.text }]}>{t('prisme.retell')}</Text>
              </Pressable>
            </View>
          ) : null}
          <Text style={[styles.text, { color: colors.text, opacity: stale ? 0.6 : 1 }]}>{stored.text}</Text>
          <Text style={[styles.verified, { color: colors.text }]}>{t('prisme.verified')}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{t('prisme.sources')}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{dossier.facts.map((f) => f.label).join(' · ')}</Text>
        </View>
      ) : busy ? (
        <View style={styles.busyRow} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.text} />
          <Text style={[styles.meta, { color: colors.textMuted }]}>{t('prisme.reading')}</Text>
        </View>
      ) : (
        <Pressable
          testID={`${testID}-tell`}
          accessibilityRole="button"
          accessibilityState={{ busy }}
          onPress={onTell}
          style={[styles.action, { borderColor: colors.text }]}
        >
          <Text style={[styles.actionLabel, { color: colors.text }]}>{t('prisme.tell')}</Text>
        </Pressable>
      )}

      {failure !== null ? (
        <Text testID={`${testID}-error`} accessibilityLiveRegion="polite" style={[styles.meta, { color: colors.textMuted }]}>
          {failureText(failure)}
        </Text>
      ) : null}

      <PrismeConsentSheet
        visible={sheet}
        status={status}
        onClose={() => setSheet(false)}
        onGranted={() => {
          setSheet(false);
          void run();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { fontFamily: fontFamily.displayBold, fontSize: 15 },
  badge: { fontFamily: fontFamily.monoBold, fontSize: 10, borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, overflow: 'hidden' },
  result: { gap: 6 },
  text: { fontFamily: fontFamily.body, fontSize: 14.5, lineHeight: 21 },
  verified: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  meta: { fontFamily: fontFamily.body, fontSize: 11.5, lineHeight: 15 },
  staleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  staleText: { flex: 1 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  action: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5 },
  smallAction: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5 },
  actionLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
});

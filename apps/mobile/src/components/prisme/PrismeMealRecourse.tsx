/**
 * US PRISME-01 — « Demander à Prisme » sous ce que la saisie rapide n'a pas reconnu (spec §3).
 *
 * ── Ce que ce composant tient ─────────────────────────────────────────────────────────────────
 * 1. **Seule la partie non reconnue part, et elle se montre avant** (R10) : « Ce qui part chez Groq :
 *    « … ». Rien d'autre. » Le texte affiché est exactement celui qu'envoie `askMeal` (coupé à 300).
 * 2. **Sans accord — ou un accord donné à un autre fournisseur —, la feuille s'ouvre** (R6).
 * 3. **Prisme propose, l'app calcule** (R8) : les aliments et grammes reviennent à l'écran parent, qui
 *    les rapproche de la base et les ajoute à la même revue. Rien n'est écrit ici.
 * 4. **Les échecs se disent** : aucun aliment, liste coupée à 12, hors ligne, réponse inexploitable.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AI_PROVIDER_LABELS, MEAL_TEXT_MAX_CHARS, needsPrismeConsent, type MealPhotoItem } from '@wellness/shared';

import { useSettings } from '@/data/repositories/settings-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { usePrismeVisibility } from '@/hooks/usePrismeVisibility';
import { askMeal, type PrismeMealOutcome } from '@/lib/ai/prisme';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

import { PrismeConsentSheet } from './PrismeConsentSheet';
import { PrismeMark } from './PrismeMark';

type Failure = Exclude<PrismeMealOutcome, { ok: true }>['code'];
type Notice = 'none' | 'truncated' | null;

type Props = {
  /** Les lignes non reconnues, telles que tapées. */
  unmatchedText: string;
  onItems: (items: MealPhotoItem[]) => void;
};

export function PrismeMealRecourse({ unmatchedText, onItems }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const lang = i18n.language.startsWith('fr') ? 'fr' : 'en';
  const { visible, status } = usePrismeVisibility();
  const { settings } = useSettings();
  const consent = { at: settings?.prismeConsentAt ?? null, provider: settings?.prismeConsentProvider ?? null };
  // Hors ligne au chargement, le statut manque : on dit quand même chez qui part le texte — le
  // fournisseur de l'accord, celui que le serveur vérifiera (R6, R10).
  const providerLabel =
    status?.provider?.label ?? (consent.provider ? (AI_PROVIDER_LABELS[consent.provider] ?? consent.provider) : '');

  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [sheet, setSheet] = useState(false);
  // `busy` ne pilote que l'affichage : deux appuis du même cycle le lisent tous deux à `false`.
  const runExclusive = useActionLock();

  const sent = unmatchedText.trim().slice(0, MEAL_TEXT_MAX_CHARS);
  // Une fois les lignes remplacées, plus rien ne part — mais « liste coupée à 12 » doit rester dit.
  if (!visible || (sent.length === 0 && notice === null)) return null;

  const run = () =>
    runExclusive(async () => {
      setBusy(true);
      setFailure(null);
      setNotice(null);
      try {
        const outcome = await askMeal(sent, lang);
        // Le serveur ne voit pas l'accord : on le redemande (spec §7).
        if (!outcome.ok && outcome.code === 'consent-required') setSheet(true);
        else if (!outcome.ok) setFailure(outcome.code);
        else if (outcome.items.length === 0) setNotice('none');
        else {
          if (outcome.truncated) setNotice('truncated');
          onItems(outcome.items);
        }
      } catch {
        setFailure('failed');
      } finally {
        setBusy(false);
      }
    });

  const onAsk = () => {
    if (needsPrismeConsent(consent, status)) {
      setSheet(true);
      return;
    }
    void run();
  };

  const failureText = (code: Failure): string => (code === 'invalid' ? t('prisme.meal.invalid') : t(`prisme.errors.${code}`));

  return (
    <View testID="prisme-meal" style={[styles.block, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.head}>
        <PrismeMark size={20} />
        <Text style={[styles.name, { color: colors.text }]}>{t('prisme.name')}</Text>
        <Text style={[styles.badge, { color: colors.textMuted, borderColor: colors.textMuted }]}>{t('prisme.badge')}</Text>
      </View>
      {sent.length > 0 ? (
        <>
          <Text style={[styles.meta, { color: colors.text }]}>{t('prisme.meal.offer')}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {t('prisme.meal.sends', { provider: providerLabel, text: sent })}
          </Text>
          {busy ? (
            <View style={styles.busyRow} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={colors.text} />
              <Text style={[styles.meta, { color: colors.textMuted }]}>{t('prisme.meal.asking')}</Text>
            </View>
          ) : (
            <Pressable
              testID="prisme-meal-ask"
              accessibilityRole="button"
              onPress={onAsk}
              style={[styles.action, { borderColor: colors.text }]}
            >
              <Text style={[styles.actionLabel, { color: colors.text }]}>{t('prisme.meal.ask')}</Text>
            </Pressable>
          )}
        </>
      ) : null}
      <Text style={[styles.meta, { color: colors.textMuted }]}>{t('prisme.meal.roles')}</Text>

      {notice !== null ? (
        <Text accessibilityLiveRegion="polite" style={[styles.meta, { color: colors.text }]}>
          {t(`prisme.meal.${notice}`)}
        </Text>
      ) : null}
      {failure !== null ? (
        <Text testID="prisme-meal-error" accessibilityLiveRegion="polite" style={[styles.meta, { color: colors.textMuted }]}>
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
  block: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { fontFamily: fontFamily.displayBold, fontSize: 14 },
  badge: { fontFamily: fontFamily.monoBold, fontSize: 10, borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, overflow: 'hidden' },
  meta: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 16 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  action: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5 },
  actionLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
});

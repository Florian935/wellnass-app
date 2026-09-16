/**
 * US IA-LAB-01 — le **labo IA** : une surface d'évaluation, pas une fonctionnalité produit.
 *
 * ── Ce que cet écran sert à décider ──────────────────────────────────────────────────────────────
 * `docs/product/ia-integration-analyse.md` estime ce que l'IA coûterait et propose un phasage, mais
 * personne n'a encore vu **ce qu'un modèle rend sur nos données**. Cet écran répond à ça, et à rien
 * d'autre : on pose une question, on lit la réponse brute, on juge. C'est l'étape 1 du §7.5.
 *
 * ── Trois choix qui le distinguent d'un écran normal ─────────────────────────────────────────────
 * 1. **La réponse est affichée telle quelle**, non validée, non reformatée. Partout ailleurs dans
 *    l'app, la sortie d'un modèle est traitée comme une entrée non fiable (`parseAiJson`) ; ici
 *    c'est précisément la sortie brute qu'on évalue, et la masquer viderait l'exercice.
 * 2. **Ce qui part est montré avant de partir** (le bloc « Ce qui est envoyé »). Un consentement
 *    donné sans voir les données est décoratif ; et pour juger une réponse, il faut savoir sur quoi
 *    elle s'appuie.
 * 3. **Le fournisseur et le modèle sont affichés** sous chaque réponse. Comparer Gemini et Claude
 *    sans savoir lequel a répondu n'apprendrait rien.
 *
 * 🔴 **Données factices uniquement.** Le palier gratuit de Gemini peut utiliser les requêtes pour
 * entraîner ses modèles (analyse §7.2). L'avertissement en tête d'écran n'est pas une précaution de
 * style : c'est la condition d'usage de cette surface. Remise à plat :
 * `supabase/scripts/ia-purge-et-dataset.sql`.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { AI_DAILY_QUOTA, AI_LAB_QUESTIONS, type AiLabQuestion } from '@wellness/shared';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AI_CONTEXT_WINDOW_DAYS, useAiSnapshot } from '@/data/repositories/ai-context-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { callAiAssist, type AiResult } from '@/lib/ai/ai-client';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function AiLabScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { settings } = useSettings();
  const { snapshot, context, isLoading } = useAiSnapshot();

  const [question, setQuestion] = useState('');
  const [selected, setSelected] = useState<AiLabQuestion | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);

  const consented = Boolean(settings?.aiConsentAt);
  const asked = question.trim();

  /** Sélectionner une question proposée remplit le champ : elle reste modifiable avant l'envoi. */
  const pick = (key: AiLabQuestion) => {
    setSelected(key);
    setQuestion(t(`aiLab.questions.${key}`));
  };

  const send = async () => {
    if (asked.length === 0 || busy) return;
    setBusy(true);
    setResult(null);
    // `context` est **exactement** la chaîne affichée dans le bloc dépliant : une seule source, donc
    // aucun écart possible entre ce qui est montré et ce qui est envoyé.
    const response = await callAiAssist({ kind: 'coach', context, question: asked });
    setResult(response);
    setBusy(false);
  };

  if (isLoading) return null;

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <ScreenHeader title={t('aiLab.title')} subtitle={t('aiLab.subtitle')} />

      {/* L'avertissement est le premier élément de l'écran, et non une note de bas de page : il
          conditionne l'usage de toute la surface. */}
      <View style={[styles.warning, { backgroundColor: colors.surfaceAlt, borderColor: colors.danger }]}>
        <Text style={[styles.warningTitle, { color: colors.text }]}>{t('aiLab.warning.title')}</Text>
        <Text style={[styles.warningBody, { color: colors.text }]}>{t('aiLab.warning.body')}</Text>
      </View>

      {!consented ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('aiLab.consent.title')}</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>{t('aiLab.consent.body')}</Text>
          <Button
            label={t('aiLab.consent.action')}
            onPress={() => router.push('/settings')}
          />
        </View>
      ) : (
        <>
          {/* ── Ce qui est envoyé ─────────────────────────────────────────────────────────────── */}
          <Pressable
            onPress={() => setShowContext((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showContext }}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {t('aiLab.context.title')}
            </Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              {t('aiLab.context.subtitle', { days: AI_CONTEXT_WINDOW_DAYS })}
            </Text>
            <Text style={[styles.toggle, { color: colors.accent }]}>
              {showContext ? t('aiLab.context.hide') : t('aiLab.context.show')}
            </Text>
          </Pressable>

          {showContext && (
            <View style={[styles.contextBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[styles.mono, { color: colors.text }]} selectable>
                {context || t('aiLab.context.empty')}
              </Text>
            </View>
          )}

          {snapshot && !snapshot.strength && !snapshot.running && !snapshot.nutrition && (
            <Text style={[styles.hint, { color: colors.textMuted }]}>{t('aiLab.context.noData')}</Text>
          )}

          {/* ── La question ───────────────────────────────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            {t('aiLab.ask.title')}
          </Text>

          <View style={styles.chips}>
            {AI_LAB_QUESTIONS.map((key) => {
              const active = selected === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => pick(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.accent : colors.surface,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.chipText, { color: active ? colors.accentText : colors.text }]}
                  >
                    {t(`aiLab.questions.${key}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={question}
            onChangeText={(text) => {
              setQuestion(text);
              // Dès qu'on édite, la puce n'est plus « la » question posée : la désélectionner évite
              // d'afficher un choix qui ne correspond plus au texte réellement envoyé.
              setSelected(null);
            }}
            placeholder={t('aiLab.ask.placeholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            accessibilityLabel={t('aiLab.ask.title')}
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
            ]}
          />

          <Button
            label={t('aiLab.ask.send')}
            onPress={() => void send()}
            loading={busy}
            disabled={asked.length === 0}
          />
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t('aiLab.ask.quota', { quota: AI_DAILY_QUOTA.coach })}
          </Text>

          {/* ── La réponse ────────────────────────────────────────────────────────────────────── */}
          {busy && <ActivityIndicator style={styles.spinner} color={colors.accent} />}

          {result?.ok && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.answer, { color: colors.text }]} selectable>
                {result.text}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {t('aiLab.result.meta', {
                  provider: result.provider,
                  model: result.model,
                  used: result.used,
                  quota: result.quota,
                })}
              </Text>
            </View>
          )}

          {result && !result.ok && (
            <View
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.danger }]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t(`aiLab.errors.${result.code}`)}
              </Text>
              {/* Le détail n'existe que pour `misconfigured` : c'est le message du fournisseur sur
                  NOTRE configuration (modèle inconnu, clé invalide). Il ne parle jamais de
                  l'utilisateur, et sans lui la cause resterait invisible depuis le téléphone. */}
              {result.detail ? (
                <Text style={[styles.mono, { color: colors.textMuted }]} selectable>
                  {result.detail}
                </Text>
              ) : null}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48, gap: 12 },
  warning: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  warningTitle: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  warningBody: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  body: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  toggle: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  contextBox: { borderWidth: 1, borderRadius: 12, padding: 12 },
  mono: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 18 },
  sectionTitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontFamily: fontFamily.body, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    fontFamily: fontFamily.body,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  hint: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },
  spinner: { marginVertical: 12 },
  answer: { fontFamily: fontFamily.body, fontSize: 14.5, lineHeight: 21 },
  meta: { fontFamily: fontFamily.body, fontSize: 11.5, lineHeight: 16 },
});

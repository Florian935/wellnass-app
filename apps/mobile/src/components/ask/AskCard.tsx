/**
 * US DASH-01 (§7.3) — « **Demande-moi** » : trois questions du moment.
 *
 * ── L'inversion qui fait tout ────────────────────────────────────────────────────────────────────
 * Le client **calcule d'abord la réponse**, à partir des mêmes briques que le reste de l'app
 * (verdict de forme, cible calorique, semaine). Le modèle, s'il est disponible, ne fait que la
 * **formuler**. Conséquences directes, et elles sont le cœur de la décision :
 *  - sans IA, sans réseau, sans consentement : **la même réponse s'affiche**, formulée par des clés
 *    i18n. La fonctionnalité ne dépend pas du modèle, elle s'en sert ;
 *  - aucun chiffre affiché ne sort d'un modèle (R7) — il n'a jamais les nombres, seulement la phrase ;
 *  - chaque réponse montre **d'où elle vient** (« Pourquoi ? ») et accepte « ce n'est pas ça ».
 */

import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { askPhrasingSchema, parseAiJson, type Explanation } from '@wellness/shared';
import { ExplainButton } from '@/components/explain/ExplainButton';
import { ExplainSheet } from '@/components/explain/ExplainSheet';
import { PressableScale } from '@/components/motion/PressableScale';
import { DenseTile } from '@/components/stage/DenseTile';
import { useAiAvailability } from '@/hooks/useAiAvailability';
import { callAiAssist } from '@/lib/ai/ai-client';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Une question du moment : son libellé, la réponse **déjà calculée**, et d'où elle sort. */
export type AskQuestion = {
  key: string;
  label: string;
  /** La réponse déterministe, formulée par clés i18n. C'est elle qui s'affiche sans IA. */
  answer: string;
  explanation: Explanation | null;
};

type Props = { questions: readonly AskQuestion[] };

export function AskCard({ questions }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const ai = useAiAvailability('ask');

  const [selected, setSelected] = useState<AskQuestion | null>(null);
  /** La reformulation du modèle, ou `null` : la réponse déterministe reste la référence. */
  const [phrasing, setPhrasing] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);

  if (questions.length === 0) return null;

  const pick = (question: AskQuestion) => {
    setSelected(question);
    setPhrasing(null);
    // Sans consentement ou hors ligne, on s'arrête là : la réponse est déjà complète.
    if (!ai.ready) return;

    setAsking(true);
    void callAiAssist({ kind: 'ask', prompt: `${question.label}\n${question.answer}` })
      .then((result) => {
        if (!result.ok) return;
        // Le modèle ne produit qu'une phrase, validée par zod. Illisible → on garde la nôtre.
        const parsed = parseAiJson(askPhrasingSchema, result.text);
        if (parsed) {
          setPhrasing(parsed.headline);
          void track(ANALYTICS_EVENTS.aiAskUsed);
        }
      })
      // Un échec d'appel n'est pas une panne : la réponse déterministe est déjà affichée.
      .catch(() => undefined)
      .finally(() => setAsking(false));
  };

  return (
    <DenseTile title={t('ask.title')} meta={ai.ready ? undefined : t('ask.offlineMeta')} testID="ask-card">
      <View style={styles.questions}>
        {questions.map((question) => {
          const active = question.key === selected?.key;
          return (
            <PressableScale
              key={question.key}
              haptic="select"
              onPress={() => pick(question)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={question.label}
              style={[
                styles.question,
                {
                  backgroundColor: active ? colors.accent : 'transparent',
                  borderColor: active ? colors.accent : colors.borderStrong,
                },
              ]}
            >
              <Text
                style={[styles.questionLabel, { color: active ? colors.accentText : colors.text }]}
                numberOfLines={2}
              >
                {question.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {selected ? (
        <View style={[styles.answer, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.answerText, { color: colors.text }]}>{phrasing ?? selected.answer}</Text>
          {asking ? <ActivityIndicator color={colors.accent} /> : null}
          {/* La formulation vient du modèle, le fond non : on le dit, plutôt que de le laisser croire. */}
          {phrasing ? (
            <Text style={[styles.source, { color: colors.textMuted }]}>{t('ask.rephrased')}</Text>
          ) : null}
          {selected.explanation ? (
            <ExplainButton
              onPress={() => setExplainOpen(true)}
              color={colors.textMuted}
              subject={selected.label}
            />
          ) : null}
        </View>
      ) : null}

      <ExplainSheet
        visible={explainOpen}
        title={selected?.label ?? ''}
        explanation={selected?.explanation ?? null}
        onClose={() => setExplainOpen(false)}
      />
    </DenseTile>
  );
}

const styles = StyleSheet.create({
  questions: { gap: 6 },
  question: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  questionLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13.5 },
  answer: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  answerText: { fontFamily: fontFamily.bodyMedium, fontSize: 14, lineHeight: 20 },
  source: { fontFamily: fontFamily.body, fontSize: 11.5, fontStyle: 'italic' },
});

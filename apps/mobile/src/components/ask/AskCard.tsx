/**
 * US DASH-01 (§7.3) — « **Demande-moi** » : trois questions du moment.
 *
 * ── Ce que la carte fait, et pourquoi elle n'a besoin de personne ────────────────────────────────
 * Le client **calcule la réponse**, à partir des mêmes briques que le reste de l'app (verdict de
 * forme, cible calorique, semaine). Elle est formulée par des clés i18n, donc exacte en FR comme en
 * EN, et chaque réponse montre **d'où elle vient** (« Pourquoi ? »).
 *
 * ── La reformulation par un modèle a été retirée (décision du 13/09/2026) ────────────────────────
 * Le premier jet envoyait la réponse déjà calculée à un modèle pour qu'il la reformule. La surface
 * IA a été retirée du build de lancement : l'app est gratuite en V1, et l'analyse du 15/07/2026
 * (`docs/product/ia-integration-analyse.md`) plaçait l'IA en **palier payant, post-V1** — la garder
 * allumée revenait à payer le modèle pour tout le monde.
 *
 * **Rien n'a été perdu au passage**, et c'est tout l'intérêt de l'inversion d'origine : le modèle ne
 * produisait qu'une **formulation**, jamais un chiffre. La carte répond exactement comme avant.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Explanation } from '@wellness/shared';
import { ExplainButton } from '@/components/explain/ExplainButton';
import { ExplainSheet } from '@/components/explain/ExplainSheet';
import { PressableScale } from '@/components/motion/PressableScale';
import { DenseTile } from '@/components/stage/DenseTile';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Une question du moment : son libellé, la réponse calculée, et d'où elle sort. */
export type AskQuestion = {
  key: string;
  label: string;
  /** La réponse déterministe, formulée par clés i18n. */
  answer: string;
  explanation: Explanation | null;
};

type Props = { questions: readonly AskQuestion[] };

export function AskCard({ questions }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [selected, setSelected] = useState<AskQuestion | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);

  if (questions.length === 0) return null;

  return (
    <DenseTile title={t('ask.title')} meta={t('ask.offlineMeta')} testID="ask-card">
      <View style={styles.questions}>
        {questions.map((question) => {
          const active = question.key === selected?.key;
          return (
            <PressableScale
              key={question.key}
              haptic="select"
              onPress={() => setSelected(question)}
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
          <Text style={[styles.answerText, { color: colors.text }]}>{selected.answer}</Text>
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
});

/**
 * US DASH-01 (§6.2) — le **brief du matin**, lu à voix haute.
 *
 * Trois phrases au plus, construites par `buildMorningBrief` (`@wellness/shared`, pure et testée) à
 * partir de faits **déjà calculés** : verdict de forme, séance du jour, record à portée, écart de
 * protéines, série. Aucun réseau, aucun consentement, aucune IA — et une traduction anglaise exacte,
 * puisque les phrases sont des clés i18n (décision G).
 *
 * ── La lecture ───────────────────────────────────────────────────────────────────────────────────
 * `expo-speech` lit les phrases l'une après l'autre et la transcription **s'allume au rythme de la
 * lecture** : c'est la synthèse locale du téléphone, pas un fichier audio téléchargé. La lecture
 * s'arrête quand le composant se démonte — une voix qui continue sur l'écran suivant serait un
 * défaut, pas une fonctionnalité (R4).
 *
 * La carte ne se rend que le matin, et seulement si elle a quelque chose à dire.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Speech from 'expo-speech';
import { buildMorningBrief, type BriefFacts } from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { DenseTile } from '@/components/stage/DenseTile';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  facts: BriefFacts;
  /** Langue de la synthèse vocale (`fr-FR` / `en-GB`). */
  speechLanguage: string;
};

export function MorningBriefCard({ facts, speechLanguage }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  /** Index de la phrase en cours de lecture, `-1` quand la lecture est à l'arrêt. */
  const [spoken, setSpoken] = useState(-1);

  const sentences = buildMorningBrief(facts).map((sentence) => t(sentence.key, sentence.params));

  // Une voix ne doit jamais survivre à l'écran qui l'a lancée.
  useEffect(() => () => void Speech.stop(), []);

  const speak = () => {
    if (spoken >= 0) {
      void Speech.stop();
      setSpoken(-1);
      return;
    }
    sentences.forEach((sentence, index) => {
      Speech.speak(sentence, {
        language: speechLanguage,
        onStart: () => setSpoken(index),
        // La dernière phrase finie, la transcription s'éteint : l'état suit la voix, pas l'inverse.
        onDone: () => setSpoken((current) => (index === sentences.length - 1 ? -1 : current)),
        onStopped: () => setSpoken(-1),
        onError: () => setSpoken(-1),
      });
    });
  };

  if (sentences.length === 0) return null;

  return (
    <DenseTile title={t('brief.title')} testID="morning-brief-card">
      <View style={styles.lines}>
        {sentences.map((sentence, index) => (
          <Text
            key={sentence}
            style={[
              styles.line,
              { color: index === spoken ? colors.text : colors.textMuted },
              index === spoken && styles.spoken,
            ]}
          >
            {sentence}
          </Text>
        ))}
      </View>

      <PressableScale
        haptic="confirm"
        onPress={speak}
        accessibilityRole="button"
        accessibilityState={{ selected: spoken >= 0 }}
        accessibilityLabel={t(spoken >= 0 ? 'brief.stop' : 'brief.listen')}
        style={[styles.listen, { borderColor: colors.borderStrong }]}
      >
        <Text style={[styles.listenLabel, { color: colors.accent }]}>
          {t(spoken >= 0 ? 'brief.stop' : 'brief.listen')}
        </Text>
      </PressableScale>
    </DenseTile>
  );
}

const styles = StyleSheet.create({
  lines: { gap: 6 },
  line: { fontFamily: fontFamily.bodyMedium, fontSize: 14.5, lineHeight: 21 },
  spoken: { fontFamily: fontFamily.bodyBold },
  listen: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  listenLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13.5 },
});

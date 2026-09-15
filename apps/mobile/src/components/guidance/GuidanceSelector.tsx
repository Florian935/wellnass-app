/**
 * Le sélecteur de régime de guidage — US GUID-01, volet C §5.5.
 *
 * ── Pourquoi il vit dans le pilier, et pas dans les réglages ────────────────────────────────────
 * L'écran Réglages compte déjà **18 sections et 11 interrupteurs**. Une 19ᵉ ligne n'y serait pas
 * « rangée », elle y serait **perdue** — et un réglage qu'on ne retrouve pas revient à un réglage
 * qui n'existe pas. Le régime gouverne un pilier : il se règle là où l'on juge ses effets.
 *
 * ── La mention « déduit », et pourquoi elle n'est pas décorative ────────────────────────────────
 * Le segment montre toujours un régime **appliqué**. Tant que personne n'a choisi, ce régime est un
 * repli — et l'afficher comme une sélection serait refaire, un cran plus haut, le bug des
 * ~614 kcal/jour de NUTRI-UX01 : `activity_level` retombait sur « Modérément actif » et l'écran
 * présentait ce repli comme une réponse de l'utilisateur.
 *
 * Deux mentions distinctes, donc, et pas une :
 *  - rien n'a jamais été choisi → « déduit de ton objectif » ;
 *  - le global a été choisi mais pas ce pilier → « hérité de ton réglage général ».
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  GUIDANCE_REGIMES,
  effectiveRegime,
  hasChosenRegime,
  hasPillarOverride,
  type GuidanceRegime,
  type GuidanceSource,
  type Pillar,
} from '@wellness/shared';
import type { Palette } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';

type Props = {
  pillar: Pillar;
  source: GuidanceSource;
  onChange: (regime: GuidanceRegime) => void;
  colors: Palette;
};

export function GuidanceSelector({ pillar, source, onChange, colors }: Props) {
  const { t } = useTranslation();

  const current = effectiveRegime(source, pillar);
  const chosen = hasChosenRegime(source, pillar);
  const overridden = hasPillarOverride(source, pillar);

  const provenance = !chosen
    ? t('guidance.derivedFromGoal')
    : overridden
      ? null
      : t('guidance.inheritedFromGlobal');

  return (
    <View style={styles.wrap}>
      <View style={[styles.segment, { backgroundColor: colors.track }]}>
        {GUIDANCE_REGIMES.map((option) => {
          const active = current === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${t(`guidance.regimes.${option}.label`)} — ${t(
                `guidance.regimes.${option}.description`,
              )}`}
              onPress={() => onChange(option)}
              style={[
                styles.segmentItem,
                active && { backgroundColor: colors.background },
              ]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  { color: active ? colors.text : colors.textMuted },
                  active && styles.segmentLabelActive,
                ]}
              >
                {t(`guidance.regimes.${option}.label`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {provenance ? (
        <Text style={[styles.provenance, { color: colors.textMuted }]}>{provenance}</Text>
      ) : null}

      <Text style={[styles.explain, { color: colors.textMuted }]}>
        {t(`guidance.pillarEffect.${pillar}.${current}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  segment: { flexDirection: 'row', borderRadius: 13, padding: 3, gap: 3 },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 4,
  },
  segmentLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 13.5 },
  segmentLabelActive: { fontFamily: fontFamily.bodySemi },
  provenance: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    letterSpacing: 0.6,
  },
  explain: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18 },
});

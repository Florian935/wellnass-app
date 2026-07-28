/**
 * US BIEN-01 — l'échelle 1-5 d'un indicateur de bien-être, et ses pictogrammes.
 *
 * Partagée entre la feuille de check-in et le widget pour que le même niveau ait **toujours** le
 * même pictogramme : deux tables de glyphes divergeraient au premier ajout.
 *
 * Trois règles d'accessibilité y sont tenues, et ce sont celles qu'on oublie (CONF-07, 9.11/9.12) :
 * 1. **jamais la couleur seule** — chaque niveau porte pictogramme + libellé + position ;
 * 2. **cible ≥ 48 dp** via `hitSlop` quand le visuel est plus petit (leçon d'UX-04) ;
 * 3. **libellé annoncé en entier** (« Énergie : 4 sur 5, bonne ») plutôt qu'un « 4 » nu.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  WELLBEING_SCALE_MAX,
  WELLBEING_SCALE_MIN,
  type WellbeingIndicator,
  type WellbeingLevel,
} from '@wellness/shared';

import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Les 5 niveaux, dans l'ordre de l'échelle. */
export const WELLBEING_LEVELS: WellbeingLevel[] = [1, 2, 3, 4, 5];

/**
 * Pictogramme par indicateur et par niveau.
 *
 * `stress` monte vers le désagréable (5 = très stressé) : ses glyphes vont donc du calme vers
 * l'agitation, à l'inverse des deux autres. Le sens est porté par le glyphe **et** le libellé i18n,
 * jamais par une teinte.
 */
export const WELLBEING_GLYPHS: Record<WellbeingIndicator, Record<WellbeingLevel, string>> = {
  mood: { 1: '😞', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' },
  energy: { 1: '▁', 2: '▃', 3: '▅', 4: '▆', 5: '█' },
  stress: { 1: '🌿', 2: '🍃', 3: '〜', 4: '⚡', 5: '🔥' },
};

/** Libellé traduit d'un niveau (« Bonne », « Très élevé »…). */
export function useLevelLabel(): (indicator: WellbeingIndicator, level: WellbeingLevel) => string {
  const { t } = useTranslation();
  return (indicator, level) => t(`wellbeing.levels.${indicator}.${level}`);
}

type Props = {
  indicator: WellbeingIndicator;
  value: number | null;
  onChange: (level: WellbeingLevel) => void;
};

/** Une ligne de 5 niveaux tapables pour un indicateur. */
export function WellbeingScale({ indicator, value, onChange }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const levelLabel = useLevelLabel();

  return (
    <View>
      <View style={styles.head}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t(`wellbeing.indicators.${indicator}`)}
        </Text>
        <Text style={[styles.note, { color: colors.textMuted }]}>
          {t(indicator === 'stress' ? 'wellbeing.reversedScale' : 'wellbeing.optional')}
        </Text>
      </View>

      <View
        style={styles.row}
        accessibilityRole="radiogroup"
        accessibilityLabel={t(`wellbeing.indicators.${indicator}`)}
      >
        {WELLBEING_LEVELS.map((level) => {
          const selected = value === level;
          return (
            <Pressable
              key={level}
              onPress={() => onChange(level)}
              // La cible visuelle fait ~62 dp de haut mais peut descendre sous 48 dp de large sur
              // un petit écran : `hitSlop` garantit la cible tactile quoi qu'il arrive.
              hitSlop={8}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t('wellbeing.a11yLevel', {
                indicator: t(`wellbeing.indicators.${indicator}`),
                level,
                label: levelLabel(indicator, level),
              })}
              style={[
                styles.level,
                { borderColor: selected ? colors.accent : colors.border },
                selected && { backgroundColor: colors.track },
              ]}
            >
              <Text style={styles.glyph} maxFontSizeMultiplier={1.4}>
                {WELLBEING_GLYPHS[indicator][level]}
              </Text>
              <Text
                style={[styles.levelLabel, { color: selected ? colors.text : colors.textMuted }]}
                numberOfLines={2}
                // Les libellés sont courts et à 5 par ligne : sans plafond, ils se tronquent
                // à grande taille de police système (critère de recette 10).
                maxFontSizeMultiplier={1.3}
              >
                {levelLabel(indicator, level)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Résumé non interactif d'un niveau : pictogramme + libellé. Utilisé par le widget. */
export function WellbeingLevelSummary({
  indicator,
  level,
}: {
  indicator: WellbeingIndicator;
  level: WellbeingLevel;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const levelLabel = useLevelLabel();

  return (
    <View style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.track }]}>
      <Text style={styles.glyph} maxFontSizeMultiplier={1.4}>
        {WELLBEING_GLYPHS[indicator][level]}
      </Text>
      <Text
        style={[styles.summaryValue, { color: colors.text }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
      >
        {levelLabel(indicator, level)}
      </Text>
      <Text style={[styles.summaryCaption, { color: colors.textMuted }]} maxFontSizeMultiplier={1.3}>
        {t(`wellbeing.indicators.${indicator}`)}
      </Text>
    </View>
  );
}

/** Borne d'échelle réexportée pour l'UI (une seule source : `@wellness/shared`). */
export { WELLBEING_SCALE_MAX, WELLBEING_SCALE_MIN };

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  note: { fontFamily: fontFamily.body, fontSize: 11, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 6, marginTop: 8 },
  level: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 3,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  glyph: { fontSize: 18, lineHeight: 22 },
  levelLabel: { fontFamily: fontFamily.bodySemi, fontSize: 10, textAlign: 'center' },
  summary: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
  },
  summaryValue: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  summaryCaption: { fontFamily: fontFamily.body, fontSize: 10, textTransform: 'uppercase' },
});

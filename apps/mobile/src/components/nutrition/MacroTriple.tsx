/**
 * Les 3 macros du jour, en **colonnes côte à côte** — refonte Nutrition (30/07/2026).
 *
 * Avant, les macros étaient 3 lignes empilées sous les calories, dans la même carte : elles
 * occupaient autant de hauteur que le bilan lui-même alors qu'elles se lisent d'un coup d'œil.
 * En colonnes, la carte tient sur ~90 px et la comparaison entre macros devient immédiate.
 *
 * Une couleur par macro (protéines accent · glucides ambre · lipides vert), reprise de la
 * maquette. Le remplissage est **borné à 100 %** — le dépassement se lit sur les chiffres,
 * pas sur une barre qui déborderait de sa piste.
 */

import { StyleSheet, Text, View } from 'react-native';
import { AnimatedBar } from '@/components/motion/AnimatedBar';
import { useTranslation } from 'react-i18next';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export const MACRO_KEYS = ['protein', 'carbs', 'fat'] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];

export function MacroTriple({
  consumed,
  targets,
}: {
  consumed: Record<MacroKey, number>;
  /** Cibles en grammes, ou `null` si aucun objectif n'est défini (barres à vide). */
  targets: Record<MacroKey, number> | null;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const colorOf: Record<MacroKey, string> = {
    protein: colors.accent,
    carbs: colors.amber,
    fat: colors.chartGreen,
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {MACRO_KEYS.map((key, index) => {
        const value = consumed[key];
        const goal = targets?.[key] ?? 0;
        const pct = goal > 0 ? Math.min(1, value / goal) : 0;
        return (
          <View key={key} style={styles.col}>
            <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
              {t(`nutrition.macros.${key}`)}
            </Text>
            {/*
              MOTION-01 (N2) : les trois barres se remplissent **décalées de 60 ms**. Parties
              ensemble, elles se lisaient comme un seul bloc qui grandit et on ne voyait plus
              qu'elles ont des longueurs différentes ; décalées, l'œil les compare une à une.

              Décélération pure, jamais de ressort (règle R6) : une jauge de protéines qui dépasse
              puis revient affiche un chiffre faux sur une donnée qu'on surveille.
            */}
            <AnimatedBar
              pct={pct}
              index={index}
              color={colorOf[key]}
              trackColor={colors.track}
              height={8}
            />
            <Text style={[styles.value, { color: colors.textMuted }]} numberOfLines={1}>
              {value}
              {goal > 0 ? ` / ${goal}` : ''} g
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', gap: 16 },
  col: { flex: 1 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 12, marginBottom: 6 },
  value: { fontFamily: fontFamily.monoBold, fontSize: 11, marginTop: 6 },
});

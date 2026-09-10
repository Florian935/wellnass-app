/**
 * Rendu d'un widget à la forme `row` — une ligne, et rien de plus (US ACCUEIL-04).
 *
 * La forme `row` mesure une demi-case de haut (79 px sur le cadre de référence, rembourrage
 * compris). Il n'y a donc de place que pour **un sur-titre, une valeur et un complément** : toute
 * tentative d'y mettre un graphique ou deux boutons serait tronquée par l'`overflow: hidden` de la
 * cellule.
 *
 * Ce composant existe pour que les huit widgets n'aient pas chacun leur version de cette ligne.
 * Sans lui, `row` serait la quatrième déclinaison à écrire huit fois — et la plus susceptible de
 * divergences, puisque c'est la plus contrainte.
 *
 * ⚠️ **La cible tactile fait au moins 44 dp** malgré la hauteur réduite : c'est l'exigence
 * d'accessibilité du dépôt (navigation-ux §8), et une bande de 79 px la satisfait sans effort — à
 * condition que la zone pressable couvre toute la carte, ce que fait `WidgetFrame`.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Eyebrow, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function RowLine({
  eyebrow,
  value,
  /** Complément aligné à droite : delta, objectif, pourcentage… Optionnel. */
  trailing,
  trailingTone = 'muted',
  /** Rend la valeur en couleur atténuée (état vide). */
  muted = false,
  onPress,
  accessibilityLabel,
}: {
  eyebrow: string;
  value: string;
  trailing?: string;
  trailingTone?: 'muted' | 'success' | 'accent';
  muted?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();

  const trailingColor =
    trailingTone === 'success'
      ? colors.success
      : trailingTone === 'accent'
        ? colors.accent
        : colors.textMuted;

  return (
    <WidgetFrame pad={16} onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <View style={styles.row}>
        <View style={styles.left}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <Text
            style={[styles.value, { color: muted ? colors.textMuted : colors.text }]}
            numberOfLines={1}
            // Une bande ne peut pas grandir : au-delà de ce facteur, le texte serait rogné. On
            // borne donc la mise à l'échelle plutôt que de laisser couper (navigation-ux §8).
            maxFontSizeMultiplier={1.3}
          >
            {value}
          </Text>
        </View>
        {trailing ? (
          <Text
            style={[styles.trailing, { color: trailingColor }]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
          >
            {trailing}
          </Text>
        ) : null}
        {onPress ? (
          <Text style={[styles.chevron, { color: colors.textMuted }]} maxFontSizeMultiplier={1.2}>
            {'›'}
          </Text>
        ) : null}
      </View>
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  left: { flex: 1, minWidth: 0, gap: 2 },
  value: { fontFamily: fontFamily.displayBold, fontSize: 17, letterSpacing: -0.3 },
  trailing: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
  chevron: { fontFamily: fontFamily.bodySemi, fontSize: 18 },
});

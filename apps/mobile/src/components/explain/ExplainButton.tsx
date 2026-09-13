/**
 * US DASH-01 (§6.1) — le point d'entrée de « Pourquoi ? », posé à côté d'un chiffre calculé.
 *
 * Discret par construction : une icône et un mot, jamais un bouton plein. Le chiffre reste le sujet ;
 * l'explication est offerte, pas imposée. 44 px de cible tout de même — c'est un vrai bouton.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/motion/PressableScale';
import { fontFamily } from '@/theme/fonts';

type Props = {
  onPress: () => void;
  /** Couleur de l'encre — la scène et le corps n'ont pas le même fond. */
  color: string;
  /** Ce que le bouton explique, pour le nom accessible (« Pourquoi : cible calorique »). */
  subject: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ExplainButton({ onPress, color, subject, style, testID }: Props) {
  const { t } = useTranslation();

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t('explain.cta')} ${subject}`}
      hitSlop={8}
      scaleTo={0.94}
      style={[styles.button, style]}
    >
      <Ionicons name="information-circle-outline" size={15} color={color} />
      <Text style={[styles.label, { color }]}>{t('explain.cta')}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingRight: 4 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 12.5, textDecorationLine: 'underline' },
});

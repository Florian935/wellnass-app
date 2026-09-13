/**
 * US DASH-01 — une action secondaire de scène, réduite à son icône.
 *
 * Les scènes portent deux ou trois accès (profil, historique, scan, réglages) qui doivent tenir sur
 * une ligne sans voler la place du contenu. 44 px de haut : la cible reste conforme (WCAG 2.5.5)
 * même quand l'icône, elle, est petite.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { PressableScale } from '@/components/motion/PressableScale';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  /** Nom accessible — les icônes seules n'en ont aucun. */
  label: string;
  onPress: () => void;
  color: string;
  size?: number;
};

export function StageIconButton({ icon, label, onPress, color, size = 21 }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      scaleTo={0.9}
      style={styles.button}
    >
      <Ionicons name={icon} size={size} color={color} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
});

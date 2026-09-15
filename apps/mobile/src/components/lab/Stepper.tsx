/**
 * US LABO-01 — le bouton rond des leviers (« − », « + », « essayer »).
 *
 * Cible tactile de 44 px, libellé accessible explicite : « Augmenter les séances », pas « + ».
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/useTheme';

type Props = {
  label: string;
  onPress: () => void;
  icon: 'add' | 'remove' | 'arrow-forward';
  disabled?: boolean;
};

export function Stepper({ label, onPress, icon, disabled = false }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, { borderColor: colors.border, opacity: disabled ? 0.35 : 1 }]}
      hitSlop={4}
    >
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});

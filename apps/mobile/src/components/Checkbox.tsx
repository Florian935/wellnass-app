import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';

type CheckboxProps = {
  checked: boolean;
  onToggle: () => void;
  /** Libellé (souvent riche : texte + liens), rendu à droite de la case. */
  children: ReactNode;
  accessibilityLabel: string;
};

export function Checkbox({ checked, onToggle, children, accessibilityLabel }: CheckboxProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      onPress={onToggle}
      style={styles.row}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? colors.accent : colors.border,
            backgroundColor: checked ? colors.accent : 'transparent',
          },
        ]}
      >
        {checked ? <Ionicons name="checkmark" size={16} color={colors.accentText} /> : null}
      </View>
      <View style={styles.label}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  label: { flex: 1 },
});

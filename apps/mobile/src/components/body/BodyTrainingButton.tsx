import { Pressable, StyleSheet, Text } from 'react-native';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function BodyTrainingButton({ label, onPress, primary = false, disabled = false }: {
  label: string; onPress: () => void; primary?: boolean; disabled?: boolean;
}) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={[styles.button, {
      borderColor: colors.borderStrong, backgroundColor: primary ? colors.accent : colors.surface, opacity: disabled ? 0.5 : 1,
    }]}>
    <Text style={[styles.label, { color: primary ? colors.accentText : colors.text }]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: 16, borderWidth: 1, padding: 12, justifyContent: 'center', alignItems: 'center' },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 15, textAlign: 'center' },
});

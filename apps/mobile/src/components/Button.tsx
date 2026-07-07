import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: ButtonProps) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isPrimary
          ? { backgroundColor: colors.accent }
          : { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
        (pressed || isDisabled) && { opacity: isDisabled ? 0.5 : 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.accentText : colors.accent} />
      ) : (
        <Text
          numberOfLines={1}
          style={[styles.label, { color: isPrimary ? colors.accentText : colors.text }]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
});

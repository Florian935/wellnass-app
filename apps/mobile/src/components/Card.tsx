import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';

type CardProps = {
  children: ReactNode;
  style?: ViewStyle;
};

/** Surface de carte thémée (rayon + bordure cohérents avec la maquette). */
export function Card({ children, style }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={StyleSheet.flatten([
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ])}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
});

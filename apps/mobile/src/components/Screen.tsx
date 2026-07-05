import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';

type ScreenProps = {
  children: ReactNode;
  /** Bords où appliquer le safe-area (par défaut haut + bas). */
  edges?: readonly Edge[];
  center?: boolean;
};

/** Conteneur d'écran thémé (fond + safe area cohérents partout). */
export function Screen({ children, edges = ['top', 'bottom'], center = false }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.content, center && styles.centered]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: 20 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16 },
});

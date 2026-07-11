import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Bloc du tableau de bord : en-tête (icône + titre) puis contenu. */
export function DashboardCard({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={18} color={colors.accent} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.3 },
});

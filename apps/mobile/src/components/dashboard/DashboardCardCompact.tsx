/**
 * Variante compacte d'un widget du dashboard (US 7.11).
 *
 * Rendu « une ligne » : icône + titre court à gauche, valeur clé à droite,
 * conformément à la maquette (`.card.compact`). Réutilise la surface `Card`
 * pour rester cohérent visuellement avec la carte normale (`DashboardCard`).
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type IconName = keyof typeof Ionicons.glyphMap;

export function DashboardCardCompact({
  icon,
  title,
  value,
}: {
  icon: IconName;
  title: string;
  /** Valeur clé affichée à droite (déjà formatée / localisée). */
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Ionicons name={icon} size={18} color={colors.accent} />
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // Padding réduit vs carte normale (maquette : .card.compact { padding:12px 16px }).
  card: { paddingVertical: 12, paddingHorizontal: 16, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: fontFamily.displaySemi, fontSize: 14, letterSpacing: -0.2 },
  value: {
    marginLeft: 'auto',
    fontFamily: fontFamily.displayBold,
    fontSize: 17,
    letterSpacing: -0.3,
  },
});

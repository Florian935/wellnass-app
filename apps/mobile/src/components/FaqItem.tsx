import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Item de FAQ contrôlé : le parent pilote l'état `expanded` (accordéon mono-ouverture).
 * L'en-tête est un bouton accessible (rôle + état `expanded`) ; la réponse n'est montée
 * dans l'arbre que lorsqu'elle est ouverte.
 */
export function FaqItem({
  question,
  answer,
  expanded,
  onToggle,
}: {
  question: string;
  answer: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={question}
        onPress={onToggle}
        style={styles.header}
      >
        <Text style={[styles.q, { color: colors.text }]}>{question}</Text>
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>
      {expanded ? <Text style={[styles.a, { color: colors.textMuted }]}>{answer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  q: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 15 },
  a: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
});

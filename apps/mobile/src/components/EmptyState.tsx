import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  cta?: { label: string; onPress: () => void };
};

/**
 * État vide soigné (spec navigation-ux §4.4) : icône + explication + action.
 * Jamais d'écran vide sans texte ni CTA. L'icône n'est jamais le seul porteur de sens.
 */
export function EmptyState({ icon, title, message, cta }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name={icon} size={34} color={colors.accent} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
      {cta ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cta.label}
          onPress={cta.onPress}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.ctaLabel, { color: colors.accentText }]}>{cta.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontFamily: fontFamily.displayBold, fontSize: 20, letterSpacing: -0.4, textAlign: 'center' },
  message: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 300 },
  cta: {
    marginTop: 12,
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
});

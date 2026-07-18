import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type ModulePreviewCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  /** Ouvre le module au tap sur la carte entière. */
  onPress: () => void;
  /** Aperçu du contenu du module (résumé) rendu sous l'en-tête. */
  children?: ReactNode;
  accessibilityHint?: string;
};

/**
 * Carte de module « aperçu » : en-tête (icône + titre + chevron) surmontant un
 * résumé du contenu réel du module. Toute la carte est tappable et ouvre le
 * module (le bouton générique est supprimé — cf. refonte des onglets piliers).
 */
export function ModulePreviewCard({
  icon,
  title,
  onPress,
  children,
  accessibilityHint,
}: ModulePreviewCardProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name={icon} size={18} color={colors.accent} />
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
      {children ? <View style={styles.body}>{children}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 18, gap: 12 },
  pressed: { opacity: 0.7 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  title: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.3 },
  body: { gap: 8 },
});

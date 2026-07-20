/**
 * Coquille tappable d'un widget aux formes **carrées** (`small` / `large`).
 *
 * Remplit toute la hauteur de sa cellule de grille (le ratio est imposé par `WidgetGrid`) :
 * en-tête (icône + titre, chevron optionnel) puis corps aligné en bas. La forme `wide`
 * (rectangle) réutilise, elle, `ModulePreviewCard` directement — pas cette coquille.
 *
 * `value` = raccourci pour un chiffre clé (forme `small`) ; `children` = contenu libre
 * (forme `large`). Toute la carte ouvre le module au tap.
 */

import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type IconName = keyof typeof Ionicons.glyphMap;

export function WidgetShell({
  icon,
  title,
  onPress,
  value,
  valueMuted,
  children,
  showChevron,
  accessibilityHint,
}: {
  icon: IconName;
  title: string;
  /** Ouvre le module au tap. Absent → carte non tappable (ex. streak sans écran dédié). */
  onPress?: () => void;
  /** Chiffre/étiquette clé, aligné en bas (forme `small`). */
  value?: string;
  /** Rend `value` en couleur atténuée (ex. état vide « Aucun »). */
  valueMuted?: boolean;
  /** Contenu libre sous l'en-tête (forme `large`). */
  children?: ReactNode;
  /** Affiche le chevron d'ouverture dans l'en-tête (forme `large`). */
  showChevron?: boolean;
  accessibilityHint?: string;
}) {
  const { colors } = useTheme();

  const inner = (
    <>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name={icon} size={18} color={colors.accent} />
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {showChevron && onPress ? (
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        ) : null}
      </View>

      {children ? <View style={styles.body}>{children}</View> : null}

      {value !== undefined ? (
        <Text
          style={[styles.value, { color: valueMuted ? colors.textMuted : colors.text }]}
          numberOfLines={2}
        >
          {value}
        </Text>
      ) : null}
    </>
  );

  const baseStyle: ViewStyle = {
    ...styles.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
  };

  if (!onPress) {
    return <View style={baseStyle}>{inner}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [baseStyle, pressed && styles.pressed]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    height: '100%',
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  pressed: { opacity: 0.7 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  title: { fontFamily: fontFamily.displaySemi, fontSize: 15, letterSpacing: -0.3, flexShrink: 1 },
  body: { gap: 6, flex: 1 },
  // Chiffre clé aligné en bas de la carte carrée.
  value: {
    marginTop: 'auto',
    fontFamily: fontFamily.displayBold,
    fontSize: 20,
    letterSpacing: -0.4,
  },
});

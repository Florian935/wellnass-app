/**
 * US DASH-01 — la tuile dense (geste B de la maquette : fusionner au lieu d'empiler).
 *
 * Une tuile qui accepte **plusieurs informations** — un titre, un repère, un contenu libre — plutôt
 * qu'un chiffre isolé dans un rectangle à moitié vide. Mêmes rayon, bordure et surface que `Card`.
 * Touchable seulement si une action est fournie.
 */

import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale } from '@/components/motion/PressableScale';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  title: string;
  meta?: string;
  children?: ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function DenseTile({ title, meta, children, onPress, accessibilityHint, style, testID }: Props) {
  const { colors } = useTheme();

  const header = (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {title}
      </Text>
      {meta ? (
        <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
    </View>
  );

  const frame = [styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }, style];

  if (onPress) {
    return (
      <PressableScale
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        style={frame}
      >
        {header}
        {children}
      </PressableScale>
    );
  }

  return (
    <View testID={testID} style={frame}>
      {header}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: fontFamily.displayBold, fontSize: 15, letterSpacing: -0.3 },
  meta: { fontFamily: fontFamily.mono, fontSize: 11 },
});

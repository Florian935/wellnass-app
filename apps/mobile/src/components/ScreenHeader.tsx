import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Élément aligné à droite (ex. bouton profil/réglages). */
  action?: ReactNode;
};

/** En-tête d'écran cohérent (gros titre display + sous-titre optionnel + action à droite). */
export function ScreenHeader({ title, subtitle, action }: ScreenHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <View style={styles.texts}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  texts: { flex: 1, gap: 2 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 28, letterSpacing: -0.8 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 19 },
});

/**
 * « Séance en cours · Reprendre », en tête d'Historique et de Progrès — US MUSCU-UX07, D3.
 *
 * Rien ne change d'onglet de force : on ne renvoie pas l'utilisateur sur S'entraîner à chaque retour
 * d'un détail consulté entre deux séries. En contrepartie, « Reprendre » n'est jamais caché.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/motion/PressableScale';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function ResumeLine({ name, onPress }: { name: string; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <PressableScale
      testID="strength-resume-line"
      haptic="confirm"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t('strengthHub.resumeLine.title')} · ${name} · ${t('strengthHub.resumeLine.action')}`}
      style={[styles.line, { backgroundColor: colors.accent }]}
    >
      <Ionicons name="play" size={16} color={colors.accentText} />
      <Text style={[styles.title, { color: colors.accentText }]} numberOfLines={1}>
        {t('strengthHub.resumeLine.title')} · {name}
      </Text>
      <Text style={[styles.action, { color: colors.accentText }]}>{t('strengthHub.resumeLine.action')}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  title: { flex: 1, fontFamily: fontFamily.bodyBold, fontSize: 14.5 },
  action: { fontFamily: fontFamily.bodyBold, fontSize: 14, textDecorationLine: 'underline' },
});

/**
 * « Course en cours · Reprendre », en tête d'Historique et de Progrès — US CARDIO-UX03, D1.
 *
 * Rien ne change d'onglet de force : on ne renvoie pas le coureur sur Courir à chaque retour d'un
 * détail consulté en pleine sortie. En contrepartie, « Reprendre » n'est jamais caché. Même règle que
 * la ligne muscu (`ResumeLine`, MUSCU-UX07 D3), dupliquée exprès (spec §11).
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/motion/PressableScale';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function RunResumeLine({ detail, onPress }: { detail: string; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <PressableScale
      testID="run-resume-line"
      haptic="confirm"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t('runningHub.resumeLine.title')} · ${detail} · ${t('runningHub.resumeLine.action')}`}
      style={[styles.line, { backgroundColor: colors.accent }]}
    >
      <Ionicons name="play" size={16} color={colors.accentText} />
      <Text style={[styles.title, { color: colors.accentText }]} numberOfLines={1}>
        {t('runningHub.resumeLine.title')} · {detail}
      </Text>
      <Text style={[styles.action, { color: colors.accentText }]}>{t('runningHub.resumeLine.action')}</Text>
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

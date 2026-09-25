/**
 * « Autre chose » : séance libre et modèles — US MUSCU-UX07, §4.2-3.
 *
 * Les trois entrées de l'ancienne feuille « Séance libre » (MUSCU-FIX02) ont chacune leur place :
 * refaire est juste au-dessus, composer et les modèles sont ici. Un modèle se lance désormais depuis
 * sa fiche, un geste de plus : c'est assumé, les modèles restent rares.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/motion/PressableScale';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function OtherActions({ onFree, onTemplates }: { onFree: () => void; onTemplates: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const tile = (testID: string, icon: 'add' | 'layers-outline', label: string, onPress: () => void) => (
    <PressableScale
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Ionicons name={icon} size={20} color={colors.accent} />
      <Text style={[styles.label, { color: colors.text }]} numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
  );

  return (
    <View style={styles.block}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t('strengthHub.other.title')}
      </Text>
      <View style={styles.row}>
        {tile('strength-free', 'add', t('strengthHub.other.free'), onFree)}
        {tile('strength-templates', 'layers-outline', t('strengthHub.other.templates'), onTemplates)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 20, letterSpacing: -0.4 },
  row: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  label: { flex: 1, fontFamily: fontFamily.bodyBold, fontSize: 14.5 },
});

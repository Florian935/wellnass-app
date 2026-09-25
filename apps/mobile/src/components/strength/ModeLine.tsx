/**
 * « Mode classique · Changer », sous Démarrer — US MUSCU-UX07, D4.
 *
 * Remplace le sélecteur à deux boutons qui trônait au-dessus de Démarrer (MUSCU-UX03, R-MO-2). La
 * règle ne change pas — on choisit au moment de partir —, seul l'encombrement change : un réglage
 * qu'on touche rarement cède sa place à « la dernière fois », qu'on lit à chaque séance.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WorkoutDisplayMode } from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function ModeLine({ mode, onChange }: { mode: WorkoutDisplayMode; onChange: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const label = t(mode === 'immersive' ? 'strengthHub.mode.immersive' : 'strengthHub.mode.classic');

  return (
    <PressableScale
      testID="strength-mode-line"
      onPress={onChange}
      accessibilityRole="button"
      accessibilityLabel={`${label} · ${t('strengthHub.mode.change')}`}
      style={styles.line}
    >
      <Ionicons name="swap-horizontal" size={15} color={colors.textMuted} />
      <Text style={[styles.label, { color: colors.textMuted }]}>
        {label} · <Text style={{ color: colors.accent, fontFamily: fontFamily.bodyBold }}>{t('strengthHub.mode.change')}</Text>
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  line: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 8,
  },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});

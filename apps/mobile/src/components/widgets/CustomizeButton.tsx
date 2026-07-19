/**
 * Bouton « Personnaliser / Terminé » d'un hub à grille de widgets (muscu / course).
 *
 * Bascule l'état d'édition. Miroir du bouton de l'accueil (`(tabs)/index.tsx`), extrait
 * pour être partagé par les hubs piliers.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function CustomizeButton({
  editing,
  onToggle,
}: {
  editing: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: editing }}
      accessibilityLabel={editing ? t('home.customize.done') : t('home.customize.edit')}
      onPress={onToggle}
      hitSlop={8}
      style={StyleSheet.flatten([
        styles.btn,
        editing
          ? { backgroundColor: colors.accent, borderColor: colors.accent }
          : { backgroundColor: colors.surface, borderColor: colors.border },
      ])}
    >
      <Ionicons
        name={editing ? 'checkmark' : 'create-outline'}
        size={16}
        color={editing ? '#fff' : colors.text}
      />
      <Text style={[styles.label, { color: editing ? '#fff' : colors.text }]}>
        {editing ? t('home.customize.done') : t('home.customize.edit')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
});

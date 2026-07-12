/**
 * Contrôles d'édition d'un widget du dashboard (US 7.1/7.3/7.11).
 *
 * Barre affichée sous chaque carte en mode édition : poignée de déplacement
 * (rendue par l'appelant pour le drag — cf. Tâche 5), bouton œil
 * (masquer/afficher — sur TOUS les widgets, masquabilité uniforme) et bascule
 * de taille (compacte ↔ normale). Conforme à la maquette (`.edit-overlay`).
 */

import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WidgetSize } from '@wellness/shared';
import { useTheme } from '@/theme/useTheme';

export function DashboardEditControls({
  visible,
  size,
  onToggleVisible,
  onToggleSize,
  handle,
}: {
  visible: boolean;
  size: WidgetSize;
  onToggleVisible: () => void;
  onToggleSize: () => void;
  /** Poignée de déplacement (drag), fournie par l'appelant (Tâche 5). */
  handle?: ReactNode;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={[styles.overlay, { borderTopColor: colors.border }]}>
      {handle}

      {/* Œil — masquer/afficher (présent sur tous les widgets, streak compris) */}
      <Pressable
        onPress={onToggleVisible}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ selected: visible }}
        accessibilityLabel={visible ? t('home.customize.hide') : t('home.customize.show')}
        style={[
          styles.ctrl,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          visible && { borderColor: colors.accent },
        ]}
      >
        <Ionicons
          name={visible ? 'eye-outline' : 'eye-off-outline'}
          size={17}
          color={visible ? colors.accent : colors.text}
        />
      </Pressable>

      {/* Bascule de taille — compacte ↔ normale */}
      <Pressable
        onPress={onToggleSize}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ selected: size === 'compact' }}
        accessibilityLabel={
          size === 'compact' ? t('home.customize.sizeFull') : t('home.customize.sizeCompact')
        }
        style={[
          styles.ctrl,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          size === 'compact' && { borderColor: colors.accent },
        ]}
      >
        <Ionicons
          name={size === 'compact' ? 'reorder-three-outline' : 'square-outline'}
          size={17}
          color={size === 'compact' ? colors.accent : colors.text}
        />
      </Pressable>

      <View style={styles.grow} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctrl: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1 },
});

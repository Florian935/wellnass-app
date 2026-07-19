/**
 * Contrôles d'édition d'un widget (US 7.1/7.3/7.11 ; étendu au moteur multi-formes).
 *
 * Barre affichée sous chaque carte en mode édition : poignée de déplacement (rendue par
 * l'appelant pour le drag), bouton œil (masquer/afficher — sur TOUS les widgets,
 * masquabilité uniforme) et **sélecteur de forme à 3 états** qui cycle
 * `small → wide → large` (petit carré → rectangle → grand carré). Conforme à la maquette
 * (`.edit-overlay` + `.ctrl.shape`).
 */

import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WidgetSize } from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** Icône + clé i18n du libellé, par forme (l'ordre du cycle est porté par le repository). */
const SHAPE_META: Record<WidgetSize, { icon: IoniconName; labelKey: string }> = {
  small: { icon: 'square-outline', labelKey: 'widgets.customize.shapeSmall' },
  wide: { icon: 'tablet-landscape-outline', labelKey: 'widgets.customize.shapeWide' },
  large: { icon: 'grid-outline', labelKey: 'widgets.customize.shapeLarge' },
};

export function DashboardEditControls({
  visible,
  size,
  onToggleVisible,
  onCycleSize,
  handle,
}: {
  visible: boolean;
  size: WidgetSize;
  onToggleVisible: () => void;
  /** Passe à la forme suivante du cycle (small → wide → large → small). */
  onCycleSize: () => void;
  /** Poignée de déplacement (drag), fournie par l'appelant. */
  handle?: ReactNode;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const shape = SHAPE_META[size];

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

      {/* Sélecteur de forme — cycle les 3 formes, libellé = forme courante */}
      <Pressable
        onPress={onCycleSize}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('widgets.customize.shapeCycle', {
          shape: t(shape.labelKey),
        })}
        style={[
          styles.ctrl,
          styles.shape,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.accent },
        ]}
      >
        <Ionicons name={shape.icon} size={17} color={colors.accent} />
        <Text style={[styles.shapeLabel, { color: colors.accent }]} numberOfLines={1}>
          {t(shape.labelKey)}
        </Text>
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
  shape: {
    width: 'auto',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
  },
  shapeLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  grow: { flex: 1 },
});

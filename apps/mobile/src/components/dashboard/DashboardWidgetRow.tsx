/**
 * Ligne d'un widget du dashboard en mode édition (US 7.1/7.3).
 *
 * Enveloppe le widget rendu : en mode édition, applique le repère visuel
 * « édition » (bord pointillé), le marquage « Masqué » (grisé + badge) pour les
 * widgets non visibles, et la barre de contrôles (poignée/œil/taille). Hors
 * édition, la ligne est transparente (le widget se rend seul).
 *
 * Conforme à la maquette (`.editing .card`, `.card.hidden`, `.badge-hidden`).
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WidgetSize } from '@wellness/shared';
import { DashboardEditControls } from '@/components/dashboard/DashboardEditControls';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function DashboardWidgetRow({
  editing,
  visible,
  size,
  onToggleVisible,
  onCycleSize,
  handle,
  children,
}: {
  editing: boolean;
  visible: boolean;
  size: WidgetSize;
  onToggleVisible: () => void;
  /** Passe le widget à la forme suivante (small → wide → large → small). */
  onCycleSize: () => void;
  /** Poignée de déplacement (drag), fournie par l'appelant. */
  handle?: ReactNode;
  /** Le widget rendu. */
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  if (!editing) {
    return <>{children}</>;
  }

  return (
    <View
      style={[
        styles.frame,
        { borderColor: colors.accent },
        !visible && styles.hidden,
      ]}
    >
      {!visible ? (
        <Text style={[styles.hiddenBadge, { color: colors.textMuted }]}>
          {t('home.customize.hiddenBadge')}
        </Text>
      ) : null}

      {/* Widget non interactif en édition (les contrôles priment). */}
      <View pointerEvents="none">{children}</View>

      <DashboardEditControls
        visible={visible}
        size={size}
        onToggleVisible={onToggleVisible}
        onCycleSize={onCycleSize}
        handle={handle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 22,
    padding: 6,
    position: 'relative',
  },
  hidden: { opacity: 0.5 },
  hiddenBadge: {
    position: 'absolute',
    top: 18,
    right: 20,
    zIndex: 1,
    fontFamily: fontFamily.bodySemi,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

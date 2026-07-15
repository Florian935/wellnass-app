/**
 * Badge de variation réutilisable — flèche (↑/↓/→) + libellé ("+12 %" ou
 * "nouveau"), ton NEUTRE (couleur accent, jamais vert/rouge).
 *
 * Purement présentationnel : ce composant ne décide jamais s'il doit être
 * affiché ou non (ex. période « all » sans base de comparaison) — c'est au
 * parent de ne pas le monter dans ce cas.
 */
import type { PercentChange } from '@wellness/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type DeltaBadgeProps = {
  change: PercentChange;
  style?: StyleProp<ViewStyle>;
};

const ICON_BY_DIRECTION = {
  up: 'arrow-up',
  down: 'arrow-down',
  flat: 'remove',
} as const;

export function DeltaBadge({ change, style }: DeltaBadgeProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const label =
    change.pct != null
      ? `${change.pct > 0 ? '+' : ''}${change.pct} %`
      : t('stats.delta.new');

  const accessibilityLabel =
    change.pct === null
      ? t('stats.delta.a11y.new')
      : t(`stats.delta.a11y.${change.direction}`, { pct: Math.abs(change.pct) });

  return (
    <View
      style={StyleSheet.flatten([styles.row, style])}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={ICON_BY_DIRECTION[change.direction]} size={14} color={colors.accent} />
      <Text style={[styles.label, { color: colors.accent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
  },
});

import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { PressableScale, type PressHaptic } from '@/components/motion/PressableScale';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'destructive';
  loading?: boolean;
  disabled?: boolean;
  /**
   * Nom accessible, quand le `label` ne suffit pas : un bouton dont le libellé est un glyphe
   * (« − », « + ») n'annonce rien d'exploitable au lecteur d'écran (US PAS-01).
   */
  accessibilityLabel?: string;
  /**
   * Retour tactile à l'appui (MOTION-01). Défaut `select`, le plus discret.
   * Un bouton qui clôt une séance ou valide un objectif peut passer à `milestone`.
   */
  haptic?: PressHaptic;
  /** Repère de test, transmis tel quel. */
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
  haptic = 'select',
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const isDestructive = variant === 'destructive';
  const isSolid = isPrimary || isDestructive;
  const isDisabled = disabled || loading;

  // Couleurs selon la variante : plein (accent / danger) ou contour (ghost).
  const solidColor = isDestructive ? colors.danger : colors.accent;
  const spinnerColor = isSolid ? colors.accentText : colors.accent;
  const labelColor = isSolid ? colors.accentText : colors.text;

  return (
    // MOTION-01 : l'enfoncement remplace le `opacity: 0.85` d'origine — sous le pouce qui recouvre
    // le bouton, une variation d'opacité est le retour le plus faible qui existe. L'opacité reste
    // employée pour l'état **désactivé**, où elle dit autre chose (« indisponible », pas « pressé »).
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      haptic={isDisabled ? 'none' : haptic}
      style={[
        styles.button,
        isSolid
          ? { backgroundColor: solidColor }
          : // Variante contour : le trait est la **seule** chose qui délimite le bouton, donc
            // `borderStrong` (3:1) et non `border`. Sans lui, un bouton secondaire n'a pas de
            // limite perceptible.
            { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderStrong },
        isDisabled && { opacity: 0.5 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text numberOfLines={1} style={[styles.label, { color: labelColor }]}>
          {label}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
});

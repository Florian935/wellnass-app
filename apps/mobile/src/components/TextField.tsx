import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type TextFieldProps = TextInputProps & {
  label: string;
};

export function TextField({ label, style, ...inputProps }: TextFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        // Le label n'est qu'un `Text` voisin : rien ne le relie au champ pour TalkBack, qui annonce
        // donc « champ de saisie » sans dire lequel. On le reprend comme libellé par défaut — placé
        // **avant** le spread, un `accessibilityLabel` explicite de l'appelant le remplace.
        // Constaté le 30/07/2026 en passe device (11 champs muets, dont 8 sur « Créer un aliment »).
        accessibilityLabel={label}
        style={[
          styles.input,
          // `borderStrong` et non `border` : la limite d'un champ de saisie doit être perceptible
          // (WCAG 1.4.11, 3:1). Avec `border`, un champ vide se confondait avec la page — flagrant
          // en thème clair, où tout est pâle.
          { backgroundColor: colors.surface, borderColor: colors.borderStrong, color: colors.text },
          style,
        ]}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  input: {
    fontFamily: fontFamily.body,
    fontSize: 16,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
});

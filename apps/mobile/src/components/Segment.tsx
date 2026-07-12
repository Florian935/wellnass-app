import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type SegmentProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: (option: T) => string;
  /**
   * Opt-in : rend le sélecteur défilable horizontalement (options à largeur
   * intrinsèque, une ligne, pas de retour à la ligne). Par défaut `false` →
   * comportement historique inchangé (items en `flex: 1` répartis sur la largeur).
   * Utile quand les libellés sont nombreux/longs (ex. objectifs de course).
   */
  scrollable?: boolean;
};

/** Sélecteur segmenté (thème, unités, sexe, objectif…). */
export function Segment<T extends string>({
  options,
  value,
  onChange,
  label,
  scrollable = false,
}: SegmentProps<T>) {
  const { colors } = useTheme();

  const items = options.map((option) => {
    const selected = value === option;
    return (
      <Pressable
        key={option}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onChange(option)}
        style={[
          scrollable ? styles.itemScrollable : styles.item,
          selected && { backgroundColor: colors.accent },
        ]}
      >
        <Text style={[styles.label, { color: selected ? colors.accentText : colors.text }]}>
          {label(option)}
        </Text>
      </Pressable>
    );
  });

  const surface = { backgroundColor: colors.surface, borderColor: colors.border };

  if (scrollable) {
    // La disposition (ligne + gap + padding) vient de `contentContainerStyle` ;
    // le `style` du ScrollView ne porte que le cadre (bordure/rayon/fond).
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={[styles.viewport, surface]}
      >
        {items}
      </ScrollView>
    );
  }

  return <View style={[styles.segment, surface]}>{items}</View>;
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 4, gap: 4 },
  viewport: { borderRadius: 16, borderWidth: 1 },
  scrollContent: { flexDirection: 'row', padding: 4, gap: 4 },
  item: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  itemScrollable: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  label: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
});

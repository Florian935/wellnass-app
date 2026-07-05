import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type SegmentProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: (option: T) => string;
};

/** Sélecteur segmenté (thème, unités, sexe, objectif…). */
export function Segment<T extends string>({ options, value, onChange, label }: SegmentProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {options.map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={[styles.item, selected && { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.label, { color: selected ? colors.accentText : colors.text }]}>
              {label(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 4, gap: 4 },
  item: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  label: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
});

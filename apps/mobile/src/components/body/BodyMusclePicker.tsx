import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FINE_MUSCLES, type FineMuscle } from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function BodyMusclePicker({ selected, onSelect }: { selected: FineMuscle | null; onSelect: (muscle: FineMuscle) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>{t('bodyExplorer.muscles')}</Text>
      <View style={styles.list}>
        {FINE_MUSCLES.map((muscle) => {
          const active = muscle === selected;
          return (
            <Pressable key={muscle} accessibilityRole="button" accessibilityLabel={t(`muscleFine.${muscle}`)} accessibilityState={{ selected: active }} onPress={() => onSelect(muscle)}
              style={[styles.chip, { backgroundColor: active ? colors.accent : colors.surface, borderColor: active ? colors.accent : colors.borderStrong }]}>
              <Text style={[styles.label, { color: active ? colors.accentText : colors.text }]}>{t(`muscleFine.${muscle}`)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  heading: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  list: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { minHeight: 44, borderRadius: 14, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, justifyContent: 'center' },
  label: { fontFamily: fontFamily.bodyMedium, fontSize: 14 },
});

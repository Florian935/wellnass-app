import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PILLARS, UNIT_SYSTEMS, type Pillar } from '@wellness/shared';
import { useSettingsStore } from '@/stores/settings-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const THEME_OPTIONS = ['system', 'light', 'dark'] as const;

type SegmentProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: (option: T) => string;
};

function Segment<T extends string>({ options, value, onChange, label }: SegmentProps<T>) {
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
            style={[styles.segmentItem, selected && { backgroundColor: colors.accent }]}
          >
            <Text
              style={[styles.segmentLabel, { color: selected ? colors.accentText : colors.text }]}
            >
              {label(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const activePillars = useSettingsStore((s) => s.activePillars);
  const togglePillar = useSettingsStore((s) => s.togglePillar);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const units = useSettingsStore((s) => s.units);
  const setUnits = useSettingsStore((s) => s.setUnits);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {/* Piliers actifs (décision H) */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
        {t('settings.pillars.title')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {PILLARS.map((pillar: Pillar, i) => (
          <View
            key={pillar}
            style={[
              styles.row,
              i < PILLARS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t(`pillars.${pillar}`)}</Text>
            <Switch
              value={activePillars.includes(pillar)}
              onValueChange={() => togglePillar(pillar)}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor="#ffffff"
              accessibilityLabel={t(`pillars.${pillar}`)}
            />
          </View>
        ))}
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('settings.pillars.hint')}</Text>

      {/* Apparence (thème) */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.appearance.title')}
      </Text>
      <Segment
        options={THEME_OPTIONS}
        value={theme}
        onChange={setTheme}
        label={(option) => t(`settings.appearance.${option}`)}
      />

      {/* Unités (item 1.15) */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.units.title')}
      </Text>
      <Segment
        options={UNIT_SYSTEMS}
        value={units}
        onChange={setUnits}
        label={(option) => t(`settings.units.${option}`)}
      />
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('settings.units.hint')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  sectionTitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  hint: { fontFamily: fontFamily.body, fontSize: 13, marginTop: 8, lineHeight: 18 },
  segment: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  segmentLabel: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
});

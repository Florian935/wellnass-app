import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PILLARS, type Pillar } from '@wellness/shared';
import { useSettingsStore } from '@/stores/settings-store';
import { useTheme } from '@/theme/useTheme';

const THEME_OPTIONS = ['system', 'light', 'dark'] as const;

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const activePillars = useSettingsStore((s) => s.activePillars);
  const togglePillar = useSettingsStore((s) => s.togglePillar);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

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
      <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {THEME_OPTIONS.map((option) => {
          const selected = theme === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setTheme(option)}
              style={[styles.segmentItem, selected && { backgroundColor: colors.accent }]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  { color: selected ? colors.accentText : colors.text },
                ]}
              >
                {t(`settings.appearance.${option}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
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
  rowLabel: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, marginTop: 8, lineHeight: 18 },
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
  segmentLabel: { fontSize: 15, fontWeight: '700' },
});

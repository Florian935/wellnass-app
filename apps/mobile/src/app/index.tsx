import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useSettingsStore } from '@/stores/settings-store';

export default function HomeScreen() {
  const { t } = useTranslation();
  const activePillars = useSettingsStore((s) => s.activePillars);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('home.title')}</Text>
        <Text style={styles.subtitle}>{t('home.subtitle')}</Text>

        <View style={styles.pillarRow}>
          {activePillars.map((pillar) => (
            <View key={pillar} style={styles.pillarChip}>
              <Text style={styles.pillarLabel}>{t(`pillars.${pillar}`)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.notice}>{t('home.scaffoldNotice')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 16, opacity: 0.7, textAlign: 'center' },
  pillarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  pillarChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(32, 138, 239, 0.12)',
  },
  pillarLabel: { fontSize: 14, fontWeight: '600', color: '#208AEF' },
  notice: { fontSize: 13, opacity: 0.5, textAlign: 'center', marginTop: 8 },
});

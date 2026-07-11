import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { SyncStatus } from '@/components/SyncStatus';
import { TodaySessionCard } from '@/components/dashboard/TodaySessionCard';
import { NutritionSummaryCard } from '@/components/dashboard/NutritionSummaryCard';
import { StreakCard } from '@/components/dashboard/StreakCard';
import { WeightCard } from '@/components/dashboard/WeightCard';
import { PILLARS } from '@wellness/shared';
import { useProfile } from '@/data/repositories/profile-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { settings } = useSettings();
  // Tant que les réglages ne sont pas chargés, on suppose tous les piliers actifs.
  const activePillars = settings?.activePillars ?? [...PILLARS];
  const { profile } = useProfile();
  const firstName = profile?.firstName ?? '';

  const greeting = firstName ? t('home.greetingName', { name: firstName }) : t('home.greeting');

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTexts}>
          <Text style={[styles.hello, { color: colors.textMuted }]}>{greeting}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{t('common.appName')}</Text>
          <SyncStatus />
        </View>
        <Link href="/settings" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.title')}
            hitSlop={10}
            style={StyleSheet.flatten([
              styles.iconBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ])}
          >
            <Ionicons name="person-circle-outline" size={26} color={colors.text} />
          </Pressable>
        </Link>
      </View>

      <ScrollView contentContainerStyle={styles.blocks} showsVerticalScrollIndicator={false}>
        {/* 1. Séance du jour — pilier musculation */}
        {activePillars.includes('strength') ? <TodaySessionCard /> : null}

        {/* 2. Résumé nutritionnel — pilier nutrition */}
        {activePillars.includes('nutrition') ? <NutritionSummaryCard /> : null}

        {/* 3. Régularité / streak — toujours affiché */}
        <StreakCard />

        {/* 4. Poids corporel — pilier nutrition (H4) */}
        {activePillars.includes('nutrition') ? <WeightCard /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTexts: { gap: 4 },
  hello: { fontFamily: fontFamily.bodyMedium, fontSize: 14 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 28, letterSpacing: -0.8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blocks: { gap: 14, paddingBottom: 24 },
});

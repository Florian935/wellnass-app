import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { useSettingsStore } from '@/stores/settings-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Bloc du tableau de bord : en-tête (icône + titre) puis contenu (état vide structuré). */
function DashboardCard({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={18} color={colors.accent} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const activePillars = useSettingsStore((s) => s.activePillars);

  const weekDays = t('home.streak.days', { returnObjects: true }) as string[];

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.hello, { color: colors.textMuted }]}>{t('home.greeting')}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{t('common.appName')}</Text>
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
        {/* Séance du jour */}
        <DashboardCard icon="calendar-outline" title={t('home.today.title')}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('home.today.empty')}
          </Text>
        </DashboardCard>

        {/* Régularité / streak (motivation — conservé) */}
        <DashboardCard icon="flame-outline" title={t('home.streak.title')}>
          <Text style={[styles.streakValue, { color: colors.text }]}>
            {t('home.streak.count', { count: 0 })}
          </Text>
          <View style={styles.weekRow}>
            {weekDays.map((day, i) => (
              <View key={`${day}-${i}`} style={styles.dayCol}>
                <View style={[styles.dayDot, { borderColor: colors.border }]} />
                <Text style={[styles.dayLabel, { color: colors.textMuted }]}>{day}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('home.streak.empty')}
          </Text>
        </DashboardCard>

        {/* Nutrition — seulement si le pilier est activé */}
        {activePillars.includes('nutrition') ? (
          <DashboardCard icon="nutrition-outline" title={t('home.nutrition.title')}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {t('home.nutrition.empty')}
            </Text>
          </DashboardCard>
        ) : null}
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.3 },
  emptyText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  streakValue: { fontFamily: fontFamily.displayBold, fontSize: 24, letterSpacing: -0.5 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 6 },
  dayDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
  dayLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 12 },
});

/**
 * Widget 7.10 — Résumé running de la semaine.
 *
 * Distance parcourue + nombre de séances de la semaine courante (lundi→dimanche,
 * minuit local), et objectif de séances (`weeklyFrequency`) s'il est défini.
 * Gardé par le pilier `running` en amont (cf. dashboard).
 *
 * États :
 *  - `count === 0` : état vide (`home.runningWeek.empty`).
 *  - Sinon         : distance formatée + « N séances » (ou « N / objectif séances »)
 *                    + lien « Historique → ».
 *
 * Formatage :
 *  - Distance via `useUnits().formatDistance(totalDistanceM / 1000)`.
 *  - Séances : `sessionsGoal` (count / goal) si `weeklyFrequency` défini, sinon
 *    `sessions` (count seul). **Objectif de distance hebdo : différé** (spec §6).
 *
 * Routing : lien → `/running-history` (Historique).
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WidgetSize } from '@wellness/shared';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardCardCompact } from '@/components/dashboard/DashboardCardCompact';
import { useRunStats } from '@/data/repositories/run-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function RunningWeekCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();

  const { stats, isLoading: statsLoading } = useRunStats('week');
  const { runnerProfile, isLoading: profileLoading } = useRunnerProfile();

  if (statsLoading || profileLoading) return null;

  // ── Variante compacte (US 7.11) : distance + séances ───────────────────────
  if (size === 'small') {
    const goal = runnerProfile?.weeklyFrequency ?? null;
    const sessions =
      goal != null
        ? t('home.runningWeek.sessionsGoal', { count: stats.count, goal })
        : t('home.runningWeek.sessions', { count: stats.count });
    const value =
      stats.count === 0
        ? t('home.runningWeek.empty')
        : `${units.formatDistance(stats.totalDistanceM / 1000)} · ${sessions}`;
    return (
      <DashboardCardCompact
        icon="walk-outline"
        title={t('home.runningWeek.title')}
        value={value}
      />
    );
  }

  // ── État : aucune course cette semaine ─────────────────────────────────────
  if (stats.count === 0) {
    return (
      <DashboardCard icon="walk-outline" title={t('home.runningWeek.title')}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t('home.runningWeek.empty')}
        </Text>
      </DashboardCard>
    );
  }

  // ── État : données présentes ───────────────────────────────────────────────
  const goal = runnerProfile?.weeklyFrequency ?? null;
  const sessionsLabel =
    goal != null
      ? t('home.runningWeek.sessionsGoal', { count: stats.count, goal })
      : t('home.runningWeek.sessions', { count: stats.count });

  return (
    <DashboardCard icon="walk-outline" title={t('home.runningWeek.title')}>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {units.formatDistance(stats.totalDistanceM / 1000)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('home.runningWeek.distance')}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.text }]}>{sessionsLabel}</Text>
        </View>
      </View>

      <View style={styles.linkRow}>
        <Pressable
          onPress={() => router.push('/running-history')}
          hitSlop={8}
          accessibilityRole="link"
        >
          <Text style={[styles.link, { color: colors.accent }]}>
            {t('home.runningWeek.link')}
          </Text>
        </Pressable>
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  emptyText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 24 },
  stat: { gap: 2 },
  statValue: { fontFamily: fontFamily.monoBold, fontSize: 22, letterSpacing: -0.5 },
  statLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  linkRow: { alignItems: 'flex-end' },
  link: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
});

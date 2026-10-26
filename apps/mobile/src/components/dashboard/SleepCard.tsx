/**
 * US ACCUEIL-08 — **le repère « Sommeil »** de « Tes repères ».
 *
 * La nuit qui précède ce matin (check-in ou Health Connect, `daily_wellbeing.sleep_minutes`) et la
 * courbe des sept dernières nuits. Gardé par le pilier Bien-être (opt-in) dans le registre : sans
 * lui, la tuile ne s'affiche pas. Un appui ouvre le pilier.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatHoursMinutes, type WidgetSize } from '@wellness/shared';
import { Eyebrow, Metric, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { Sparkline } from '@/components/widgets/primitives';
import { useWellbeingEntries } from '@/data/repositories/daily-wellbeing-repository';
import { useTodayKey, useWindowStartKey } from '@/hooks/useTodayKey';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Les nuits de la courbe. */
const SLEEP_WINDOW_DAYS = 7;

export function SleepCard({ size = 'small' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const todayKey = useTodayKey();
  const since = useWindowStartKey(SLEEP_WINDOW_DAYS);
  const { entries } = useWellbeingEntries(since);

  const nights = entries
    .filter((e) => e.sleepMinutes != null && e.sleepMinutes > 0)
    .sort((a, b) => a.logDate.localeCompare(b.logDate));
  const tonight = nights.find((e) => e.logDate === todayKey)?.sleepMinutes ?? null;
  const value = tonight != null ? formatHoursMinutes(tonight * 60) : t('home.reperes.sleep.none');
  const open = () => router.push('/(tabs)/wellbeing-hub');

  return (
    <WidgetFrame
      pad={size === 'small' ? 16 : 18}
      onPress={open}
      accessibilityLabel={t('home.reperes.sleep.a11y', { value })}
    >
      <View style={styles.col}>
        <Eyebrow>{t('home.reperes.sleep.title')}</Eyebrow>
        <Metric value={value} muted={tonight == null} />
        <Sparkline values={nights.map((n) => n.sleepMinutes ?? 0)} height={22} color={colors.pillarWellbeing} />
        <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
          {t('home.reperes.sleep.sub')}
        </Text>
      </View>
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  col: { gap: 6 },
  sub: { fontFamily: fontFamily.body, fontSize: 11.5 },
});

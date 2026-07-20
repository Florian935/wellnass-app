/**
 * Widget 7.6 — Régularité (streak).
 *
 * États :
 *  - `current > 0`  : grand nombre + "jours d'affilée" + 7 pastilles semaine
 *  - `current === 0`: nombre muted + texte `home.streak.empty` + 7 pastilles semaine
 *
 * Pastille : active → couleur accent ; isToday → contour accent (anneau).
 * Labels des jours : `home.streak.days` (tableau ["L","M","M","J","V","S","D"]).
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WidgetSize } from '@wellness/shared';
import { DashboardCard } from '@/components/DashboardCard';
import { WidgetShell } from '@/components/widgets/WidgetShell';
import { useStreakData } from '@/data/repositories/dashboard-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function StreakCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { current, last7, isLoading } = useStreakData();

  if (isLoading) return null;

  const isEmpty = current === 0;

  // ── Forme petit carré : « N j » (remplit la case) ──────────────────────────
  if (size === 'small') {
    return (
      <WidgetShell
        icon="flame-outline"
        title={t('home.streak.title')}
        value={t('home.streak.compact', { count: current })}
        valueMuted={isEmpty}
      />
    );
  }

  const weekDays = t('home.streak.days', { returnObjects: true }) as string[];

  const body = (
    <>
      {/* Nombre de jours + label */}
      <View style={styles.streakTop}>
        <Text
          style={[
            styles.streakNum,
            { color: isEmpty ? colors.textMuted : colors.text },
          ]}
        >
          {current}
        </Text>
        <Text style={[styles.streakWord, { color: colors.textMuted }]}>
          {isEmpty
            ? t('home.streak.empty')
            : t('home.streak.suffix', { count: current })}
        </Text>
      </View>

      {/* 7 pastilles semaine */}
      <View style={styles.weekRow}>
        {last7.map((day, i) => (
          <View key={day.key} style={styles.dayCol}>
            <View
              style={[
                styles.pill,
                { backgroundColor: day.active ? colors.accent : colors.surfaceAlt },
                day.isToday && {
                  shadowColor: colors.accent,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 1,
                  shadowRadius: 0,
                  // Anneau via borderColor (ring effect)
                  borderWidth: 2,
                  borderColor: colors.accent,
                  // Si actif ET aujourd'hui : fond accent avec anneau visible via
                  // un léger offset de couleur de fond.
                  backgroundColor: day.active ? colors.accent : colors.surfaceAlt,
                },
              ]}
            />
            <Text style={[styles.dayLabel, { color: colors.textMuted }]}>
              {weekDays[i] ?? ''}
            </Text>
          </View>
        ))}
      </View>
    </>
  );

  // ── Forme grand carré : même visuel, remplit la case ───────────────────────
  if (size === 'large') {
    return (
      <WidgetShell icon="flame-outline" title={t('home.streak.title')}>
        {body}
      </WidgetShell>
    );
  }

  // ── Forme rectangle (défaut) ───────────────────────────────────────────────
  return (
    <DashboardCard icon="flame-outline" title={t('home.streak.title')}>
      {body}
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  streakTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  streakNum: { fontFamily: fontFamily.monoBold, fontSize: 30, letterSpacing: -0.5 },
  streakWord: { fontFamily: fontFamily.body, fontSize: 14, flex: 1 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { flex: 1, alignItems: 'center', gap: 6 },
  pill: { width: 30, aspectRatio: 1, borderRadius: 9 },
  dayLabel: { fontFamily: fontFamily.bodySemi, fontSize: 11 },
});

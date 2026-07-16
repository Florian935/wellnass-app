/**
 * Widget MR-06 — Temps d'entraînement (inter-piliers muscu + course).
 *
 * Temps total de la semaine ISO courante (lundi→dimanche) + ventilation muscu / course.
 * Gardé par les piliers `strength` OU `running` en amont (registre dashboard). La ventilation
 * n'affiche que les piliers actifs ; « 0h 00 » / état vide si aucune séance ni course.
 *
 * Formatage : `formatHoursMinutes` (« Xh YY »), composé en JS (pas d'interpolation i18n).
 */

import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatHoursMinutes, type WidgetSize } from '@wellness/shared';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardCardCompact } from '@/components/dashboard/DashboardCardCompact';
import { useTrainingTime } from '@/data/repositories/dashboard-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function TrainingTimeCard({ size = 'full' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const tt = useTrainingTime();
  if (tt.isLoading) return null;

  // Ventilation : uniquement les piliers actifs.
  const parts: string[] = [];
  if (tt.strengthActive) {
    parts.push(`${t('home.trainingTime.breakdownStrength')} ${formatHoursMinutes(tt.strengthSeconds)}`);
  }
  if (tt.runningActive) {
    parts.push(`${t('home.trainingTime.breakdownRunning')} ${formatHoursMinutes(tt.runningSeconds)}`);
  }
  // Ventilation affichée seulement si les DEUX piliers sont actifs : avec un seul,
  // la ligne répéterait le total (ex. total « 4h 30 » puis « muscu 4h 30 »).
  const breakdown = parts.length >= 2 ? parts.join(' · ') : '';

  // ── Variante compacte (US 7.11) ────────────────────────────────────────────
  if (size === 'compact') {
    const value =
      tt.totalSeconds === 0 ? t('home.trainingTime.empty') : formatHoursMinutes(tt.totalSeconds);
    return (
      <DashboardCardCompact
        icon="time-outline"
        title={t('home.trainingTime.title')}
        value={value}
      />
    );
  }

  // ── État vide : aucune séance ni course cette semaine ──────────────────────
  if (tt.totalSeconds === 0) {
    return (
      <DashboardCard icon="time-outline" title={t('home.trainingTime.title')}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t('home.trainingTime.empty')}
        </Text>
      </DashboardCard>
    );
  }

  // ── État : données présentes ───────────────────────────────────────────────
  return (
    <DashboardCard icon="time-outline" title={t('home.trainingTime.title')}>
      <Text style={[styles.total, { color: colors.text }]}>
        {formatHoursMinutes(tt.totalSeconds)}
      </Text>
      {breakdown.length > 0 ? (
        <Text style={[styles.breakdown, { color: colors.textMuted }]}>{breakdown}</Text>
      ) : null}
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  emptyText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  total: { fontFamily: fontFamily.monoBold, fontSize: 26, letterSpacing: -0.5 },
  breakdown: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginTop: 2 },
});

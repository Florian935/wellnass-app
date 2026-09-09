/**
 * US RUN-F4 (lot H) — l'échéance d'un bloc de préparation : « J-42 », l'objectif chrono, et où
 * l'on en est dans le plan.
 *
 * Répond au mur M12 de l'analyse du 04/09/2026. Le calendrier existait déjà
 * (`planned_sessions.scheduled_date` + `week_index`) : **il manquait l'ancre**, pas le
 * calendrier. Sans elle, RUN-14 savait *prédire* un temps de course et la 5.31 *recaler*
 * l'allure de référence, mais on ne pouvait nulle part écrire « ma course est le 25/10 et je
 * vise 20:00 ».
 *
 * Rend `null` sans échéance — et c'est le cas de la majorité des programmes (« Reprise en
 * douceur »). Surtout pas un « J-0 » par défaut.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { blockProgress, formatMmSs, raceCountdown } from '@wellness/shared';
import { Card } from '@/components/Card';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  targetDate: string | null;
  targetTimeSeconds: number | null;
  eventName: string | null;
  /** Statuts des séances planifiées du programme — pour le taux de réalisation. */
  sessionStatuses?: readonly ('planned' | 'done' | 'skipped')[];
  todayKey: string;
};

export function RaceCountdownCard({
  targetDate,
  targetTimeSeconds,
  eventName,
  sessionStatuses,
  todayKey,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const countdown = raceCountdown(targetDate, todayKey);
  if (countdown === null) return null;

  const progress = sessionStatuses ? blockProgress(sessionStatuses) : null;

  // Trois états, trois phrases : la course est passée, c'est aujourd'hui, ou il reste N jours.
  const headline = countdown.isPast
    ? t('running.prepa.past')
    : countdown.isToday
      ? t('running.prepa.today')
      : t('running.prepa.countdown', { count: countdown.daysRemaining });

  return (
    <Card>
      <Text style={[styles.title, { color: colors.textMuted }]}>
        {t('running.prepa.title')}
      </Text>

      <View style={styles.headlineRow}>
        <Text style={[styles.headline, { color: colors.text }]}>{headline}</Text>
        {/* L'affûtage est une information d'entraînement, pas une alerte : teinte d'accent. */}
        {countdown.isTaperWeek && !countdown.isPast ? (
          <Text style={[styles.taper, { color: colors.accent }]}>
            {t('running.prepa.taperWeek')}
          </Text>
        ) : null}
      </View>

      {eventName ? (
        <Text style={[styles.line, { color: colors.text }]}>{eventName}</Text>
      ) : null}

      {targetTimeSeconds != null ? (
        <Text style={[styles.line, { color: colors.textMuted }]}>
          {t('running.prepa.targetTime')} : {formatMmSs(targetTimeSeconds)}
        </Text>
      ) : null}

      {/* Semaines restantes : redondant avec « J-42 » quand l'échéance est proche, utile quand
          elle est lointaine (« 7 semaines » se se projette mieux que « 50 jours »). */}
      {!countdown.isPast && countdown.weeksRemaining > 0 ? (
        <Text style={[styles.line, { color: colors.textMuted }]}>
          {t('running.prepa.weeksRemaining', { count: countdown.weeksRemaining })}
        </Text>
      ) : null}

      {/* Taux de réalisation : les séances SAUTÉES comptent au dénominateur, jamais au
          numérateur — un indicateur flatteur serait un indicateur inutile. */}
      {progress && progress.ratio != null ? (
        <Text style={[styles.line, { color: colors.textMuted }]}>
          {t('running.prepa.progress', {
            done: progress.doneCount,
            total: progress.plannedCount,
          })}{' '}
          ·{' '}
          {t('running.prepa.progressRatio', { value: Math.round(progress.ratio * 100) })}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  headlineRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  headline: { fontFamily: fontFamily.bodyBold, fontSize: 20 },
  taper: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  line: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, marginTop: 2 },
});

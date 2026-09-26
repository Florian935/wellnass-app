/**
 * « Ton programme », sur Courir — US CARDIO-UX03, D8, R11 (Q9).
 *
 * Le compte à rebours de la course et l'objectif chrono (RUN-F4 lot H) ne vivaient que dans la fiche
 * du programme : annuaire, Programmes, le programme — trois gestes pour savoir « J-combien ». Ici :
 *  - le nom, « semaine X sur N · D séances sur T » et la barre d'avancement ;
 *  - l'échéance (`raceCountdown`, les libellés de la fiche : `running.prepa.*`) ;
 *  - l'objectif **face à** ton record sur cette distance, sinon à l'estimation du jour depuis ton
 *    record 5 km (`raceObjective`). **Sans couleur ni commentaire** : c'est la décision Q9 de Florian.
 *    Un chiffre qui peut décourager n'a pas besoin d'un feu rouge en plus.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatMmSs, raceCountdown, raceObjective, type RecordDistanceKey } from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import type { RunProgramData } from '@/data/repositories/run-hub-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  programName: string;
  data: RunProgramData;
  records: readonly { distanceKey: RecordDistanceKey; bestTimeSeconds: number }[];
  todayKey: string;
  onPress: () => void;
};

export function RunProgramCard({ programName, data, records, todayKey, onPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { progress, race } = data;

  const countdown = race ? raceCountdown(race.targetDate, todayKey) : null;
  const objective =
    race && countdown && !countdown.isPast
      ? raceObjective({ targetTimeSeconds: race.targetTimeSeconds, raceDistanceM: race.raceDistanceM, records })
      : null;

  const headline = countdown
    ? countdown.isPast
      ? t('running.prepa.past')
      : countdown.isToday
        ? t('running.prepa.today')
        : t('running.prepa.countdown', { count: countdown.daysRemaining })
    : null;
  const raceDate = race
    ? (() => {
        const [, mm, dd] = race.targetDate.split('-');
        return `${dd}/${mm}`;
      })()
    : null;

  return (
    <PressableScale
      testID="run-program-card"
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.eyebrow, { color: colors.accent }]}>{t('runningHub.program.title')}</Text>

      <View style={styles.headRow}>
        <View style={styles.headTexts}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
            {programName}
          </Text>
          {progress ? (
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {t('runningHub.program.progress', {
                week: progress.week,
                total: progress.totalWeeks,
                done: progress.done,
                count: progress.total,
              })}
            </Text>
          ) : null}
        </View>
        {headline ? (
          <View style={styles.countdown} testID="run-program-countdown">
            <Text style={[styles.countdownValue, { color: colors.accent }]}>{headline}</Text>
            <Text style={[styles.countdownMeta, { color: colors.textMuted }]} numberOfLines={1}>
              {[race?.eventName, raceDate].filter(Boolean).join(' · ')}
            </Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        )}
      </View>

      {progress ? (
        <View style={[styles.track, { backgroundColor: colors.track }]}>
          <View
            style={[styles.fill, { width: `${Math.round(progress.ratio * 100)}%`, backgroundColor: colors.accent }]}
          />
        </View>
      ) : null}

      {objective ? (
        <View style={[styles.objective, { backgroundColor: colors.surfaceAlt }]} testID="run-program-objective">
          <View style={styles.objectiveCol}>
            <Text style={[styles.objectiveLabel, { color: colors.textMuted }]}>
              {t('runningHub.program.objective')}
            </Text>
            <Text style={[styles.objectiveValue, { color: colors.text }]}>{formatMmSs(objective.targetSeconds)}</Text>
          </View>
          {objective.compareSeconds != null && objective.compareKind ? (
            <View style={styles.objectiveCol}>
              <Text style={[styles.objectiveLabel, { color: colors.textMuted }]}>
                {t(`runningHub.program.${objective.compareKind}`)}
              </Text>
              <Text style={[styles.objectiveValue, { color: colors.text }]}>
                {formatMmSs(objective.compareSeconds)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 12 },
  eyebrow: { fontFamily: fontFamily.monoBold, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  headTexts: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.displayXBold, fontSize: 20, letterSpacing: -0.4 },
  meta: { fontFamily: fontFamily.body, fontSize: 13 },
  countdown: { alignItems: 'flex-end', maxWidth: '45%' },
  countdownValue: { fontFamily: fontFamily.displayXBold, fontSize: 26, letterSpacing: -0.8 },
  countdownMeta: { fontFamily: fontFamily.body, fontSize: 12 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  objective: { flexDirection: 'row', gap: 10, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  objectiveCol: { flex: 1, gap: 1 },
  objectiveLabel: { fontFamily: fontFamily.bodySemi, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  objectiveValue: { fontFamily: fontFamily.monoBold, fontSize: 17 },
});

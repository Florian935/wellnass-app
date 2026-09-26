/**
 * « La dernière fois », dans la carte de la séance du jour — US CARDIO-UX03, D3, §4.2.1, R3 et R4.
 *
 * Avant ses 6 × 400, le coureur veut savoir en combien il les avait passés : c'était enregistré
 * répétition par répétition (`run_intervals`) et montré nulle part avant le départ.
 *
 *  - **avec des fractions** : une pastille par répétition du corps de séance — son temps quand elle
 *    est bornée en distance, son allure quand elle l'est en durée — pleine dans la plage, cerclée
 *    hors plage, neutre sans plage ; puis « 5 sur 6 dans la plage » ;
 *  - **sans fraction** (sortie longue, endurance) : « distance · durée · allure · ressenti ».
 *
 * La course retenue (`pickRunLastTime`) est choisie par l'appelant ; ce composant ne lit que ses
 * fractions.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  feelingFromStoredRpe,
  formatDurationHms,
  formatPaceMMSS,
  lastTimeReps,
  repsInRange,
  type LastTimeRep,
} from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { useRunIntervals, type RunHistoryItem } from '@/data/repositories/run-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Au-delà, les pastilles passeraient sur trois lignes : les 12 premières, puis « +N ». */
const MAX_CHIPS = 12;

type Props = {
  run: RunHistoryItem;
  match: 'session' | 'type';
  onOpen: () => void;
};

export function RunLastTime({ run, match, onOpen }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const { intervals } = useRunIntervals(run.id);

  const reps = lastTimeReps(intervals);
  const rated = repsInRange(reps);
  const shown = reps.slice(0, MAX_CHIPS);
  const more = reps.length - shown.length;

  const date = new Date(run.finishedAt ?? run.startedAt);
  const dow = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(date).replace('.', '');
  const dateLabel = `${dow} ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;

  const repValue = (rep: LastTimeRep) =>
    rep.seconds == null ? '—' : rep.kind === 'time' ? formatPaceMMSS(rep.seconds, '—') : units.formatPace(rep.seconds);

  const feeling = feelingFromStoredRpe(run.rpe);
  const summary = [
    run.distanceM != null ? units.formatDistance(run.distanceM / 1000) : null,
    run.durationSeconds != null ? formatDurationHms(run.durationSeconds) : null,
    run.avgPaceSPerKm != null ? units.formatPace(run.avgPaceSPerKm) : null,
    feeling ? t(`workout.summary.feeling.${feeling}`) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View testID="run-last-time" style={[styles.box, { backgroundColor: colors.surfaceAlt }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.textMuted }]} numberOfLines={1}>
          {t('runningHub.lastTime.titleOn', { date: dateLabel.toUpperCase() })}
        </Text>
        <Text style={[styles.tag, { color: colors.textMuted }]}>
          {t(match === 'session' ? 'runningHub.lastTime.sameSession' : 'runningHub.lastTime.sameType')}
        </Text>
      </View>

      {reps.length > 0 ? (
        <>
          <View style={styles.chips}>
            {shown.map((rep) => {
              const value = repValue(rep);
              return (
                <View
                  key={rep.rep}
                  testID={`last-time-rep-${rep.rep}`}
                  accessible
                  accessibilityLabel={t('runningHub.lastTime.repA11y', {
                    rep: rep.rep,
                    value,
                    state: t(`runningHub.lastTime.state.${rep.state}`),
                  })}
                  style={[
                    styles.chip,
                    rep.state === 'in'
                      ? { backgroundColor: colors.accent, borderColor: colors.accent }
                      : rep.state === 'out'
                        ? { backgroundColor: colors.surface, borderColor: colors.borderStrong }
                        : { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.chipRep, { color: rep.state === 'in' ? colors.accentText : colors.textMuted }]}>
                    {rep.rep}
                  </Text>
                  <Text style={[styles.chipValue, { color: rep.state === 'in' ? colors.accentText : colors.text }]}>
                    {value}
                  </Text>
                </View>
              );
            })}
            {more > 0 ? (
              <View style={[styles.chip, styles.moreChip, { borderColor: colors.border }]}>
                <Text style={[styles.chipValue, { color: colors.textMuted }]}>
                  {t('runningHub.lastTime.more', { count: more })}
                </Text>
              </View>
            ) : null}
          </View>
          {rated ? (
            <Text style={[styles.line, { color: colors.text }]}>
              {t('runningHub.lastTime.inRange', { done: rated.done, total: rated.total })}
            </Text>
          ) : null}
        </>
      ) : summary ? (
        <Text style={[styles.summary, { color: colors.text }]}>{summary}</Text>
      ) : null}

      <PressableScale
        testID="run-last-time-open"
        onPress={onOpen}
        accessibilityRole="button"
        style={styles.open}
      >
        <Text style={[styles.openLabel, { color: colors.accent }]}>{t('runningHub.lastTime.open')}</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.accent} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 14, padding: 12, gap: 9 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1, fontFamily: fontFamily.monoBold, fontSize: 10.5, letterSpacing: 1.1 },
  tag: { fontFamily: fontFamily.body, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: {
    minWidth: 48,
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: 1.5,
    paddingHorizontal: 6,
    paddingVertical: 5,
    gap: 1,
  },
  moreChip: { justifyContent: 'center' },
  chipRep: { fontFamily: fontFamily.mono, fontSize: 9.5 },
  chipValue: { fontFamily: fontFamily.monoBold, fontSize: 13 },
  line: { fontFamily: fontFamily.bodyMedium, fontSize: 13 },
  summary: { fontFamily: fontFamily.mono, fontSize: 13, lineHeight: 19 },
  open: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  openLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
});
